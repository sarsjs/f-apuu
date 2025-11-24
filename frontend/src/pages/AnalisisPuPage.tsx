import { useEffect, useState } from "react";

import { apiFetch } from "../api/client";
import {
    ConceptoMatrizEditor,
    type MatrizRow,
    type FactorToggleMap,
    type FactorToggleKey,
    mapearSugerenciasDesdeIA,
} from "../components/conceptos/ConceptoMatrizEditor";
import { NotaVentaModalFixed as NotaVentaModal, type NotaVenta } from "../components/conceptos/NotaVentaModalFixed";

type Concepto = {
    id: number;
    clave: string;
    descripcion: string;
    unidad_concepto: string;
};

type ConceptoForm = {
    id: number | null;
    clave: string;
    descripcion: string;
    unidad_concepto: string;
};

type ChatApuInsumo = {
    tipo_insumo: "Material" | "ManoObra" | "Mano de Obra" | "Equipo" | "Maquinaria";
    insumo_id?: number | null;
    id_insumo?: number | "";
    cantidad?: number;
    merma?: number | null;
    porcentaje_merma?: number | null;
    flete_unitario?: number | null;
    precio_flete_unitario?: number | null;
    rendimiento_diario?: number | null;
    rendimiento_jornada?: number | null;
    nombre?: string | null;
    justificacion_breve?: string | null;
};

type ChatApuResponse = {
    explicacion?: string;
    insumos: ChatApuInsumo[];
};

const SOBRECOSTO_FIELDS: Record<FactorToggleKey, { label: string; description: string }> = {
    indirectos: {
        label: "Costos indirectos",
        description: "Supervision, herramientas, oficinas, etc.",
    },
    financiamiento: {
        label: "Financiamiento",
        description: "Costo financiero de ejecutar la obra.",
    },
    utilidad: {
        label: "Utilidad",
        description: "Margen deseado del contratista.",
    },
    iva: {
        label: "IVA",
        description: "Impuesto al valor agregado.",
    },
};

const initialSobrecostos = (): FactorToggleMap => ({
    indirectos: { activo: true, porcentaje: 15 },
    financiamiento: { activo: false, porcentaje: 5 },
    utilidad: { activo: true, porcentaje: 10 },
    iva: { activo: true, porcentaje: 16 },
});

const emptyConceptoForm = (): ConceptoForm => ({
    id: null,
    clave: "",
    descripcion: "",
    unidad_concepto: "",
});

export function AnalisisPuPage() {
    const [conceptoForm, setConceptoForm] = useState<ConceptoForm>(() => emptyConceptoForm());
    const [selectedConceptId, setSelectedConceptId] = useState<number | null>(null);
    const [iaRows, setIaRows] = useState<MatrizRow[] | null>(null);
    const [guardarTrigger, setGuardarTrigger] = useState(0);
    const [resumen, setResumen] = useState({ costo_directo: 0, precio_unitario: 0 });
    const [iaExplanation, setIaExplanation] = useState<string>("");
    const [textoDetalles, setTextoDetalles] = useState<string>("");
    const [cargandoExplicacion, setCargandoExplicacion] = useState(false);
    const [matrizDraft, setMatrizDraft] = useState<MatrizRow[]>([]);
    const [notaVentaData, setNotaVentaData] = useState<NotaVenta | null>(null);
    const [sobrecostos, setSobrecostos] = useState<FactorToggleMap>(() => initialSobrecostos());

    useEffect(() => {
        void loadConceptos();
    }, []);

    useEffect(() => {
        if (selectedConceptId) {
            void loadConceptoDetalle(selectedConceptId);
        } else {
            setConceptoForm(emptyConceptoForm());
        }
        setIaExplanation("");
        setTextoDetalles("");
    }, [selectedConceptId]);

    useEffect(() => {
        if (selectedConceptId) {
            setMatrizDraft([]);
        }
    }, [selectedConceptId]);

    async function loadConceptos() {
        const data = await apiFetch<Concepto[]>(`/conceptos`);
        if (data.length && !selectedConceptId) {
            setSelectedConceptId(data[0].id);
        }
    }

    async function loadConceptoDetalle(id: number) {
        const data = await apiFetch<Concepto>(`/conceptos/${id}`);
        setConceptoForm({
            id: data.id,
            clave: data.clave,
            descripcion: data.descripcion,
            unidad_concepto: data.unidad_concepto,
        });
    }

    function handleSobrecostoToggle(key: FactorToggleKey, checked: boolean) {
        setSobrecostos((prev) => ({
            ...prev,
            [key]: { ...prev[key], activo: checked },
        }));
    }

    function handleSobrecostoPorcentaje(key: FactorToggleKey, value: string) {
        const parsed = Number(value);
        setSobrecostos((prev) => ({
            ...prev,
            [key]: { ...prev[key], porcentaje: Number.isFinite(parsed) ? parsed : 0 },
        }));
    }

    async function handleGuardarConcepto() {
        if (!conceptoForm.clave || !conceptoForm.descripcion || !conceptoForm.unidad_concepto) return;
        const payload = {
            clave: conceptoForm.clave,
            descripcion: conceptoForm.descripcion,
            unidad_concepto: conceptoForm.unidad_concepto,
        };
        if (conceptoForm.id) {
            await apiFetch(`/conceptos/${conceptoForm.id}`, { method: "PUT", body: payload });
            setGuardarTrigger((prev) => prev + 1);
            await loadConceptos();
            return;
        }
        const created = await apiFetch<Concepto>(`/conceptos`, { method: "POST", body: payload });
        await guardarMatrizRemota(created.id, matrizDraft);
        setConceptoForm((prev) => ({ ...prev, id: created.id }));
        setSelectedConceptId(created.id);
        setMatrizDraft([]);
        await loadConceptos();
    }

    async function handleEliminarConcepto() {
        if (!conceptoForm.id) return;
        if (!confirm("?Eliminar el concepto seleccionado?")) return;
        await apiFetch(`/conceptos/${conceptoForm.id}`, { method: "DELETE" });
        setConceptoForm(emptyConceptoForm());
        setSelectedConceptId(null);
        setMatrizDraft([]);
        await loadConceptos();
    }

    function handleChange<K extends keyof ConceptoForm>(field: K, value: ConceptoForm[K]) {
        setConceptoForm((prev) => ({ ...prev, [field]: value }));
    }

    async function handleSugerirAPUConIA() {
        if (!conceptoForm.descripcion) return;
        try {
            const data = await apiFetch<ChatApuResponse>(`/ia/chat_apu`, {
                method: "POST",
                body: {
                    descripcion: conceptoForm.descripcion,
                    unidad: conceptoForm.unidad_concepto,
                    concepto_id: conceptoForm.id,
                },
            });
            const mappedRows = mapearSugerenciasDesdeIA(data.insumos ?? [], conceptoForm.id ?? 0);
            setIaRows(mappedRows);
            const explicacion = data.explicacion ?? "";
            setIaExplanation(explicacion);
            setTextoDetalles(explicacion);
        } catch (error) {
            console.error("Error al solicitar /ia/chat_apu", error);
        }
    }

    function handleGuardarMatriz() {
        if (!conceptoForm.id) return;
        setGuardarTrigger((prev) => prev + 1);
    }

    async function handleDetallesSugerencia() {
        const explicacionActual = iaExplanation.trim();
        if (explicacionActual.length > 0) {
            setTextoDetalles(explicacionActual);
            return;
        }
        if (!conceptoForm.id && !conceptoForm.descripcion) return;
        setCargandoExplicacion(true);
        try {
            const params = conceptoForm.id
                ? `?concepto_id=${conceptoForm.id}`
                : `?descripcion_concepto=${encodeURIComponent(conceptoForm.descripcion)}`;
            const data = await apiFetch<{ explicacion: string }>(`/ia/explicar_sugerencia${params}`);
            setTextoDetalles(data.explicacion ?? "");
        } catch (error) {
            console.error("Error al obtener /ia/explicar_sugerencia", error);
        } finally {
            setCargandoExplicacion(false);
        }
    }

    async function guardarMatrizRemota(conceptoId: number, rows: MatrizRow[]) {
        if (!conceptoId || rows.length === 0) return;
        const existentes = await apiFetch<MatrizRow[]>(`/conceptos/${conceptoId}/matriz`);
        const idsActuales = new Set(rows.filter((row) => row.id).map((row) => row.id as number));
        for (const registro of existentes) {
            if (registro.id && !idsActuales.has(registro.id)) {
                await apiFetch(`/matriz/${registro.id}`, { method: "DELETE" });
            }
        }
        for (const row of rows) {
            if (!row.id_insumo) continue;
            const payload = {
                concepto: conceptoId,
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
            if (row.id) {
                await apiFetch(`/matriz/${row.id}`, { method: "PUT", body: payload });
            } else {
                await apiFetch<MatrizRow>(`/matriz`, { method: "POST", body: payload });
            }
        }
    }

    async function handleGenerarNotaVenta() {
        if (!conceptoForm.id || matrizDraft.length === 0 && !selectedConceptId) {
            alert("Guarda el concepto y su matriz de insumos antes de generar una nota de venta.");
            return;
        }

        const matrizParaEnviar = hayConceptoGuardado
            ? await apiFetch<MatrizRow[]>(`/conceptos/${conceptoForm.id}/matriz`)
            : matrizDraft;

        if (matrizParaEnviar.length === 0) {
            alert("La matriz de insumos esta vacia. No se puede generar una nota de venta.");
            return;
        }

        const payload: any = {
            descripcion: conceptoForm.descripcion,
            unidad: conceptoForm.unidad_concepto,
            matriz: matrizParaEnviar,
            concepto_id: conceptoForm.id,
        };

        try {
            const notaVenta = await apiFetch<NotaVenta>("/ventas/crear_nota_venta", {
                method: "POST",
                body: payload,
            });
            setNotaVentaData(notaVenta);
        } catch (error) {
            console.error("Error al generar la nota de venta:", error);
            alert("Hubo un error al generar la nota de venta. Revisa la consola para mas detalles.");
        }
    }

    const hayConceptoGuardado = Boolean(conceptoForm.id);

    return (
        <section className="page analisis-pu">
            <header className="analisis-hero">
                <div>
                    <p className="analisis-lead">Precios Unitarios</p>
                    <h1>Analisis de Precio Unitario</h1>
                </div>
            </header>

            <div className="analisis-layout">
                <div className="analisis-column analisis-column--left">
                    <section className="card detalle-card">
                        <header className="card__header">
                            <p className="card__eyebrow">Detalle del concepto</p>
                            <span className="card__status">{hayConceptoGuardado ? "Guardado" : "Borrador"}</span>
                        </header>
                        <div className="analisis-form-grid">
                            <label>
                                Nombre
                                <input
                                    value={conceptoForm.clave}
                                    onChange={(event) => handleChange("clave", event.target.value)}
                                    placeholder="Ej. Barda de tabique de 5 metros"
                                />
                            </label>
                            <label className="descripcion-field">
                                Descripcion
                                <textarea
                                    value={conceptoForm.descripcion}
                                    onChange={(event) => handleChange("descripcion", event.target.value)}
                                    rows={4}
                                    placeholder="Describe la actividad y especificaciones"
                                />
                            </label>
                        </div>
                        <p className="descripcion-tip">
                            Mientras mas completa sea la descripcion, mejor sera la sugerencia de la IA.
                        </p>
                    </section>

                    <section className="card resumen-card">
                        <header className="card__header">
                            <p className="card__eyebrow">Resumen financiero</p>
                        </header>
                        <div className="resumen-costos resumen-costos--panel">
                            <div>
                                <span>Costo directo</span>
                                <strong>${resumen.costo_directo.toFixed(2)}</strong>
                            </div>
                            <div>
                                <span>Precio unitario</span>
                                <strong>${resumen.precio_unitario.toFixed(4)}</strong>
                            </div>
                        </div>
                        <p className="resumen-ayuda">Activa los sobrecostos que deseas incluir en el calculo.</p>
                        <div className="sobrecosto-grid">
                            {(Object.keys(SOBRECOSTO_FIELDS) as FactorToggleKey[]).map((key) => {
                                const config = sobrecostos[key];
                                const meta = SOBRECOSTO_FIELDS[key];
                                return (
                                    <div key={key} className="sobrecosto-item">
                                        <label className="sobrecosto-item__toggle">
                                            <input
                                                type="checkbox"
                                                checked={config.activo}
                                                onChange={(event) => handleSobrecostoToggle(key, event.target.checked)}
                                            />
                                            <span>{meta.label}</span>
                                        </label>
                                        <div className="sobrecosto-item__input">
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.1}
                                                value={config.porcentaje}
                                                onChange={(event) => handleSobrecostoPorcentaje(key, event.target.value)}
                                                disabled={!config.activo}
                                            />
                                            <span>%</span>
                                        </div>
                                        <small>{meta.description}</small>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>

                <div className="analisis-column analisis-column--right">
                    <section className="card acciones-card">
                        <header className="card__header">
                            <p className="card__eyebrow">Acciones</p>
                        </header>
                        <div className="analisis-actions-grid">
                            <button type="button" onClick={handleSugerirAPUConIA} disabled={!conceptoForm.descripcion}>
                                Sugerencia Gemini
                            </button>
                            <button
                                type="button"
                                onClick={handleDetallesSugerencia}
                                disabled={!conceptoForm.descripcion || cargandoExplicacion}
                            >
                                {cargandoExplicacion ? "Obteniendo..." : "Detalles de Sugerencia"}
                            </button>
                            <button type="button" onClick={handleGuardarConcepto}>
                                Guardar Concepto
                            </button>
                            <button type="button" disabled={!conceptoForm.id} onClick={handleGuardarMatriz}>
                                Guardar Matriz
                            </button>
                            <button type="button" disabled={!conceptoForm.id} onClick={handleEliminarConcepto}>
                                Eliminar Concepto
                            </button>
                            <button type="button" disabled={!hayConceptoGuardado} onClick={handleGenerarNotaVenta}>
                                Generar Nota de Venta
                            </button>
                        </div>
                    </section>

                    <ConceptoMatrizEditor
                        conceptoId={conceptoForm.id}
                        conceptoInfo={conceptoForm}
                        iaRows={iaRows ?? undefined}
                        iaExplanation={iaExplanation}
                        guardarTrigger={guardarTrigger}
                        onResumenChange={setResumen}
                        modoLocal={!hayConceptoGuardado}
                        externalRows={!hayConceptoGuardado ? matrizDraft : undefined}
                        onRowsChange={!hayConceptoGuardado ? setMatrizDraft : undefined}
                        factoresSobrecosto={sobrecostos}
                    />
                </div>
            </div>

            <NotaVentaModal nota={notaVentaData} onClose={() => setNotaVentaData(null)} />
        </section>
    );
}
