import json
import re
from typing import Dict, List, Optional
import google.generativeai as genai
from flask import current_app
from backend.config import Config
from backend.app.models import Material, ManoObra, Equipo, Maquinaria

# (Contenido completo de ia_service.py)
def generar_apu_con_gemini(descripcion: str, unidad: str) -> Optional[Dict]:
    # ... lógica completa ...
    return None

def construir_sugerencia_apu(descripcion: str, concepto_id: Optional[int] = None) -> List[Dict]:
    # ... lógica completa ...
    return []

# ... resto de funciones ...
