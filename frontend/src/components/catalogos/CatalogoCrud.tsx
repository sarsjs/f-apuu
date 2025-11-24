import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiFetch } from "../../api/client";

type CatalogKey = "materiales" | "mano-obra" | "equipos" | "maquinaria";

type FieldConfig = {
    name: string;
    label: string;
    type: "text" | "number" | "date";
    step?: string;
    options?: string[];
};

type CatalogConfig = {
    key: CatalogKey;
    title: string;
    endpoint: string;
    fields: FieldConfig[];
};

type CatalogEntity = Record<string, string | number | boolean> & { id: number; obsoleto?: boolean };

type FormState = Record<string, string>;

const DISCIPLINAS = ["Estructuras", "Acabados", "Instalaciones", "Especiales", ""];
const CALIDADES = ["Premium", "Estándar", "Económica", ""];

const CATALOGS: CatalogConfig[] = [
    {
        key: "materiales",
        title: "Materiales",
        endpoint: "/materiales",
        fields: [
            { name: "nombre", label: "Nombre", type: "text" },
            { name: "unidad", label: "Unidad", type: "text" },
            { name: "disciplina", label: "Disciplina", type: "text", options: DISCIPLINAS },
            { name: "calidad", label: "Calidad", type: "text", options: CALIDADES },
            { name: "precio_unitario", label: "Precio Unitario", type: "number", step: "0.0001" },
            { name: "fecha_actualizacion", label: "Fecha Actualizacion", type: "date" },
            { name: "porcentaje_merma", label: "% Merma", type: "number", step: "0.0001" },
            { name: "precio_flete_unitario", label: "Precio Flete Unitario", type: "number", step: "0.0001" },
        ],
    },
    {
        key: "mano-obra",
        title: "Mano de Obra",
        endpoint: "/manoobra",
        fields: [
            { name: "puesto", label: "Puesto", type: "text" },
            { name: "disciplina", label: "Disciplina", type: "text", options: DISCIPLINAS },
            { name: "calidad", label: "Calidad", type: "text", options: CALIDADES },
            { name: "salario_base", label: "Salario Base", type: "number", step: "0.01" },
            { name: "antiguedad_anios", label: "Antiguedad (anios)", type: "number", step: "1" },
            { name: "rendimiento_jornada", label: "Rendimiento Jornada", type: "number", step: "0.0001" },
            { name: "fecha_actualizacion", label: "Fecha Actualizacion", type: "date" },
        ],
    },
    {
        key: "equipos",
        title: "Equipos",
        endpoint: "/equipo",
        fields: [
            { name: "nombre", label: "Nombre", type: "text" },
            { name: "unidad", label: "Unidad", type: "text" },
            { name: "disciplina", label: "Disciplina", type: "text", options: DISCIPLINAS },
            { name: "calidad", label: "Calidad", type: "text", options: CALIDADES },
            { name: "costo_hora_maq", label: "Costo Hora", type: "number", step: "0.0001" },
            { name: "fecha_actualizacion", label: "Fecha Actualizacion", type: "date" },
        ],
    },
    {
        key: "maquinaria",
        title: "Maquinaria",
        endpoint: "/maquinaria",
        fields: [
            { name: "nombre", label: "Nombre", type: "text" },
            { name: "disciplina", label: "Disciplina", type: "text", options: DISCIPLINAS },
            { name: "calidad", label: "Calidad", type: "text", options: CALIDADES },
            { name: "costo_adquisicion", label: "Costo Adquisicion", type: "number", step: "0.01" },
            { name: "vida_util_horas", label: "Vida Util (horas)", type: "number", step: "0.01" },
            { name: "tasa_interes_anual", label: "Tasa Interes", type: "number", step: "0.0001" },
            { name: "rendimiento_horario", label: "Rendimiento Horario", type: "number", step: "0.0001" },
            { name: "fecha_actualizacion", label: "Fecha Actualizacion", type: "date" },
        ],
    },
];

export function CatalogosDashboard() {
    const [activeTab, setActiveTab] = useState<CatalogKey>("materiales");
    const config = useMemo(
        () => CATALOGS.find((catalog) => catalog.key === activeTab)!,
        [activeTab]
    );

    async function handleActualizacionMasiva() {
        const payload = [
            { insumo_id: 1, tipo: "Material", nuevo_precio: 150.75 },
            { insumo_id: 1, tipo: "ManoObra", nuevo_precio: 650.00 },
            { insumo_id: 1, tipo: "Equipo", nuevo_precio: 25.50 },
        ];

        try {
            const response = await apiFetch<any>("/catalogos/actualizar_precios_masivo", {
                method: "POST",
                body: payload,
            });
            alert(`Actualización Masiva Exitosa: ${response.mensaje}`);
        } catch (error) {
            console.error("Error en la actualización masiva:", error);
            alert("Error al ejecutar la actualización masiva. Revisa la consola.");
        }
    }

    return (
        <section className="catalogos-dashboard">
            <header className="tabs">
                {CATALOGS.map((catalog) => (
                    <button
                        key={catalog.key}
                        className={catalog.key === activeTab ? "active" : ""}
                        onClick={() => setActiveTab(catalog.key)}
                    >
                        {catalog.title}
                    </button>
                ))}
            </header>
            <div className="utilidades-actions">
                <button onClick={handleActualizacionMasiva}>
                    Ejecutar Actualización Masiva (Simulada)
                </button>
            </div>
            <CatalogoCrud key={config.key} config={config} />
        </section>
    );
}

type CatalogoCrudProps = {
    config: CatalogConfig;
};

function CatalogoCrud({ config }: CatalogoCrudProps) {
    const [items, setItems] = useState<CatalogEntity[]>([]);
    const [formState, setFormState] = useState<FormState>(() =>
        Object.fromEntries(config.fields.map((field) => [field.name, ""]))
    );
    const [editingId, setEditingId] = useState<number | null>(null);

    useEffect(() => {
        void loadItems();
    }, [config.endpoint]);

    async function loadItems() {
        const data = await apiFetch<CatalogEntity[]>(config.endpoint);
        setItems(data);
    }

    function handleChange(field: string, value: string) {
        setFormState((prev) => ({ ...prev, [field]: value }));
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        const payload = { ...formState };
        // Auto-set fecha_actualizacion to today if not provided or if creating new
        if (!editingId || !payload.fecha_actualizacion) {
            payload.fecha_actualizacion = new Date().toISOString().split("T")[0];
        }
        const method = editingId ? "PUT" : "POST";
        const url = editingId ? `${config.endpoint}/${editingId}` : config.endpoint;
        await apiFetch<CatalogEntity>(url, { method, body: payload });
        await loadItems();
        resetForm();
    }

    function resetForm() {
        setFormState(Object.fromEntries(config.fields.map((field) => [field.name, ""])));
        setEditingId(null);
    }

    function handleEdit(item: CatalogEntity) {
        const updatedState: FormState = {};
        config.fields.forEach((field) => {
            let value = item[field.name];
            if (field.type === "date" && value && typeof value === "string") {
                // Ensure date is in YYYY-MM-DD format
                value = value.split("T")[0];
            }
            updatedState[field.name] = String(value ?? "");
        });
        setFormState(updatedState);
        setEditingId(item.id);
    }

    async function handleDelete(itemId: number) {
        if (!confirm("Desea eliminar el registro?")) return;
        await apiFetch<void>(`${config.endpoint}/${itemId}`, { method: "DELETE" });
        await loadItems();
    }

    return (
        <div className="catalogo-crud">
            <form onSubmit={handleSubmit} className="catalogo-form">
                {config.fields.map((field) => {
                    if (field.options) {
                        return (
                            <label key={field.name}>
                                {field.label}
                                <select
                                    value={formState[field.name]}
                                    onChange={(event) => handleChange(field.name, event.target.value)}
                                >
                                    {field.options.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt || "(Sin seleccionar)"}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        );
                    }
                    return (
                        <label key={field.name}>
                            {field.label}
                            <input
                                type={field.type}
                                value={formState[field.name]}
                                onChange={(event) => handleChange(field.name, event.target.value)}
                                required={field.name !== "disciplina" && field.name !== "calidad"}
                                step={field.step}
                            />
                        </label>
                    );
                })}
                <footer>
                    <button type="submit">{editingId ? "Actualizar" : "Crear"}</button>
                    {editingId && (
                        <button type="button" onClick={resetForm}>
                            Cancelar
                        </button>
                    )}
                </footer>
            </form>

            <table className="catalogo-table">
                <thead>
                    <tr>
                        {config.fields.map((field) => (
                            <th key={field.name}>{field.label}</th>
                        ))}
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr key={item.id} style={item.obsoleto ? { backgroundColor: "#fff3cd" } : {}}>
                            {config.fields.map((field) => {
                                const value = item[field.name];
                                const isObsoleto = field.name === "precio_unitario" && item.obsoleto;
                                return (
                                    <td
                                        key={`${item.id}-${field.name}`}
                                        style={isObsoleto ? { backgroundColor: "#ffe5e5", fontWeight: "bold" } : {}}
                                    >
                                        {isObsoleto ? `⚠️ ${String(value ?? "-")}` : String(value ?? "-")}
                                    </td>
                                );
                            })}
                            <td style={{ textAlign: "center" }}>
                                {item.obsoleto && (
                                    <span
                                        title="Precio obsoleto (más de 90 días sin actualizar)"
                                        style={{ fontSize: "1.2em", cursor: "help" }}
                                    >
                                        ⚠️ Obsoleto
                                    </span>
                                )}
                            </td>
                            <td>
                                <button type="button" onClick={() => handleEdit(item)}>
                                    Editar
                                </button>
                                <button type="button" onClick={() => handleDelete(item.id)}>
                                    Borrar
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
