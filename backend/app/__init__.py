from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()
from backend.config import Config

db = SQLAlchemy()
cors = CORS()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    db.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": Config.get_allowed_origins()}}, supports_credentials=True)

    with app.app_context():
        from .routes import auth, catalogos, conceptos, proyectos, ventas, ia
        app.register_blueprint(auth.auth_bp, url_prefix='/api/auth')
        app.register_blueprint(catalogos.catalogos_bp, url_prefix='/api')
        app.register_blueprint(conceptos.conceptos_bp, url_prefix='/api')
        app.register_blueprint(proyectos.proyectos_bp, url_prefix='/api')
        app.register_blueprint(ventas.ventas_bp, url_prefix='/api/ventas')
        app.register_blueprint(ia.ia_bp, url_prefix='/api/ia')
        return app
