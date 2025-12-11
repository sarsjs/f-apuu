from flask import Blueprint, jsonify
from backend.app.services.dashboard_service import get_dashboard_data

dashboard_bp = Blueprint('dashboard_bp', __name__)

@dashboard_bp.route("/proyectos/<int:proyecto_id>/dashboard_data", methods=["GET"])
def get_project_dashboard_data(proyecto_id: int):
    """
    Endpoint para obtener los datos procesados para el dashboard de un proyecto.
    """
    try:
        data = get_dashboard_data(proyecto_id)
        return jsonify(data)
    except Exception as e:
        # En caso de que un proyecto no se encuentre (404) o haya otro error
        return jsonify({"error": str(e)}), 500
