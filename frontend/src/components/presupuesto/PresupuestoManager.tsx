import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiFetch } from "../../api/client";

type FactorKey = "mano_obra" | "indirectos" | "financiamiento" | "utilidad" | "iva";

type FactorResponse = {
    activo: boolean;
    porcentaje: number;
};

type ProyectoResponse = {
    id: number;
    nombre_proyecto: string;
    ubicacion: string | null;
    descripcion: string;
    fecha_creacion: string;
    ajustes: Record<FactorKey, FactorResponse>;
    has_presupuesto_maximo: boolean;
    monto_maximo: number;
};

type FactorForm = {
    activo: boolean;
    porcentaje: string;
};

type ProyectoForm = {
    nombre_proyecto: string;
    ubicacion: string;
    descripcion: string;
    fecha_creacion: string;
    ajustes: Record<FactorKey, FactorForm>;
    has_presupuesto_maximo: boolean;
    monto_maximo: string;
};

type Partida = {
    id: number;
    nombre_partida: string;
    proyecto: number;
};

type Detalle = {
    id: number;
    partida: number;
    concepto: number;
    cantidad_obra: number;
    precio_unitario_calculado: number;
    costo_directo: number;
    concepto_detalle?: {
        clave: string;
        descripcion: string;
    };
};

type Concepto = {
    id: number;
    clave: string;
    descripcion: string;
};

type DetalleForm = {
    concepto: string;
    cantidad_obra: string;
};

const FACTOR_FIELDS: { key: FactorKey; label: string }[] = [
    { key: "mano_obra", label: "Costo de Mano de Obra (% MO)" },
    { key: "indirectos", label: "Factores de Indirectos (%)" },
    { key: "financiamiento", label: "Financiamiento (%)" },
    { key: "utilidad", label: "Utilidad (%)" },
    { key: "iva", label: "IVA (%)" },
];

const emptyAjustes = (): Record<FactorKey, FactorForm> => ({
    mano_obra: { activo: false, porcentaje: "0" },
    indirectos: { activo: false, porcentaje: "0" },
    financiamiento: { activo: false, porcentaje: "0" },
    utilidad: { activo: false, porcentaje: "0" },
    iva: { activo: false, porcentaje: "0" },
});

const initialProyectoForm = (): ProyectoForm => ({
    nombre_proyecto: "",
    ubicacion: "",
    descripcion: "",
    fecha_creacion: "",
    ajustes: emptyAjustes(),
    has_presupuesto_maximo: false,
    monto_maximo: "",
});

export function PresupuestoManager() {
    const [proyectos, setProyectos] = useState<ProyectoResponse[]>([]);
    const [proyectoForm, setProyectoForm] = useState<ProyectoForm>(() => initialProyectoForm());
    const [selectedProyectoId, setSelectedProyectoId] = useState<number | null>(null);
    const [showSelector, setShowSelector] = useState(false);

    const [partidas, setPartidas] = useState<Partida[]>([]);
    const [selectedPartidaId, setSelectedPartidaId] = useState<number | null>(null);
    const [detalles, setDetalles] = useState<Detalle[]>([]);
    const [partidaForm, setPartidaForm] = useState({ nombre_partida: "" });

    const [conceptos, setConceptos] = useState<Concepto[]>([]);
    const [conceptSearch, setConceptSearch] = useState("");
    const [detalleForm, setDetalleForm] = useState<DetalleForm>({ concepto: "", cantidad_obra: "" });

    useEffect(() => {
        void loadProyectos();
        void loadConceptos();
    }, []);

    useEffect(() => {
        if (selectedProyectoId) {
            void loadPartidas(selectedProyectoId);
            void loadProyectoDetalle(selectedProyectoId);
        } else {
            setPartidas([]);
            setSelectedPartidaId(null);
            setDetalles([]);
            setProyectoForm(initialProyectoForm());
        }
    }, [selectedProyectoId]);

    useEffect(() => {
        if (selectedPartidaId) {
            void loadDetalles(selectedPartidaId);
        } else {
            setDetalles([]);
        }
    }, [selectedPartidaId]);

    const filteredConceptos = useMemo(() => {
        const term = conceptSearch.toLowerCase();
        if (!term) return conceptos.slice(0, 5);
        return conceptos
            .filter((concepto) => `${concepto.clave} ${concepto.descripcion}`.toLowerCase().includes(term))
            .slice(0, 5);
    }, [conceptos, conceptSearch]);

    const resumen = useMemo(() => calcularResumen(detalles), [detalles]);
    const montoMaximo = proyectoForm.has_presupuesto_maximo ? Number(proyectoForm.monto_maximo || 0) : null;
    const restante = montoMaximo !== null ? montoMaximo - resumen.totalPU : null;

    async function loadProyectos() {
        const data = await apiFetch<ProyectoResponse[]>(`/proyectos`);
        setProyectos(data);
        if (selectedProyectoId) {
            const existe = data.some((proyecto) => proyecto.id === selectedProyectoId);
            if (!existe) {
                setSelectedProyectoId(null);
            }
        }
    }

    async function loadProyectoDetalle(proyectoId: number) {
        const data = await apiFetch<ProyectoResponse>(`/proyectos/${proyectoId}`);
        setProyectoForm(formFromResponse(data));
    }

    async function loadPartidas(proyectoId: number) {
        const data = await apiFetch<Partida[]>(`/proyectos/${proyectoId}/partidas`);
        setPartidas(data);
        const currentExists = data.some((partida) => partida.id === selectedPartidaId);
        if (!currentExists) {
            setSelectedPartidaId(data.length ? data[0].id : null);
        }
    }

    async function loadDetalles(partidaId: number) {
        const data = await apiFetch<Detalle[]>(`/partidas/${partidaId}/detalles`);
        setDetalles(
            data.map((detalle) => ({
                ...detalle,
                cantidad_obra: Number(detalle.cantidad_obra),
                precio_unitario_calculado: Number(detalle.precio_unitario_calculado),
                costo_directo: Number(detalle.costo_directo ?? detalle.precio_unitario_calculado),
            }))
        );
    }

    async function loadConceptos() {
        const data = await apiFetch<Concepto[]>(`/conceptos`);
        setConceptos(data);
    }

    function handleNuevoProyecto() {
        setSelectedProyectoId(null);
        setProyectoForm(initialProyectoForm());
        setPartidas([]);
        setSelectedPartidaId(null);
        setDetalles([]);
        setPartidaForm({ nombre_partida: "" });
    }

    async function handleProyectoSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const payload = buildProyectoPayload(proyectoForm);
        let response: ProyectoResponse;
        if (selectedProyectoId) {
            response = await apiFetch(`/proyectos/${selectedProyectoId}`, { method: "PUT", body: payload });
        } else {
            response = await apiFetch(`/proyectos`, { method: "POST", body: payload });
            setSelectedProyectoId(response.id);
        }
        setProyectoForm(formFromResponse(response));
        await loadProyectos();
    }

    async function handlePartidaSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedProyectoId || !partidaForm.nombre_partida) return;
        await apiFetch(`/partidas`, {
            method: "POST",
            body: { nombre_partida: partidaForm.nombre_partida, proyecto: selectedProyectoId },
        });
        setPartidaForm({ nombre_partida: "" });
        await loadPartidas(selectedProyectoId);
    }

    async function handleDetalleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedPartidaId || !detalleForm.concepto) return;
        await apiFetch(`/detalles-presupuesto`, {
            method: "POST",
            body: {
                partida: selectedPartidaId,
                concepto: Number(detalleForm.concepto),
                cantidad_obra: Number(detalleForm.cantidad_obra || 0),
            },
        });
        setDetalleForm({ concepto: "", cantidad_obra: "" });
        setConceptSearch("");
        await loadDetalles(selectedPartidaId);
    }

    async function handleCantidadBlur(detalleId: number) {
        const detalle = detalles.find((item) => item.id === detalleId);
        if (!detalle) return;
        await apiFetch(`/detalles-presupuesto/${detalleId}`, {
            method: "PUT",
            body: { cantidad_obra: detalle.cantidad_obra },
        });
        if (selectedPartidaId) {
            await loadDetalles(selectedPartidaId);
        }
    }

    async function handleEliminarDetalle(detalleId: number) {
        await apiFetch(`/detalles-presupuesto/${detalleId}`, { method: "DELETE" });
        if (selectedPartidaId) {
            await loadDetalles(selectedPartidaId);
        }
    }

    function handleDetalleCantidadLocalChange(detalleId: number, value: string) {
        setDetalles((prev) =>
            prev.map((detalle) => (detalle.id === detalleId ? { ...detalle, cantidad_obra: Number(value) } : detalle))
        );
    }

    return (
        <section className="presupuesto-manager">
            <header className="presupuesto-header">
                <h2>Gestionar Presupuesto</h2>
                <div className="actions">
                    <button type="button" onClick={handleNuevoProyecto}>
                        Nuevo Proyecto
                    </button>
                    <button type="button" onClick={() => setShowSelector((prev) => !prev)}>
                        Abrir Proyecto
                    </button>
                    {showSelector && (
                        <select
                            value={selectedProyectoId ?? ""}
                            onChange={(event) => setSelectedProyectoId(event.target.value ? Number(event.target.value) : null)}
                        >
                            <option value="">Seleccione un proyecto</option>
                            {proyectos.map((proyecto) => (
                                <option key={proyecto.id} value={proyecto.id}>
                                    {proyecto.nombre_proyecto}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </header>

            <form onSubmit={handleProyectoSubmit} className="card proyecto-form">
                <h3>Proyecto</h3>
                <label>
                    Nombre del Proyecto
                    <input
                        value={proyectoForm.nombre_proyecto}
                        onChange={(event) => setProyectoForm((prev) => ({ ...prev, nombre_proyecto: event.target.value }))}
                        required
                    />
                </label>
                <label>
                    Ubicacion
                    <input
                        value={proyectoForm.ubicacion}
                        onChange={(event) => setProyectoForm((prev) => ({ ...prev, ubicacion: event.target.value }))}
                    />
                </label>
                <label>
                    Fecha de Creacion
                    <input value={proyectoForm.fecha_creacion || "Se generara al guardar"} readOnly />
                </label>
                <label>
                    Detalles del Proyecto
                    <textarea
                        value={proyectoForm.descripcion}
                        onChange={(event) => setProyectoForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                    />
                </label>

                <section className="ajustes-card">
                    <h4>Ajustes del Proyecto</h4>
                    {FACTOR_FIELDS.map(({ key, label }) => (
                        <div key={key} className="ajuste-row">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={proyectoForm.ajustes[key].activo}
                                    onChange={(event) =>
                                        setProyectoForm((prev) => ({
                                            ...prev,
                                            ajustes: {
                                                ...prev.ajustes,
                                                [key]: { ...prev.ajustes[key], activo: event.target.checked },
                                            },
                                        }))
                                    }
                                />
                                {label}
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={proyectoForm.ajustes[key].porcentaje}
                                disabled={!proyectoForm.ajustes[key].activo}
                                onChange={(event) =>
                                    setProyectoForm((prev) => ({
                                        ...prev,
                                        ajustes: {
                                            ...prev.ajustes,
                                            [key]: { ...prev.ajustes[key], porcentaje: event.target.value },
                                        },
                                    }))
                                }
                            />
                        </div>
                    ))}

                    <label className="toggle-row">
                        <input
                            type="checkbox"
                            checked={proyectoForm.has_presupuesto_maximo}
                            onChange={(event) =>
                                setProyectoForm((prev) => ({
                                    ...prev,
                                    has_presupuesto_maximo: event.target.checked,
                                    monto_maximo: event.target.checked ? prev.monto_maximo : "",
                                }))
                            }
                        />
                        Si, cuento con un presupuesto maximo
                    </label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={proyectoForm.monto_maximo}
                        disabled={!proyectoForm.has_presupuesto_maximo}
                        onChange={(event) => setProyectoForm((prev) => ({ ...prev, monto_maximo: event.target.value }))}
                    />
                </section>

                <button type="submit">Guardar Proyecto</button>
            </form>

            <div className="presupuesto-grid">
                <form onSubmit={handlePartidaSubmit} className="card" id="partida-form">
                    <h3>Nueva Partida</h3>
                    <label>
                        Nombre de la Partida
                        <input
                            value={partidaForm.nombre_partida}
                            onChange={(event) => setPartidaForm({ nombre_partida: event.target.value })}
                            required
                            disabled={!selectedProyectoId}
                        />
                    </label>
                    <button type="submit" disabled={!selectedProyectoId}>
                        Agregar
                    </button>
                </form>

                <form onSubmit={handleDetalleSubmit} className="card">
                    <h3>Agregar Concepto</h3>
                    <label>
                        Buscar Concepto
                        <input
                            value={conceptSearch}
                            onChange={(event) => setConceptSearch(event.target.value)}
                            placeholder="Escriba clave o descripcion"
                            disabled={!selectedPartidaId}
                        />
                    </label>
                    {conceptSearch && (
                        <div className="autocomplete-list">
                            {filteredConceptos.map((concepto) => (
                                <button
                                    type="button"
                                    key={concepto.id}
                                    onClick={() => {
                                        setConceptSearch(`${concepto.clave} - ${concepto.descripcion}`);
                                        setDetalleForm((prev) => ({ ...prev, concepto: concepto.id.toString() }));
                                    }}
                                >
                                    {concepto.clave} - {concepto.descripcion}
                                </button>
                            ))}
                        </div>
                    )}
                    <label>
                        Cantidad de Obra
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={detalleForm.cantidad_obra}
                            disabled={!selectedPartidaId}
                            onChange={(event) => setDetalleForm((prev) => ({ ...prev, cantidad_obra: event.target.value }))}
                            required
                        />
                    </label>
                    <button type="submit" disabled={!selectedPartidaId || !detalleForm.concepto}>
                        Insertar
                    </button>
                </form>
            </div>

            <section className="partidas-list">
                <h3>Partidas del Proyecto</h3>
                <ul>
                    {partidas.map((partida) => (
                        <li key={partida.id}>
                            <button
                                type="button"
                                className={partida.id === selectedPartidaId ? "active" : ""}
                                onClick={() => setSelectedPartidaId(partida.id)}
                            >
                                {partida.nombre_partida}
                            </button>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="detalle-tabla">
                <h3>Detalle de Presupuesto</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Concepto</th>
                            <th>Cantidad</th>
                            <th>PU</th>
                            <th>Importe</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {detalles.map((detalle) => (
                            <tr key={detalle.id}>
                                <td>
                                    {detalle.concepto_detalle
                                        ? `${detalle.concepto_detalle.clave} - ${detalle.concepto_detalle.descripcion}`
                                        : detalle.concepto}
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={detalle.cantidad_obra}
                                        onChange={(event) => handleDetalleCantidadLocalChange(detalle.id, event.target.value)}
                                        onBlur={() => handleCantidadBlur(detalle.id)}
                                    />
                                </td>
                                <td>${detalle.precio_unitario_calculado.toFixed(4)}</td>
                                <td>${(detalle.precio_unitario_calculado * detalle.cantidad_obra).toFixed(2)}</td>
                                <td>
                                    <button type="button" onClick={() => handleEliminarDetalle(detalle.id)}>
                                        Eliminar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <footer className="resumen">
                    <p>Total CD: ${resumen.totalCD.toFixed(2)}</p>
                    <p>Total PU: ${resumen.totalPU.toFixed(2)}</p>
                    {montoMaximo !== null && (
                        <p className={restante !== null && restante < 0 ? "alerta-presupuesto" : ""}>
                            Max: ${montoMaximo.toFixed(2)} | Restante: ${(restante ?? 0).toFixed(2)}
                        </p>
                    )}
                </footer>
            </section>
        </section>
    );
}

type Resumen = {
    totalPU: number;
    totalCD: number;
};

function calcularResumen(detalles: Detalle[]): Resumen {
    return detalles.reduce(
        (acumulado, detalle) => {
            const cantidad = detalle.cantidad_obra;
            const totalPU = cantidad * detalle.precio_unitario_calculado;
            const totalCD = cantidad * (detalle.costo_directo ?? detalle.precio_unitario_calculado);
            return {
                totalPU: acumulado.totalPU + totalPU,
                totalCD: acumulado.totalCD + totalCD,
            };
        },
        { totalPU: 0, totalCD: 0 }
    );
}

function formFromResponse(proyecto: ProyectoResponse): ProyectoForm {
    const ajustes: Record<FactorKey, FactorForm> = emptyAjustes();
    FACTOR_FIELDS.forEach(({ key }) => {
        const ajuste = proyecto.ajustes[key];
        ajustes[key] = {
            activo: ajuste?.activo ?? false,
            porcentaje: String((ajuste?.porcentaje ?? 0) * 100),
        };
    });
    return {
        nombre_proyecto: proyecto.nombre_proyecto,
        ubicacion: proyecto.ubicacion ?? "",
        descripcion: proyecto.descripcion ?? "",
        fecha_creacion: proyecto.fecha_creacion,
        ajustes,
        has_presupuesto_maximo: proyecto.has_presupuesto_maximo,
        monto_maximo: proyecto.monto_maximo ? String(proyecto.monto_maximo) : "",
    };
}

function buildProyectoPayload(form: ProyectoForm) {
    const ajustesPayload: Record<FactorKey, FactorResponse> = {
        mano_obra: { activo: false, porcentaje: 0 },
        indirectos: { activo: false, porcentaje: 0 },
        financiamiento: { activo: false, porcentaje: 0 },
        utilidad: { activo: false, porcentaje: 0 },
        iva: { activo: false, porcentaje: 0 },
    };
    FACTOR_FIELDS.forEach(({ key }) => {
        const ajuste = form.ajustes[key];
        ajustesPayload[key] = {
            activo: ajuste.activo,
            porcentaje: Number(ajuste.porcentaje || "0") / 100,
        };
    });
    return {
        nombre_proyecto: form.nombre_proyecto,
        ubicacion: form.ubicacion,
        descripcion: form.descripcion,
        ajustes: ajustesPayload,
        has_presupuesto_maximo: form.has_presupuesto_maximo,
        monto_maximo: Number(form.monto_maximo || 0),
    };
}
