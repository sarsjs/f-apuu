from flask import Blueprint, request, jsonify
from backend.app import db
from backend.app.models import Material, Equipo, Maquinaria, ManoObra
from backend.app.utils import decimal_field
catalogos_bp = Blueprint('catalogos_bp', __name__)
# ... (CONTENIDO COMPLETO de todas las rutas CRUD para los 4 tipos de insumo) ...
@catalogos_bp.route("/materiales", methods=["GET", "POST"])
def m():
    if request.method == "GET": return jsonify([i.to_dict() for i in Material.query.all()])
    p=request.get_json(); n=Material(nombre=p['nombre'], unidad=p['unidad'], precio_unitario=decimal_field(p['precio_unitario'])); db.session.add(n); db.session.commit(); return jsonify(n.to_dict()), 201
