import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiFetch } from "../../api/client";

export type MatrizRow = {
    id?: number;
    concepto: number;
    tipo_insumo: "Material" | "ManoObra" | "Equipo" | "Maquinaria";
    id_insumo: number | "";
    cantidad: number;
    porcentaje_merma?: number | "";
    precio_flete_unitario?: number | "";
    rendimiento_jornada?: number | "";
    existe_en_catalogo?: boolean;
    nombre_sugerido?: string;
    justificacion_breve?: string;
};

type MaterialDTO = {
    id: number;
    nombre: string;
    unidad: string;
    precio_unitario: number;
    porcentaje_merma: number;
    precio_flete_unitario: number;
    disciplina?: string;
    calidad?: string;
    fecha_actualizacion?: string;
    obsoleto?: boolean;
};
type ManoObraDTO = {
    id: number;
    puesto: string;
    fasar: number;
    salario_base: number;
    rendimiento_jornada: number;
    disciplina?: string;
    calidad?: string;
    fecha_actualizacion?: string;
    obsoleto?: boolean;
};
type EquipoDTO = {
    id: number;
    nombre: string;
    unidad: string;
    costo_hora_maq: number;
    disciplina?: string;
    calidad?: string;
    fecha_actualizacion?: string;
    obsoleto?: boolean;
};
type MaquinariaDTO = {
    id: number;
    nombre: string;
    costo_posesion_hora: number;
    rendimiento_horario: number;
    disciplina?: string;
    calidad?: string;
    fecha_actualizacion?: string;
    obsoleto?: boolean;
};

type CatalogData = {
    materiales: Record<number, MaterialDTO>;
    manoObra: Record<number, ManoObraDTO>;
    equipos: Record<number, EquipoDTO>;
    maquinaria: Record<number, MaquinariaDTO>;
};

type ConceptoResumen = {
    clave: string;
    descripcion: string;
    unidad_concepto: string;
};

export type FactorToggleKey = "indirectos" | "financiamiento" | "utilidad" | "iva";

export type FactorToggleConfig = {
    activo: boolean;
    porcentaje: number;
};

export type FactorToggleMap = Record<FactorToggleKey, FactorToggleConfig>;

type ConceptoMatrizEditorProps = {
    conceptoId: number | null;
    conceptoInfo: ConceptoResumen;
    iaRows?: MatrizRow[] | null;
    iaExplanation?: string;
    guardarTrigger?: number;
    onResumenChange?: (resumen: PuResponse) => void;
    modoLocal?: boolean;
    externalRows?: MatrizRow[];
    onRowsChange?: (rows: MatrizRow[]) => void;
    onGuardarLocal?: (rows: MatrizRow[]) => Promise<void> | void;
    factoresSobrecosto?: FactorToggleMap;
};

type PuResponse = {
    costo_directo: number;
    precio_unitario: number;
};

type IASugerencia = {
    tipo_insumo: MatrizRow["tipo_insumo"] | "Mano de Obra";
    id_insumo?: number | "";
    insumo_id?: number | "" | null;
    cantidad?: number;
    porcentaje_merma?: number | null;
    merma?: number | null;
    precio_flete_unitario?: number | null;
    flete_unitario?: number | null;
    rendimiento_jornada?: number | null;
    rendimiento_diario?: number | null;
    existe_en_catalogo?: boolean;
    nombre?: string | null;
    justificacion_breve?: string | null;
};

export function ConceptoMatrizEditor({
    conceptoId,
    conceptoInfo,
    iaRows,
    iaExplanation,
    guardarTrigger,
    onResumenChange,
    modoLocal: modoLocalProp,
    externalRows,
    onRowsChange,
    onGuardarLocal,
    factoresSobrecosto,
}: ConceptoMatrizEditorProps) {
    const modoLocal = modoLocalProp ?? !conceptoId;
    const [rows, setRows] = useState<MatrizRow[]>(() => externalRows ?? []);
    const [catalogos, setCatalogos] = useState<CatalogData | null>(null);
    const [puResumen, setPuResumen] = useState<PuResponse>({ costo_directo: 0, precio_unitario: 0 });
    const [calculando, setCalculando] = useState(false);
    const [draftRow, setDraftRow] = useState<MatrizRow>(() => crearDraftRow(conceptoId));
    const [catalogModal, setCatalogModal] = useState<CatalogModalState | null>(null);
    const [loadingPriceForRow, setLoadingPriceForRow] = useState<number | null>(null);

    useEffect(() => {
        void loadCatalogos();
    }, []);

    useEffect(() => {
        if (modoLocal) return;
        if (!conceptoId) {
            setRows([]);
            return;
        }
        void loadMatriz();
    }, [conceptoId, modoLocal]);

    useEffect(() => {
        if (!modoLocal) return;
        setRows(externalRows ?? []);
    }, [externalRows, modoLocal]);

    useEffect(() => {
        void calcularPuRemoto();
    }, [conceptoId, rows, modoLocal, factoresSobrecosto]);

    useEffect(() => {
        onResumenChange?.(puResumen);
    }, [puResumen, onResumenChange]);

    useEffect(() => {
        if (!iaRows || !iaRows.length) return;
        setRows(iaRows);
    }, [iaRows]);

    useEffect(() => {
        if (!guardarTrigger) return;
        void guardarMatrizCompleta();
    }, [guardarTrigger, modoLocal]);

    useEffect(() => {
        setDraftRow(crearDraftRow(conceptoId));
    }, [conceptoId]);

    useEffect(() => {
        onRowsChange?.(rows);
    }, [rows, onRowsChange]);

    async function loadMatriz() {
        if (!conceptoId) {
            setRows([]);
            return;
        }
        const data = await apiFetch<MatrizRow[]>(`/conceptos/${conceptoId}/matriz`);
        const normalizados = data.map((row) => ({
            ...row,
            cantidad: Number(row.cantidad),
            porcentaje_merma: row.porcentaje_merma ?? "",
            precio_flete_unitario: row.precio_flete_unitario ?? "",
            rendimiento_jornada: row.rendimiento_jornada ?? "",
            existe_en_catalogo: true,
        }));
        setRows(normalizados);
    }

    async function loadCatalogos() {
        const [materiales, manoObra, equipos, maquinaria] = await Promise.all([
            apiFetch<MaterialDTO[]>(`/materiales`),
            apiFetch<ManoObraDTO[]>(`/manoobra`),
            apiFetch<EquipoDTO[]>(`/equipo`),
            apiFetch<MaquinariaDTO[]>(`/maquinaria`),
        ]);
        setCatalogos({
            materiales: Object.fromEntries(materiales.map((item) => [item.id, item])),
            manoObra: Object.fromEntries(manoObra.map((item) => [item.id, item])),
            equipos: Object.fromEntries(equipos.map((item) => [item.id, item])),
            maquinaria: Object.fromEntries(maquinaria.map((item) => [item.id, item])),
        });
    }

    function handleRowChange(index: number, updates: Partial<MatrizRow>) {
        setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...updates } : row)));
    }

    async function handleDeleteRow(rowId?: number, rowIndex?: number) {
        if (!rowId) {
            setRows((prev) => prev.filter((_, idx) => idx !== rowIndex));
            return;
        }
        if (!confirm("Eliminar el insumo de la matriz?")) return;
        await apiFetch<void>(`/matriz/${rowId}`, { method: "DELETE" });
        await loadMatriz();
    }

    async function calcularPuRemoto() {
        if (!rows.length) {
            setPuResumen({ costo_directo: 0, precio_unitario: 0 });
            return;
        }
        const matrizPayload = rows
            .filter((row) => row.id_insumo !== "" && Number(row.cantidad) >= 0)
            .map((row) => ({
                tipo_insumo: row.tipo_insumo,
                id_insumo: Number(row.id_insumo),
                cantidad: Number(row.cantidad),
                porcentaje_merma:
                    row.tipo_insumo === "Material" && row.porcentaje_merma !== ""
                        ? Number(row.porcentaje_merma)
                        : undefined,
                precio_flete_unitario:
                    row.tipo_insumo === "Material" && row.precio_flete_unitario !== ""
                        ? Number(row.precio_flete_unitario)
                        : undefined,
                rendimiento_jornada:
                    row.tipo_insumo === "ManoObra" && row.rendimiento_jornada !== ""
                        ? Number(row.rendimiento_jornada)
                        : undefined,
            }));
        if (matrizPayload.length === 0) {
            setPuResumen({ costo_directo: 0, precio_unitario: 0 });
            return;
        }
        setCalculando(true);
        try {
            const body: Record<string, unknown> = { matriz: matrizPayload };
            if (conceptoId) {
                body.concepto_id = conceptoId;
            }
            const factoresPayload = mapFactoresParaApi(factoresSobrecosto);
            if (factoresPayload) {
                body.factores = factoresPayload;
            }
            const data = await apiFetch<PuResponse>(`/conceptos/calcular_pu`, {
                method: "POST",
                body,
            });
            setPuResumen(data);
        } finally {
            setCalculando(false);
        }
    }

    async function guardarMatrizCompleta() {
        if (modoLocal) {
            await onGuardarLocal?.(rows);
            return;
        }
        if (!conceptoId) {
            return;
        }
        const payloadRows = rows.map((row) => ({ ...row }));
        const existentes = await apiFetch<MatrizRow[]>(`/conceptos/${conceptoId}/matriz`);
        const idsActuales = new Set(payloadRows.filter((row) => row.id).map((row) => row.id as number));
        const eliminaciones = existentes.filter((registro) => !idsActuales.has(registro.id as number));
        for (const registro of eliminaciones) {
            await apiFetch(`/matriz/${registro.id}`, { method: "DELETE" });
        }
        for (const row of payloadRows) {
            await persistRow(row);
        }
        await loadMatriz();
    }

    async function handleAgregarDraft() {
        if (!puedeAgregarDraft()) return;
        if (modoLocal) {
            setRows((prev) => [...prev, { ...draftRow, concepto: conceptoId ?? 0 }]);
            setDraftRow(crearDraftRow(conceptoId));
            return;
        }
        await persistRow({ ...draftRow });
        await loadMatriz();
        setDraftRow(crearDraftRow(conceptoId));
    }

    function puedeAgregarDraft(): boolean {
        return Boolean(draftRow.id_insumo && draftRow.cantidad > 0);
    }

    async function handleObtenerPrecio(rowIndex: number) {
        const row = rows[rowIndex];
        if (!row || !row.id_insumo || obtenerCostoUnitario(row) !== 0) return;

        setLoadingPriceForRow(rowIndex);
        try {
            const nombre = obtenerNombre(row);
            const unidad = obtenerUnidad(row);

            const response = await apiFetch<{
                precio_sugerido: number;
                fuente: string;
            }>(`/catalogos/sugerir_precio_mercado`, {
                method: "POST",
                body: { nombre, unidad },
            });

            if (response.precio_sugerido && response.precio_sugerido > 0) {
                if (row.tipo_insumo === "Material") {
                    handleRowChange(rowIndex, { precio_flete_unitario: response.precio_sugerido });
                } else if (row.tipo_insumo === "ManoObra") {
                    const mano = catalogos?.manoObra[Number(row.id_insumo)];
                    if (mano) {
                        handleRowChange(rowIndex, {
                            rendimiento_jornada: mano.salario_base * mano.fasar / response.precio_sugerido,
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Error obtaining market price:", error);
        } finally {
            setLoadingPriceForRow(null);
        }
    }

    function abrirCatalogoDesdeRow(rowIndex: number) {
        const row = rows[rowIndex];
        if (!row) return;
        setCatalogModal({
            rowIndex,
            tipo: row.tipo_insumo,
            form: crearFormularioCatalogo(row),
        });
    }

    function handleCatalogFormChange(field: string, value: string) {
        setCatalogModal((prev) => (prev ? { ...prev, form: { ...prev.form, [field]: value } } : prev));
    }

    function renderCatalogFormFields() {
        if (!catalogModal) return null;
        const { tipo, form } = catalogModal;
        if (tipo === "Material") {
            return (
                <>
                    <label>
                        Nombre
                        <input value={form.nombre ?? ""} onChange={(event) => handleCatalogFormChange("nombre", event.target.value)} required />
                    </label>
                    <label>
                        Unidad
                        <input value={form.unidad ?? ""} onChange={(event) => handleCatalogFormChange("unidad", event.target.value)} required />
                    </label>
                    <label>
                        Precio Unitario
                        <input
                            type="number"
                            step="0.01"
                            value={form.precio_unitario ?? ""}
                            onChange={(event) => handleCatalogFormChange("precio_unitario", event.target.value)}
                            required
                        />
                    </label>
                    <label>
                        Porcentaje Merma
                        <input
                            type="number"
                            step="0.0001"
                            value={form.porcentaje_merma ?? ""}
                            onChange={(event) => handleCatalogFormChange("porcentaje_merma", event.target.value)}
                        />
                    </label>
                    <label>
                        Precio Flete Unitario
                        <input
                            type="number"
                            step="0.01"
                            value={form.precio_flete_unitario ?? ""}
                            onChange={(event) => handleCatalogFormChange("precio_flete_unitario", event.target.value)}
                        />
                    </label>
                </>
            );
        }
        if (tipo === "ManoObra") {
            return (
                <>
                    <label>
                        Puesto
                        <input value={form.nombre ?? ""} onChange={(event) => handleCatalogFormChange("nombre", event.target.value)} required />
                    </label>
                    <label>
                        Salario Base
                        <input
                            type="number"
                            step="0.01"
                            value={form.salario_base ?? ""}
                            onChange={(event) => handleCatalogFormChange("salario_base", event.target.value)}
                            required
                        />
                    </label>
                    <label>
                        Rendimiento Jornada
                        <input
                            type="number"
                            step="0.01"
                            value={form.rendimiento_jornada ?? ""}
                            onChange={(event) => handleCatalogFormChange("rendimiento_jornada", event.target.value)}
                        />
                    </label>
                </>
            );
        }
        if (tipo === "Equipo") {
            return (
                <>
                    <label>
                        Nombre
                        <input value={form.nombre ?? ""} onChange={(event) => handleCatalogFormChange("nombre", event.target.value)} required />
                    </label>
                    <label>
                        Unidad
                        <input value={form.unidad ?? ""} onChange={(event) => handleCatalogFormChange("unidad", event.target.value)} required />
                    </label>
                    <label>
                        Costo Hora
                        <input
                            type="number"
                            step="0.01"
                            value={form.costo_hora_maq ?? ""}
                            onChange={(event) => handleCatalogFormChange("costo_hora_maq", event.target.value)}
                            required
                        />
                    </label>
                </>
            );
        }
        return (
            <>
                <label>
                    Nombre
                    <input value={form.nombre ?? ""} onChange={(event) => handleCatalogFormChange("nombre", event.target.value)} required />
                </label>
                <label>
                    Costo Adquisicion
                    <input
                        type="number"
                        step="0.01"
                        value={form.costo_adquisicion ?? ""}
                        onChange={(event) => handleCatalogFormChange("costo_adquisicion", event.target.value)}
                        required
                    />
                </label>
                <label>
                    Vida Util (horas)
                    <input
                        type="number"
                        step="0.1"
                        value={form.vida_util_horas ?? ""}
                        onChange={(event) => handleCatalogFormChange("vida_util_horas", event.target.value)}
                        required
                    />
                </label>
                <label>
                    Tasa Interes Anual
                    <input
                        type="number"
                        step="0.0001"
                        value={form.tasa_interes_anual ?? ""}
                        onChange={(event) => handleCatalogFormChange("tasa_interes_anual", event.target.value)}
                    />
                </label>
                <label>
                    Rendimiento Horario
                    <input
                        type="number"
                        step="0.01"
                        value={form.rendimiento_horario ?? ""}
                        onChange={(event) => handleCatalogFormChange("rendimiento_horario", event.target.value)}
                    />
                </label>
            </>
        );
    }

    async function handleCatalogSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!catalogModal) return;
        const { tipo, form, rowIndex } = catalogModal;
        let endpoint = "";
        let payload: Record<string, unknown> = {};
        switch (tipo) {
            case "Material":
                endpoint = "/materiales";
                payload = {
                    nombre: form.nombre,
                    unidad: form.unidad,
                    precio_unitario: Number(form.precio_unitario || 0),
                    fecha_actualizacion: new Date().toISOString().split("T")[0],
                    porcentaje_merma: Number(form.porcentaje_merma || 0),
                    precio_flete_unitario: Number(form.precio_flete_unitario || 0),
                };
                break;
            case "ManoObra":
                endpoint = "/manoobra";
                payload = {
                    puesto: form.nombre,
                    salario_base: Number(form.salario_base || 0),
                    rendimiento_jornada: Number(form.rendimiento_jornada || 1),
                };
                break;
            case "Equipo":
                endpoint = "/equipo";
                payload = {
                    nombre: form.nombre,
                    unidad: form.unidad,
                    costo_hora_maq: Number(form.costo_hora_maq || 0),
                };
                break;
            case "Maquinaria":
                endpoint = "/maquinaria";
                payload = {
                    nombre: form.nombre,
                    costo_adquisicion: Number(form.costo_adquisicion || 0),
                    vida_util_horas: Number(form.vida_util_horas || 1),
                    tasa_interes_anual: Number(form.tasa_interes_anual || 0),
                    rendimiento_horario: Number(form.rendimiento_horario || 1),
                };
                break;
            default:
                return;
        }
        const creado = await apiFetch<Record<string, any>>(endpoint, { method: "POST", body: payload });
        await loadCatalogos();
        setRows((prev) =>
            prev.map((row, idx) =>
                idx === rowIndex
                    ? { ...row, id_insumo: creado.id, existe_en_catalogo: true, nombre_sugerido: undefined }
                    : row
            )
        );
        setCatalogModal(null);
    }

    async function persistRow(row: MatrizRow) {
        if (modoLocal || !conceptoId) {
            return;
        }
        const payload = buildRowPayload(row, conceptoId);
        if (row.id) {
            await apiFetch(`/matriz/${row.id}`, { method: "PUT", body: payload });
        } else {
            const created = await apiFetch<MatrizRow>(`/matriz`, { method: "POST", body: payload });
            row.id = created.id;
        }
    }

    function buildRowPayload(row: MatrizRow, conceptoDestino: number) {
        return {
            concepto: conceptoDestino,
            tipo_insumo: row.tipo_insumo,
            id_insumo: Number(row.id_insumo),
            cantidad: Number(row.cantidad),
            porcentaje_merma:
                row.tipo_insumo === "Material" && row.porcentaje_merma !== ""
                    ? Number(row.porcentaje_merma)
                    : null,
            precio_flete_unitario:
                row.tipo_insumo === "Material" && row.precio_flete_unitario !== ""
                    ? Number(row.precio_flete_unitario)
                    : null,
            rendimiento_jornada:
                row.tipo_insumo === "ManoObra" && row.rendimiento_jornada !== ""
                    ? Number(row.rendimiento_jornada)
                    : null,
        };
    }

    const detalleSugerencia = iaExplanation?.trim()
        ? iaExplanation.trim()
        : "Genera una sugerencia con el asistente para ver el detalle aqui.";

    function obtenerUnidad(row: MatrizRow): string {
        if (row.existe_en_catalogo === false) return "-";
        if (!catalogos || !row.id_insumo) return "-";
        const id = Number(row.id_insumo);
        switch (row.tipo_insumo) {
            case "Material":
                return catalogos.materiales[id]?.unidad ?? "-";
            case "ManoObra":
                return "jornada";
            case "Equipo":
                return catalogos.equipos[id]?.unidad ?? "hora";
            case "Maquinaria":
                return "hora";
            default:
                return "-";
        }
    }

    function obtenerNombre(row: MatrizRow): string {
        if (row.existe_en_catalogo === false) return row.nombre_sugerido ?? "-";
        if (!catalogos || !row.id_insumo) return "-";
        const id = Number(row.id_insumo);
        switch (row.tipo_insumo) {
            case "Material":
                return catalogos.materiales[id]?.nombre ?? "-";
            case "ManoObra":
                return catalogos.manoObra[id]?.puesto ?? "-";
            case "Equipo":
                return catalogos.equipos[id]?.nombre ?? "-";
            case "Maquinaria":
                return catalogos.maquinaria[id]?.nombre ?? "-";
            default:
                return "-";
        }
    }

    function obtenerCostoUnitario(row: MatrizRow): number {
        if (row.existe_en_catalogo === false) return 0;
        if (!catalogos || !row.id_insumo) return 0;
        const id = Number(row.id_insumo);
        switch (row.tipo_insumo) {
            case "Material": {
                const material = catalogos.materiales[id];
                if (!material) return 0;
                const merma =
                    row.porcentaje_merma !== "" && row.porcentaje_merma !== undefined
                        ? Number(row.porcentaje_merma)
                        : material.porcentaje_merma;
                const flete =
                    row.precio_flete_unitario !== "" && row.precio_flete_unitario !== undefined
                        ? Number(row.precio_flete_unitario)
                        : material.precio_flete_unitario;
                return material.precio_unitario * (1 + merma) + flete;
            }
            case "ManoObra": {
                const mano = catalogos.manoObra[id];
                if (!mano) return 0;
                const rendimiento =
                    row.rendimiento_jornada !== "" && row.rendimiento_jornada !== undefined
                        ? Number(row.rendimiento_jornada)
                        : mano.rendimiento_jornada || 1;
                const salarioReal = mano.salario_base * mano.fasar;
                return rendimiento > 0 ? salarioReal / rendimiento : salarioReal;
            }
            case "Equipo": {
                const equipo = catalogos.equipos[id];
                return equipo?.costo_hora_maq ?? 0;
            }
            case "Maquinaria": {
                const maq = catalogos.maquinaria[id];
                if (!maq) return 0;
                const rendimiento = maq.rendimiento_horario || 1;
                return rendimiento > 0 ? maq.costo_posesion_hora / rendimiento : maq.costo_posesion_hora;
            }
            default:
                return 0;
        }
    }

    function formatearMoneda(valor: number): string {
        if (!Number.isFinite(valor)) return "$0.00";
        return `$${valor.toFixed(2)}`;
    }

    function obtenerObsoleto(row: MatrizRow): boolean {
        if (row.existe_en_catalogo === false) return false;
        if (!catalogos || !row.id_insumo) return false;
        const id = Number(row.id_insumo);
        switch (row.tipo_insumo) {
            case "Material":
                return catalogos.materiales[id]?.obsoleto ?? false;
            case "ManoObra":
                return catalogos.manoObra[id]?.obsoleto ?? false;
            case "Equipo":
                return catalogos.equipos[id]?.obsoleto ?? false;
            case "Maquinaria":
                return catalogos.maquinaria[id]?.obsoleto ?? false;
            default:
                return false;
        }
    }

    return (
        <section className="concepto-editor">
            <header className="concepto-editor__header">
                <div className="concepto-editor__detalle-ia">
                    <span className="concepto-editor__detalle-label">Detalles de la sugerencia</span>
                    <p className="concepto-editor__detalle-texto">{detalleSugerencia}</p>
                </div>
                {calculando && <small className="concepto-editor__estado">Calculando...</small>}
            </header>

            <table className="matriz-table">
                <thead>
                    <tr>
                        <th>
                            Tipo Insumo
                            {renderTooltip("Categor??a del recurso (Material, Mano de Obra, Maquinaria) que compone el APU.")}
                        </th>
                        <th>
                            Insumo
                            {renderTooltip("Recurso espec??fico extra??do del Cat??logo.")}
                        </th>
                        <th>
                            Unidad
                            {renderTooltip("Unidad de medida del insumo (ej., saco, m3, jornada).")}
                        </th>
                        <th>
                            Cantidad
                            {renderTooltip(
                                "Consumo unitario del insumo necesario para ejecutar una unidad del concepto (ej., sacos de cemento por m?? de muro)."
                            )}
                        </th>
                        <th>
                            Merma (%)
                            {renderTooltip(
                                "Porcentaje de desperdicio que se suma al consumo te??rico del material (ej., 3% de p??rdida por manejo). Este porcentaje incrementa el Costo Total del insumo."
                            )}
                        </th>
                        <th>
                            Flete Unitario
                            {renderTooltip("Costo de transporte o acarreo del material hasta el sitio de la obra, prorrateado por la unidad del insumo.")}
                        </th>
                        <th>
                            Rendimiento Diario
                            {renderTooltip(
                                "Productividad de la cuadrilla o m??quina, expresada en unidades del concepto por jornada u hora. Es el factor que reduce el costo de Mano de Obra/Maquinaria a nivel unitario."
                            )}
                        </th>
                        <th>
                            Costo Unitario
                            {renderTooltip("Costo final del insumo puesto en obra; incluye precio base, merma y flete.")}
                        </th>
                        <th>
                            Costo Total
                            {renderTooltip("Costo del insumo para producir una unidad del concepto (Cantidad ?? Costo Unitario).")}
                        </th>
                        <th>
                            Acciones
                            {renderTooltip("Acciones disponibles para el insumo (Eliminar).")}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={row.id ?? `tmp-${index}`}>
                            <td>
                                <select
                                    value={row.tipo_insumo}
                                    onChange={(event) => {
                                        const nextType = event.target.value as MatrizRow["tipo_insumo"];
                                        handleRowChange(index, {
                                            tipo_insumo: nextType,
                                            id_insumo: "",
                                            porcentaje_merma: nextType === "Material" ? row.porcentaje_merma : "",
                                            precio_flete_unitario: nextType === "Material" ? row.precio_flete_unitario : "",
                                            rendimiento_jornada: nextType === "ManoObra" ? row.rendimiento_jornada : "",
                                        });
                                    }}
                                >
                                    <option value="Material">Material</option>
                                    <option value="ManoObra">Mano de Obra</option>
                                    <option value="Equipo">Equipo</option>
                                    <option value="Maquinaria">Maquinaria</option>
                                </select>
                            </td>
                            <td>{renderInsumoSelect(row, index)}</td>
                            <td>{obtenerUnidad(row)}</td>
                            <td>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    value={row.cantidad}
                                    onChange={(event) =>
                                        handleRowChange(index, {
                                            cantidad: Number(event.target.value) || 0,
                                        })
                                    }
                                />
                            </td>
                            <td>
                                {row.tipo_insumo === "Material" ? (
                                    <input
                                        type="number"
                                        step="0.0001"
                                        value={row.porcentaje_merma ?? ""}
                                        onChange={(event) =>
                                            handleRowChange(index, {
                                                porcentaje_merma: event.target.value === "" ? "" : Number(event.target.value),
                                            })
                                        }
                                    />
                                ) : (
                                    "-"
                                )}
                            </td>
                            <td>
                                {row.tipo_insumo === "Material" ? (
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={row.precio_flete_unitario ?? ""}
                                        onChange={(event) =>
                                            handleRowChange(index, {
                                                precio_flete_unitario:
                                                    event.target.value === "" ? "" : Number(event.target.value),
                                            })
                                        }
                                    />
                                ) : (
                                    "-"
                                )}
                            </td>
                            <td>
                                {row.tipo_insumo === "ManoObra" ? (
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        value={row.rendimiento_jornada ?? ""}
                                        onChange={(event) =>
                                            handleRowChange(index, {
                                                rendimiento_jornada:
                                                    event.target.value === "" ? "" : Number(event.target.value),
                                            })
                                        }
                                    />
                                ) : (
                                    "-"
                                )}
                            </td>
                            <td>
                                {obtenerCostoUnitario(row) === 0 ? (
                                    <button
                                        type="button"
                                        onClick={() => handleObtenerPrecio(index)}
                                        disabled={loadingPriceForRow === index}
                                        title="Obtener sugerencia de precio de mercado"
                                        style={{
                                            padding: "4px 8px",
                                            backgroundColor: "#4CAF50",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "4px",
                                            cursor: loadingPriceForRow === index ? "not-allowed" : "pointer",
                                            opacity: loadingPriceForRow === index ? 0.6 : 1,
                                        }}
                                    >
                                        {loadingPriceForRow === index ? "â³ Cargando..." : "ð Obtener"}
                                    </button>
                                ) : obtenerObsoleto(row) ? (
                                    <span
                                        style={{
                                            backgroundColor: "#fff3cd",
                                            padding: "4px 8px",
                                            borderRadius: "4px",
                                            fontWeight: "bold",
                                            color: "#856404",
                                        }}
                                        title="Precio obsoleto (más de 90 días sin actualizar)"
                                    >
                                        ?? {formatearMoneda(obtenerCostoUnitario(row))}
                                    </span>
                                ) : (
                                    formatearMoneda(obtenerCostoUnitario(row))
                                )}
                            </td>
                            <td>{formatearMoneda(obtenerCostoUnitario(row) * row.cantidad)}</td>
                            <td>
                                {row.existe_en_catalogo === false ? (
                                    <button type="button" onClick={() => abrirCatalogoDesdeRow(index)}>
                                        Agregar a Catalogo
                                    </button>
                                ) : (
                                    <button type="button" onClick={() => handleDeleteRow(row.id, index)}>
                                        Eliminar
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                    <tr>
                        <td>
                            <select
                                value={draftRow.tipo_insumo}
                                onChange={(event) =>
                                    setDraftRow((prev) => ({
                                        ...prev,
                                        tipo_insumo: event.target.value as MatrizRow["tipo_insumo"],
                                        id_insumo: "",
                                        porcentaje_merma: event.target.value === "Material" ? prev.porcentaje_merma : "",
                                        precio_flete_unitario: event.target.value === "Material" ? prev.precio_flete_unitario : "",
                                        rendimiento_jornada: event.target.value === "ManoObra" ? prev.rendimiento_jornada : "",
                                    }))
                                }
                            >
                                <option value="Material">Material</option>
                                <option value="ManoObra">Mano de Obra</option>
                                <option value="Equipo">Equipo</option>
                                <option value="Maquinaria">Maquinaria</option>
                            </select>
                        </td>
                        <td>
                            {renderInsumoSelect(draftRow, -1, (updates) =>
                                setDraftRow((prev) => ({ ...prev, ...updates }))
                            )}
                        </td>
                        <td>{obtenerUnidad(draftRow)}</td>
                        <td>
                            <input
                                type="number"
                                min="0"
                                step="0.0001"
                                value={draftRow.cantidad}
                                onChange={(event) =>
                                    setDraftRow((prev) => ({ ...prev, cantidad: Number(event.target.value) || 0 }))
                                }
                            />
                        </td>
                        <td>
                            {draftRow.tipo_insumo === "Material" ? (
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={draftRow.porcentaje_merma ?? ""}
                                    onChange={(event) =>
                                        setDraftRow((prev) => ({
                                            ...prev,
                                            porcentaje_merma: event.target.value === "" ? "" : Number(event.target.value),
                                        }))
                                    }
                                />
                            ) : (
                                "-"
                            )}
                        </td>
                        <td>
                            {draftRow.tipo_insumo === "Material" ? (
                                <input
                                    type="number"
                                    step="0.01"
                                    value={draftRow.precio_flete_unitario ?? ""}
                                    onChange={(event) =>
                                        setDraftRow((prev) => ({
                                            ...prev,
                                            precio_flete_unitario: event.target.value === "" ? "" : Number(event.target.value),
                                        }))
                                    }
                                />
                            ) : (
                                "-"
                            )}
                        </td>
                        <td>
                            {draftRow.tipo_insumo === "ManoObra" ? (
                                <input
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    value={draftRow.rendimiento_jornada ?? ""}
                                    onChange={(event) =>
                                        setDraftRow((prev) => ({
                                            ...prev,
                                            rendimiento_jornada: event.target.value === "" ? "" : Number(event.target.value),
                                        }))
                                    }
                                />
                            ) : (
                                "-"
                            )}
                        </td>
                        <td>{formatearMoneda(obtenerCostoUnitario(draftRow))}</td>
                        <td>{formatearMoneda(obtenerCostoUnitario(draftRow) * draftRow.cantidad)}</td>
                        <td>
                            <button type="button" onClick={handleAgregarDraft} disabled={!puedeAgregarDraft()}>
                                Agregar
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>

            {catalogModal && (
                <div className="catalog-modal">
                    <div className="catalog-modal__content card">
                        <h3>Agregar {catalogModal.tipo} al catalogo</h3>
                        <form onSubmit={handleCatalogSubmit}>
                            {renderCatalogFormFields()}
                            <div className="modal-actions">
                                <button type="submit">Guardar en Catalogo</button>
                                <button type="button" onClick={() => setCatalogModal(null)}>
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );

    function renderInsumoSelect(
        row: MatrizRow,
        index: number,
        customHandler?: (updates: Partial<MatrizRow>) => void
    ) {
        if (row.existe_en_catalogo === false) {
            return (
                <span
                    className="insumo-pendiente"
                    title={row.justificacion_breve ?? row.nombre_sugerido ?? undefined}
                >
                    {row.nombre_sugerido ?? "Insumo sugerido (pendiente)"}
                </span>
            );
        }
        const options = obtenerOpciones(row.tipo_insumo, catalogos);
        const handler = customHandler
            ? customHandler
            : (updates: Partial<MatrizRow>) => handleRowChange(index, updates);
        return (
            <div className="insumo-field">
                <select
                    value={row.id_insumo}
                    title={row.justificacion_breve ?? undefined}
                    onChange={(event) =>
                        handler({
                            id_insumo: event.target.value ? Number(event.target.value) : "",
                            ...(row.tipo_insumo === "Material" && event.target.value
                                ? obtenerDefaultMermaFlete(Number(event.target.value), catalogos)
                                : row.tipo_insumo === "Material"
                                ? { porcentaje_merma: "", precio_flete_unitario: "" }
                                : {}),
                            ...(row.tipo_insumo === "ManoObra" && event.target.value
                                ? obtenerDefaultRendimiento(Number(event.target.value), catalogos)
                                : row.tipo_insumo === "Material"
                                ? {}
                                : row.tipo_insumo === "ManoObra"
                                ? { rendimiento_jornada: "" }
                                : {}),
                        })
                    }
                >
                    <option value="">-- seleccionar --</option>
                    {options.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.nombre}
                        </option>
                    ))}
                </select>
                {row.justificacion_breve ? (
                    <span className="insumo-field__info" title={row.justificacion_breve}>
                        i
                    </span>
                ) : null}
            </div>
        );
    }
}

type FactoresApiPayload = Record<"mano_obra" | FactorToggleKey, { activo: boolean; porcentaje: number }>;

function mapFactoresParaApi(factores?: FactorToggleMap): FactoresApiPayload | undefined {
    if (!factores) return undefined;
    const payload: FactoresApiPayload = {
        mano_obra: { activo: false, porcentaje: 0 },
        indirectos: { activo: false, porcentaje: 0 },
        financiamiento: { activo: false, porcentaje: 0 },
        utilidad: { activo: false, porcentaje: 0 },
        iva: { activo: false, porcentaje: 0 },
    };
    (["indirectos", "financiamiento", "utilidad", "iva"] as FactorToggleKey[]).forEach((key) => {
        const config = factores[key];
        if (!config) return;
        const porcentajeValor = Number(config.porcentaje);
        payload[key] = {
            activo: Boolean(config.activo),
            porcentaje: Number.isFinite(porcentajeValor) ? porcentajeValor / 100 : 0,
        };
    });
    const algunoActivo = (["indirectos", "financiamiento", "utilidad", "iva"] as FactorToggleKey[]).some(
        (key) => payload[key].activo && payload[key].porcentaje > 0
    );
    if (!algunoActivo) {
        return undefined;
    }
    return payload;
}

export function mapearSugerenciasDesdeIA(insumos: IASugerencia[] = [], conceptoId: number): MatrizRow[] {
    return insumos.map((item) => {
        const tipo = normalizarTipoIA(item.tipo_insumo);
        const idInsumo = (item.id_insumo ?? item.insumo_id) ?? "";
        const merma = item.merma ?? item.porcentaje_merma ?? null;
        const flete = item.flete_unitario ?? item.precio_flete_unitario ?? null;
        const rendimiento = item.rendimiento_diario ?? item.rendimiento_jornada ?? null;
        return {
            concepto: conceptoId,
            tipo_insumo: tipo,
            id_insumo: idInsumo,
            cantidad: Number(item.cantidad ?? 0),
            porcentaje_merma: tipo === "Material" ? numeroOSinValor(merma) : "",
            precio_flete_unitario: tipo === "Material" ? numeroOSinValor(flete) : "",
            rendimiento_jornada: tipo === "ManoObra" ? numeroOSinValor(rendimiento) : "",
            existe_en_catalogo: item.existe_en_catalogo ?? Boolean(idInsumo),
            nombre_sugerido: item.nombre ?? undefined,
            justificacion_breve: item.justificacion_breve ?? undefined,
        };
    });
}

function normalizarTipoIA(tipo: IASugerencia["tipo_insumo"]): MatrizRow["tipo_insumo"] {
    const texto = (tipo ?? "Material").toString().replace(/\s+/g, "").toLowerCase();
    switch (texto) {
        case "manodeobra":
            return "ManoObra";
        case "equipo":
            return "Equipo";
        case "maquinaria":
            return "Maquinaria";
        default:
            return "Material";
    }
}

function numeroOSinValor(valor: number | null): number | "" {
    if (valor === null || valor === undefined) {
        return "";
    }
    const parsed = Number(valor);
    return Number.isNaN(parsed) ? "" : parsed;
}

type InsumoOption = { id: number; nombre: string };

function obtenerOpciones(tipo: MatrizRow["tipo_insumo"], catalogos: CatalogData | null): InsumoOption[] {
    if (!catalogos) return [];
    if (tipo === "Material") {
        return Object.values(catalogos.materiales).map((material) => ({
            id: material.id,
            nombre: material.nombre,
        }));
    }
    if (tipo === "ManoObra") {
        return Object.values(catalogos.manoObra).map((item) => ({
            id: item.id,
            nombre: item.puesto,
        }));
    }
    if (tipo === "Equipo") {
        return Object.values(catalogos.equipos).map((equipo) => ({
            id: equipo.id,
            nombre: equipo.nombre,
        }));
    }
    return Object.values(catalogos.maquinaria).map((equipo) => ({
        id: equipo.id,
        nombre: equipo.nombre,
    }));
}

function obtenerDefaultMermaFlete(materialId: number, catalogos: CatalogData | null) {
    if (!catalogos) return {};
    const material = catalogos.materiales[materialId];
    if (!material) return {};
    return {
        porcentaje_merma: material.porcentaje_merma,
        precio_flete_unitario: material.precio_flete_unitario,
    };
}

function obtenerDefaultRendimiento(manoId: number, catalogos: CatalogData | null) {
    if (!catalogos) return {};
    const mano = catalogos.manoObra[manoId];
    if (!mano) return {};
    return {
        rendimiento_jornada: mano.rendimiento_jornada,
    };
}

function crearDraftRow(conceptoId?: number | null): MatrizRow {
    return {
        concepto: conceptoId ?? 0,
        tipo_insumo: "Material",
        id_insumo: "",
        cantidad: 0,
        porcentaje_merma: "",
        precio_flete_unitario: "",
        rendimiento_jornada: "",
    };
}

function renderTooltip(contenido: string) {
    return (
        <span className="help-icon" title={contenido}>
            ?
        </span>
    );
}

type CatalogModalState = {
    rowIndex: number;
    tipo: MatrizRow["tipo_insumo"];
    form: Record<string, string>;
};

function crearFormularioCatalogo(row: MatrizRow): Record<string, string> {
    const nombre = row.nombre_sugerido ?? "";
    switch (row.tipo_insumo) {
        case "Material":
            return {
                nombre,
                unidad: "unidad",
                precio_unitario: "",
                porcentaje_merma: row.porcentaje_merma !== "" && row.porcentaje_merma !== undefined ? String(row.porcentaje_merma) : "0.03",
                precio_flete_unitario:
                    row.precio_flete_unitario !== "" && row.precio_flete_unitario !== undefined
                        ? String(row.precio_flete_unitario)
                        : "0",
            };
        case "ManoObra":
            return {
                nombre,
                salario_base: "",
                rendimiento_jornada:
                    row.rendimiento_jornada !== "" && row.rendimiento_jornada !== undefined
                        ? String(row.rendimiento_jornada)
                        : "8.0",
            };
        case "Equipo":
            return {
                nombre,
                unidad: "hora",
                costo_hora_maq: "",
            };
        case "Maquinaria":
            return {
                nombre,
                costo_adquisicion: "",
                vida_util_horas: "",
                tasa_interes_anual: "0.10",
                rendimiento_horario: "1.0",
            };
        default:
            return { nombre };
    }
}


