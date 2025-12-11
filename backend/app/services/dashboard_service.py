from collections import defaultdict
from decimal import Decimal
from backend.app.models import Proyecto, DetallePresupuesto, MatrizInsumo
from backend.app.services.calculation_service import obtener_costo_insumo

def get_dashboard_data(proyecto_id: int) -> dict:
    """
    Calcula y estructura los datos para el dashboard de un proyecto.
    """
    proyecto = Proyecto.query.get_or_404(proyecto_id)
    detalles = DetallePresupuesto.query.join(DetallePresupuesto.partida).filter_by(proyecto_id=proyecto_id).all()

    costos_por_tipo = defaultdict(Decimal)
    costos_por_concepto = []

    # Usar caches para eficiencia, similar al cálculo de PU
    caches = ({}, {}, {}, {})

    for detalle in detalles:
        costo_total_concepto = Decimal("0.0")
        registros_matriz = MatrizInsumo.query.filter_by(concepto_id=detalle.concepto_id).all()

        for registro in registros_matriz:
            costo_unitario = obtener_costo_insumo(registro.to_dict(), caches)
            costo_total_insumo = detalle.cantidad_obra * registro.cantidad * costo_unitario
            costos_por_tipo[registro.tipo_insumo] += costo_total_insumo
            costo_total_concepto += costo_total_insumo

        costos_por_concepto.append({
            "nombre": detalle.concepto.clave or f"Concepto {detalle.concepto_id}",
            "costo_total": float(costo_total_concepto)
        })

    # Formatear datos para Recharts
    costos_por_tipo_grafico = [
        {"name": tipo.replace("ManoObra", "Mano de Obra"), "value": float(costo)}
        for tipo, costo in costos_por_tipo.items()
    ]

    # Ordenar y tomar los 5 conceptos más caros
    top_5_conceptos = sorted(costos_por_concepto, key=lambda x: x['costo_total'], reverse=True)[:5]

    return {
        "nombre_proyecto": proyecto.nombre_proyecto,
        "costo_total_proyecto": sum(item['value'] for item in costos_por_tipo_grafico),
        "desglose_por_tipo": costos_por_tipo_grafico,
        "top_5_conceptos": top_5_conceptos,
    }
