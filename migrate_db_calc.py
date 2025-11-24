import sqlite3
import os

db_path = os.path.join("catalogos", "data.sqlite3")
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()

print("Migrating database for Calculation Options...")

# Conceptos
try:
    c.execute('ALTER TABLE conceptos ADD COLUMN cantidad_obra NUMERIC(14, 4) DEFAULT 1.0')
    print("Added cantidad_obra to conceptos")
except sqlite3.OperationalError:
    print("cantidad_obra already exists in conceptos")

try:
    c.execute('ALTER TABLE conceptos ADD COLUMN calculo_activo BOOLEAN DEFAULT 0')
    print("Added calculo_activo to conceptos")
except sqlite3.OperationalError:
    print("calculo_activo already exists in conceptos")

# Matriz Insumo
try:
    c.execute('ALTER TABLE matriz_insumo ADD COLUMN cantidad_unitaria NUMERIC(12, 4)')
    print("Added cantidad_unitaria to matriz_insumo")
except sqlite3.OperationalError:
    print("cantidad_unitaria already exists in matriz_insumo")

conn.commit()
conn.close()
print("Migration complete.")
