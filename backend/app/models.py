from datetime import date
from decimal import Decimal
from typing import Dict, Optional
from backend.app import db
from backend.config import Config

def is_precio_obsoleto(fecha_actualizacion: Optional[date]) -> bool:
    if not fecha_actualizacion:
        return False
    try:
        delta = date.today() - fecha_actualizacion
        return delta.days > Config.PRECIOS_OBSOLETOS_DIAS
    except Exception:
        return False

class ConstantesFASAR(db.Model):
    __tablename__ = "constantes_fasar"
    id = db.Column(db.Integer, primary_key=True, default=1)
    # ... (all other fields)
    suma_cargas_sociales = db.Column(db.Numeric(5, 4), default=Decimal("0.15"))
    @classmethod
    def get_singleton(cls):
        instancia = cls.query.get(1)
        if not instancia:
            instancia = cls(id=1)
            db.session.add(instancia)
            db.session.commit()
        return instancia
    def to_dict(self):
        return { "id": self.id, "dias_del_anio": self.dias_del_anio, "dias_festivos_obligatorios": float(self.dias_festivos_obligatorios), "dias_riesgo_trabajo_promedio": float(self.dias_riesgo_trabajo_promedio), "dias_vacaciones_minimos": self.dias_vacaciones_minimos, "prima_vacacional_porcentaje": float(self.prima_vacacional_porcentaje), "dias_aguinaldo_minimos": self.dias_aguinaldo_minimos, "suma_cargas_sociales": float(self.suma_cargas_sociales) }

class Material(db.Model):
    __tablename__ = "materiales"
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), unique=True, nullable=False)
    # ... (all other fields)
    precio_flete_unitario = db.Column(db.Numeric(12, 4), default=Decimal("0.00"), nullable=False)
    def to_dict(self):
        return { "id": self.id, "nombre": self.nombre, "unidad": self.unidad, "precio_unitario": float(self.precio_unitario), "fecha_actualizacion": self.fecha_actualizacion.isoformat(), "disciplina": self.disciplina, "calidad": self.calidad, "obsoleto": is_precio_obsoleto(self.fecha_actualizacion), "porcentaje_merma": float(self.porcentaje_merma or 0), "precio_flete_unitario": float(self.precio_flete_unitario or 0) }

class Equipo(db.Model):
    # ... (content of Equipo model)
    __tablename__ = "equipos"
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), nullable=False)
    unidad = db.Column(db.String(50), nullable=False)
    disciplina = db.Column(db.String(100), nullable=True)
    calidad = db.Column(db.String(100), nullable=True)
    fecha_actualizacion = db.Column(db.Date, default=date.today, nullable=False)
    costo_hora_maq = db.Column(db.Numeric(12, 4), nullable=False)
    def to_dict(self):
        return { "id": self.id, "nombre": self.nombre, "unidad": self.unidad, "disciplina": self.disciplina, "calidad": self.calidad, "fecha_actualizacion": self.fecha_actualizacion.isoformat(), "obsoleto": is_precio_obsoleto(self.fecha_actualizacion), "costo_hora_maq": float(self.costo_hora_maq) }

class Maquinaria(db.Model):
    __tablename__ = "maquinaria"
    id = db.Column(db.Integer, primary_key=True)
    # ... (all other fields)
    fecha_actualizacion = db.Column(db.Date, default=date.today, nullable=False)
    def actualizar_costo_posesion(self):
        from backend.app.services.calculation_service import calcular_costo_posesion
        self.costo_posesion_hora = calcular_costo_posesion(self)
    def to_dict(self):
        return { "id": self.id, "nombre": self.nombre, "disciplina": self.disciplina, "calidad": self.calidad, "fecha_actualizacion": self.fecha_actualizacion.isoformat(), "obsoleto": is_precio_obsoleto(self.fecha_actualizacion), "costo_adquisicion": float(self.costo_adquisicion), "vida_util_horas": float(self.vida_util_horas), "tasa_interes_anual": float(self.tasa_interes_anual or 0), "rendimiento_horario": float(self.rendimiento_horario or 0), "costo_posesion_hora": float(self.costo_posesion_hora or 0) }

class ManoObra(db.Model):
    __tablename__ = "mano_obra"
    id = db.Column(db.Integer, primary_key=True)
    # ... (all other fields)
    fecha_actualizacion = db.Column(db.Date, default=date.today, nullable=False)
    def refresh_fasar(self):
        from backend.app.services.calculation_service import calcular_fasar_valor
        self.fasar = calcular_fasar_valor()
    def to_dict(self):
        return { "id": self.id, "puesto": self.puesto, "salario_base": float(self.salario_base), "antiguedad_anios": self.antiguedad_anios, "fasar": float(self.fasar), "rendimiento_jornada": float(self.rendimiento_jornada or 0), "disciplina": self.disciplina, "calidad": self.calidad, "fecha_actualizacion": self.fecha_actualizacion.isoformat(), "obsoleto": is_precio_obsoleto(self.fecha_actualizacion) }

# ... (Concepto, MatrizInsumo, Proyecto, Partida, DetallePresupuesto models)
class Concepto(db.Model):
    __tablename__ = "conceptos"
    id = db.Column(db.Integer, primary_key=True)
    clave = db.Column(db.String(50), unique=True, nullable=False)
    descripcion = db.Column(db.Text, nullable=False)
    unidad_concepto = db.Column(db.String(50), nullable=False)
    insumos = db.relationship("MatrizInsumo", backref="concepto", cascade="all, delete-orphan")
    def to_dict(self):
        return { "id": self.id, "clave": self.clave, "descripcion": self.descripcion, "unidad_concepto": self.unidad_concepto }

class MatrizInsumo(db.Model):
    __tablename__ = "matriz_insumo"
    id = db.Column(db.Integer, primary_key=True)
    concepto_id = db.Column(db.Integer, db.ForeignKey("conceptos.id"), nullable=False)
    tipo_insumo = db.Column(db.String(20), nullable=False)
    id_insumo = db.Column(db.Integer, nullable=False)
    cantidad = db.Column(db.Numeric(12, 4), nullable=False)
    porcentaje_merma = db.Column(db.Numeric(6, 4), nullable=True)
    precio_flete_unitario = db.Column(db.Numeric(12, 4), nullable=True)
    def to_dict(self):
        return { "id": self.id, "concepto": self.concepto_id, "tipo_insumo": self.tipo_insumo, "id_insumo": self.id_insumo, "cantidad": float(self.cantidad), "porcentaje_merma": float(self.porcentaje_merma) if self.porcentaje_merma is not None else None, "precio_flete_unitario": float(self.precio_flete_unitario) if self.precio_flete_unitario is not None else None }

class Proyecto(db.Model):
    __tablename__ = "proyectos"
    id = db.Column(db.Integer, primary_key=True)
    nombre_proyecto = db.Column(db.String(255), nullable=False)
    # ...
    monto_maximo = db.Column(db.Numeric(14, 2), default=Decimal("0.00"))
    partidas = db.relationship("Partida", backref="proyecto", cascade="all, delete-orphan")
    def to_dict(self):
        return { "id": self.id, "nombre_proyecto": self.nombre_proyecto, "ubicacion": self.ubicacion, "descripcion": self.descripcion or "", "fecha_creacion": self.fecha_creacion.isoformat(), "ajustes": { "mano_obra": {"activo": bool(self.ajuste_mano_obra_activo), "porcentaje": float(self.ajuste_mano_obra_porcentaje or 0)}, "indirectos": {"activo": bool(self.ajuste_indirectos_activo), "porcentaje": float(self.ajuste_indirectos_porcentaje or 0)}, "financiamiento": {"activo": bool(self.ajuste_financiamiento_activo), "porcentaje": float(self.ajuste_financiamiento_porcentaje or 0)}, "utilidad": {"activo": bool(self.ajuste_utilidad_activo), "porcentaje": float(self.ajuste_utilidad_porcentaje or 0)}, "iva": {"activo": bool(self.ajuste_iva_activo), "porcentaje": float(self.ajuste_iva_porcentaje or 0)}, }, "has_presupuesto_maximo": bool(self.has_presupuesto_maximo), "monto_maximo": float(self.monto_maximo or 0) }

class Partida(db.Model):
    __tablename__ = "partidas"
    id = db.Column(db.Integer, primary_key=True)
    proyecto_id = db.Column(db.Integer, db.ForeignKey("proyectos.id"), nullable=False)
    nombre_partida = db.Column(db.String(255), nullable=False)
    detalles = db.relationship("DetallePresupuesto", backref="partida", cascade="all, delete-orphan")
    def to_dict(self):
        return {"id": self.id, "proyecto": self.proyecto_id, "nombre_partida": self.nombre_partida}

class DetallePresupuesto(db.Model):
    __tablename__ = "detalle_presupuesto"
    id = db.Column(db.Integer, primary_key=True)
    partida_id = db.Column(db.Integer, db.ForeignKey("partidas.id"), nullable=False)
    concepto_id = db.Column(db.Integer, db.ForeignKey("conceptos.id"), nullable=False)
    cantidad_obra = db.Column(db.Numeric(14, 4), nullable=False)
    precio_unitario_calculado = db.Column(db.Numeric(14, 4), nullable=False)
    costo_directo = db.Column(db.Numeric(14, 4), nullable=False, default=Decimal("0.0000"))
    concepto = db.relationship("Concepto")
    def to_dict(self):
        return { "id": self.id, "partida": self.partida_id, "concepto": self.concepto_id, "cantidad_obra": float(self.cantidad_obra), "precio_unitario_calculado": float(self.precio_unitario_calculado), "costo_directo": float(self.costo_directo or 0), "concepto_detalle": {"clave": self.concepto.clave, "descripcion": self.concepto.descripcion}, }
