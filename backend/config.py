import os
from decimal import Decimal

BASE_DIR = os.path.dirname(os.path.abspath(os.path.join(__file__, os.pardir)))
DB_PATH = os.path.join(BASE_DIR, "data.sqlite3")

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-this-secret-in-production")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{DB_PATH}"
    SESSION_COOKIE_SAMESITE = "None"
    SESSION_COOKIE_SECURE = True

    @staticmethod
    def get_allowed_origins():
        return ["http://localhost:3000", "http://localhost:5173"]

    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
    PRECIOS_OBSOLETOS_DIAS = int(os.environ.get("PRECIOS_OBSOLETOS_DIAS", "90"))
    ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    WTF_CSRF_ENABLED = False
