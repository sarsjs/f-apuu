import io
from typing import Dict, List
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
# ... más importaciones de reportlab ...

def generar_pdf_nota_venta(concepto: Dict, matriz_detalle: List[Dict], resultado_calculo: Dict) -> bytes:
    buffer = io.BytesIO()
    # ... lógica completa de generación de PDF ...
    doc.build(story)
    return buffer.getvalue()
