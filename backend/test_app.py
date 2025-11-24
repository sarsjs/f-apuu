import pytest
import json
from decimal import Decimal
from unittest.mock import MagicMock

# Importar la app y la base de datos desde el módulo principal
from app import app, db, Material, ManoObra, match_mano_obra

@pytest.fixture(scope='module')
def test_client():
    """Configura un cliente de prueba para la aplicación Flask."""
    # Establecer una base de datos en memoria para las pruebas
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    with app.test_client() as testing_client:
        with app.app_context():
            db.create_all()
            yield testing_client  # esto es lo que se usará en las pruebas
            db.drop_all()

@pytest.fixture(scope='module')
def init_database(test_client):
    """Inicializa la base de datos con datos de prueba."""
    # Crear insumos de prueba que se usarán en los cálculos
    material_cemento = Material(nombre="Cemento", unidad="kg", precio_unitario=Decimal("100.00"))
    mano_obra_albanil = ManoObra(puesto="Albañil", salario_base=Decimal("500.00"))
    mano_obra_peon = ManoObra(puesto="Peón", salario_base=Decimal("300.00"))
    
    db.session.add(material_cemento)
    db.session.add(mano_obra_albanil)
    db.session.add(mano_obra_peon)
    db.session.commit()

    yield db  # Proporciona la sesión de la base de datos a las pruebas si es necesario

    db.session.close()

def test_calculo_pu_simple(test_client, init_database):
    """
    Prueba el cálculo de un Precio Unitario simple con indirectos y utilidad fijos.
    """
    # Payload simulado para el cálculo
    matriz_payload = {
        "matriz": [
            {
                "tipo_insumo": "Material",
                "id_insumo": 1,  # Cemento
                "cantidad": 0.5,
            },
            {
                "tipo_insumo": "ManoObra",
                "id_insumo": 1,  # Albañil
                "cantidad": 1.0, # Asumimos que la cantidad ya incluye el rendimiento
            }
        ],
        "indirectos": 0.20, # 20%
        "utilidad": 0.10 # 10%
    }
    
    # El costo directo esperado es: (100 * 0.5) + (500 * 1.0) = 50 + 500 = 550
    # El precio unitario esperado es: 550 * (1 + 0.20 + 0.10) = 550 * 1.30 = 715

    response = test_client.post('/api/conceptos/calcular_pu', data=json.dumps(matriz_payload), content_type='application/json')
    
    assert response.status_code == 200
    data = response.get_json()
    
    # Aserciones con una pequeña tolerancia para cálculos de punto flotante
    assert data['costo_directo'] == pytest.approx(550.00)
    assert data['precio_unitario'] == pytest.approx(715.00)

def test_match_mano_obra_anti_regresion():
    """
    Previene la regresión del error AttributeError al buscar 'nombre' en lugar de 'puesto'.
    """
    # Crear una lista simulada de objetos ManoObra
    # Usamos MagicMock para simular objetos de SQLAlchemy sin necesidad de la base de datos
    peon_mock = MagicMock(spec=ManoObra)
    peon_mock.puesto = "Ayudante general (Peón)"
    peon_mock.id = 1

    albanil_mock = MagicMock(spec=ManoObra)
    albanil_mock.puesto = "Oficial Albañil"
    albanil_mock.id = 2
    
    mano_de_obra_lista = [peon_mock, albanil_mock]
    
    # Simular la búsqueda de la palabra "peón"
    resultado = match_mano_obra("peón", mano_de_obra_lista)
    
    # Aserción: El resultado no debe ser nulo y debe ser el mock del peón
    assert resultado is not None
    assert resultado.id == peon_mock.id
    assert resultado.puesto == peon_mock.puesto

    # Aserción: La función no debe lanzar AttributeError
    try:
        match_mano_obra("algo", mano_de_obra_lista)
    except AttributeError:
        pytest.fail("AttributeError: La función match_mano_obra intentó acceder a un atributo incorrecto.")

