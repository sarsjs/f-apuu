from __future__ import annotations

from datetime import date
from decimal import Decimal

from app import (
    app,
    db,
    ConstantesFASAR,
    Equipo,
    ManoObra,
    Material,
    Concepto,
    MatrizInsumo,
    Maquinaria,
    calcular_costo_posesion,
)


def seed_all_data() -> None:
    """Carga datos base para catálogos, constantes y un concepto de prueba."""

    with app.app_context():
        _seed_constantes()
        materiales = _seed_materiales()
        mano_obra = _seed_mano_obra()
        equipos = _seed_equipos()
        maquinaria = _seed_maquinaria()
        _seed_concepto_prueba(materiales, mano_obra, equipos, maquinaria)
        db.session.commit()


def _seed_constantes() -> None:
    constantes = ConstantesFASAR.get_singleton()
    constantes.dias_del_anio = 365
    constantes.dias_festivos_obligatorios = Decimal("7.0")
    constantes.dias_riesgo_trabajo_promedio = Decimal("1.5")
    constantes.dias_vacaciones_minimos = 12
    constantes.prima_vacacional_porcentaje = Decimal("0.25")
    constantes.dias_aguinaldo_minimos = 15
    constantes.suma_cargas_sociales = Decimal("0.170")
    db.session.add(constantes)


def _seed_materiales() -> dict[str, Material]:
    materiales_data = [
        {
            "nombre": "Cemento gris saco 50kg",
            "unidad": "saco",
            "precio_unitario": Decimal("200.00"),
            "porcentaje_merma": Decimal("0.03"),
            "precio_flete_unitario": Decimal("15.00"),
        },
        {
            "nombre": "Arena gruesa",
            "unidad": "m3",
            "precio_unitario": Decimal("450.00"),
            "porcentaje_merma": Decimal("0.05"),
            "precio_flete_unitario": Decimal("80.00"),
        },
        {
            "nombre": "Agua de red",
            "unidad": "m3",
            "precio_unitario": Decimal("30.00"),
            "porcentaje_merma": Decimal("0.01"),
            "precio_flete_unitario": Decimal("0.00"),
        },
    ]
    materiales: dict[str, Material] = {}
    for datos in materiales_data:
        material = Material.query.filter_by(nombre=datos["nombre"]).first()
        if material is None:
            material = Material(
                nombre=datos["nombre"],
                unidad=datos["unidad"],
                precio_unitario=datos["precio_unitario"],
                fecha_actualizacion=date.today(),
                porcentaje_merma=datos["porcentaje_merma"],
                precio_flete_unitario=datos["precio_flete_unitario"],
            )
            db.session.add(material)
        else:
            material.unidad = datos["unidad"]
            material.precio_unitario = datos["precio_unitario"]
            material.porcentaje_merma = datos["porcentaje_merma"]
            material.precio_flete_unitario = datos["precio_flete_unitario"]
        materiales[datos["nombre"]] = material
    return materiales


def _seed_mano_obra() -> dict[str, ManoObra]:
    mano_obra_data = [
        {"puesto": "Albañil", "salario_base": Decimal("350.00"), "rendimiento_jornada": Decimal("9.0")},
        {"puesto": "Peón", "salario_base": Decimal("250.00"), "rendimiento_jornada": Decimal("9.0")},
    ]
    mano_dict: dict[str, ManoObra] = {}
    for datos in mano_obra_data:
        mano = ManoObra.query.filter_by(puesto=datos["puesto"]).first()
        if mano is None:
            mano = ManoObra(
                puesto=datos["puesto"],
                salario_base=datos["salario_base"],
                antiguedad_anios=1,
                rendimiento_jornada=datos["rendimiento_jornada"],
                fecha_actualizacion=date.today(),
            )
            db.session.add(mano)
        else:
            mano.salario_base = datos["salario_base"]
            mano.rendimiento_jornada = datos["rendimiento_jornada"]
        mano.refresh_fasar()
        mano_dict[datos["puesto"]] = mano
    return mano_dict


def _seed_equipos() -> dict[str, Equipo]:
    equipos_data = [
        {
            "nombre": "Revolvedora 1 saco",
            "unidad": "hora",
            "costo_hora_maq": Decimal("150.00"),
        }
    ]
    equipos: dict[str, Equipo] = {}
    for datos in equipos_data:
        equipo = Equipo.query.filter_by(nombre=datos["nombre"]).first()
        if equipo is None:
            equipo = Equipo(
                nombre=datos["nombre"],
                unidad=datos["unidad"],
                costo_hora_maq=datos["costo_hora_maq"],
                fecha_actualizacion=date.today(),
            )
            db.session.add(equipo)
        else:
            equipo.unidad = datos["unidad"]
            equipo.costo_hora_maq = datos["costo_hora_maq"]
        equipos[datos["nombre"]] = equipo
    return equipos


def _seed_maquinaria() -> dict[str, Maquinaria]:
    data = [
        {
            "nombre": "Retro excavadora",
            "costo_adquisicion": Decimal("850000.00"),
            "vida_util_horas": Decimal("8000"),
            "tasa_interes_anual": Decimal("0.10"),
            "rendimiento_horario": Decimal("1.0"),
        }
    ]
    maquinas: dict[str, Maquinaria] = {}
    for datos in data:
        maquina = Maquinaria.query.filter_by(nombre=datos["nombre"]).first()
        if maquina is None:
            maquina = Maquinaria(
                nombre=datos["nombre"],
                costo_adquisicion=datos["costo_adquisicion"],
                vida_util_horas=datos["vida_util_horas"],
                tasa_interes_anual=datos["tasa_interes_anual"],
                rendimiento_horario=datos["rendimiento_horario"],
                fecha_actualizacion=date.today(),
            )
            maquina.costo_posesion_hora = calcular_costo_posesion(maquina)
            db.session.add(maquina)
        else:
            maquina.costo_adquisicion = datos["costo_adquisicion"]
            maquina.vida_util_horas = datos["vida_util_horas"]
            maquina.tasa_interes_anual = datos["tasa_interes_anual"]
            maquina.rendimiento_horario = datos["rendimiento_horario"]
            maquina.costo_posesion_hora = calcular_costo_posesion(maquina)
        maquinas[datos["nombre"]] = maquina
    return maquinas


def _seed_concepto_prueba(
    materiales: dict[str, Material],
    mano_obra: dict[str, ManoObra],
    equipos: dict[str, Equipo],
    maquinaria: dict[str, Maquinaria],
) -> None:
    concepto = Concepto.query.filter_by(clave="M-01").first()
    if concepto is None:
        concepto = Concepto(
            clave="M-01",
            descripcion="Muro de block de cemento 15x20x40",
            unidad_concepto="m2",
        )
        db.session.add(concepto)
        db.session.flush()
    else:
        concepto.descripcion = "Muro de block de cemento 15x20x40"
        concepto.unidad_concepto = "m2"

    MatrizInsumo.query.filter_by(concepto_id=concepto.id).delete(synchronize_session=False)

    matriz_registros = [
        ("Material", materiales["Cemento gris saco 50kg"].id, Decimal("7.5000"), None, None),
        ("Material", materiales["Arena gruesa"].id, Decimal("0.3500"), Decimal("0.04"), Decimal("100.00")),
        ("Material", materiales["Agua de red"].id, Decimal("0.1500"), None, None),
        ("ManoObra", mano_obra["Albañil"].id, Decimal("0.4000"), None, None),
        ("ManoObra", mano_obra["Peón"].id, Decimal("0.3500"), None, None),
        ("Equipo", equipos["Revolvedora 1 saco"].id, Decimal("0.2500"), None, None),
        ("Maquinaria", maquinaria["Retro excavadora"].id, Decimal("0.1200"), None, None),
    ]

    for tipo, insumo_id, cantidad, merma, flete in matriz_registros:
        db.session.add(
            MatrizInsumo(
                concepto_id=concepto.id,
                tipo_insumo=tipo,
                id_insumo=insumo_id,
                cantidad=cantidad,
                porcentaje_merma=merma,
                precio_flete_unitario=flete,
            )
        )


if __name__ == "__main__":
    seed_all_data()
