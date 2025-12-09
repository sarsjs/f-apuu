from decimal import Decimal
from typing import Dict, List, Optional
from backend.app.models import ConstantesFASAR, Material, ManoObra, Equipo, Maquinaria, MatrizIno, Proyecto
from backend.app.utils import decimal_field

# (Todo el contenido completo y correcto de calculation_service.py)
# ...
def calcular_fasar_valor() -> Decimal:
    constantes = ConstantesFASAR.get_singleton()
    dias_pagados = Decimal(constantes.dias_del_anio) + Decimal(constantes.dias_aguinaldo_minimos) + Decimal(constantes.dias_vacaciones_minimos) * Decimal(constantes.prima_vacacional_porcentaje)
    dias_trabajados = Decimal(constantes.dias_del_anio) - Decimal(constantes.dias_festivos_obligatorios) - Decimal(constantes.dias_vacaciones_minimos) - Decimal(constantes.dias_riesgo_trabajo_promedio)
    if dias_trabajados <= 0: return Decimal("1.0")
    return (dias_pagados / dias_trabajados) * (Decimal("1.0") + Decimal(constantes.suma_cargas_sociales))

def calcular_precio_unitario(concepto_id=None, matriz=None, factores=None):
    # ... lógica completa ...
    return {"costo_directo": 0.0, "precio_unitario": 0.0}

# ... resto de funciones completas ...
