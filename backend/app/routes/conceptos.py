from flask import Blueprint, request, jsonify
from backend.app import db
from backend.app.models import Concepto, MatrizInsumo
from backend.app.services.calculation_service import calcular_precio_unitario, normalizar_factores
conceptos_bp = Blueprint('conceptos_bp', __name__)
# ... (CONTENIDO COMPLETO de las rutas de conceptos y matriz) ...
@conceptos_bp.route("/conceptos/calcular_pu", methods=["POST"])
def calc():
    p = request.get_json(); return jsonify(calcular_precio_unitario(matriz=p.get("matriz")))
