# Resumen del proyecto

Precios Unitarios es una aplicacion de dos capas que permite administrar catalogos de insumos, generar analisis de precio unitario (APU) asistidos por IA y componer presupuestos con seguimiento financiero. El backend en `catalogos/` expone toda la logica de datos y calculo, mientras que el frontend en `frontend/` ofrece una interfaz React con vistas para Presupuestos, Catalogos y Analisis de PU.

## Componentes principales
- **Backend (Flask 3 + SQLAlchemy + SQLite)**: `catalogos/app.py` concentra la configuracion de la app, define los modelos `ConstantesFASAR`, `Material`, `ManoObra`, `Equipo`, `Maquinaria`, `Concepto`, `MatrizInsumo`, `Proyecto`, `Partida` y `DetallePresupuesto`, ademas de utilidades como `calcular_precio_unitario`, `obtener_costo_insumo`, heuristicas de IA y generacion de PDF con ReportLab. Todas las rutas REST (CRUD de catalogos y conceptos, calculos de PU, presupuestos, IA y notas de venta) viven en el mismo archivo y usan `data.sqlite3` como almacenamiento local.
- **Frontend (React 18 + TypeScript + Vite)**: `frontend/src` define el shell (`App.tsx`), el enrutador (`main.tsx`), el cliente `axios` (`api/client.ts`) y paginas especificas. `PresupuestoPage` hospeda `PresupuestoManager`, `CatalogosPage` envuelve `CatalogosDashboard` y `AnalisisPuPage` orquesta el formulario de concepto, los factores de sobrecosto, el editor de matriz y la relacion con las rutas de IA.

## Flujos de trabajo destacados
1. **Catalogos**: CRUD completo de materiales, mano de obra, equipos y maquinaria. Cada registro expone `obsoleto` cuando `fecha_actualizacion` rebasa `PRECIOS_OBSOLETOS_DIAS` (90 dias por defecto). El frontend ofrece formularios dinamicos por tipo y un boton de actualizacion masiva que dispara `/api/catalogos/actualizar_precios_masivo`.
2. **Analisis de PU**: `AnalisisPuPage.tsx` permite capturar o cargar conceptos, solicitar sugerencias IA (`/api/ia/chat_apu`), conciliar las filas generadas contra el catalogo mediante `ConceptoMatrizEditor`, calcular precio unitario remitiendo la matriz a `/api/conceptos/calcular_pu` y generar notas de venta (JSON o PDF).
3. **Presupuestos**: `PresupuestoManager.tsx` administra la jerarquia Proyecto → Partida → Detalle, mantiene formularios para los factores (`mano_obra`, `indirectos`, `financiamiento`, `utilidad`, `iva`), crea partidas y detalla los conceptos invocando `/api/detalles-presupuesto`.
4. **IA y precios sugeridos**: El backend combina heuristicas (`construir_sugerencia_apu`), una integracion opcional con Google Gemini (`generar_apu_con_gemini`) y un flujo de precios de mercado (`/api/catalogos/sugerir_precio_mercado`) que consulta primero la base local, luego coincidencias por nombre, despues tablas simuladas y al final Gemini si hay clave disponible.

## Configuracion y ejecucion
- **Backend**: desde `catalogos/`, crear y activar un virtualenv, instalar dependencias con `pip install -r requirements.txt`, definir `GEMINI_API_KEY`, `GEMINI_MODEL` (opcional) y `PRECIOS_OBSOLETOS_DIAS` en `.env`, y arrancar `python app.py`. Cuando se ejecuta como script se crean las tablas, se precarga `seed_data.py` y la API queda disponible en `http://localhost:8000/api`.
- **Frontend**: en `frontend/`, correr `npm install` y luego `npm run dev` (Vite) para levantar `http://localhost:3000`. La base de la API se configura con `VITE_API_BASE_URL` (por defecto `http://localhost:8000/api`), lo que permite apuntar a entornos distintos sin recompilar el backend.

## Dependencias destacadas
- **Backend**: `flask`, `flask-sqlalchemy`, `flask-cors`, `python-dotenv`, `google-generativeai`, `reportlab` y `pytest` para los tests basicos.
- **Frontend**: `react`, `react-router-dom`, `axios`, Vite y TypeScript.

## Datos iniciales y pruebas
- `catalogos/seed_data.py` ejecuta dentro del contexto de la app para poblar constantes FASAR, materiales, mano de obra, equipo, maquinaria y un concepto de ejemplo con su matriz.
- `catalogos/test_app.py` monta una base en memoria, verifica `calcular_pu` en el endpoint `/api/conceptos/calcular_pu` y asegura que `match_mano_obra` no vuelva a buscar un atributo inexistente.

## Limitaciones actuales
- Todo el backend sigue dentro de `catalogos/app.py`, lo que complica separar preocupaciones, reusar helpers y crear pruebas mas amplias.
- La configuracion de CORS y la URL del backend estan codificadas para entorno local (`http://localhost:3000` y `http://localhost:8000/api`).
- La gestion de errores en el frontend descansa en `alert` y `console.error`, sin estados o toasts centralizados.
- Solo existen pruebas unitarias para una parte del flujo de calculo; los endpoints CRUD y la logica de IA/ventas carecen de cobertura.
