import React, { useState } from 'react';
import {
    Search, Plus, Save, Trash2, Edit3, Package, HardHat, Truck, Wrench,
    FolderOpen, FileText, ArrowUpRight, BoxSelect, X, Eye, Tag, CheckCircle2,
    Folder, ChevronLeft, Calculator, Receipt, ScrollText
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

// --- LISTA MAESTRA DE UNIDADES (Misma que en Analisis) ---
const CATALOG_UNITS = [
    "pza", "m2", "m3", "ml", "kg", "ton", "litro", "galon",
    "bulto", "caja", "lote", "jor", "hr", "dia", "sem", "mes", "%MO"
];

// Tipos de pestañas
type TabType = 'materiales' | 'mano_obra' | 'equipos' | 'maquinaria' | 'proyectos_guardados';
type FolderType = 'Presupuesto' | 'Factura' | 'Nota de Venta' | null;

export default function CatalogoPage() {
    const [activeTab, setActiveTab] = useState<TabType>('materiales');
    const [currentFolder, setCurrentFolder] = useState<FolderType>(null);
    const [selectedProject, setSelectedProject] = useState<any>(null);

    // --- Estados simulados de datos ---
    const [newItem, setNewItem] = useState({
        nombre: '', unidad: '', precio: '',
        puesto: '', salario: '', antiguedad: '', rendimiento: '',
        costo_hora: '',
        costo_adq: '', vida_util: '', tasa: '',
    });

    const [materiales, setMateriales] = useState([
        { id: 1, nombre: 'Cemento Gris 50kg', unidad: 'bulto', precio: 210.50, fecha: '2023-10-15' },
        { id: 2, nombre: 'Arena de Rio', unidad: 'm3', precio: 450.00, fecha: '2023-11-01' },
    ]);
    const [manoObra, setManoObra] = useState([
        { id: 1, puesto: 'Oficial Albañil', salario: 450.00, antiguedad: 2, rendimiento: 0.1, fecha: '2024-01-10' },
    ]);
    const [equipos, setEquipos] = useState([
        { id: 1, nombre: 'Andamio tubular', unidad: 'día', costo_hora: 15.00, fecha: '2023-09-20' },
    ]);
    const [maquinaria, setMaquinaria] = useState([
        { id: 1, nombre: 'Revolvedora 1 saco', costo_adq: 25000, vida_util: 2000, tasa: 12, rendimiento: 5, fecha: '2023-05-15' },
    ]);

    const [proyectos, setProyectos] = useState([
        {
            id: 1, nombre: 'Muro Perimetral Norte', tipo_documento: 'Presupuesto',
            descripcion: 'Muro de block con dalas',
            config: { apu: true, iva: true, indirectos: true, utilidad: true, financiamiento: false },
            total: 154200.50, fecha: '2024-02-20', insumos: []
        },
        {
            id: 2, nombre: 'Losa Casa Habitación', tipo_documento: 'Presupuesto',
            descripcion: 'Losa maciza 10cm',
            config: { apu: true, iva: true, indirectos: false, utilidad: true, financiamiento: false },
            total: 89350.00, fecha: '2024-02-18', insumos: []
        },
        {
            id: 3, nombre: 'Suministro Block', tipo_documento: 'Nota de Venta',
            descripcion: 'Venta de block 15x20x40',
            config: { apu: false, iva: true, indirectos: false, utilidad: false, financiamiento: false },
            total: 12500.00, fecha: '2024-02-15', insumos: []
        },
    ]);

    // --- Lógica de Guardado ---
    const handleInputChange = (field: string, value: string) => setNewItem(prev => ({ ...prev, [field]: value }));

    const handleCreateItem = () => {
        // (Simulación de guardado)
        const id = Date.now();
        if (activeTab === 'materiales') {
            if (!newItem.nombre || !newItem.precio) return alert('Faltan datos');
            setMateriales([...materiales, { id, nombre: newItem.nombre, unidad: newItem.unidad || 'pza', precio: parseFloat(newItem.precio) || 0, fecha: 'Hoy' }]);
        } else if (activeTab === 'mano_obra') {
            if (!newItem.puesto || !newItem.salario) return alert('Faltan datos');
            setManoObra([...manoObra, { id, puesto: newItem.puesto, salario: parseFloat(newItem.salario) || 0, antiguedad: parseFloat(newItem.antiguedad) || 0, rendimiento: parseFloat(newItem.rendimiento) || 0, fecha: 'Hoy' }]);
        } else if (activeTab === 'equipos') {
            if (!newItem.nombre || !newItem.costo_hora) return alert('Faltan datos');
            setEquipos([...equipos, { id, nombre: newItem.nombre, unidad: newItem.unidad || 'día', costo_hora: parseFloat(newItem.costo_hora) || 0, fecha: 'Hoy' }]);
        } else if (activeTab === 'maquinaria') {
            if (!newItem.nombre || !newItem.costo_adq) return alert('Faltan datos');
            setMaquinaria([...maquinaria, { id, nombre: newItem.nombre, costo_adq: parseFloat(newItem.costo_adq) || 0, vida_util: parseFloat(newItem.vida_util) || 0, tasa: parseFloat(newItem.tasa) || 0, rendimiento: parseFloat(newItem.rendimiento) || 0, fecha: 'Hoy' }]);
        }
        setNewItem({ nombre: '', unidad: '', precio: '', puesto: '', salario: '', antiguedad: '', rendimiento: '', costo_hora: '', costo_adq: '', vida_util: '', tasa: '' });
    };

    const handleDelete = (id: number, listSetter: React.Dispatch<React.SetStateAction<any[]>>) => {
        if (window.confirm('¿Estás seguro de eliminar este item?')) {
            listSetter(prev => prev.filter(item => item.id !== id));
        }
    };

    // Helper Badges
    const ConfigBadges = ({ config }: { config: any }) => (
        <div className="flex flex-wrap gap-1 mt-1.5">
            {config?.apu && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded border border-blue-200">APU</span>}
            {config?.iva && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[9px] font-bold rounded border border-gray-200">IVA</span>}
            {config?.indirectos && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-bold rounded border border-purple-200">Indirectos</span>}
            {config?.utilidad && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded border border-green-200">Utilidad</span>}
        </div>
    );

    // Renderizado del formulario
    const renderForm = () => {
        if (activeTab === 'materiales') return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="col-span-2"><label className="text-xs font-semibold text-gray-500 uppercase">Nombre</label><input type="text" value={newItem.nombre} onChange={e => handleInputChange('nombre', e.target.value)} className="w-full border-gray-300 rounded text-sm" /></div>

                {/* CAMBIO: Input con Datalist */}
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Unidad</label>
                    <input
                        type="text"
                        list="catalog-units"
                        value={newItem.unidad}
                        onChange={e => handleInputChange('unidad', e.target.value)}
                        className="w-full border-gray-300 rounded text-sm"
                        placeholder="Ej. pza"
                    />
                </div>

                <div><label className="text-xs font-semibold text-gray-500 uppercase">Precio</label><input type="number" value={newItem.precio} onChange={e => handleInputChange('precio', e.target.value)} className="w-full border-gray-300 rounded text-sm" /></div>
            </div>
        );
        if (activeTab === 'mano_obra') return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="col-span-2"><label className="text-xs font-semibold text-gray-500 uppercase">Puesto</label><input type="text" value={newItem.puesto} onChange={e => handleInputChange('puesto', e.target.value)} className="w-full border-gray-300 rounded text-sm" /></div>
                <div><label className="text-xs font-semibold text-gray-500 uppercase">Salario</label><input type="number" value={newItem.salario} onChange={e => handleInputChange('salario', e.target.value)} className="w-full border-gray-300 rounded text-sm" /></div>
                <div><label className="text-xs font-semibold text-gray-500 uppercase">Antigüedad (años)</label><input type="number" value={newItem.antiguedad} onChange={e => handleInputChange('antiguedad', e.target.value)} className="w-full border-gray-300 rounded text-sm" /></div>
            </div>
        );
        if (activeTab === 'equipos') return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="col-span-1"><label className="text-xs font-semibold text-gray-500 uppercase">Nombre Equipo</label><input type="text" value={newItem.nombre} onChange={e => handleInputChange('nombre', e.target.value)} className="w-full border-gray-300 rounded text-sm" /></div>

                {/* CAMBIO: Input con Datalist */}
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Unidad</label>
                    <input
                        type="text"
                        list="catalog-units"
                        value={newItem.unidad}
                        onChange={e => handleInputChange('unidad', e.target.value)}
                        className="w-full border-gray-300 rounded text-sm"
                    />
                </div>

                <div><label className="text-xs font-semibold text-gray-500 uppercase">Costo Hora</label><input type="number" value={newItem.costo_hora} onChange={e => handleInputChange('costo_hora', e.target.value)} className="w-full border-gray-300 rounded text-sm" placeholder="$0.00" /></div>
            </div>
        );
        if (activeTab === 'maquinaria') return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div><label className="text-xs font-semibold text-gray-500 uppercase">Nombre</label><input type="text" value={newItem.nombre} onChange={e => handleInputChange('nombre', e.target.value)} className="w-full border-gray-300 rounded text-sm" /></div>
                <div><label className="text-xs font-semibold text-gray-500 uppercase">Costo Adquisición</label><input type="number" value={newItem.costo_adq} onChange={e => handleInputChange('costo_adq', e.target.value)} className="w-full border-gray-300 rounded text-sm" /></div>
                <div><label className="text-xs font-semibold text-gray-500 uppercase">Vida Útil (hrs)</label><input type="number" value={newItem.vida_util} onChange={e => handleInputChange('vida_util', e.target.value)} className="w-full border-gray-300 rounded text-sm" /></div>
                <div><label className="text-xs font-semibold text-gray-500 uppercase">Tasa (%)</label><input type="number" value={newItem.tasa} onChange={e => handleInputChange('tasa', e.target.value)} className="w-full border-gray-300 rounded text-sm" /></div>
            </div>
        );
        return null;
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col relative">

            {/* DATALIST GLOBAL */}
            <datalist id="catalog-units">
                {CATALOG_UNITS.map(u => <option key={u} value={u} />)}
            </datalist>

            {/* Navbar Superior */}
            <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm h-16 flex-shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 text-white p-1.5 rounded-lg"><BoxSelect className="w-5 h-5" /></div>
                    <h1 className="text-lg font-bold text-slate-800 tracking-tight">APU <span className="font-normal text-slate-400">| Builder IA</span></h1>
                    <div className="ml-8 flex space-x-1 text-sm font-medium">
                        <button onClick={() => window.location.href = '/analisis'} className="text-gray-500 hover:text-indigo-600 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors">Análisis APU</button>
                        <button className="text-indigo-600 bg-indigo-50 px-3 py-2 rounded-md cursor-default">Catálogo</button>
                        <button onClick={() => window.location.href = '/comparador'} className="text-gray-500 hover:text-indigo-600 hover:bg-gray-50 px-3 py-2 rounded-md transition-colors">Comparador</button>
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <input type="text" placeholder="Buscar..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition-colors" />
                </div>
            </nav>

            {/* Contenido Principal */}
            <div className="max-w-7xl mx-auto px-8 py-6 flex-1 w-full flex flex-col">

                {/* Tabs */}
                <div className="flex space-x-1 mb-6 border-b border-gray-200 overflow-x-auto shrink-0">
                    <button onClick={() => setActiveTab('materiales')} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'materiales' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><Package className="w-4 h-4" /> Materiales</button>
                    <button onClick={() => setActiveTab('mano_obra')} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'mano_obra' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><HardHat className="w-4 h-4" /> Mano de Obra</button>
                    <button onClick={() => setActiveTab('equipos')} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'equipos' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><Wrench className="w-4 h-4" /> Equipos</button>
                    <button onClick={() => setActiveTab('maquinaria')} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'maquinaria' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><Truck className="w-4 h-4" /> Maquinaria</button>
                    <div className="w-px h-8 bg-gray-300 mx-2 self-center hidden md:block"></div>
                    <button onClick={() => { setActiveTab('proyectos_guardados'); setCurrentFolder(null); }} className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap", activeTab === 'proyectos_guardados' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/30')}><FolderOpen className="w-4 h-4" /> Proyectos Guardados</button>
                </div>

                {/* --- CONTENIDO (Vistas de Carpetas / Listas) --- */}
                {activeTab === 'proyectos_guardados' ? (
                    <div className="animate-in fade-in flex-1">
                        {currentFolder === null ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                                <div onClick={() => setCurrentFolder('Presupuesto')} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all group">
                                    <div className="flex items-start justify-between mb-4"><div className="bg-blue-100 p-3 rounded-lg text-blue-600"><Calculator className="w-8 h-8" /></div><span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">{proyectos.filter(p => p.tipo_documento === 'Presupuesto').length}</span></div>
                                    <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-700">Presupuestos</h3>
                                </div>
                                <div onClick={() => setCurrentFolder('Factura')} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-300 cursor-pointer transition-all group">
                                    <div className="flex items-start justify-between mb-4"><div className="bg-purple-100 p-3 rounded-lg text-purple-600"><Receipt className="w-8 h-8" /></div><span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">{proyectos.filter(p => p.tipo_documento === 'Factura').length}</span></div>
                                    <h3 className="text-lg font-bold text-gray-800 group-hover:text-purple-700">Facturas</h3>
                                </div>
                                <div onClick={() => setCurrentFolder('Nota de Venta')} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-300 cursor-pointer transition-all group">
                                    <div className="flex items-start justify-between mb-4"><div className="bg-orange-100 p-3 rounded-lg text-orange-600"><ScrollText className="w-8 h-8" /></div><span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">{proyectos.filter(p => p.tipo_documento === 'Nota de Venta').length}</span></div>
                                    <h3 className="text-lg font-bold text-gray-800 group-hover:text-orange-700">Notas de Venta</h3>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-in slide-in-from-right-4">
                                <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-4 bg-gray-50">
                                    <button onClick={() => setCurrentFolder(null)} className="p-2 hover:bg-white rounded-full border border-transparent hover:border-gray-300 transition-all text-gray-500"><ChevronLeft className="w-5 h-5" /></button>
                                    <div><h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Folder className="w-5 h-5" /> {currentFolder}s</h3></div>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs"><tr><th className="px-6 py-3">Nombre</th><th className="px-6 py-3">Descripción / Config</th><th className="px-6 py-3 text-right">Total</th><th className="px-6 py-3">Fecha</th><th className="px-6 py-3 text-right">Acciones</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {proyectos.filter(p => p.tipo_documento === currentFolder).map(p => (
                                            <tr key={p.id} className="hover:bg-gray-50 group">
                                                <td className="px-6 py-4 align-top"><span className="font-medium text-gray-900 flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-400" />{p.nombre}</span></td>
                                                <td className="px-6 py-4 align-top"><div className="text-gray-500 truncate max-w-xs mb-1">{p.descripcion}</div><ConfigBadges config={p.config} /></td>
                                                <td className="px-6 py-4 text-right font-bold text-indigo-700 align-top">${p.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                                <td className="px-6 py-4 text-gray-400 text-xs align-top">{p.fecha}</td>
                                                <td className="px-6 py-4 text-right align-top">
                                                    <button onClick={() => setSelectedProject(p)} title="Ver Detalles" className="text-gray-400 hover:text-indigo-600 mx-1 p-1 hover:bg-indigo-50 rounded transition-colors"><Eye className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(p.id, setProyectos)} title="Eliminar" className="text-gray-400 hover:text-red-600 mx-1 p-1 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Formulario de Alta */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8 animate-in fade-in">
                            <div className="flex justify-between items-start mb-4"><h3 className="text-sm font-bold text-gray-700 uppercase">Agregar Nuevo {activeTab.replace('_', ' ')}</h3></div>
                            {renderForm()}
                            <div className="mt-4 flex justify-end"><button onClick={handleCreateItem} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"><Plus className="w-4 h-4" /> Crear Item</button></div>
                        </div>

                        {/* Tablas de Insumos */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {activeTab === 'materiales' && (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs"><tr><th className="px-6 py-3">Nombre</th><th className="px-6 py-3">Unidad</th><th className="px-6 py-3">Precio</th><th className="px-6 py-3">Fecha</th><th className="px-6 py-3 text-right">Acciones</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {materiales.map(m => (<tr key={m.id} className="hover:bg-gray-50"><td className="px-6 py-3 font-medium">{m.nombre}</td><td className="px-6 py-3 text-gray-500">{m.unidad}</td><td className="px-6 py-3 font-bold">${m.precio}</td><td className="px-6 py-3 text-gray-400 text-xs">{m.fecha}</td><td className="px-6 py-3 text-right"><button onClick={() => handleDelete(m.id, setMateriales)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td></tr>))}
                                    </tbody>
                                </table>
                            )}
                            {activeTab === 'mano_obra' && (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs"><tr><th className="px-6 py-3">Puesto</th><th className="px-6 py-3">Salario</th><th className="px-6 py-3">Antigüedad</th><th className="px-6 py-3">Rendimiento</th><th className="px-6 py-3">Fecha</th><th className="px-6 py-3 text-right">Acciones</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {manoObra.map(m => (<tr key={m.id} className="hover:bg-gray-50"><td className="px-6 py-3 font-medium">{m.puesto}</td><td className="px-6 py-3 font-bold">${m.salario}</td><td className="px-6 py-3 text-gray-500">{m.antiguedad} años</td><td className="px-6 py-3 text-gray-500">{m.rendimiento}</td><td className="px-6 py-3 text-gray-400 text-xs">{m.fecha}</td><td className="px-6 py-3 text-right"><button onClick={() => handleDelete(m.id, setManoObra)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td></tr>))}
                                    </tbody>
                                </table>
                            )}
                            {activeTab === 'equipos' && (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs"><tr><th className="px-6 py-3">Nombre</th><th className="px-6 py-3">Unidad</th><th className="px-6 py-3">Costo Hora</th><th className="px-6 py-3">Fecha</th><th className="px-6 py-3 text-right">Acciones</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {equipos.map(e => (<tr key={e.id} className="hover:bg-gray-50"><td className="px-6 py-3 font-medium">{e.nombre}</td><td className="px-6 py-3 text-gray-500">{e.unidad}</td><td className="px-6 py-3 font-bold">${e.costo_hora}</td><td className="px-6 py-3 text-gray-400 text-xs">{e.fecha}</td><td className="px-6 py-3 text-right"><button onClick={() => handleDelete(e.id, setEquipos)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td></tr>))}
                                    </tbody>
                                </table>
                            )}
                            {activeTab === 'maquinaria' && (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs"><tr><th className="px-6 py-3">Nombre</th><th className="px-6 py-3">Costo Adq.</th><th className="px-6 py-3">Vida Útil</th><th className="px-6 py-3">Tasa</th><th className="px-6 py-3">Fecha</th><th className="px-6 py-3 text-right">Acciones</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {maquinaria.map(m => (<tr key={m.id} className="hover:bg-gray-50"><td className="px-6 py-3 font-medium">{m.nombre}</td><td className="px-6 py-3 font-bold">${m.costo_adq.toLocaleString()}</td><td className="px-6 py-3 text-gray-500">{m.vida_util} hrs</td><td className="px-6 py-3 text-gray-500">{m.tasa}%</td><td className="px-6 py-3 text-gray-400 text-xs">{m.fecha}</td><td className="px-6 py-3 text-right"><button onClick={() => handleDelete(m.id, setMaquinaria)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td></tr>))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* --- MODAL DE DETALLE --- */}
            {selectedProject && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                            <div><h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-600" /> {selectedProject.nombre}</h2></div>
                            <button onClick={() => setSelectedProject(null)}><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div className="space-y-4">
                                <div><span className="text-xs font-bold text-gray-500 uppercase block mb-1">Tipo de Documento</span><span className="text-sm text-gray-800">{selectedProject.tipo_documento}</span></div>
                                <div><span className="text-xs font-bold text-gray-500 uppercase block mb-1">Descripción</span><span className="text-sm text-gray-800">{selectedProject.descripcion}</span></div>
                                <div><span className="text-xs font-bold text-gray-500 uppercase block mb-1">Configuración</span><ConfigBadges config={selectedProject.config} /></div>
                                <div><span className="text-xs font-bold text-gray-500 uppercase block mb-1">Total</span><span className="text-2xl font-bold text-indigo-700">${selectedProject.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
                                <div><span className="text-xs font-bold text-gray-500 uppercase block mb-1">Fecha</span><span className="text-sm text-gray-800">{selectedProject.fecha}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
