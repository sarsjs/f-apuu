import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AnalisisPuPage from './pages/AnalisisPuPage';
import CatalogoPage from './pages/CatalogoPage';
import LoginPage from './pages/LoginPage';
import ComparadorPage from './pages/ComparadorPage'; // Restaurado
import AdminDashboard from './pages/AdminDashboard'; // Restaurado
import DashboardPage from './pages/DashboardPage'; // Nueva página
import { UserInfo } from './types/user';
import { UserContext } from './context/user';
import { apiFetch } from './api/client';

function App() {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const data = await apiFetch<UserInfo>({ url: '/auth/me' });
                setUser(data);
            } catch (error) {
                setUser(null);
            } finally {
                setIsChecking(false);
            }
        };
        checkAuth();
    }, []);

    if (isChecking) return <div>Cargando...</div>;

    return (
        <UserContext.Provider value={user}>
            <Toaster position="top-right" />
            <Routes>
                <Route path="/login" element={!user ? <LoginPage onLogin={setUser} /> : <Navigate to="/catalogo" replace />} />

                {/* Rutas Protegidas */}
                <Route path="/catalogo" element={user ? <CatalogoPage /> : <Navigate to="/login" replace />} />
                <Route path="/analisis" element={user ? <AnalisisPuPage /> : <Navigate to="/login" replace />} />
                <Route path="/comparador" element={user ? <ComparadorPage /> : <Navigate to="/login" replace />} />
                <Route path="/admin" element={user && user.is_admin ? <AdminDashboard /> : <Navigate to="/catalogo" replace />} />
                <Route path="/dashboard/:projectId" element={user ? <DashboardPage /> : <Navigate to="/login" replace />} />

                <Route path="/" element={<Navigate to="/catalogo" replace />} />
                <Route path="*" element={<Navigate to="/catalogo" replace />} />
            </Routes>
        </UserContext.Provider>
    );
}
export default App;
