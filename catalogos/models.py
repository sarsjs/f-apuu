from decimal import Decimal, ROUND_HALF_UP

from django.core.validators import MinValueValidator
from django.db import models


class ConstantesFASAR(models.Model):
    """Configuracion editable para el calculo del FASAR (singleton)."""

    singleton_id = 1

    dias_del_anio = models.PositiveIntegerField(default=365)
    dias_festivos_obligatorios = models.DecimalField(
        max_digits=6, decimal_places=2, default=Decimal("7.0")
    )
    dias_riesgo_trabajo_promedio = models.DecimalField(
        max_digits=6, decimal_places=2, default=Decimal("1.5")
    )
    dias_vacaciones_minimos = models.PositiveIntegerField(default=12)
    prima_vacacional_porcentaje = models.DecimalField(
        max_digits=4, decimal_places=2, default=Decimal("0.25")
    )
    dias_aguinaldo_minimos = models.PositiveIntegerField(default=15)
    suma_cargas_sociales = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=Decimal("0.15"),
        help_text="Sumatoria de las cargas sociales patronales (IMSS, INFONAVIT, etc.).",
    )

    class Meta:
        verbose_name = "Constantes FASAR"
        verbose_name_plural = "Constantes FASAR"

    def save(self, *args, **kwargs):
        """Fuerza a que solo exista un registro persistiendo siempre con la misma PK."""

        self.pk = self.singleton_id
        super().save(*args, **kwargs)

    @classmethod
    def obtener_constantes(cls) -> "ConstantesFASAR":
        """Obtiene el registro unico, creandolo si aun no existe."""

        constantes, _ = cls.objects.get_or_create(pk=cls.singleton_id)
        return constantes


class Material(models.Model):
    """Catalogo de materiales basicos utilizados en los conceptos."""

    nombre = models.CharField(max_length=255, unique=True)
    unidad = models.CharField(max_length=50)
    precio_unitario = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0000"))],
        help_text="Costo del material por unidad (moneda base).",
    )
    fecha_actualizacion = models.DateField(
        help_text="Fecha de la ultima actualizacion del precio unitario."
    )

    class Meta:
        ordering = ["nombre"]

    def __str__(self) -> str:
        return self.nombre


class Equipo(models.Model):
    """Catalogo de maquinaria o equipo auxiliar."""

    nombre = models.CharField(max_length=255)
    unidad = models.CharField(max_length=50)
    costo_hora_maq = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0000"))],
        help_text="Costo horario equivalente por maquina.",
    )

    class Meta:
        ordering = ["nombre"]
        unique_together = ("nombre", "unidad")

    def __str__(self) -> str:
        return self.nombre


class ManoObra(models.Model):
    """Catalogo de puestos de trabajo incluyendo calculo automatico del FASAR."""

    puesto = models.CharField(max_length=255)
    salario_base = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    antiguedad_anios = models.PositiveIntegerField(default=1)
    fasar = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        editable=False,
        help_text="Factor de Salario Real calculado automaticamente.",
    )

    class Meta:
        ordering = ["puesto"]
        unique_together = ("puesto", "antiguedad_anios")

    def calcular_fasar(self) -> Decimal:
        """Calcula el FASAR usando las constantes legales configurables."""

        constantes = ConstantesFASAR.obtener_constantes()
        dias_pagados = (
            Decimal(constantes.dias_del_anio)
            + Decimal(constantes.dias_aguinaldo_minimos)
            + (
                Decimal(constantes.dias_vacaciones_minimos)
                * constantes.prima_vacacional_porcentaje
            )
        )
        dias_trabajados = (
            Decimal(constantes.dias_del_anio)
            - Decimal(constantes.dias_festivos_obligatorios)
            - Decimal(constantes.dias_vacaciones_minimos)
            - Decimal(constantes.dias_riesgo_trabajo_promedio)
        )
        if dias_trabajados <= 0:
            raise ValueError("Los dias trabajados resultaron en cero; verifique las constantes FASAR.")

        factor_dias = dias_pagados / dias_trabajados
        factor_cargas = Decimal("1.00") + constantes.suma_cargas_sociales
        fasar = factor_dias * factor_cargas
        return fasar.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    def save(self, *args, **kwargs):
        self.fasar = self.calcular_fasar()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.puesto

    @property
    def costo_unitario(self) -> Decimal:
        """Devuelve el salario real aplicado al FASAR."""

        return (self.salario_base * self.fasar).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )


class Concepto(models.Model):
    """Concepto dentro de la matriz de analisis de precio unitario."""

    clave = models.CharField(max_length=50, unique=True)
    descripcion = models.TextField()
    unidad_concepto = models.CharField(max_length=50)

    class Meta:
        ordering = ["clave"]

    def __str__(self) -> str:
        return f"{self.clave} - {self.descripcion[:40]}"


class MatrizInsumo(models.Model):
    """Relacion de insumos por concepto para integrar el precio unitario."""

    class TipoInsumo(models.TextChoices):
        MATERIAL = "Material", "Material"
        MANO_OBRA = "ManoObra", "Mano de Obra"
        EQUIPO = "Equipo", "Equipo"

    concepto = models.ForeignKey(
        Concepto,
        on_delete=models.CASCADE,
        related_name="matrix_insumos",
    )
    tipo_insumo = models.CharField(max_length=20, choices=TipoInsumo.choices)
    id_insumo = models.PositiveIntegerField(
        help_text="Identificador del insumo en su catalogo especifico."
    )
    cantidad = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text="Cantidad del insumo para producir una unidad del concepto.",
    )

    class Meta:
        unique_together = ("concepto", "tipo_insumo", "id_insumo")

    def __str__(self) -> str:
        return f"{self.concepto.clave} | {self.tipo_insumo} ({self.id_insumo})"


class Proyecto(models.Model):
    """Proyecto general que agrupa el presupuesto."""

    nombre_proyecto = models.CharField(max_length=255)
    ubicacion = models.CharField(max_length=255)
    fecha_creacion = models.DateField()

    class Meta:
        ordering = ["-fecha_creacion", "nombre_proyecto"]

    def __str__(self) -> str:
        return self.nombre_proyecto


class Partida(models.Model):
    """Partidas o capitulos de un presupuesto."""

    proyecto = models.ForeignKey(
        Proyecto,
        on_delete=models.CASCADE,
        related_name="partidas",
    )
    nombre_partida = models.CharField(max_length=255)

    class Meta:
        ordering = ["proyecto", "nombre_partida"]
        unique_together = ("proyecto", "nombre_partida")

    def __str__(self) -> str:
        return f"{self.proyecto.nombre_proyecto} - {self.nombre_partida}"


class DetallePresupuesto(models.Model):
    """Detalle de conceptos presupuestados dentro de una partida."""

    partida = models.ForeignKey(
        Partida,
        on_delete=models.CASCADE,
        related_name="detalles",
    )
    concepto = models.ForeignKey(
        Concepto,
        on_delete=models.CASCADE,
        related_name="detalles_presupuesto",
    )
    cantidad_obra = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    precio_unitario_calculado = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Precio unitario almacenado al momento de la cotizacion.",
    )

    class Meta:
        ordering = ["partida", "concepto"]
        unique_together = ("partida", "concepto")

    def save(self, *args, **kwargs):
        if self.precio_unitario_calculado is None:
            self.precio_unitario_calculado = calcular_precio_unitario(self.concepto_id)
        super().save(*args, **kwargs)

    @property
    def importe_total(self) -> Decimal:
        return (self.cantidad_obra * self.precio_unitario_calculado).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    def __str__(self) -> str:
        return f"{self.partida} | {self.concepto.clave}"


def calcular_precio_unitario(concepto_id: int) -> Decimal:
    """Calcula el precio unitario completo para un concepto."""

    insumos = MatrizInsumo.objects.filter(concepto_id=concepto_id)
    if not insumos.exists():
        return Decimal("0.0000")

    cd_base = Decimal("0.0000")
    costo_mano_obra = Decimal("0.0000")
    material_cache: dict[int, Decimal] = {}
    mano_obra_cache: dict[int, Decimal] = {}
    equipo_cache: dict[int, Decimal] = {}

    for insumo in insumos:
        costo_unitario = _obtener_costo_insumo(
            insumo.tipo_insumo,
            insumo.id_insumo,
            material_cache,
            mano_obra_cache,
            equipo_cache,
        )
        importe = insumo.cantidad * costo_unitario
        cd_base += importe
        if insumo.tipo_insumo == MatrizInsumo.TipoInsumo.MANO_OBRA:
            costo_mano_obra += importe

    herramienta_menor = costo_mano_obra * Decimal("0.03")
    cd_total = cd_base + herramienta_menor
    precio_unitario = cd_total * Decimal("1.12") * Decimal("1.02") * Decimal("1.08")
    return precio_unitario.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def _obtener_costo_insumo(
    tipo: str,
    insumo_id: int,
    material_cache: dict[int, Decimal],
    mano_obra_cache: dict[int, Decimal],
    equipo_cache: dict[int, Decimal],
) -> Decimal:
    """Obtiene y cachea el costo unitario del insumo solicitado."""

    if tipo == MatrizInsumo.TipoInsumo.MATERIAL:
        if insumo_id not in material_cache:
            material_cache[insumo_id] = Material.objects.get(pk=insumo_id).precio_unitario
        return material_cache[insumo_id]
    if tipo == MatrizInsumo.TipoInsumo.MANO_OBRA:
        if insumo_id not in mano_obra_cache:
            mano_obra_cache[insumo_id] = ManoObra.objects.get(pk=insumo_id).costo_unitario
        return mano_obra_cache[insumo_id]
    if tipo == MatrizInsumo.TipoInsumo.EQUIPO:
        if insumo_id not in equipo_cache:
            equipo_cache[insumo_id] = Equipo.objects.get(pk=insumo_id).costo_hora_maq
        return equipo_cache[insumo_id]
    raise ValueError(f"Tipo de insumo desconocido: {tipo}")
