from decimal import Decimal
from datetime import date
from backend.app.models import (
    ConstantesFASAR, Material, ManoObra, Equipo, Maquinaria, Concepto, MatrizInsumo
)

def seed_all_data(db):
    if Material.query.first() is not None:
        print("Database already contains data. Skipping seeding.")
        return

    print("Populating database with initial data...")

    fasar_defaults = ConstantesFASAR.get_singleton()
    db.session.add(fasar_defaults)

    materiales = [
        Material(nombre="Cemento gris saco 50kg", unidad="saco", precio_unitario=Decimal("250.00")),
        Material(nombre="Arena de río", unidad="m3", precio_unitario=Decimal("450.00")),
        Material(nombre="Tabique rojo recocido 7x14x28", unidad="pza", precio_unitario=Decimal("3.25")),
    ]
    db.session.add_all(materiales)

    mano_obra = [
        ManoObra(puesto="Oficial Albañil", salario_base=Decimal("450.00")),
        ManoObra(puesto="Ayudante General (Peón)", salario_base=Decimal("250.00")),
    ]
    for mo in mano_obra:
        mo.refresh_fasar()
    db.session.add_all(mano_obra)

    db.session.commit()

    concepto_ejemplo = Concepto(
        clave="MUR-001",
        descripcion="Muro de tabique rojo",
        unidad_concepto="m2"
    )
    db.session.add(concepto_ejemplo)
    db.session.commit()

    matriz = [
        MatrizInsumo(concepto_id=concepto_ejemplo.id, tipo_insumo="Material", id_insumo=materiales[2].id, cantidad=Decimal("55.0")),
        MatrizInsumo(concepto_id=concepto_ejemplo.id, tipo_insumo="ManoObra", id_insumo=mano_obra[0].id, cantidad=Decimal("0.1428")),
    ]
    db.session.add_all(matriz)

    try:
        db.session.commit()
        print("Initial data seeded successfully.")
    except Exception as e:
        db.session.rollback()
        print(f"Error seeding data: {e}")
