# Modulos del repositorio

## Backend (`catalogos/`)
- `app.py`: punto de entrada del backend. Configura Flask, SQLAlchemy, CORS y las variables de entorno, define todos los modelos del dominio y expone las rutas REST (catalogos, conceptos, matrices, proyectos, partidas, detalles, calculos, IA, precios de mercado y notas de venta). Tambien aloja las funciones auxiliares (`decimal_field`, `calcular_precio_unitario`, heuristicas de IA, generacion de PDF).
- `seed_data.py`: se ejecuta dentro del contexto de la app para poblar constantes FASAR, catalogos basicos y un concepto de ejemplo cuando se corre `python app.py`.
- `models.py`: version anterior de los modelos escrita con Django ORM. Hoy no se importa, pero sirve como referencia de los mismos campos y validaciones que deberian migrarse a SQLAlchemy o eliminarse para evitar confusion.
- `test_app.py`: pruebas unitarias con `pytest` que montan la app en modo testing, crean una base SQLite en memoria y validan tanto `calcular_pu` como el helper `match_mano_obra`.
- `nota_venta_template.html`: template statico utilizado en versiones previas de la nota de venta (el flujo actual usa ReportLab).
- `migrations/`: espacio reservado para scripts de Alembic (no se estan generando migraciones automaticas por ahora).
- `requirements.txt`: dependencias del backend (`flask`, `flask-sqlalchemy`, `flask-cors`, `python-dotenv`, `google-generativeai`, `reportlab`, `pytest`).
- `data.sqlite3`: base de datos local usada en desarrollo. Se crea/llena automaticamente al iniciar la app.
- `__init__.py`, `.env`, archivos de apoyo (por ejemplo `seed_data.py`) y la carpeta `__pycache__`.

## Frontend (`frontend/`)
- `package.json` / `tsconfig*.json` / `vite.config.ts`: configuracion de build y scripts (`npm run dev`, `npm run build`, `npm run preview`, asi como `npm run dev:backend` para iniciar Flask desde Node).
- `src/main.tsx`: arranca React con `BrowserRouter` y aplica los estilos globales de `styles.css`.
- `src/App.tsx`: define la estructura principal (`AppHeader`) y las rutas `/presupuesto`, `/catalogos` y `/analisis`.
- `src/api/client.ts`: crea una instancia `axios` con base URL `VITE_API_BASE_URL` y cabeceras JSON, utilizada por todos los componentes via la funcion `apiFetch`.
- `src/pages/PresupuestoPage.tsx`: envuelve `PresupuestoManager`, componente que administra proyectos, partidas, selects de conceptos, resumenes y escritura de detalles.
- `src/pages/CatalogosPage.tsx`: muestra `CatalogosDashboard`, interfaz tabulada para cada catalogo con formularios genericos y tabla con indicadores de obsolescencia.
- `src/pages/AnalisisPuPage.tsx`: pagina mas grande del frontend; maneja el formulario del concepto, los factores de sobrecosto, la interaccion con IA (`/api/ia/chat_apu`), el guardado de matrices y la generacion de notas de venta que abre `NotaVentaModal`.
- `src/components/catalogos/CatalogoCrud.tsx`: implementacion de `CatalogosDashboard`. Contiene la definicion de tabs, la simulacion de actualizacion masiva y el CRUD reutilizable (formulario + tabla) para cada tipo de insumo.
- `src/components/conceptos/ConceptoMatrizEditor.tsx`: administra las filas de la matriz, descarga los catalogos en paralelo, intenta conciliar sugerencias IA con registros reales, expone un modal para registrar nuevos insumos y ofrece acciones como "obtener precio de mercado" o "guardar en catalogo".
- `src/components/conceptos/NotaVentaModal.tsx` y `NotaVentaModalFixed.tsx`: muestran el resultado de `/api/ventas/crear_nota_venta`, resumen financiero y boton para descargar el PDF generado en backend.
- `src/components/presupuesto/PresupuestoManager.tsx`: maneja el estado de proyectos/partidas/detalles, renderiza formularios y tablas, hace busquedas de conceptos y crea detalles llamando a `/api/detalles-presupuesto`.
- `src/components/layout/AppHeader.tsx`: cabecera comun con navegacion simple.
- `src/styles.css`: estilos globales para el layout, tarjetas, tablas, modales y grids de acciones.

## Documentos y otros
- Los archivos Markdown (`README.md`, `PROJECT_SUMMARY.md`, `ARCHITECTURE.md`, `API_REFERENCE.md`, `TODOS.md`) concentran la documentacion tecnica y las tareas pendientes.
- El repositorio incluye un entorno virtual (`venv312/`) para ejecutar el backend en Windows, asi como caches de pytest o compilaciones de Vite en `frontend/dist/`.
