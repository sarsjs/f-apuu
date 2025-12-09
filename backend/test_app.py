import pytest
from decimal import Decimal
import json

from backend.app import create_app, db
from backend.app.models import Material, ManoObra

@pytest.fixture
def app():
    """Crea y configura una nueva instancia de la app para cada prueba."""
    app = create_app(config_class='backend.config.TestingConfig')
    with app.app_context():
        db.create_all()
        material = Material(nombre="Cemento", unidad="saco", precio_unitario=Decimal("200.0"))
        mano_obra = ManoObra(puesto="Oficial Albañil", salario_base=Decimal("450.0"))
        mano_obra.refresh_fasar()
        db.session.add_all([material, mano_obra])
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

def test_calcular_pu_endpoint(client):
    """Prueba el endpoint de cálculo de precio unitario."""
    material = Material.query.first()
    mano_obra = ManoObra.query.first()
    matriz_payload = {
        "matriz": [
            {"tipo_insumo": "Material", "id_insumo": material.id, "cantidad": 2.0},
            {"tipo_insumo": "ManoObra", "id_insumo": mano_obra.id, "cantidad": 0.5}
        ]
    }
    response = client.post('/api/conceptos/calcular_pu', data=json.dumps(matriz_payload), content_type='application/json')
    assert response.status_code == 200
    data = response.get_json()
    assert 'costo_directo' in data and data['costo_directo'] > 0

def test_get_materiales(client):
    """Prueba que el endpoint para obtener materiales funcione."""
    response = client.get('/api/materiales')
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert data[0]['nombre'] == 'Cemento'
