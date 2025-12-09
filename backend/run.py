from backend.app import create_app, db
from backend.app.models import ConstantesFASAR
from backend.seed_data import seed_all_data
import os

app = create_app()

def init_db():
    with app.app_context():
        db.create_all()
        ConstantesFASAR.get_singleton()
        seed_all_data(db)
        print("Database initialized and seeded.")

if __name__ == "__main__":
    db_path = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
    if not os.path.exists(db_path):
        print(f"Database not found at '{db_path}'. Creating and initializing...")
        init_db()

    print("Backend server running at http://localhost:8000")
    app.run(host="0.0.0.0", port=8000)
