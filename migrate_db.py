import sqlite3
import os

db_path = os.path.join("catalogos", "data.sqlite3")
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()

print("Migrating database...")

try:
    c.execute('ALTER TABLE matriz_insumo ADD COLUMN rendimiento_jornada NUMERIC(10, 4)')
    print("Added rendimiento_jornada column")
except sqlite3.OperationalError as e:
    print(f"rendimiento_jornada column might already exist: {e}")

try:
    c.execute('ALTER TABLE matriz_insumo ADD COLUMN factor_uso NUMERIC(10, 4)')
    print("Added factor_uso column")
except sqlite3.OperationalError as e:
    print(f"factor_uso column might already exist: {e}")

conn.commit()
conn.close()
print("Migration complete.")
