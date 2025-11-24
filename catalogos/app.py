import os
import json
import re
from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional

import google.generativeai as genai
from dotenv import load_dotenv
from flask import Flask, jsonify, request, current_app, send_file
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import Table, TableStyle, SimpleDocTemplate, Spacer, Paragraph
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data.sqlite3")

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

# Días para considerar un precio como obsoleto (configurable)
PRECIOS_OBSOLETOS_DIAS = int(os.environ.get("PRECIOS_OBSOLETOS_DIAS", "90"))

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def is_precio_obsoleto(fecha_actualizacion: Optional[date]) -> bool:
    """Determina si un precio está obsoleto según PRECIOS_OBSOLETOS_DIAS."""
    if not fecha_actualizacion:
        return False
    try:
        delta = date.today() - fecha_actualizacion
        return delta.days > PRECIOS_OBSOLETOS_DIAS
    except Exception:
        return False


class ConstantesFASAR(db.Model):
    __tablename__ = "constantes_fasar"

    id = db.Column(db.Integer, primary_key=True, default=1)
    dias_del_anio = db.Column(db.Integer, default=365)
    dias_festivos_obligatorios = db.Column(db.Numeric(6, 2), default=Decimal("7.0"))
    dias_riesgo_trabajo_promedio = db.Column(db.Numeric(6, 2), default=Decimal("1.5"))
    dias_vacaciones_minimos = db.Column(db.Integer, default=12)
    prima_vacacional_porcentaje = db.Column(db.Numeric(4, 2), default=Decimal("0.25"))
    dias_aguinaldo_minimos = db.Column(db.Integer, default=15)
    suma_cargas_sociales = db.Column(db.Numeric(5, 4), default=Decimal("0.15"))

    @classmethod
    def get_singleton(cls) -> "ConstantesFASAR":
        instancia = cls.query.get(1)
        if not instancia:
            instancia = cls(id=1)
            db.session.add(instancia)
            db.session.commit()
        return instancia

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "dias_del_anio": self.dias_del_anio,
            "dias_festivos_obligatorios": float(self.dias_festivos_obligatorios),
            "dias_riesgo_trabajo_promedio": float(self.dias_riesgo_trabajo_promedio),
            "dias_vacaciones_minimos": self.dias_vacaciones_minimos,
            "prima_vacacional_porcentaje": float(self.prima_vacacional_porcentaje),
            "dias_aguinaldo_minimos": self.dias_aguinaldo_minimos,
            "suma_cargas_sociales": float(self.suma_cargas_sociales),
        }


class Material(db.Model):
    __tablename__ = "materiales"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), unique=True, nullable=False)
    unidad = db.Column(db.String(50), nullable=False)
    precio_unitario = db.Column(db.Numeric(12, 4), nullable=False)
    fecha_actualizacion = db.Column(db.Date, default=date.today, nullable=False)
    disciplina = db.Column(db.String(100), nullable=True)
    calidad = db.Column(db.String(100), nullable=True)
    porcentaje_merma = db.Column(db.Numeric(5, 4), default=Decimal("0.03"), nullable=False)
    precio_flete_unitario = db.Column(db.Numeric(12, 4), default=Decimal("0.00"), nullable=False)

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "unidad": self.unidad,
            "precio_unitario": float(self.precio_unitario),
            "fecha_actualizacion": self.fecha_actualizacion.isoformat(),
            "disciplina": self.disciplina,
            "calidad": self.calidad,
            "obsoleto": is_precio_obsoleto(self.fecha_actualizacion),
            "porcentaje_merma": float(self.porcentaje_merma or 0),
            "precio_flete_unitario": float(self.precio_flete_unitario or 0),
        }


class Equipo(db.Model):
    __tablename__ = "equipos"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), nullable=False)
    unidad = db.Column(db.String(50), nullable=False)
    disciplina = db.Column(db.String(100), nullable=True)
    calidad = db.Column(db.String(100), nullable=True)
    fecha_actualizacion = db.Column(db.Date, default=date.today, nullable=False)
    costo_hora_maq = db.Column(db.Numeric(12, 4), nullable=False)

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "unidad": self.unidad,
            "disciplina": self.disciplina,
            "calidad": self.calidad,
            "fecha_actualizacion": self.fecha_actualizacion.isoformat(),
            "obsoleto": is_precio_obsoleto(self.fecha_actualizacion),
            "costo_hora_maq": float(self.costo_hora_maq),
        }


class Maquinaria(db.Model):
    __tablename__ = "maquinaria"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), nullable=False)
    costo_adquisicion = db.Column(db.Numeric(14, 2), nullable=False)
    vida_util_horas = db.Column(db.Numeric(14, 2), nullable=False)
    tasa_interes_anual = db.Column(db.Numeric(5, 4), default=Decimal("0.10"), nullable=False)
    rendimiento_horario = db.Column(db.Numeric(10, 4), default=Decimal("1.0"), nullable=False)
    costo_posesion_hora = db.Column(db.Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    disciplina = db.Column(db.String(100), nullable=True)
    calidad = db.Column(db.String(100), nullable=True)
    fecha_actualizacion = db.Column(db.Date, default=date.today, nullable=False)

    def actualizar_costo_posesion(self):
        costo_posesion = calcular_costo_posesion(self)
        self.costo_posesion_hora = costo_posesion

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "disciplina": self.disciplina,
            "calidad": self.calidad,
            "fecha_actualizacion": self.fecha_actualizacion.isoformat(),
            "obsoleto": is_precio_obsoleto(self.fecha_actualizacion),
            "costo_adquisicion": float(self.costo_adquisicion),
            "vida_util_horas": float(self.vida_util_horas),
            "tasa_interes_anual": float(self.tasa_interes_anual or 0),
            "rendimiento_horario": float(self.rendimiento_horario or 0),
            "costo_posesion_hora": float(self.costo_posesion_hora or 0),
        }


class ManoObra(db.Model):
    __tablename__ = "mano_obra"

    id = db.Column(db.Integer, primary_key=True)
    puesto = db.Column(db.String(255), nullable=False)
    salario_base = db.Column(db.Numeric(12, 2), nullable=False)
    antiguedad_anios = db.Column(db.Integer, default=1, nullable=False)
    fasar = db.Column(db.Numeric(12, 4), default=Decimal("1.0000"), nullable=False)
    rendimiento_jornada = db.Column(db.Numeric(10, 4), default=Decimal("1.0000"), nullable=False)
    disciplina = db.Column(db.String(100), nullable=True)
    calidad = db.Column(db.String(100), nullable=True)
    fecha_actualizacion = db.Column(db.Date, default=date.today, nullable=False)

    def refresh_fasar(self):
        self.fasar = calcular_fasar_valor()

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "puesto": self.puesto,
            "salario_base": float(self.salario_base),
            "antiguedad_anios": self.antiguedad_anios,
            "fasar": float(self.fasar),
            "rendimiento_jornada": float(self.rendimiento_jornada or 0),
            "disciplina": self.disciplina,
            "calidad": self.calidad,
            "fecha_actualizacion": self.fecha_actualizacion.isoformat(),
            "obsoleto": is_precio_obsoleto(self.fecha_actualizacion),
        }


class Concepto(db.Model):
    __tablename__ = "conceptos"

    id = db.Column(db.Integer, primary_key=True)
    clave = db.Column(db.String(50), unique=True, nullable=False)
    descripcion = db.Column(db.Text, nullable=False)
    unidad_concepto = db.Column(db.String(50), nullable=False)

    insumos = db.relationship("MatrizInsumo", backref="concepto", cascade="all, delete-orphan")

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "clave": self.clave,
            "descripcion": self.descripcion,
            "unidad_concepto": self.unidad_concepto,
        }


class MatrizInsumo(db.Model):
    __tablename__ = "matriz_insumo"

    id = db.Column(db.Integer, primary_key=True)
    concepto_id = db.Column(db.Integer, db.ForeignKey("conceptos.id"), nullable=False)
    tipo_insumo = db.Column(db.String(20), nullable=False)
    id_insumo = db.Column(db.Integer, nullable=False)
    cantidad = db.Column(db.Numeric(12, 4), nullable=False)
    porcentaje_merma = db.Column(db.Numeric(6, 4), nullable=True)
    precio_flete_unitario = db.Column(db.Numeric(12, 4), nullable=True)

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "concepto": self.concepto_id,
            "tipo_insumo": self.tipo_insumo,
            "id_insumo": self.id_insumo,
            "cantidad": float(self.cantidad),
            "porcentaje_merma": float(self.porcentaje_merma) if self.porcentaje_merma is not None else None,
            "precio_flete_unitario": float(self.precio_flete_unitario) if self.precio_flete_unitario is not None else None,
        }


class Proyecto(db.Model):
    __tablename__ = "proyectos"

    id = db.Column(db.Integer, primary_key=True)
    nombre_proyecto = db.Column(db.String(255), nullable=False)
    ubicacion = db.Column(db.String(255), nullable=True, default="")
    descripcion = db.Column(db.Text, nullable=True, default="")
    fecha_creacion = db.Column(db.Date, default=date.today, nullable=False)
    ajuste_mano_obra_activo = db.Column(db.Boolean, default=False)
    ajuste_mano_obra_porcentaje = db.Column(db.Numeric(6, 4), default=Decimal("0.00"))
    ajuste_indirectos_activo = db.Column(db.Boolean, default=False)
    ajuste_indirectos_porcentaje = db.Column(db.Numeric(6, 4), default=Decimal("0.00"))
    ajuste_financiamiento_activo = db.Column(db.Boolean, default=False)
    ajuste_financiamiento_porcentaje = db.Column(db.Numeric(6, 4), default=Decimal("0.00"))
    ajuste_utilidad_activo = db.Column(db.Boolean, default=False)
    ajuste_utilidad_porcentaje = db.Column(db.Numeric(6, 4), default=Decimal("0.00"))
    ajuste_iva_activo = db.Column(db.Boolean, default=False)
    ajuste_iva_porcentaje = db.Column(db.Numeric(6, 4), default=Decimal("0.00"))
    has_presupuesto_maximo = db.Column(db.Boolean, default=False)
    monto_maximo = db.Column(db.Numeric(14, 2), default=Decimal("0.00"))

    partidas = db.relationship("Partida", backref="proyecto", cascade="all, delete-orphan")

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "nombre_proyecto": self.nombre_proyecto,
            "ubicacion": self.ubicacion,
             "descripcion": self.descripcion or "",
            "fecha_creacion": self.fecha_creacion.isoformat(),
             "ajustes": {
                 "mano_obra": {
                     "activo": bool(self.ajuste_mano_obra_activo),
                     "porcentaje": float(self.ajuste_mano_obra_porcentaje or 0),
                 },
                 "indirectos": {
                     "activo": bool(self.ajuste_indirectos_activo),
                     "porcentaje": float(self.ajuste_indirectos_porcentaje or 0),
                 },
                 "financiamiento": {
                     "activo": bool(self.ajuste_financiamiento_activo),
                     "porcentaje": float(self.ajuste_financiamiento_porcentaje or 0),
                 },
                 "utilidad": {
                     "activo": bool(self.ajuste_utilidad_activo),
                     "porcentaje": float(self.ajuste_utilidad_porcentaje or 0),
                 },
                 "iva": {
                     "activo": bool(self.ajuste_iva_activo),
                     "porcentaje": float(self.ajuste_iva_porcentaje or 0),
                 },
             },
             "has_presupuesto_maximo": bool(self.has_presupuesto_maximo),
             "monto_maximo": float(self.monto_maximo or 0),
        }


class Partida(db.Model):
    __tablename__ = "partidas"

    id = db.Column(db.Integer, primary_key=True)
    proyecto_id = db.Column(db.Integer, db.ForeignKey("proyectos.id"), nullable=False)
    nombre_partida = db.Column(db.String(255), nullable=False)

    detalles = db.relationship("DetallePresupuesto", backref="partida", cascade="all, delete-orphan")

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "proyecto": self.proyecto_id,
            "nombre_partida": self.nombre_partida,
        }


class DetallePresupuesto(db.Model):
    __tablename__ = "detalle_presupuesto"

    id = db.Column(db.Integer, primary_key=True)
    partida_id = db.Column(db.Integer, db.ForeignKey("partidas.id"), nullable=False)
    concepto_id = db.Column(db.Integer, db.ForeignKey("conceptos.id"), nullable=False)
    cantidad_obra = db.Column(db.Numeric(14, 4), nullable=False)
    precio_unitario_calculado = db.Column(db.Numeric(14, 4), nullable=False)
    costo_directo = db.Column(db.Numeric(14, 4), nullable=False, default=Decimal("0.0000"))

    concepto = db.relationship("Concepto")

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "partida": self.partida_id,
            "concepto": self.concepto_id,
            "cantidad_obra": float(self.cantidad_obra),
            "precio_unitario_calculado": float(self.precio_unitario_calculado),
            "costo_directo": float(self.costo_directo or 0),
            "concepto_detalle": {
                "clave": self.concepto.clave,
                "descripcion": self.concepto.descripcion,
            },
        }


def init_db():
    os.makedirs(BASE_DIR, exist_ok=True)
    db.create_all()
    ConstantesFASAR.get_singleton()


@app.route("/api/ventas/crear_nota_venta", methods=["POST"])
def crear_nota_venta():
    payload = request.get_json(force=True)

    descripcion_concepto = payload.get("descripcion")
    unidad_concepto = payload.get("unidad")
    matriz_insumos_payload = payload.get("matriz", [])
    concepto_id = payload.get("concepto_id")

    if not all([descripcion_concepto, unidad_concepto, matriz_insumos_payload]):
        return jsonify({"error": "Datos incompletos para generar la nota de venta"}), 400

    try:
        # Reutilizamos la función de cálculo existente
        resultado = calcular_precio_unitario(matriz=matriz_insumos_payload)
        costo_directo = resultado["costo_directo"]
        precio_unitario = resultado["precio_unitario"]
    except Exception as e:
        current_app.logger.error(f"Error al calcular PU para nota de venta: {e}")
        return jsonify({"error": "No se pudo calcular el precio unitario"}), 500

    nota_de_venta = {
        "concepto_id": concepto_id,
        "concepto_descripcion": descripcion_concepto,
        "unidad": unidad_concepto,
        "cantidad": 1,
        "costo_directo_unitario": costo_directo,
        "precio_unitario_final": precio_unitario,
        "importe_total": precio_unitario,
        "mensaje": "Nota de Venta generada exitosamente.",
    }

    return jsonify(nota_de_venta), 201


@app.route('/api/ventas/descargar_nota_venta_pdf/<int:concepto_id>', methods=['GET'])
def descargar_nota_venta_pdf(concepto_id: int):
    from reportlab.platypus import SimpleDocTemplate, Spacer, PageTemplate, Frame, KeepTogether
    from reportlab.pdfgen import canvas as pdfcanvas
    
    concepto = Concepto.query.get_or_404(concepto_id)
    registros = [r.to_dict() for r in MatrizInsumo.query.filter_by(concepto_id=concepto_id).all()]

    # Construir matriz detallada
    matriz_detalle = []
    material_cache = {}
    mano_cache = {}
    equipo_cache = {}
    maquinaria_cache = {}
    
    for registro in registros:
        cantidad = decimal_field(registro.get('cantidad'))
        costo_unitario = obtener_costo_insumo(registro, material_cache, mano_cache, equipo_cache, maquinaria_cache)
        importe = cantidad * costo_unitario

        tipo = registro.get('tipo_insumo')
        nombre = ''
        unidad = ''
        if tipo == 'Material':
            m = material_cache.get(registro['id_insumo'])
            if not m:
                m = Material.query.get(registro['id_insumo'])
            nombre = m.nombre if m else ''
            unidad = m.unidad if m else ''
        elif tipo == 'ManoObra':
            mo = mano_cache.get(registro['id_insumo'])
            if not mo:
                mo = ManoObra.query.get(registro['id_insumo'])
            nombre = mo.puesto if mo else ''
            unidad = 'jornada'
        elif tipo == 'Equipo':
            eq = equipo_cache.get(registro['id_insumo'])
            if not eq:
                eq = Equipo.query.get(registro['id_insumo'])
            nombre = eq.nombre if eq else ''
            unidad = eq.unidad if eq else ''
        elif tipo == 'Maquinaria':
            maq = maquinaria_cache.get(registro['id_insumo'])
            if not maq:
                maq = Maquinaria.query.get(registro['id_insumo'])
            nombre = maq.nombre if maq else ''
            unidad = maq.unidad if maq and hasattr(maq, 'unidad') else 'hora'
        else:
            nombre = registro.get('nombre') or ''
            unidad = ''

        matriz_detalle.append({
            'tipo_insumo': tipo,
            'nombre': nombre,
            'cantidad': float(cantidad),
            'unidad': unidad,
            'precio_unitario': float(costo_unitario),
            'importe': float(importe),
        })

    # Calcular resultados
    resultado = calcular_precio_unitario(concepto_id=concepto_id)
    costo_directo = resultado['costo_directo']
    precio_unitario = resultado['precio_unitario']
    sobrecosto = precio_unitario - costo_directo
    porcentaje_sobrecosto = (sobrecosto / costo_directo * 100) if costo_directo > 0 else 0

    # Generar PDF
    buffer = io.BytesIO()
    try:
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=14, textColor=colors.HexColor('#1f4788'), spaceAfter=6)
        header_style = ParagraphStyle('CustomHeader', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#666666'), spaceAfter=3)
        
        doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=25*mm, bottomMargin=20*mm)
        story = []

        # Encabezado profesional
        story.append(Paragraph("NOTA DE VENTA / ANÁLISIS DE PRECIO UNITARIO", title_style))
        story.append(Paragraph("Documento Preliminar - Confidencial", header_style))
        story.append(Spacer(1, 10))

        # Información del concepto
        story.append(Paragraph(f"<b>Concepto:</b> {concepto.descripcion}", styles['Normal']))
        story.append(Paragraph(f"<b>Unidad de Medida:</b> {concepto.unidad_concepto}", styles['Normal']))
        story.append(Spacer(1, 12))

        # Tabla de resumen financiero
        resumen_data = [
            ["Componente", "Valor (MXN)", "Porcentaje"],
            ["Costo Directo (CD)", f"${costo_directo:,.2f}", "100.00%"],
            ["Sobrecosto (Indirectos + Utilidad)", f"${sobrecosto:,.2f}", f"{porcentaje_sobrecosto:.2f}%"],
            ["PRECIO UNITARIO (PU) FINAL", f"${precio_unitario:,.2f}", f"{(precio_unitario/costo_directo*100):.2f}%"],
        ]
        resumen_table = Table(resumen_data, colWidths=[90*mm, 50*mm, 35*mm])
        resumen_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor('#1f4788')),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 10),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
            ("GRID", (0, 0), (-1, -1), 1, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, 2), [colors.beige, colors.white]),
            ("BACKGROUND", (0, 3), (-1, 3), colors.HexColor('#e8f0f8')),
            ("FONTNAME", (0, 3), (-1, 3), "Helvetica-Bold"),
            ("FONTSIZE", (0, 3), (-1, 3), 11),
        ]))
        story.append(resumen_table)
        story.append(Spacer(1, 15))

        # Tabla de desglose de insumos
        story.append(Paragraph("<b>Desglose de Insumos (Matriz)</b>", styles['Heading2']))
        story.append(Spacer(1, 6))

        insumos_data = [["Tipo", "Descripción", "Cantidad", "Unidad", "Precio Unit. (MXN)", "Importe (MXN)"]]
        for row in matriz_detalle:
            insumos_data.append([
                row.get("tipo_insumo", ""),
                row.get("nombre", "")[:40],  # Limitar longitud
                f"{row.get('cantidad', 0):.4f}",
                row.get("unidad", ""),
                f"${row.get('precio_unitario', 0):,.2f}",
                f"${row.get('importe', 0):,.2f}",
            ])

        insumos_table = Table(insumos_data, colWidths=[35*mm, 50*mm, 23*mm, 18*mm, 32*mm, 32*mm])
        insumos_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor('#1f4788')),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
            ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
            ("ALIGN", (1, 1), (1, -1), "LEFT"),
            ("GRID", (0, 0), (-1, -1), 1, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
        ]))
        story.append(insumos_table)
        story.append(Spacer(1, 15))

        # Pie de página con nota legal
        story.append(Paragraph(
            "<font size=7 color='#666666'><i>Nota: Este documento es preliminar y confidencial. Generado automáticamente por el sistema de Precios Unitarios.</i></font>",
            styles['Normal']
        ))

        # Construir el PDF
        doc.build(story)
        pdf_bytes = buffer.getvalue()

    except Exception as e:
        current_app.logger.error(f"Error al generar PDF con ReportLab: {e}")
        return jsonify({"error": "Fallo al generar PDF"}), 500

    return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=True, download_name=f'nota_venta_{concepto_id}.pdf')


def decimal_field(value) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    if isinstance(value, str) and not value.strip():
        return Decimal("0")
    return Decimal(str(value))


@app.route("/api/materiales", methods=["GET", "POST"])
def materiales_collection():
    if request.method == "GET":
        materiales = Material.query.order_by(Material.nombre).all()
        return jsonify([mat.to_dict() for mat in materiales])

    payload = request.get_json(force=True)
    material = Material(
        nombre=payload["nombre"],
        unidad=payload["unidad"],
        precio_unitario=decimal_field(payload["precio_unitario"]),
        fecha_actualizacion=date.fromisoformat(payload.get("fecha_actualizacion")) if payload.get("fecha_actualizacion") else date.today(),
        porcentaje_merma=decimal_field(payload.get("porcentaje_merma", Decimal("0.03"))),
        precio_flete_unitario=decimal_field(payload.get("precio_flete_unitario", Decimal("0.00"))),
        disciplina=payload.get("disciplina"),
        calidad=payload.get("calidad"),
    )
    db.session.add(material)
    db.session.commit()
    return jsonify(material.to_dict()), 201


@app.route("/api/materiales/<int:material_id>", methods=["GET", "PUT", "DELETE"])
def material_detail(material_id: int):
    material = Material.query.get_or_404(material_id)
    if request.method == "GET":
        return jsonify(material.to_dict())

    if request.method == "DELETE":
        db.session.delete(material)
        db.session.commit()
        return "", 204

    payload = request.get_json(force=True)
    material.nombre = payload.get("nombre", material.nombre)
    material.unidad = payload.get("unidad", material.unidad)
    if "precio_unitario" in payload:
        material.precio_unitario = decimal_field(payload["precio_unitario"])
    if "fecha_actualizacion" in payload:
        material.fecha_actualizacion = date.fromisoformat(payload["fecha_actualizacion"])
    if "disciplina" in payload:
        material.disciplina = payload.get("disciplina")
    if "calidad" in payload:
        material.calidad = payload.get("calidad")
    if "porcentaje_merma" in payload:
        material.porcentaje_merma = decimal_field(payload["porcentaje_merma"])
    if "precio_flete_unitario" in payload:
        material.precio_flete_unitario = decimal_field(payload["precio_flete_unitario"])
    db.session.commit()
    return jsonify(material.to_dict())


@app.route("/api/equipo", methods=["GET", "POST"])
def equipo_collection():
    if request.method == "GET":
        equipos = Equipo.query.order_by(Equipo.nombre).all()
        return jsonify([equ.to_dict() for equ in equipos])

    payload = request.get_json(force=True)
    equipo = Equipo(
        nombre=payload["nombre"],
        unidad=payload["unidad"],
        disciplina=payload.get("disciplina"),
        calidad=payload.get("calidad"),
        fecha_actualizacion=date.fromisoformat(payload.get("fecha_actualizacion")) if payload.get("fecha_actualizacion") else date.today(),
        costo_hora_maq=decimal_field(payload["costo_hora_maq"]),
    )
    db.session.add(equipo)
    db.session.commit()
    return jsonify(equipo.to_dict()), 201


@app.route("/api/equipo/<int:equipo_id>", methods=["GET", "PUT", "DELETE"])
def equipo_detail(equipo_id: int):
    equipo = Equipo.query.get_or_404(equipo_id)
    if request.method == "GET":
        return jsonify(equipo.to_dict())

    if request.method == "DELETE":
        db.session.delete(equipo)
        db.session.commit()
        return "", 204

    payload = request.get_json(force=True)
    equipo.nombre = payload.get("nombre", equipo.nombre)
    equipo.unidad = payload.get("unidad", equipo.unidad)
    if "disciplina" in payload:
        equipo.disciplina = payload.get("disciplina")
    if "calidad" in payload:
        equipo.calidad = payload.get("calidad")
    if "fecha_actualizacion" in payload:
        equipo.fecha_actualizacion = date.fromisoformat(payload["fecha_actualizacion"])
    if "costo_hora_maq" in payload:
        equipo.costo_hora_maq = decimal_field(payload["costo_hora_maq"])
    db.session.commit()
    return jsonify(equipo.to_dict())


@app.route("/api/maquinaria", methods=["GET", "POST"])
def maquinaria_collection():
    if request.method == "GET":
        maquinas = Maquinaria.query.order_by(Maquinaria.nombre).all()
        return jsonify([maq.to_dict() for maq in maquinas])

    payload = request.get_json(force=True)
    maquinaria = Maquinaria(
        nombre=payload["nombre"],
        costo_adquisicion=decimal_field(payload["costo_adquisicion"]),
        vida_util_horas=decimal_field(payload["vida_util_horas"]),
        tasa_interes_anual=decimal_field(payload.get("tasa_interes_anual", Decimal("0.10"))),
        rendimiento_horario=decimal_field(payload.get("rendimiento_horario", Decimal("1.0"))),
        disciplina=payload.get("disciplina"),
        calidad=payload.get("calidad"),
        fecha_actualizacion=date.fromisoformat(payload.get("fecha_actualizacion")) if payload.get("fecha_actualizacion") else date.today(),
    )
    maquinaria.actualizar_costo_posesion()
    db.session.add(maquinaria)
    db.session.commit()
    return jsonify(maquinaria.to_dict()), 201


@app.route("/api/maquinaria/<int:maquinaria_id>", methods=["GET", "PUT", "DELETE"])
def maquinaria_detail(maquinaria_id: int):
    maquinaria = Maquinaria.query.get_or_404(maquinaria_id)
    if request.method == "GET":
        return jsonify(maquinaria.to_dict())

    if request.method == "DELETE":
        db.session.delete(maquinaria)
        db.session.commit()
        return "", 204

    payload = request.get_json(force=True)
    maquinaria.nombre = payload.get("nombre", maquinaria.nombre)
    if "disciplina" in payload:
        maquinaria.disciplina = payload.get("disciplina")
    if "calidad" in payload:
        maquinaria.calidad = payload.get("calidad")
    if "fecha_actualizacion" in payload:
        maquinaria.fecha_actualizacion = date.fromisoformat(payload["fecha_actualizacion"])
    if "costo_adquisicion" in payload:
        maquinaria.costo_adquisicion = decimal_field(payload["costo_adquisicion"])
    if "vida_util_horas" in payload:
        maquinaria.vida_util_horas = decimal_field(payload["vida_util_horas"])
    if "tasa_interes_anual" in payload:
        maquinaria.tasa_interes_anual = decimal_field(payload["tasa_interes_anual"])
    if "rendimiento_horario" in payload:
        maquinaria.rendimiento_horario = decimal_field(payload["rendimiento_horario"])
    maquinaria.actualizar_costo_posesion()
    db.session.commit()
    return jsonify(maquinaria.to_dict())


@app.route("/api/manoobra", methods=["GET", "POST"])
def manoobra_collection():
    if request.method == "GET":
        mano_obra = ManoObra.query.order_by(ManoObra.puesto).all()
        return jsonify([mano.to_dict() for mano in mano_obra])

    payload = request.get_json(force=True)
    mano = ManoObra(
        puesto=payload["puesto"],
        salario_base=decimal_field(payload["salario_base"]),
        antiguedad_anios=payload.get("antiguedad_anios", 1),
        rendimiento_jornada=decimal_field(payload.get("rendimiento_jornada", Decimal("1.0"))),
        disciplina=payload.get("disciplina"),
        calidad=payload.get("calidad"),
        fecha_actualizacion=date.fromisoformat(payload.get("fecha_actualizacion")) if payload.get("fecha_actualizacion") else date.today(),
    )
    mano.refresh_fasar()
    db.session.add(mano)
    db.session.commit()
    return jsonify(mano.to_dict()), 201


@app.route("/api/manoobra/<int:mano_id>", methods=["GET", "PUT", "DELETE"])
def manoobra_detail(mano_id: int):
    mano = ManoObra.query.get_or_404(mano_id)
    if request.method == "GET":
        return jsonify(mano.to_dict())

    if request.method == "DELETE":
        db.session.delete(mano)
        db.session.commit()
        return "", 204

    payload = request.get_json(force=True)
    mano.puesto = payload.get("puesto", mano.puesto)
    if "disciplina" in payload:
        mano.disciplina = payload.get("disciplina")
    if "calidad" in payload:
        mano.calidad = payload.get("calidad")
    if "fecha_actualizacion" in payload:
        mano.fecha_actualizacion = date.fromisoformat(payload["fecha_actualizacion"])
    if "salario_base" in payload:
        mano.salario_base = decimal_field(payload["salario_base"])
    if "antiguedad_anios" in payload:
        mano.antiguedad_anios = int(payload["antiguedad_anios"])
    if "rendimiento_jornada" in payload:
        mano.rendimiento_jornada = decimal_field(payload["rendimiento_jornada"])
    mano.refresh_fasar()
    db.session.commit()
    return jsonify(mano.to_dict())


@app.route("/api/conceptos", methods=["GET", "POST"])
def conceptos_collection():
    if request.method == "GET":
        conceptos = Concepto.query.order_by(Concepto.clave).all()
        return jsonify([concepto.to_dict() for concepto in conceptos])

    payload = request.get_json(force=True)
    concepto = Concepto(
        clave=payload["clave"],
        descripcion=payload["descripcion"],
        unidad_concepto=payload["unidad_concepto"],
    )
    db.session.add(concepto)
    db.session.commit()
    return jsonify(concepto.to_dict()), 201


@app.route("/api/conceptos/<int:concepto_id>", methods=["GET", "PUT", "DELETE"])
def concepto_detail(concepto_id: int):
    concepto = Concepto.query.get_or_404(concepto_id)
    if request.method == "GET":
        return jsonify(concepto.to_dict())

    if request.method == "DELETE":
        db.session.delete(concepto)
        db.session.commit()
        return "", 204

    payload = request.get_json(force=True)
    concepto.clave = payload.get("clave", concepto.clave)
    concepto.descripcion = payload.get("descripcion", concepto.descripcion)
    concepto.unidad_concepto = payload.get("unidad_concepto", concepto.unidad_concepto)
    db.session.commit()
    return jsonify(concepto.to_dict())


@app.route("/api/conceptos/<int:concepto_id>/matriz", methods=["GET"])
def concepto_matriz(concepto_id: int):
    Concepto.query.get_or_404(concepto_id)
    registros = MatrizInsumo.query.filter_by(concepto_id=concepto_id).all()
    return jsonify([registro.to_dict() for registro in registros])


@app.route("/api/matriz", methods=["POST"])
def matriz_create():
    payload = request.get_json(force=True)
    registro = MatrizInsumo(
        concepto_id=payload["concepto"],
        tipo_insumo=payload["tipo_insumo"],
        id_insumo=payload["id_insumo"],
        cantidad=decimal_field(payload["cantidad"]),
        porcentaje_merma=decimal_field(payload.get("porcentaje_merma")) if payload.get("porcentaje_merma") is not None else None,
        precio_flete_unitario=decimal_field(payload.get("precio_flete_unitario")) if payload.get("precio_flete_unitario") is not None else None,
    )
    db.session.add(registro)
    db.session.commit()
    return jsonify(registro.to_dict()), 201


@app.route("/api/matriz/<int:registro_id>", methods=["PUT", "DELETE"])
def matriz_update(registro_id: int):
    registro = MatrizInsumo.query.get_or_404(registro_id)
    if request.method == "DELETE":
        db.session.delete(registro)
        db.session.commit()
        return "", 204

    payload = request.get_json(force=True)
    registro.tipo_insumo = payload.get("tipo_insumo", registro.tipo_insumo)
    if "id_insumo" in payload:
        registro.id_insumo = payload["id_insumo"]
    if "cantidad" in payload:
        registro.cantidad = decimal_field(payload["cantidad"])
    if "porcentaje_merma" in payload:
        registro.porcentaje_merma = (
            decimal_field(payload["porcentaje_merma"]) if payload["porcentaje_merma"] is not None else None
        )
    if "precio_flete_unitario" in payload:
        registro.precio_flete_unitario = (
            decimal_field(payload["precio_flete_unitario"]) if payload["precio_flete_unitario"] is not None else None
        )
    db.session.commit()
    return jsonify(registro.to_dict())


@app.route("/api/proyectos", methods=["GET", "POST"])
def proyectos_collection():
    if request.method == "GET":
        proyectos = Proyecto.query.order_by(Proyecto.fecha_creacion.desc()).all()
        return jsonify([proy.to_dict() for proy in proyectos])

    payload = request.get_json(force=True)
    proyecto = Proyecto(
        nombre_proyecto=payload["nombre_proyecto"],
        ubicacion=payload.get("ubicacion"),
        descripcion=payload.get("descripcion", ""),
        fecha_creacion=date.today(),
    )
    aplicar_configuracion_proyecto(proyecto, payload)
    db.session.add(proyecto)
    db.session.commit()
    return jsonify(proyecto.to_dict()), 201


@app.route("/api/proyectos/<int:proyecto_id>", methods=["GET", "PUT", "DELETE"])
def proyecto_detail(proyecto_id: int):
    proyecto = Proyecto.query.get_or_404(proyecto_id)
    if request.method == "GET":
        return jsonify(proyecto.to_dict())

    if request.method == "DELETE":
        db.session.delete(proyecto)
        db.session.commit()
        return "", 204

    payload = request.get_json(force=True)
    proyecto.nombre_proyecto = payload.get("nombre_proyecto", proyecto.nombre_proyecto)
    if "ubicacion" in payload:
        proyecto.ubicacion = payload["ubicacion"]
    if "descripcion" in payload:
        proyecto.descripcion = payload["descripcion"]
    aplicar_configuracion_proyecto(proyecto, payload)
    db.session.commit()
    return jsonify(proyecto.to_dict())


@app.route("/api/proyectos/<int:proyecto_id>/partidas", methods=["GET"])
def partidas_por_proyecto(proyecto_id: int):
    Proyecto.query.get_or_404(proyecto_id)
    partidas = Partida.query.filter_by(proyecto_id=proyecto_id).order_by(Partida.nombre_partida).all()
    return jsonify([partida.to_dict() for partida in partidas])


@app.route("/api/partidas", methods=["POST"])
def partidas_create():
    payload = request.get_json(force=True)
    partida = Partida(
        proyecto_id=payload["proyecto"],
        nombre_partida=payload["nombre_partida"],
    )
    db.session.add(partida)
    db.session.commit()
    return jsonify(partida.to_dict()), 201


@app.route("/api/partidas/<int:partida_id>/detalles", methods=["GET"])
def detalles_por_partida(partida_id: int):
    Partida.query.get_or_404(partida_id)
    detalles = DetallePresupuesto.query.filter_by(partida_id=partida_id).all()
    return jsonify([detalle.to_dict() for detalle in detalles])


@app.route("/api/detalles-presupuesto", methods=["POST"])
def detalle_create():
    payload = request.get_json(force=True)
    concepto_id = payload["concepto"]
    partida = Partida.query.get_or_404(payload["partida"])
    factores = obtener_factores_de_proyecto(partida.proyecto)
    resultado_pu = calcular_precio_unitario(concepto_id=concepto_id, factores=factores)
    pu = payload.get("precio_unitario_calculado")
    if pu is not None:
        resultado_pu["precio_unitario"] = float(pu)
    detalle = DetallePresupuesto(
        partida_id=partida.id,
        concepto_id=concepto_id,
        cantidad_obra=decimal_field(payload["cantidad_obra"]),
        precio_unitario_calculado=decimal_field(resultado_pu["precio_unitario"]),
        costo_directo=decimal_field(resultado_pu.get("costo_directo", pu)),
    )
    db.session.add(detalle)
    db.session.commit()
    return jsonify(detalle.to_dict()), 201


@app.route("/api/detalles-presupuesto/<int:detalle_id>", methods=["PUT", "DELETE"])
def detalle_update(detalle_id: int):
    detalle = DetallePresupuesto.query.get_or_404(detalle_id)
    if request.method == "DELETE":
        db.session.delete(detalle)
        db.session.commit()
        return "", 204

    payload = request.get_json(force=True)
    if "cantidad_obra" in payload:
        detalle.cantidad_obra = decimal_field(payload["cantidad_obra"])
    db.session.commit()
    return jsonify(detalle.to_dict())


@app.route("/api/fasar/calcular", methods=["POST"])
def recalcular_fasar():
    mano_obra = ManoObra.query.all()
    for mano in mano_obra:
        mano.refresh_fasar()
    db.session.commit()
    return jsonify({"count": len(mano_obra)}), 200


@app.route("/api/conceptos/calcular_pu", methods=["POST"])
def calcular_pu_endpoint():
    payload = request.get_json(force=True)
    concepto_id = payload.get("concepto_id")
    matriz = payload.get("matriz")
    factores = normalizar_factores(payload.get("factores"))
    resultado = calcular_precio_unitario(concepto_id=concepto_id, matriz=matriz, factores=factores)
    return jsonify(resultado)


@app.route("/api/ia/generar_apu_sugerido", methods=["POST"])
def generar_apu_sugerido():
    payload = request.get_json(force=True)
    descripcion = payload.get("descripcion_concepto", "")
    if not descripcion:
        return jsonify([])
    concepto_id = payload.get("concepto_id")
    sugerencias = construir_sugerencia_apu(descripcion, concepto_id)
    return jsonify(sugerencias)


def extraer_json_de_texto(contenido: str) -> Optional[str]:
    texto = (contenido or "").strip()
    if not texto:
        return None
    try:
        json.loads(texto)
        return texto
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", texto, re.DOTALL)
        if match:
            posible = match.group(0)
            try:
                json.loads(posible)
                return posible
            except json.JSONDecodeError:
                return None
    return None


def generar_apu_con_gemini(descripcion, unidad):
    """
    Llama a la API de Google Gemini para generar un APU en formato JSON.
    Devuelve un dict con 'explicacion' e 'insumos' o None si falla.
    """
    if not GEMINI_API_KEY:
        return None

    texto = (descripcion or "").strip()
    if not texto:
        return None

    try:
        prompt_completo = f"""
Eres un ingeniero de costos experto en analisis de precios unitarios (APU) para construccion en Mexico.
Genera un Analisis de Precio Unitario (APU) para el siguiente concepto de construccion.

Descripcion del concepto: "{texto}"
Unidad del concepto: "{unidad}"

Responde EXCLUSIVAMENTE en JSON con la siguiente estructura:

{{
  "explicacion": "texto breve explicando que materiales, mano de obra y equipo propusiste y por que",
  "insumos": [
    {{
      "tipo_insumo": "Material | Mano de Obra | Equipo | Maquinaria",
      "nombre": "Nombre del insumo, por ejemplo 'Cemento gris saco 50kg'",
      "unidad": "Unidad del insumo, por ejemplo 'saco', 'm3', 'jornada', 'hora'",
      "cantidad": 0.0,
      "merma": 0.0,
      "flete_unitario": 0.0,
      "rendimiento_diario": null
    }}
  ]
}}

Reglas:
- Usa cantidades y rendimientos razonables para obra tradicional en Mexico.
- Incluye materiales principales, mano de obra y equipo realmente necesarios.
- NO incluyas ningun comentario fuera del JSON.
"""

        model = genai.GenerativeModel(model_name=GEMINI_MODEL)
        respuesta = model.generate_content(
            prompt_completo,
            generation_config={"temperature": 0.2},
        )

        contenido = getattr(respuesta, "text", "") or ""
        bloque = extraer_json_de_texto(contenido)
        if not bloque:
            return None

        data = json.loads(bloque)
        if not isinstance(data, dict):
            return None

        insumos = data.get("insumos") or []
        if not isinstance(insumos, list) or not insumos:
            return None

        return data

    except Exception:
        try:
            current_app.logger.exception("Error al llamar a Gemini para generar APU")
        except Exception:
            pass
        return None


def construir_matriz_desde_gemini(data_gemini):
    """
    Toma el dict devuelto por generar_apu_con_gemini y lo convierte
    al mismo formato de 'sugerencias' que usa construir_sugerencia_apu.
    """
    if not data_gemini:
        return []

    insumos_ia = data_gemini.get("insumos") or []
    if not isinstance(insumos_ia, list):
        return []

    materiales = list(Material.query.all())
    mano_obra = list(ManoObra.query.all())
    equipo = list(Equipo.query.all())
    maquinaria = list(Maquinaria.query.all())

    sugerencias: List[Dict] = []

    def buscar_por_nombre(catalogo, atributo, nombre_busqueda: str):
        if not catalogo:
            return None
        texto = (nombre_busqueda or "").strip().lower()
        if not texto:
            return None
        for registro in catalogo:
            valor = (getattr(registro, atributo, "") or "").strip().lower()
            if not valor:
                continue
            if texto in valor or valor in texto:
                return registro
        return None

    tipo_map = {
        "material": "Material",
        "manodeobra": "ManoObra",
        "equipo": "Equipo",
        "maquinaria": "Maquinaria",
    }

    for item in insumos_ia:
        tipo_raw = item.get("tipo_insumo") or item.get("tipo") or ""
        nombre_raw = item.get("nombre") or ""
        unidad_raw = item.get("unidad") or ""
        cantidad = item.get("cantidad", 0) or 0
        merma = item.get("merma", 0) or 0
        flete_unitario = item.get("flete_unitario", 0) or 0
        rendimiento_diario = item.get("rendimiento_diario")

        tipo_norm = normalizar_tipo_insumo(tipo_raw)
        tipo_canon = tipo_map.get(tipo_norm)
        if not tipo_canon:
            continue

        obj = None
        if tipo_canon == "Material":
            obj = buscar_por_nombre(materiales, "nombre", nombre_raw)
        elif tipo_canon == "ManoObra":
            obj = buscar_por_nombre(mano_obra, "puesto", nombre_raw)
        elif tipo_canon == "Equipo":
            obj = buscar_por_nombre(equipo, "nombre", nombre_raw)
        elif tipo_canon == "Maquinaria":
            obj = buscar_por_nombre(maquinaria, "nombre", nombre_raw)

        if obj is None:
            continue

        insumo_id = obj.id
        if hasattr(obj, "nombre"):
            nombre_real = obj.nombre
        elif hasattr(obj, "puesto"):
            nombre_real = obj.puesto
        else:
            nombre_real = nombre_raw

        unidad_real = getattr(obj, "unidad", unidad_raw)
        rendimiento = None
        if rendimiento_diario is not None:
            try:
                rendimiento = float(rendimiento_diario)
            except (TypeError, ValueError):
                rendimiento = None

        merma_val = None
        try:
            merma_val = float(merma)
        except (TypeError, ValueError):
            merma_val = None

        flete_val = None
        try:
            flete_val = float(flete_unitario)
        except (TypeError, ValueError):
            flete_val = None

        cantidad_val = 0.0
        try:
            cantidad_val = float(cantidad)
        except (TypeError, ValueError):
            cantidad_val = 0.0

        justificacion = item.get("justificacion_breve") or item.get("justificacion")

        sugerencias.append(
            {
                "tipo_insumo": tipo_canon,
                "insumo_id": insumo_id,
                "id_insumo": insumo_id,
                "nombre": nombre_real,
                "unidad": unidad_real,
                "cantidad": cantidad_val,
                "merma": merma_val,
                "porcentaje_merma": merma_val,
                "flete_unitario": flete_val,
                "precio_flete_unitario": flete_val,
                "rendimiento_diario": rendimiento,
                "rendimiento_jornada": rendimiento,
                "costo_unitario": 0.0,
                "justificacion_breve": justificacion,
            }
        )

    return sugerencias


@app.route("/api/ia/chat_apu", methods=["POST"])
def chat_apu():
    data = request.get_json() or {}
    descripcion = data.get("descripcion", "") or ""
    unidad = data.get("unidad", "") or ""
    concepto_id = data.get("concepto_id")

    data_gemini = generar_apu_con_gemini(descripcion, unidad)
    sugerencias: List[Dict] = []
    explicacion = ""

    if data_gemini is not None:
        sugerencias = construir_matriz_desde_gemini(data_gemini)
        explicacion = data_gemini.get("explicacion") or ""

    if not sugerencias:
        sugerencias = construir_sugerencia_apu(descripcion, concepto_id)
        explicacion = construir_explicacion_para_chat(descripcion, sugerencias)
    elif not explicacion:
        explicacion = construir_explicacion_para_chat(descripcion, sugerencias)

    insumos_json: List[Dict] = []

    for item in sugerencias:
        tipo = item.get("tipo_insumo") or item.get("tipo")
        insumo_id = item.get("insumo_id") or item.get("id_insumo")

        nombre_insumo = None
        unidad_insumo = None

        obj = None
        tipo_norm = (tipo or "").replace(" ", "").lower()
        if tipo_norm == "material" and insumo_id:
            obj = Material.query.get(insumo_id)
        elif tipo_norm in {"manodeobra", "manoobra"} and insumo_id:
            obj = ManoObra.query.get(insumo_id)
        elif tipo_norm == "equipo" and insumo_id:
            obj = Equipo.query.get(insumo_id)
        elif tipo_norm == "maquinaria" and insumo_id:
            obj = Maquinaria.query.get(insumo_id)

        if obj is not None:
            if hasattr(obj, "nombre"):
                nombre_insumo = obj.nombre
            elif hasattr(obj, "puesto"):
                nombre_insumo = obj.puesto
            if hasattr(obj, "unidad"):
                unidad_insumo = obj.unidad

        insumos_json.append(
            {
                "tipo_insumo": tipo,
                "insumo_id": insumo_id,
                "nombre": nombre_insumo,
                "unidad": unidad_insumo,
                "cantidad": item.get("cantidad", 0),
                "merma": item.get("merma", item.get("porcentaje_merma", 0)),
                "flete_unitario": item.get("flete_unitario", item.get("precio_flete_unitario", 0)),
                "rendimiento_diario": item.get("rendimiento_diario", item.get("rendimiento_jornada", 0)),
                "costo_unitario": item.get(
                    "costo_unitario",
                    item.get("precio_unitario_calculado", item.get("precio_unitario", 0)),
                ),
                "justificacion_breve": item.get("justificacion_breve") or item.get("justificacion"),
            }
        )

    return jsonify({"explicacion": explicacion, "insumos": insumos_json})

@app.route("/api/ia/explicar_sugerencia", methods=["GET"])
def explicar_sugerencia():
    concepto_id = request.args.get("concepto_id", type=int)
    descripcion = request.args.get("descripcion_concepto", "")
    if concepto_id and not descripcion:
        concepto = Concepto.query.get_or_404(concepto_id)
        descripcion = concepto.descripcion
    if not descripcion:
        return jsonify({"explicacion": "Proporcione una descripcion del concepto para obtener la explicacion."})
    sugerencias = construir_sugerencia_apu(descripcion, concepto_id)
    explicacion = construir_explicacion_para_chat(descripcion, sugerencias)
    return jsonify({"explicacion": explicacion})


def normalizar_tipo_insumo(tipo: Optional[str]) -> str:
    if not tipo:
        return ""
    return tipo.replace(" ", "").replace("_", "").lower()


def obtener_insumo_catalogo(tipo: Optional[str], insumo_id: Optional[int]):
    if not tipo or not insumo_id:
        return None
    tipo_normalizado = normalizar_tipo_insumo(tipo)
    if tipo_normalizado == "material":
        return Material.query.get(insumo_id)
    if tipo_normalizado == "manodeobra":
        return ManoObra.query.get(insumo_id)
    if tipo_normalizado == "equipo":
        return Equipo.query.get(insumo_id)
    if tipo_normalizado == "maquinaria":
        return Maquinaria.query.get(insumo_id)
    return None


def construir_explicacion_para_chat(descripcion, sugerencias):
    texto = (descripcion or "").lower()
    base = ""

    if "barda" in texto and "tabique" in texto:
        base = (
            "Se detectó una barda de tabique; se usaron tabique, mortero "
            "(cemento + arena) y cuadrilla albañil + peón."
        )
    elif "concreto" in texto and ("f'c" in texto or "f\u2019c" in texto or "fc=" in texto):
        base = (
            "Se detectó concreto estructural f'c; se propuso dosificación típica "
            "con cemento, arena, grava y agua; más cuadrilla de colado y equipo."
        )
    else:
        base = (
            "Se generó una matriz sugerida basándose en la descripción del concepto "
            "y los insumos disponibles en catálogo."
        )

    return f"{base} Se generaron {len(sugerencias)} renglones."


def calcular_fasar_valor() -> Decimal:
    constantes = ConstantesFASAR.get_singleton()
    dias_pagados = (
        Decimal(constantes.dias_del_anio)
        + Decimal(constantes.dias_aguinaldo_minimos)
        + Decimal(constantes.dias_vacaciones_minimos) * Decimal(constantes.prima_vacacional_porcentaje)
    )
    dias_trabajados = (
        Decimal(constantes.dias_del_anio)
        - Decimal(constantes.dias_festivos_obligatorios)
        - Decimal(constantes.dias_vacaciones_minimos)
        - Decimal(constantes.dias_riesgo_trabajo_promedio)
    )
    if dias_trabajados <= 0:
        return Decimal("1.0")
    factor_dias = dias_pagados / dias_trabajados
    factor_cargas = Decimal("1.0") + Decimal(constantes.suma_cargas_sociales)
    return factor_dias * factor_cargas


def calcular_precio_unitario(
    concepto_id: Optional[int] = None,
    matriz: Optional[List[Dict]] = None,
    factores: Optional[Dict[str, Dict[str, Decimal]]] = None,
) -> Dict[str, float]:
    registros: List[Dict]
    if matriz is not None:
        registros = matriz
    elif concepto_id:
        registros = [insumo.to_dict() for insumo in MatrizInsumo.query.filter_by(concepto_id=concepto_id)]
    else:
        registros = []

    cd_base = Decimal("0")
    costo_mano_obra = Decimal("0")
    material_cache: Dict[int, Material] = {}
    mano_obra_cache: Dict[int, ManoObra] = {}
    equipo_cache: Dict[int, Equipo] = {}
    maquinaria_cache: Dict[int, Maquinaria] = {}
    for registro in registros:
        cantidad = decimal_field(registro["cantidad"])
        costo_unitario = obtener_costo_insumo(
            registro,
            material_cache,
            mano_obra_cache,
            equipo_cache,
            maquinaria_cache,
        )
        importe = cantidad * costo_unitario
        cd_base += importe
        if registro["tipo_insumo"] == "ManoObra":
            costo_mano_obra += importe

    factores = factores or {}
    factor_mano_obra = obtener_factor_decimal(factores, "mano_obra")
    ajuste_mano_obra = costo_mano_obra * factor_mano_obra
    cd_total = cd_base + ajuste_mano_obra
    multiplicador = Decimal("1.0")
    for key in ("indirectos", "financiamiento", "utilidad", "iva"):
        valor = obtener_factor_decimal(factores, key)
        multiplicador *= Decimal("1.0") + valor
    pu = cd_total * multiplicador
    return {
        "costo_directo": float(cd_total),
        "precio_unitario": float(pu),
    }


def obtener_factor_decimal(factores: Dict[str, Dict[str, Decimal]], clave: str) -> Decimal:
    config = factores.get(clave) or {}
    activo = config.get("activo")
    if not activo:
        return Decimal("0.0")
    porcentaje = config.get("porcentaje", Decimal("0.0"))
    return Decimal(porcentaje)


def normalizar_factores(payload: Optional[Dict]) -> Dict[str, Dict[str, Decimal]]:
    if not payload:
        return {}
    factores: Dict[str, Dict[str, Decimal]] = {}
    for clave in ("mano_obra", "indirectos", "financiamiento", "utilidad", "iva"):
        datos = payload.get(clave) or {}
        factores[clave] = {
            "activo": bool(datos.get("activo")),
            "porcentaje": decimal_field(datos.get("porcentaje")),
        }
    return factores


def obtener_factores_de_proyecto(proyecto: Proyecto) -> Dict[str, Dict[str, Decimal]]:
    return {
        "mano_obra": {
            "activo": bool(proyecto.ajuste_mano_obra_activo),
            "porcentaje": decimal_field(proyecto.ajuste_mano_obra_porcentaje),
        },
        "indirectos": {
            "activo": bool(proyecto.ajuste_indirectos_activo),
            "porcentaje": decimal_field(proyecto.ajuste_indirectos_porcentaje),
        },
        "financiamiento": {
            "activo": bool(proyecto.ajuste_financiamiento_activo),
            "porcentaje": decimal_field(proyecto.ajuste_financiamiento_porcentaje),
        },
        "utilidad": {
            "activo": bool(proyecto.ajuste_utilidad_activo),
            "porcentaje": decimal_field(proyecto.ajuste_utilidad_porcentaje),
        },
        "iva": {
            "activo": bool(proyecto.ajuste_iva_activo),
            "porcentaje": decimal_field(proyecto.ajuste_iva_porcentaje),
        },
    }


def aplicar_configuracion_proyecto(proyecto: Proyecto, payload: Dict) -> None:
    ajustes = payload.get("ajustes")
    if ajustes:
        ajustes_n = normalizar_factores(ajustes)
        proyecto.ajuste_mano_obra_activo = ajustes_n["mano_obra"]["activo"]
        proyecto.ajuste_mano_obra_porcentaje = ajustes_n["mano_obra"]["porcentaje"]
        proyecto.ajuste_indirectos_activo = ajustes_n["indirectos"]["activo"]
        proyecto.ajuste_indirectos_porcentaje = ajustes_n["indirectos"]["porcentaje"]
        proyecto.ajuste_financiamiento_activo = ajustes_n["financiamiento"]["activo"]
        proyecto.ajuste_financiamiento_porcentaje = ajustes_n["financiamiento"]["porcentaje"]
        proyecto.ajuste_utilidad_activo = ajustes_n["utilidad"]["activo"]
        proyecto.ajuste_utilidad_porcentaje = ajustes_n["utilidad"]["porcentaje"]
        proyecto.ajuste_iva_activo = ajustes_n["iva"]["activo"]
        proyecto.ajuste_iva_porcentaje = ajustes_n["iva"]["porcentaje"]

    proyecto.has_presupuesto_maximo = bool(payload.get("has_presupuesto_maximo"))
    proyecto.monto_maximo = decimal_field(payload.get("monto_maximo"))


def calcular_costo_posesion(maquinaria: Maquinaria) -> Decimal:
    costo = decimal_field(maquinaria.costo_adquisicion)
    vida = decimal_field(maquinaria.vida_util_horas or Decimal("1.0"))
    if vida <= 0:
        vida = Decimal("1.0")
    tasa = decimal_field(maquinaria.tasa_interes_anual or Decimal("0.0"))
    depreciacion = costo / vida
    interes = (costo * tasa) / vida
    return depreciacion + interes


def obtener_costo_insumo(
    registro: Dict,
    material_cache: Dict[int, Material],
    mano_obra_cache: Dict[int, ManoObra],
    equipo_cache: Dict[int, Equipo],
    maquinaria_cache: Dict[int, Maquinaria],
) -> Decimal:
    tipo = registro["tipo_insumo"]
    insumo_id = registro["id_insumo"]
    if tipo == "Material":
        material = material_cache.get(insumo_id)
        if material is None:
            material = Material.query.get_or_404(insumo_id)
            material_cache[insumo_id] = material
        merma = (
            decimal_field(registro.get("porcentaje_merma"))
            if registro.get("porcentaje_merma") is not None
            else decimal_field(material.porcentaje_merma)
        )
        flete = (
            decimal_field(registro.get("precio_flete_unitario"))
            if registro.get("precio_flete_unitario") is not None
            else decimal_field(material.precio_flete_unitario)
        )
        base = decimal_field(material.precio_unitario)
        return base * (Decimal("1.0") + merma) + flete
    if tipo == "ManoObra":
        mano = mano_obra_cache.get(insumo_id)
        if mano is None:
            mano = ManoObra.query.get_or_404(insumo_id)
            mano_obra_cache[insumo_id] = mano
        rendimiento = decimal_field(mano.rendimiento_jornada or Decimal("1.0"))
        if rendimiento <= 0:
            rendimiento = Decimal("1.0")
        salario_real = decimal_field(mano.salario_base) * decimal_field(mano.fasar)
        return salario_real / rendimiento
    if tipo == "Equipo":
        equipo = equipo_cache.get(insumo_id)
        if equipo is None:
            equipo = Equipo.query.get_or_404(insumo_id)
            equipo_cache[insumo_id] = equipo
        return decimal_field(equipo.costo_hora_maq)
    if tipo == "Maquinaria":
        maquina = maquinaria_cache.get(insumo_id)
        if maquina is None:
            maquina = Maquinaria.query.get_or_404(insumo_id)
            maquinaria_cache[insumo_id] = maquina
        rendimiento = decimal_field(maquina.rendimiento_horario or Decimal("1.0"))
        if rendimiento <= 0:
            rendimiento = Decimal("1.0")
        costo_hora = decimal_field(maquina.costo_posesion_hora)
        return costo_hora / rendimiento
    raise ValueError(f"Tipo de insumo no soportado: {tipo}")


def construir_sugerencia_apu(descripcion: str, concepto_id: Optional[int] = None) -> List[Dict]:
    descripcion_original = descripcion or ""
    descripcion = descripcion_original.lower()
    sugerencias: List[Dict] = []

    materiales = list(Material.query.all())
    mano_obra = list(ManoObra.query.all())
    equipo = list(Equipo.query.all())
    maquinaria = list(Maquinaria.query.all())

    def match_material(keyword: str, catalogo_materiales: List[Material]) -> Optional[Material]:
        if not catalogo_materiales:
            return None

        palabra = keyword.lower()

        for item in catalogo_materiales:
            if palabra in item.nombre.lower():
                return item

        return catalogo_materiales[0]

    def match_mano_obra(keyword: str, catalogo_mano_obra: List[ManoObra]) -> Optional[ManoObra]:
        if not catalogo_mano_obra:
            return None

        palabra = (keyword or "").lower()
        if not palabra:
            return catalogo_mano_obra[0]

        for item in catalogo_mano_obra:
            # ManoObra usa 'puesto', NO 'nombre'
            texto = (getattr(item, "puesto", "") or "").lower()
            if palabra in texto:
                return item

        # fallback: primer registro si no hay coincidencias
        return catalogo_mano_obra[0]

    def match_equipo(keyword: str, catalogo_equipo: List[Equipo]) -> Optional[Equipo]:
        if not catalogo_equipo:
            return None

        palabra = keyword.lower()

        for item in catalogo_equipo:
            if palabra in item.nombre.lower():
                return item

        return catalogo_equipo[0]

    def match_maquinaria(keyword: str, catalogo_maquinaria: List[Maquinaria]) -> Optional[Maquinaria]:
        if not catalogo_maquinaria:
            return None

        palabra = keyword.lower()

        for item in catalogo_maquinaria:
            if palabra in item.nombre.lower():
                return item

        return catalogo_maquinaria[0]

    def construir_justificacion(tipo: str, nombre: Optional[str], mensaje_personalizado: Optional[str] = None) -> Optional[str]:
        if mensaje_personalizado:
            return mensaje_personalizado
        nombre = (nombre or "").strip()
        if not nombre:
            return None
        concepto_ref = descripcion_original.strip() or "el concepto solicitado"
        if len(concepto_ref) > 60:
            concepto_ref = concepto_ref[:60].rstrip() + "..."
        if tipo == "Material":
            return f"{nombre}: Material sugerido para {concepto_ref}."
        if tipo == "ManoObra":
            return f"{nombre}: Mano de obra necesaria para ejecutar {concepto_ref}."
        if tipo == "Equipo":
            return f"{nombre}: Equipo de apoyo estimado para {concepto_ref}."
        if tipo == "Maquinaria":
            return f"{nombre}: Maquinaria considerada para cumplir el rendimiento del concepto."
        return None

    def agregar_material(
        material: Optional[Material],
        cantidad: Decimal,
        *,
        merma: Optional[Decimal] = None,
        flete: Optional[Decimal] = None,
        justificacion: Optional[str] = None,
    ):
        if not material:
            return
        justificacion_texto = construir_justificacion("Material", material.nombre, justificacion)
        sugerencias.append(
            {
                "tipo_insumo": "Material",
                "id_insumo": material.id,
                "insumo_id": material.id,
                "cantidad": float(cantidad),
                "precio_unitario_calculado": float(material.precio_unitario),
                "porcentaje_merma": float(merma if merma is not None else (material.porcentaje_merma or 0)),
                "precio_flete_unitario": float(
                    flete if flete is not None else (material.precio_flete_unitario or 0)
                ),
                "rendimiento_jornada": None,
                "existe_en_catalogo": True,
                "nombre": material.nombre,
                "nombre_sugerido": material.nombre,
                "unidad": material.unidad,
                "justificacion_breve": justificacion_texto,
            }
        )

    def agregar_mano(
        mano: Optional[ManoObra],
        factor: Decimal,
        *,
        rendimiento_diario: Optional[Decimal] = None,
        justificacion: Optional[str] = None,
    ):
        if not mano:
            return
        rendimiento = (
            Decimal(rendimiento_diario)
            if rendimiento_diario is not None
            else (mano.rendimiento_jornada or Decimal("1.0"))
        )
        costo_unitario = decimal_field(mano.salario_base) * decimal_field(mano.fasar) / rendimiento
        justificacion_texto = construir_justificacion("ManoObra", mano.puesto, justificacion)
        sugerencias.append(
            {
                "tipo_insumo": "ManoObra",
                "id_insumo": mano.id,
                "insumo_id": mano.id,
                "cantidad": float(factor),
                "precio_unitario_calculado": float(costo_unitario),
                "rendimiento_jornada": float(rendimiento),
                "porcentaje_merma": None,
                "precio_flete_unitario": None,
                "existe_en_catalogo": True,
                "nombre": mano.puesto,
                "nombre_sugerido": mano.puesto,
                "justificacion_breve": justificacion_texto,
            }
        )

    def agregar_equipo(
        equipo_insumo: Optional[Equipo],
        factor: Decimal,
        *,
        rendimiento_diario: Optional[Decimal] = None,
        justificacion: Optional[str] = None,
    ):
        if not equipo_insumo:
            return
        justificacion_texto = construir_justificacion("Equipo", equipo_insumo.nombre, justificacion)
        sugerencias.append(
            {
                "tipo_insumo": "Equipo",
                "id_insumo": equipo_insumo.id,
                "insumo_id": equipo_insumo.id,
                "cantidad": float(factor),
                "precio_unitario_calculado": float(equipo_insumo.costo_hora_maq),
                "rendimiento_jornada": float(rendimiento_diario) if rendimiento_diario else None,
                "porcentaje_merma": None,
                "precio_flete_unitario": None,
                "existe_en_catalogo": True,
                "nombre": equipo_insumo.nombre,
                "nombre_sugerido": equipo_insumo.nombre,
                "unidad": equipo_insumo.unidad,
                "justificacion_breve": justificacion_texto,
            }
        )

    def agregar_maquinaria(
        maquina: Optional[Maquinaria],
        factor: Decimal,
        *,
        rendimiento_diario: Optional[Decimal] = None,
        justificacion: Optional[str] = None,
    ):
        if not maquina:
            return
        divisor = (
            Decimal(rendimiento_diario) if rendimiento_diario is not None else (maquina.rendimiento_horario or Decimal("1.0"))
        )
        if divisor <= 0:
            divisor = Decimal("1.0")
        costo_unitario = decimal_field(maquina.costo_posesion_hora) / divisor
        justificacion_texto = construir_justificacion("Maquinaria", maquina.nombre, justificacion)
        sugerencias.append(
            {
                "tipo_insumo": "Maquinaria",
                "id_insumo": maquina.id,
                "insumo_id": maquina.id,
                "cantidad": float(factor),
                "precio_unitario_calculado": float(costo_unitario),
                "rendimiento_jornada": float(rendimiento_diario)
                if rendimiento_diario is not None
                else float(maquina.rendimiento_horario or 0),
                "porcentaje_merma": None,
                "precio_flete_unitario": None,
                "existe_en_catalogo": True,
                "nombre": maquina.nombre,
                "nombre_sugerido": maquina.nombre,
                "justificacion_breve": justificacion_texto,
            }
        )

    texto = descripcion

    if "barda" in texto and "tabique" in texto:
        sugerencias.clear()
        mat_tabique = match_material("tabique", materiales)
        mat_cemento = match_material("cemento", materiales)
        mat_arena = match_material("arena", materiales)

        agregar_material(
            mat_tabique,
            Decimal("55"),
            merma=Decimal("0.05"),
            flete=Decimal("0"),
            justificacion="Tabique: Es el material base para muros divisorios de 12 cm.",
        )
        agregar_material(
            mat_cemento,
            Decimal("0.14"),
            merma=Decimal("0.03"),
            flete=Decimal("15"),
            justificacion="Cemento: Liga los tabiques y garantiza la resistencia del muro.",
        )
        agregar_material(
            mat_arena,
            Decimal("0.03"),
            merma=Decimal("0.05"),
            flete=Decimal("10"),
            justificacion="Arena: Aporta volumen al mortero utilizado en el muro de tabique.",
        )

        mo_albanil = match_mano_obra("albañil", mano_obra)
        mo_peon = match_mano_obra("peon", mano_obra)
        rendimiento_ref = Decimal("7")
        agregar_mano(
            mo_albanil,
            Decimal("1"),
            rendimiento_diario=rendimiento_ref,
            justificacion="Oficial albanil: Coloca el tabique y cuida la alineacion del muro.",
        )
        agregar_mano(
            mo_peon,
            Decimal("1"),
            rendimiento_diario=rendimiento_ref,
            justificacion="Ayudante: Abastece tabique y mortero para mantener el ritmo de la cuadrilla.",
        )

        eq_revolvedora = match_equipo("revolvedora", equipo)
        agregar_equipo(
            eq_revolvedora,
            Decimal("1"),
            rendimiento_diario=rendimiento_ref,
            justificacion="Revolvedora: Prepara el mortero de asentado del tabique.",
        )

        return sugerencias

    elif "concreto" in texto and ("f'c" in texto or "fc=" in texto or "f’c" in texto):
        sugerencias.clear()
        mat_cemento = match_material("cemento", materiales)
        mat_arena = match_material("arena", materiales)
        mat_grava = match_material("grava", materiales)
        mat_agua = match_material("agua", materiales)

        agregar_material(
            mat_cemento,
            Decimal("7"),
            merma=Decimal("0.03"),
            flete=Decimal("15"),
            justificacion="Cemento: Es el aglutinante principal del concreto f'c.",
        )
        agregar_material(
            mat_arena,
            Decimal("0.5"),
            merma=Decimal("0.05"),
            flete=Decimal("10"),
            justificacion="Arena: Ajusta la trabajabilidad del concreto.",
        )
        agregar_material(
            mat_grava,
            Decimal("0.7"),
            merma=Decimal("0.05"),
            flete=Decimal("10"),
            justificacion="Grava: Proporciona resistencia mecanica a la mezcla.",
        )
        agregar_material(
            mat_agua,
            Decimal("0.2"),
            merma=Decimal("0.0"),
            flete=Decimal("0"),
            justificacion="Agua: Activa el fraguado y determina la colocacion del concreto.",
        )

        mo_albanil = match_mano_obra("albañil", mano_obra)
        mo_peon = match_mano_obra("peon", mano_obra)
        rendimiento_ref = Decimal("8")
        agregar_mano(
            mo_albanil,
            Decimal("1"),
            rendimiento_diario=rendimiento_ref,
            justificacion="Cuadrilla de cimbrado/colado: Coloca y nivela el concreto.",
        )
        agregar_mano(
            mo_peon,
            Decimal("1"),
            rendimiento_diario=rendimiento_ref,
            justificacion="Ayudante: Alimenta la mezcladora y vibra el colado.",
        )

        eq_revolvedora = match_equipo("revolvedora", equipo)
        maq_vibrador = match_maquinaria("vibrador", maquinaria)
        agregar_equipo(
            eq_revolvedora,
            Decimal("1"),
            rendimiento_diario=rendimiento_ref,
            justificacion="Revolvedora: Mezcla el concreto en sitio.",
        )
        agregar_maquinaria(
            maq_vibrador,
            Decimal("1"),
            rendimiento_diario=rendimiento_ref,
            justificacion="Vibrador: Elimina vacios y mejora el acabado del concreto.",
        )

        return sugerencias

    else:
        if "muro" in descripcion or "block" in descripcion:
            material = match_material("cemento", materiales)
            if material:
                agregar_material(material, Decimal("7.5"))
            arena = match_material("arena", materiales)
            if arena:
                agregar_material(arena, Decimal("0.35"))
        else:
            for material in materiales[:2]:
                agregar_material(material, Decimal("1.0"))

        agua = match_material("agua", materiales)
        if agua:
            agregar_material(agua, Decimal("0.2"))

        for mano in mano_obra[:2]:
            agregar_mano(mano, Decimal("0.3"))

        equipo_predeterminado = match_equipo("revolvedora", equipo)
        if equipo_predeterminado:
            agregar_equipo(equipo_predeterminado, Decimal("0.2"))

        retro = match_maquinaria("retro", maquinaria)
        if retro:
            agregar_maquinaria(retro, Decimal("0.1"))

        if not materiales and descripcion_original:
            sugerencias.append(
                {
                    "tipo_insumo": "Material",
                    "id_insumo": 0,
                    "insumo_id": 0,
                    "cantidad": 1.0,
                    "precio_unitario_calculado": 0.0,
                    "porcentaje_merma": 0.03,
                    "precio_flete_unitario": 0.0,
                    "existe_en_catalogo": False,
                    "nombre": f"Material sugerido para {descripcion_original[:30]}",
                    "nombre_sugerido": f"Material sugerido para {descripcion_original[:30]}",
                    "justificacion_breve": f"Material generico necesario para {descripcion_original[:30]}",
                }
            )

        if not mano_obra and descripcion_original:
            sugerencias.append(
                {
                    "tipo_insumo": "ManoObra",
                    "id_insumo": 0,
                    "insumo_id": 0,
                    "cantidad": 1.0,
                    "precio_unitario_calculado": 0.0,
                    "rendimiento_jornada": 8.0,
                    "existe_en_catalogo": False,
                    "nombre": f"Cuadrilla sugerida para {descripcion_original[:30]}",
                    "nombre_sugerido": f"Cuadrilla sugerida para {descripcion_original[:30]}",
                    "justificacion_breve": f"Cuadrilla generica necesaria para {descripcion_original[:30]}",
                }
            )

    return sugerencias


@app.route("/api/catalogos/sugerir_precio_mercado", methods=["POST"])
def sugerir_precio_mercado():
    """
    Endpoint que sugiere un precio de mercado para un insumo basado en su nombre y unidad.
    Utiliza Gemini para simular búsquedas de precios de mercado.
    """
    payload = request.get_json(force=True)
    nombre = payload.get("nombre", "").strip().lower()
    unidad = payload.get("unidad", "").strip()

    if not nombre or not unidad:
        return jsonify({"error": "Nombre y unidad son requeridos"}), 400

    # Diccionario de precios simulados basado en palabras clave
    precios_simulados = {
        "block": {"pza": 5.50, "pieza": 5.50},
        "tabique": {"pza": 3.25, "pieza": 3.25},
        "cemento": {"kg": 0.35, "bulto": 250.00},
        "arena": {"m3": 450.00, "tonelada": 280.00},
        "grava": {"m3": 380.00, "tonelada": 240.00},
        "varilla": {"kg": 18.50, "tonelada": 18500.00},
        "acero": {"kg": 18.50, "tonelada": 18500.00},
        "alambre": {"kg": 22.00, "rollo": 180.00},
        "mortero": {"sacos": 85.00, "kg": 0.45},
        "agua": {"m3": 15.00, "litro": 0.015},
        "pintura": {"litro": 45.00, "cubeta": 350.00},
        "vidrio": {"m2": 120.00, "pieza": 85.00},
        "ladrillo": {"pza": 2.50, "pieza": 2.50},
        "tubo": {"metro": 45.00, "pieza": 150.00},
    }

    precio_sugerido = None
    fuente = "Simulación de Búsqueda de Mercado"

    # Buscar coincidencias en el diccionario
    for palabra_clave, precios_por_unidad in precios_simulados.items():
        if palabra_clave in nombre:
            unidad_normalizada = unidad.lower()
            if unidad_normalizada in precios_por_unidad:
                precio_sugerido = precios_por_unidad[unidad_normalizada]
                break

    # Si no hay coincidencia simulada, usar Gemini si está disponible
    if precio_sugerido is None and GEMINI_API_KEY:
        try:
            model = genai.GenerativeModel(GEMINI_MODEL)
            prompt = f"""
            Proporciona SOLO un número que represente el precio de mercado promedio en MXN (pesos mexicanos) 
            para: "{nombre}" en unidad "{unidad}".
            
            Responde SOLO con el número decimal (ej: 12.50, 450.00).
            Si no conoces el precio, responde con: 0
            """
            response = model.generate_content(prompt)
            respuesta_text = response.text.strip()
            try:
                precio_sugerido = float(respuesta_text)
                fuente = "Gemini AI - Búsqueda de Mercado"
            except ValueError:
                precio_sugerido = 0.0
                fuente = "Error: No se pudo procesar la respuesta de Gemini"
        except Exception as e:
            current_app.logger.error(f"Error al consultar Gemini para precio: {e}")
            precio_sugerido = 0.0
            fuente = f"Error: {str(e)}"

    # Si aún no hay precio, devolver un valor por defecto
    if precio_sugerido is None:
        precio_sugerido = 0.0
        fuente = "No se encontró información de precio"

    return jsonify({
        "nombre": nombre,
        "unidad": unidad,
        "precio_sugerido": float(precio_sugerido),
        "fuente": fuente,
    }), 200


@app.route("/api/catalogos/actualizar_precios_masivo", methods=["POST"])
def actualizar_precios_masivo():
    updates = request.get_json(force=True)
    if not isinstance(updates, list):
        return jsonify({"error": "El payload debe ser una lista de actualizaciones"}), 400

    try:
        for item_update in updates:
            insumo_id = item_update.get("insumo_id")
            tipo = item_update.get("tipo")
            nuevo_precio = decimal_field(item_update.get("nuevo_precio"))

            if not all([insumo_id, tipo, nuevo_precio is not None]):
                continue # Opcional: registrar un warning

            if tipo == "Material":
                insumo = Material.query.get(insumo_id)
                if insumo:
                    insumo.precio_unitario = nuevo_precio
            elif tipo == "ManoObra":
                insumo = ManoObra.query.get(insumo_id)
                if insumo:
                    insumo.salario_base = nuevo_precio
            elif tipo == "Equipo":
                insumo = Equipo.query.get(insumo_id)
                if insumo:
                    insumo.costo_hora_maq = nuevo_precio
            elif tipo == "Maquinaria":
                insumo = Maquinaria.query.get(insumo_id)
                if insumo:
                    insumo.costo_adquisicion = nuevo_precio
        
        db.session.commit()
        return jsonify({"mensaje": f"{len(updates)} precios actualizados exitosamente."}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error en actualización masiva de precios: {e}")
        return jsonify({"error": "Ocurrió un error al actualizar los precios."}), 500


if __name__ == "__main__":
    from seed_data import seed_all_data

    with app.app_context():
        init_db()
        seed_all_data()

    print("Servidor backend corriendo en http://localhost:8000")
    app.run(host="0.0.0.0", port=8000)



