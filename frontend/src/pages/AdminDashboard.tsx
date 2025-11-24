import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../api/client';

interface AdminRequest {
    endpoint: string;
    user_id: number | null;
    created_at: string;
}

interface AdminOverview {
    total_users: number;
    active_users: number;
    project_count: number;
    storage_bytes: number;
    storage_mb: number;
    ia_requests_total: number;
    ia_requests_today: number;
    recent_requests: AdminRequest[];
}

export default function AdminDashboard() {
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        const loadOverview = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/admin/overview`, {
                    credentials: 'include',
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error('No autorizado');
                }

                const data = await response.json();
                setOverview(data);
            } catch (err) {
                if (err instanceof Error && err.name !== 'AbortError') {
                    setError(err.message || 'No se pudo cargar el panel');
                }
            } finally {
                setLoading(false);
            }
        };

        loadOverview();

        return () => controller.abort();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </div>
        );
    }

    if (error || !overview) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <p className="text-red-600 font-semibold">{error || 'No se encontraron datos.'}</p>
            </div>
        );
    }

    const stats = [
        { label: 'Usuarios registrados', value: overview.total_users.toLocaleString('es-MX') },
        { label: 'Usuarios activos (15 min)', value: overview.active_users.toLocaleString('es-MX') },
        { label: 'Proyectos guardados', value: overview.project_count.toLocaleString('es-MX') },
        { label: 'IA (hoy)', value: overview.ia_requests_today.toLocaleString('es-MX') },
        { label: 'IA (total)', value: overview.ia_requests_total.toLocaleString('es-MX') },
        { label: 'Almacenamiento (MB)', value: overview.storage_mb.toLocaleString('es-MX') },
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
                <header className="flex flex-col gap-2">
                    <p className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">Panel Administrativo</p>
                    <h1 className="text-3xl font-bold text-slate-900">Visión general del producto</h1>
                    <p className="text-sm text-slate-500">Usuarios, proyectos y uso de la IA en un vistazo comercial.</p>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.map((stat) => (
                        <div key={stat.label} className="bg-white shadow-sm border border-gray-100 rounded-2xl p-4 flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-widest text-gray-400">{stat.label}</span>
                            <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
                        </div>
                    ))}
                </div>

                <section className="bg-white rounded-2xl shadow border border-gray-100 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900">Solicitudes de IA recientes</h2>
                        <span className="text-xs text-gray-500">{overview.recent_requests.length} registros</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase text-gray-400">
                                    <th className="py-2 pr-4">Usuario</th>
                                    <th className="py-2 pr-4">Endpoint</th>
                                    <th className="py-2 pr-4">Marca de tiempo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {overview.recent_requests.map((item) => (
                                    <tr key={`${item.endpoint}-${item.created_at}`} className="text-gray-600">
                                        <td className="py-2 pr-4">{item.user_id ?? 'Anónimo'}</td>
                                        <td className="py-2 pr-4">{item.endpoint}</td>
                                        <td className="py-2 pr-4">{new Date(item.created_at).toLocaleString('es-MX')}</td>
                                    </tr>
                                ))}
                                {overview.recent_requests.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="py-4 text-center text-gray-400">
                                            Sin registros recientes.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
}
