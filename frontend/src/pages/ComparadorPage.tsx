import React, { useState, useEffect, useContext } from 'react';
import {
    Package,
    Search,
    Trash2,
    X,
    Save,
    BoxSelect,
    History,
    Import,
    ArrowRight,
    FileText,
    ChevronLeft,
    Sparkles,
    Loader2
} from 'lucide-react';
import { UserContext } from '../context/user';
import { API_BASE_URL } from '../api/client';

// --- Tipos ---
type Cotizacion = {
    tienda1: string; precio1: number;
    tienda2: string; precio2: number;
    tienda3: string; precio3: number;
};

type ComparacionItem = {
    id: string;
    nombre: string;
    unidad: string;
    isLoading?: boolean; // Estado de carga individual
    cotizaciones: Cotizacion;
};

type ComparacionGuardada = {
    id: string;
    nombre: string;
    fecha: string;
    items: ComparacionItem[];
};

// --- Datos Mock ---
const MOCK_PROYECTOS = [
    { id: 1, nombre: 'Muro Perimetral Norte', insumos: [{ nombre: 'Block 15x20x40', unidad: 'pza' }, { nombre: 'Cemento Gris', unidad: 'bulto' }] },
    { id: 2, nombre: 'Losa Casa Habitación', insumos: [{ nombre: 'Concreto Premezclado', unidad: 'm3' }, { nombre: 'Varilla 3/8', unidad: 'ton' }] },
];

export default function ComparadorPage() {
    const [view, setView] = useState<'active' | 'history'>('active');
    const [showImportModal, setShowImportModal] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [tabla, setTabla] = useState<ComparacionItem[]>([]);
    const [tituloComparacion, setTituloComparacion] = useState('');
    const [historial, setHistorial] = useState<ComparacionGuardada[]>([]);
    const currentUser = useContext(UserContext);

    useEffect(() => {
        const guardados = JSON.parse(localStorage.getItem('comparaciones') || '[]');
        setHistorial(guardados);
    }, []);

    // --- FUNCIONES DE LÓGICA ---

    // FUSIÓN: Agregar y Cotizar en un solo paso
    const handleAgregarYCotizar = async () => {
        const nombreMaterial = inputValue.trim();
        if (!nombreMaterial) return;

        const id = crypto.randomUUID();

        // 1. Agregar ítem en estado de carga (Loading)
        const nuevo: ComparacionItem = {
            id,
            nombre: nombreMaterial,
            unidad: 'pza',
            isLoading: true, // Empieza cargando
            cotizaciones: { tienda1: '', precio1: 0, tienda2: '', precio2: 0, tienda3: '', precio3: 0 }
        };

        setTabla(prev => [nuevo, ...prev]); // Lo ponemos al principio para verlo rápido
        setInputValue('');

        // 2. Disparar búsqueda automática
        try {
            const response = await fetch(`${API_BASE_URL}/ia/cotizar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ material: nombreMaterial }),
            });

            if (!response.ok) throw new Error('Error en la API');
            const data = await response.json();

            const cotizacionIA = {
                tienda1: data.tienda1 || "Tienda A", precio1: data.precio1 || 0,
                tienda2: data.tienda2 || "Tienda B", precio2: data.precio2 || 0,
                tienda3: data.tienda3 || "Tienda C", precio3: data.precio3 || 0
            };

            // 3. Actualizar con los datos recibidos
            setTabla(prev => prev.map(i => i.id === id ? {
                ...i,
                isLoading: false,
                cotizaciones: cotizacionIA
            } : i));

        } catch (error) {
            console.error(error);
            alert("Error al consultar IA");
            setTabla(prev => prev.map(i => i.id === id ? { ...i, isLoading: false } : i));
        }
    };

    // Función para re-cotizar un ítem individual si se desea
    const handleReCotizar = async (id: string, nombreMaterial: string) => {
        setTabla(prev => prev.map(i => i.id === id ? { ...i, isLoading: true } : i));
        try {
            const response = await fetch(`${API_BASE_URL}/ia/cotizar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ material: nombreMaterial }),
            });

            if (!response.ok) throw new Error('Error en la API');
            const data = await response.json();

            setTabla(prev => prev.map(i => i.id === id ? {
                ...i, isLoading: false,
                cotizaciones: {
                    tienda1: data.tienda1 || "Tienda A", precio1: data.precio1 || 0,
                    tienda2: data.tienda2 || "Tienda B", precio2: data.precio2 || 0,
                    tienda3: data.tienda3 || "Tienda C", precio3: data.precio3 || 0
                }
            } : i));
        } catch (error) {
            console.error(error);
            setTabla(prev => prev.map(i => i.id === id ? { ...i, isLoading: false } : i));
        }
    };

    const handleImportarProyecto = (proyecto: any) => {
        // Al importar, no cotizamos automático para no saturar, se deja manual.
        const nuevosItems = proyecto.insumos.map((ins: any) => ({
            id: crypto.randomUUID(),
            nombre: ins.nombre,
            unidad: ins.unidad,
            cotizaciones: { tienda1: '', precio1: 0, tienda2: '', precio2: 0, tienda3: '', precio3: 0 }
        }));
        setTabla([...tabla, ...nuevosItems]);
        setTituloComparacion(`Comparativa: ${proyecto.nombre}`);
        setShowImportModal(false);
    };

    const handleGuardarComparacion = () => {
        if (tabla.length === 0) return alert('No hay datos para guardar.');
        const nuevaComparacion: ComparacionGuardada = {
            id: crypto.randomUUID(),
            nombre: tituloComparacion || `Comparación ${new Date().toLocaleDateString()}`,
            fecha: new Date().toLocaleDateString('es-MX'),
            items: tabla
        };
        const nuevoHistorial = [nuevaComparacion, ...historial];
        setHistorial(nuevoHistorial);
        localStorage.setItem('comparaciones', JSON.stringify(nuevoHistorial));
        alert('✅ Comparación guardada exitosamente en el historial.');
    };

    const handleCargarHistorial = (comp: ComparacionGuardada) => {
        if (window.confirm("Esto reemplazará la tabla actual. ¿Continuar?")) {
            setTabla(comp.items);
            setTituloComparacion(comp.nombre);
            setView('active');
        }
    };

    const handleBorrarHistorial = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("¿Borrar esta comparación?")) {
            const filtrado = historial.filter(h => h.id !== id);
            setHistorial(filtrado);
            localStorage.setItem('comparaciones', JSON.stringify(filtrado));
        }
    };

    const updateItem = (id: string, field: string, val: any, isCotizacion = false) => {
        setTabla(prev => prev.map(item => {
            if (item.id !== id) return item;
            if (isCotizacion) return { ...item, cotizaciones: { ...item.cotizaciones, [field]: val } };
            return { ...item, [field]: val };
        }));
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">

            {/* Navbar */}
            <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm h-16 flex-shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 text-white p-1.5 rounded-lg"><BoxSelect className="w-5 h-5" /></div>
                    <h1 className="text-lg font-bold text-slate-800 tracking-tight">APU <span className="font-normal text-slate-400">| Builder IA</span></h1>
                    <div className="ml-8 flex space-x-1 text-sm font-medium">
                        <button onClick={() => window.location.href = '/analisis'} className="text-gray-500 hover:text-indigo-600 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors">Análisis APU</button>
                        <button onClick={() => window.location.href = '/catalogo'} className="text-gray-500 hover:text-indigo-600 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors">Catálogo</button>
                        <button className="text-indigo-600 bg-indigo-50 px-3 py-2 rounded-md cursor-default">Comparador</button>
                    </div>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setView('active')} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${view === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Cotizador</button>
                    <button onClick={() => setView('history')} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${view === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Guardados ({historial.length})</button>
                </div>
                {currentUser?.is_admin && (
                    <button
                        onClick={() => (window.location.href = '/admin')}
                        className="ml-4 bg-gray-900 hover:bg-black text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-all"
                    >
                        Dashboard Admin
                    </button>
                )}
            </nav>

            <div className="max-w-6xl mx-auto px-6 py-8">

                {/* VISTA COTIZADOR */}
                {view === 'active' && (
                    <div className="animate-in fade-in slide-in-from-left-4">
                        <div className="flex justify-between items-end mb-6">
                            <div className="w-1/2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título de la Comparación</label>
                                <input type="text" value={tituloComparacion} onChange={(e) => setTituloComparacion(e.target.value)} className="w-full text-xl font-bold text-slate-900 bg-transparent border-b border-gray-300 focus:border-indigo-600 focus:outline-none py-1" placeholder="Ej. Comparativa Muro Norte" />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowImportModal(true)} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm"><Import className="w-4 h-4" /> Importar de Proyecto</button>
                                <button onClick={handleGuardarComparacion} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm transition-colors"><Save className="w-4 h-4" /> Guardar</button>
                            </div>
                        </div>

                        {/* Barra de Agregar y Cotizar Directo */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm flex gap-3">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAgregarYCotizar()}
                                placeholder="Escribe un material (ej. Cemento 50kg) para cotizar..."
                                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                onClick={handleAgregarYCotizar}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-md shadow-indigo-200 transition-all"
                            >
                                <Sparkles className="w-4 h-4" /> Cotizar Ahora
                            </button>
                        </div>

                        {tabla.length > 0 ? (
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-4 w-1/4">Material / Insumo</th>
                                            <th className="px-4 py-4 w-1/4 bg-blue-50/50 text-blue-600 border-l">Opción A</th>
                                            <th className="px-4 py-4 w-1/4 border-l">Opción B</th>
                                            <th className="px-4 py-4 w-1/4 border-l">Opción C</th>
                                            <th className="px-2 py-4 w-10 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {tabla.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50 group">
                                                <td className="px-6 py-3 align-top relative">
                                                    {/* Loading Overlay para el item */}
                                                    {item.isLoading && (
                                                        <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center gap-2 text-indigo-600 text-xs font-medium">
                                                            <Loader2 className="w-4 h-4 animate-spin" /> Buscando precios...
                                                        </div>
                                                    )}

                                                    <input type="text" value={item.nombre} onChange={(e) => updateItem(item.id, 'nombre', e.target.value)} className="w-full font-medium text-gray-900 bg-transparent border-none p-0 focus:ring-0 mb-1" />
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-gray-400">{item.unidad}</span>
                                                        <button
                                                            onClick={() => handleReCotizar(item.id, item.nombre)}
                                                            className="text-[10px] text-indigo-400 hover:text-indigo-600 hover:underline flex items-center gap-1"
                                                        >
                                                            <Sparkles className="w-3 h-3" /> Recotizar
                                                        </button>
                                                    </div>
                                                </td>
                                                {/* Opciones de Precios */}
                                                {['1', '2', '3'].map((n) => (
                                                    <td key={n} className={`px-4 py-3 border-l border-gray-100 ${n === '1' ? 'bg-blue-50/30' : ''}`}>
                                                        <input type="text" placeholder={`Proveedor ${n}`} value={(item.cotizaciones as any)[`tienda${n}`]} onChange={(e) => updateItem(item.id, `tienda${n}`, e.target.value, true)} className="w-full text-xs mb-1 bg-white border border-gray-200 rounded px-2 py-1" />
                                                        <div className="relative"><span className="absolute left-2 top-1 text-gray-400 text-xs">$</span><input type="number" placeholder="0.00" value={(item.cotizaciones as any)[`precio${n}`] || ''} onChange={(e) => updateItem(item.id, `precio${n}`, parseFloat(e.target.value), true)} className="w-full text-sm font-bold text-gray-800 pl-5 bg-white border border-gray-200 rounded px-2 py-1" /></div>
                                                    </td>
                                                ))}
                                                <td className="px-2 py-3 text-center align-middle">
                                                    <button onClick={() => setTabla(t => t.filter(i => i.id !== item.id))} className="text-gray-300 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl"><Package className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">Escribe un material arriba para cotizar automáticamente.</p></div>
                        )}
                    </div>
                )}

                {/* VISTA HISTORIAL */}
                {view === 'history' && (
                    <div className="animate-in fade-in slide-in-from-right-4">
                        <div className="flex items-center gap-2 mb-6"><h2 className="text-xl font-bold text-slate-900">Comparaciones Guardadas</h2><span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{historial.length}</span></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {historial.map(comp => (
                                <div key={comp.id} onClick={() => handleCargarHistorial(comp)} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all group relative">
                                    <div className="flex justify-between items-start"><div><h3 className="font-bold text-gray-800 group-hover:text-indigo-700">{comp.nombre}</h3><p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><History className="w-3 h-3" /> {comp.fecha}</p></div><button onClick={(e) => handleBorrarHistorial(comp.id, e)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 className="w-4 h-4" /></button></div>
                                    <div className="mt-4 flex items-center gap-2"><span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100">{comp.items.length} items analizados</span><span className="text-xs text-gray-400 flex items-center gap-1 ml-auto group-hover:text-indigo-500">Cargar <ArrowRight className="w-3 h-3" /></span></div>
                                </div>
                            ))}
                            {historial.length === 0 && <div className="col-span-2 text-center py-12 text-gray-400 italic">No hay historial guardado.</div>}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL IMPORTAR */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-800">Selecciona un Proyecto</h3><button onClick={() => setShowImportModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button></div>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                            {MOCK_PROYECTOS.map(proj => (<button key={proj.id} onClick={() => handleImportarProyecto(proj)} className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"><div className="font-bold text-gray-800 group-hover:text-indigo-700">{proj.nombre}</div><div className="text-xs text-gray-500 mt-1">{proj.insumos.length} insumos registrados</div></button>))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
