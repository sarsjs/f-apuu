# Referencia de API

La API REST corre en `http://localhost:8000/api` y devuelve JSON. Todos los endpoints requieren `Content-Type: application/json` y usan codigos HTTP estandar. Los montos se normalizan a `float` mediante `decimal_field`, por lo que nunca se exponen tipos `Decimal`.

## Catalogos de insumos

### Materiales
- `GET /materiales`: lista completa ordenada por nombre. Cada elemento incluye `id`, `nombre`, `unidad`, `precio_unitario`, `disciplina`, `calidad`, `fecha_actualizacion`, `porcentaje_merma`, `precio_flete_unitario` y `obsoleto` (true si la fecha rebasa `PRECIOS_OBSOLETOS_DIAS`).
- `POST /materiales`: crea un material. Campos obligatorios `nombre`, `unidad`, `precio_unitario`; opcionales `disciplina`, `calidad`, `fecha_actualizacion`, `porcentaje_merma`, `precio_flete_unitario`. Responde el registro creado.
- `GET/PUT/DELETE /materiales/<id>`: consulta, actualiza o elimina un material. Las actualizaciones aceptan cualquier campo manejado en el POST.

### Mano de Obra
- `GET /manoobra`: devuelve la lista de puestos con `fasar`, `rendimiento_jornada`, `disciplina`, `calidad`, `fecha_actualizacion` y `obsoleto`.
- `POST /manoobra`: requiere `puesto` y `salario_base`. Opcionales: `antiguedad_anios`, `rendimiento_jornada`, `disciplina`, `calidad`, `fecha_actualizacion`. El backend recalcula `fasar` antes de guardar.
- `GET/PUT/DELETE /manoobra/<id>`: CRUD individual. `PUT` recalcula `fasar` despues de aplicar los nuevos valores.

### Equipos y Maquinaria
- `GET /equipo` y `GET /maquinaria`: listan los registros con campos financieros (`costo_hora_maq`, `costo_adquisicion`, `vida_util_horas`, `tasa_interes_anual`, `rendimiento_horario`, `costo_posesion_hora`, etc.).
- `POST /equipo`: requiere `nombre`, `unidad`, `costo_hora_maq`. `POST /maquinaria` necesita `nombre`, `costo_adquisicion`, `vida_util_horas` y permite `tasa_interes_anual`, `rendimiento_horario`, `disciplina`, `calidad`, `fecha_actualizacion`. Al crear/actualizar maquinaria se recalcula `costo_posesion_hora`.
- `GET/PUT/DELETE /equipo/<id>` y `/maquinaria/<id>`: operaciones individuales. `PUT` acepta los mismos campos del POST y recalcula los costos correspondientes.

## Conceptos y matrices
- `GET /conceptos`: lista `clave`, `descripcion`, `unidad_concepto`.
- `POST /conceptos`: crea un concepto con esos tres campos obligatorios.
- `GET/PUT/DELETE /conceptos/<id>`: CRUD individual.
- `GET /conceptos/<id>/matriz`: devuelve los renglones (`id`, `concepto`, `tipo_insumo`, `id_insumo`, `cantidad`, `porcentaje_merma`, `precio_flete_unitario`).
- `POST /matriz`: crea un renglón. Campos obligatorios `concepto`, `tipo_insumo` (`Material`, `ManoObra`, `Equipo`, `Maquinaria`), `id_insumo`, `cantidad`. Puede incluir `porcentaje_merma` y `precio_flete_unitario`.
- `PUT/DELETE /matriz/<id>`: actualiza o elimina un renglón existente.
- `POST /conceptos/calcular_pu`: calcula el costo directo y precio unitario. Cuerpo esperado:
  ```json
  {
    "concepto_id": 1,        // opcional si se manda una matriz manual
    "matriz": [
      { "tipo_insumo": "Material", "id_insumo": 3, "cantidad": 0.25, "porcentaje_merma": 0.03, "precio_flete_unitario": 10.0 }
    ],
    "factores": {
      "mano_obra": { "activo": true, "porcentaje": 0.05 },
      "indirectos": { "activo": true, "porcentaje": 0.15 },
      "financiamiento": { "activo": false, "porcentaje": 0 },
      "utilidad": { "activo": true, "porcentaje": 0.10 },
      "iva": { "activo": true, "porcentaje": 0.16 }
    }
  }
  ```
  Si no se incluye `matriz`, el servicio usa la matriz guardada del `concepto_id`. Si no se incluyen `factores`, usa 0 % para cada uno.

## Presupuestos
- `GET /proyectos`: entrega todos los proyectos ordenados por fecha, cada uno con `ajustes` (mapa de factores), `has_presupuesto_maximo` y `monto_maximo`.
- `POST /proyectos`: requiere `nombre_proyecto`; acepta `ubicacion`, `descripcion`, `has_presupuesto_maximo`, `monto_maximo` y un bloque `ajustes` con las mismas claves que `factores` en el calculo de PU.
- `GET/PUT/DELETE /proyectos/<id>`: consulta, actualiza o elimina un proyecto completo. `PUT` reutiliza `aplicar_configuracion_proyecto` para normalizar los factores.
- `GET /proyectos/<id>/partidas`: lista las partidas asignadas a ese proyecto.
- `POST /partidas`: crea una partida con `proyecto` (id) y `nombre_partida`.
- `GET /partidas/<id>/detalles`: devuelve los detalles (`cantidad_obra`, `precio_unitario_calculado`, `costo_directo`, info del concepto).
- `POST /detalles-presupuesto`: requiere `partida`, `concepto`, `cantidad_obra` y opcionalmente `precio_unitario_calculado`. El backend recalcula el PU usando los factores activos del proyecto antes de guardar.
- `PUT/DELETE /detalles-presupuesto/<id>`: `PUT` solo permite actualizar `cantidad_obra`; `DELETE` elimina el detalle.

## Operaciones auxiliares
- `POST /fasar/calcular`: recorre todos los registros de mano de obra, recalcula `fasar` con las constantes FASAR y devuelve `{"count": <registros actualizados>}`.
- `POST /catalogos/sugerir_precio_mercado`: cuerpo esperado `{ "tipo_insumo": "Material", "insumo_id": 3, "nombre": "Cemento gris", "unidad": "saco" }`. Devuelve `{ precio_sugerido, fuente }`. El backend intenta primero el catalogo real (`obtener_costo_insumo`), luego coincidencias por nombre, despues una tabla simulada y por ultimo una consulta a Gemini si hay API key.
- `POST /catalogos/actualizar_precios_masivo`: recibe una lista de `{ insumo_id, tipo, nuevo_precio }` (tipo = `Material`, `ManoObra`, `Equipo`, `Maquinaria`) y actualiza los campos de precio correspondientes. Responde `{"mensaje": "<n> precios actualizados exitosamente."}` o un error si el payload no es una lista.

## IA, sugerencias y notas de venta
- `POST /ia/generar_apu_sugerido`: body `{ "descripcion_concepto": "...", "unidad": "m2", "concepto_id": 1 }`. Devuelve la matriz heuristica generada localmente sin pasar por Gemini.
- `POST /ia/chat_apu`: body `{ "descripcion": "...", "unidad": "m2", "concepto_id": 1 }`. Intenta llamar a Gemini (si hay `GEMINI_API_KEY`), normaliza la respuesta y, si falla o viene vacia, cae en `construir_sugerencia_apu`. Respuesta:
  ```json
  {
    "explicacion": "Texto que resume la decision de la IA",
    "insumos": [
      {
        "tipo_insumo": "Material",
        "insumo_id": 3,
        "nombre": "Cemento gris",
        "unidad": "saco",
        "cantidad": 7.5,
        "merma": 0.03,
        "flete_unitario": 15.0,
        "rendimiento_diario": 0,
        "costo_unitario": 245.0,
        "precio_unitario": 245.0,
        "justificacion_insumo": "..."
      }
    ]
  }
  ```
- `GET /ia/explicar_sugerencia`: acepta `concepto_id` y/o `descripcion_concepto` como query params y devuelve `{"explicacion": "..."}` basada en la heuristica local.
- `POST /ventas/crear_nota_venta`: body `{ "descripcion": "...", "unidad": "m2", "matriz": [ ... ], "concepto_id": 1 }`. Usa `calcular_precio_unitario` para derivar `costo_directo_unitario`, `precio_unitario_final` e `importe_total`, que se envian junto con un mensaje y la descripcion del concepto.
- `GET /ventas/descargar_nota_venta_pdf/<concepto_id>`: genera y descarga un PDF con la matriz, costos y nota legal usando ReportLab. Requiere que el concepto exista y tenga renglones en `MatrizInsumo`.
