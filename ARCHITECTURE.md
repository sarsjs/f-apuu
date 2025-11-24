# Arquitectura del codigo

## Backend (`catalogos/`)
1. **Configuracion y arranque**: `app.py` carga las variables de entorno con `python-dotenv`, arma la ruta a `data.sqlite3`, inicializa Flask + SQLAlchemy y aplica CORS solo para `http://localhost:3000`. Lee `GEMINI_API_KEY`, `GEMINI_MODEL` (por defecto `gemini-2.5-flash`) y `PRECIOS_OBSOLETOS_DIAS` (90) para habilitar las rutas de IA y marcar precios obsoletos.
2. **Modelos y persistencia**: El mismo archivo define todos los modelos (`ConstantesFASAR`, `Material`, `ManoObra`, `Equipo`, `Maquinaria`, `Concepto`, `MatrizInsumo`, `Proyecto`, `Partida`, `DetallePresupuesto`) con sus `to_dict`. Cada `to_dict` ajusta tipos (`Decimal` a `float`) y calcula campos derivados como `obsoleto`. A pesar de existir `catalogos/models.py` con versiones Django de estos modelos, el backend real solo usa las clases SQLAlchemy del archivo principal.
3. **Servicios y utilidades**: `app.py` tambien contiene helpers como `decimal_field`, `is_precio_obsoleto`, `calcular_costo_posesion`, `calcular_fasar_valor`, `obtener_costo_insumo` (con caches por tipo), `calcular_precio_unitario` (suma costo directo, aplica ajustes y multiplicadores) y `normalizar_factores`. La logica de IA incluye:
   - `construir_sugerencia_apu`: heuristica local que arma matrices basadas en palabras clave (barda, concreto, etc.) y en catalogos existentes.
   - `generar_apu_con_gemini` + `construir_matriz_desde_gemini`: cuando hay API key consulta Gemini y reconcilia la respuesta a JSON valido.
   - `sugerir_precio_mercado`: intenta primero el costo real del catalogo, luego busquedas por nombre, despues un diccionario de precios simulados y finalmente Gemini.
   - Generacion de PDF: `/api/ventas/descargar_nota_venta_pdf/<id>` usa ReportLab para producir la nota de venta desde la matriz.
4. **Rutas REST**: Todo esta concentrado en un unico modulo:
   - **Catalogos**: `/api/materiales`, `/api/manoobra`, `/api/equipo`, `/api/maquinaria` con CRUD completo y calculo de `obsoleto`.
   - **Conceptos y matrices**: `/api/conceptos`, `/api/matriz`, `/api/conceptos/<id>/matriz`, `/api/conceptos/calcular_pu`.
   - **Presupuestos**: `/api/proyectos`, `/api/proyectos/<id>/partidas`, `/api/partidas`, `/api/partidas/<id>/detalles`, `/api/detalles-presupuesto`.
   - **Calculos auxiliares**: `/api/fasar/calcular`, `/api/catalogos/sugerir_precio_mercado`, `/api/catalogos/actualizar_precios_masivo`.
   - **IA y ventas**: `/api/ia/generar_apu_sugerido`, `/api/ia/chat_apu`, `/api/ia/explicar_sugerencia`, `/api/ventas/crear_nota_venta`, `/api/ventas/descargar_nota_venta_pdf/<id>`.
5. **Datos iniciales y pruebas**: `seed_data.py` se ejecuta en el bloque `if __name__ == "__main__"` para crear constantes FASAR y un APU ejemplo. `test_app.py` levanta una base en memoria y valida `calcular_pu` junto con `match_mano_obra` para prevenir regresiones.

## Frontend (`frontend/`)
1. **Shell y rutas**: `src/main.tsx` monta React en modo estricto con `BrowserRouter`. `App.tsx` define la cabecera (`AppHeader`) y las rutas `/presupuesto`, `/catalogos` y `/analisis` (landea en Presupuesto por defecto).
2. **Cliente HTTP**: `src/api/client.ts` crea una instancia `axios` que apunta a `import.meta.env.VITE_API_BASE_URL` o `http://localhost:8000/api`. No hay manejo centralizado de errores; los llamados retornan la data cruda.
3. **Paginas**:
   - `PresupuestoPage` renderiza `PresupuestoManager`, componente que coordina proyectos, partidas y detalles (formularios de ajustes, selectores, resumen monetario).
   - `CatalogosPage` muestra `CatalogosDashboard`, una vista tabulada que reutiliza un CRUD generico por tipo y ofrece simulacion de actualizacion masiva.
   - `AnalisisPuPage` controla el formulario del concepto, los toggles de sobrecostos, las llamadas a `/api/ia/chat_apu`, persistencia de la matriz y la generacion de notas de venta.
4. **Componentes clave**:
   - `CatalogosDashboard` (`components/catalogos/CatalogoCrud.tsx`): forma dinamicamente los campos segun el tipo, colorea registros obsoletos y permite editar/borrar desde la tabla.
   - `ConceptoMatrizEditor`: administra el estado de las filas de matriz, descarga catalogos en memoria, calcula el PU desde el backend cada vez que cambia la tabla, intenta conciliar sugerencias IA con registros reales y expone un modal para registrar insumos faltantes dentro del catalogo. Tambien puede pedir precios de referencia a `/api/catalogos/sugerir_precio_mercado`.
   - `PresupuestoManager`: sincroniza proyectos, partidas y detalles, arma payloads hacia `/api/proyectos` y `/api/detalles-presupuesto` y calcula un resumen comparando contra `monto_maximo`.
   - `NotaVentaModal` / `NotaVentaModalFixed`: presentan los resultados de `/api/ventas/crear_nota_venta` y permiten abrir el PDF del backend.
5. **Estilos y build**: `src/styles.css` define el layout completo (shell, tarjetas, tablas, modal). Vite maneja los comandos `dev`, `build` y `preview`.

## Flujo de datos
- El frontend usa `apiFetch` para todas las llamadas y depende de respuestas JSON normalizadas (sin `Decimal`). Los catalogos se consultan al cargar `ConceptoMatrizEditor` y se mantienen en memoria para poblar selects, validar unidades y calcular campos por defecto (mermas, rendimientos).
- Cuando un usuario edita una matriz, el componente arma el payload esperado por `/api/conceptos/calcular_pu` (`matriz` + `factores`) y publica los totales en tiempo real. Al guardar, recrea los registros via `/api/matriz` para mantener la base sincronizada.
- `PresupuestoManager` descarga el proyecto, vuelve a pedir las partidas y detalles cada vez que cambia la seleccion y, al registrar un detalle, deja que el backend vuelva a calcular el PU usando los factores de cada proyecto.
- Las sugerencias de IA (JSON) pasan por `mapearSugerenciasDesdeIA`, se muestran al usuario y deben conciliarse con el catalogo antes de guardar la matriz o de generar una nota de venta. Si el concepto esta guardado, la nota de venta reutiliza la matriz almacenada y puede derivar en un PDF generado por Flask.
