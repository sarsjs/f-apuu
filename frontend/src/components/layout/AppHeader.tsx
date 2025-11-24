import { NavLink } from "react-router-dom";

export function AppHeader() {
    return (
        <header className="app-header">
            <div className="brand">Precios Unitarios</div>
            <nav>
                <NavLink to="/presupuesto">Presupuesto</NavLink>
                <NavLink to="/analisis">Analisis PU</NavLink>
                <NavLink to="/catalogos">Catalogos</NavLink>
            </nav>
        </header>
    );
}
