from decimal import Decimal

def decimal_field(value) -> Decimal:
    """Convierte un valor a Decimal de forma segura."""
    if value is None: return Decimal("0")
    if isinstance(value, Decimal): return value
    if isinstance(value, str) and not value.strip(): return Decimal("0")
    try:
        return Decimal(str(value))
    except (ValueError, TypeError):
        return Decimal("0")

# Otras funciones de utilidad que puedan ser necesarias en el futuro
# ...
