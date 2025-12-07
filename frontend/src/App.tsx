import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AnalisisPuPage } from './pages/AnalisisPuPage';
import CatalogoPage from './pages/CatalogoPage';
import ComparadorPage from './pages/ComparadorPage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import { API_BASE_URL } from './api/client';
import { UserInfo } from './types/user';
import { UserContext } from './context/user';

function App() {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const isAdmin = Boolean(user?.is_admin);

    useEffect(() => {
        let isMounted = true;

        const checkAuth = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/auth/me`, {
                    credentials: 'include',
                });
                if (!isMounted) return;
                if (response.ok) {
                    const data = await response.json();
                    setUser(data);
                    setIsAuthenticated(true);
                } else {
                    setUser(null);
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error('Error verificando sesión:', error);
                if (isMounted) {
                    setUser(null);
                    setIsAuthenticated(false);
                }
            } finally {
                if (isMounted) {
                    setIsChecking(false);
                }
            }
        };

        checkAuth();

        return () => {
            isMounted = false;
        };
    }, []);

    const handleLogin = (userInfo: UserInfo) => {
        setUser(userInfo);
        setIsAuthenticated(true);
    };

    if (isChecking) return null;

    return (
        <UserContext.Provider value={user}>
            <Routes>
                <Route
                    path="/login"
                    element={!isAuthenticated ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/analisis" replace />}
                />
                <Route
                    path="/analisis"
                    element={isAuthenticated ? <AnalisisPuPage /> : <Navigate to="/login" replace />}
                />
                <Route
                    path="/catalogo"
                    element={isAuthenticated ? <CatalogoPage /> : <Navigate to="/login" replace />}
                />
                <Route
                    path="/comparador"
                    element={isAuthenticated ? <ComparadorPage /> : <Navigate to="/login" replace />}
                />
                <Route
                    path="/admin"
                    element={isAuthenticated && isAdmin ? <AdminDashboard /> : <Navigate to="/analisis" replace />}
                />
                <Route path="/" element={<Navigate to="/analisis" replace />} />
                <Route path="*" element={<Navigate to="/analisis" replace />} />
            </Routes>
        </UserContext.Provider>
    );
}

export default App;
