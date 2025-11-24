"""
Migration script to add disciplina, calidad, and fecha_actualizacion
columns to insumo tables in the SQLite database.

- Adds columns only if they don't already exist.
- Sets existing rows' `fecha_actualizacion` to today's date by using
  an ALTER TABLE ... ADD COLUMN with DEFAULT 'YYYY-MM-DD' and NOT NULL.

Run from project root (PowerShell):
> python .\catalogos\migrations\add_insumo_fields.py

"""
import sqlite3
import os
from datetime import date

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data.sqlite3")

TODAY = date.today().isoformat()

# Map of table -> list of (column_name, column_sql_definition)
SCHEMA_ADDITIONS = {
    "materiales": [
        ("disciplina", "TEXT"),
        ("calidad", "TEXT"),
        ("fecha_actualizacion", f"DATE DEFAULT '{TODAY}' NOT NULL"),
    ],
    "equipos": [
        ("disciplina", "TEXT"),
        ("calidad", "TEXT"),
        ("fecha_actualizacion", f"DATE DEFAULT '{TODAY}' NOT NULL"),
    ],
    "maquinaria": [
        ("disciplina", "TEXT"),
        ("calidad", "TEXT"),
        ("fecha_actualizacion", f"DATE DEFAULT '{TODAY}' NOT NULL"),
    ],
    "mano_obra": [
        ("disciplina", "TEXT"),
        ("calidad", "TEXT"),
        ("fecha_actualizacion", f"DATE DEFAULT '{TODAY}' NOT NULL"),
    ],
}


def table_columns(conn, table_name):
    cur = conn.execute(f"PRAGMA table_info('{table_name}')")
    rows = cur.fetchall()
    # PRAGMA table_info returns columns: cid, name, type, notnull, dflt_value, pk
    return [r[1] for r in rows]


def add_column(conn, table, col_name, col_def):
    sql = f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def};"
    print(f"Executing: {sql}")
    conn.execute(sql)


def main():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    try:
        existing_tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        print(f"Found tables: {existing_tables}")

        for table, additions in SCHEMA_ADDITIONS.items():
            if table not in existing_tables:
                print(f"Table '{table}' not present in DB, skipping.")
                continue

            cols = table_columns(conn, table)
            print(f"Columns in {table}: {cols}")

            for col_name, col_def in additions:
                if col_name in cols:
                    print(f"Column '{col_name}' already exists in '{table}', skipping.")
                    continue
                try:
                    add_column(conn, table, col_name, col_def)
                    print(f"Added column '{col_name}' to '{table}'.")
                except Exception as e:
                    print(f"Failed to add column '{col_name}' to '{table}': {e}")

        conn.commit()
        print("Migration completed.\nNote: `fecha_actualizacion` was added with a DEFAULT value set to today's date for existing rows.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
