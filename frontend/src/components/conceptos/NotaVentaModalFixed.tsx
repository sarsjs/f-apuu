import React from "react";

export type NotaVenta = {
    concepto_id?: number | null;
    concepto_descripcion: string;
    unidad: string;
    cantidad: number;
    costo_directo_unitario: number;
    precio_unitario_final: number;
    importe_total: number;
    mensaje: string;
};

type Props = {
    nota: NotaVenta | null;
    onClose: () => void;
};

export function NotaVentaModalFixed({ nota, onClose }: Props) {
    if (!nota) return null;

    const sobrecosto = nota.precio_unitario_final - nota.costo_directo_unitario;

    const handleSimularExportar = () => {
        if (nota.concepto_id) {
            const url = `/api/ventas/descargar_nota_venta_pdf/${nota.concepto_id}`;
            window.open(url, "_blank", "noopener,noreferrer");
            return;
        }
        alert("No se dispone de un concepto asociado para descargar el PDF.");
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="modal-header">
                    <h2>Nota de Venta Preliminar</h2>
                    <button onClick={onClose} className="close-button" aria-label="Cerrar">×</button>
                </div>

                <div className="modal-body">
                    <h3>{nota.concepto_descripcion}</h3>
                    <p className="concepto-unidad">Unidad: {nota.unidad} | Cantidad: {nota.cantidad}</p>

                    <div className="resumen-financiero">
                        <div className="resumen-item">
                            <span className="label">Costo Directo (CD)</span>
                            <span className="valor">${nota.costo_directo_unitario.toFixed(2)}</span>
                        </div>
                        <div className="resumen-item">
                            <span className="label">Sobrecosto (Indirectos + Utilidad)</span>
                            <span className="valor">${sobrecosto.toFixed(2)}</span>
                        </div>
                        <div className="resumen-item total">
                            <span className="label">Precio Unitario (PU) Final</span>
                            <span className="valor">${nota.precio_unitario_final.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="detalle-concepto">
                        <h4>Detalle del Concepto:</h4>
                        <p>{nota.mensaje}</p>
                    </div>
                </div>

                <div className="modal-footer">
                    <button onClick={handleSimularExportar} className="cta-button">Simular Exportar/Imprimir PDF</button>
                    <button onClick={onClose} className="secondary-button">Cerrar</button>
                </div>

                <style>{`
                    .modal-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-color: rgba(0, 0, 0, 0.6);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        z-index: 1000;
                    }
                    .modal-content {
                        background-color: #ffffff;
                        padding: 1.5rem;
                        border-radius: 8px;
                        width: 90%;
                        max-width: 640px;
                        box-shadow: 0 6px 24px rgba(0,0,0,0.2);
                    }
                    .modal-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 0.5rem;
                        margin-bottom: 1rem;
                    }
                    .modal-header h2 { margin: 0; font-size: 1.25rem; }
                    .close-button { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
                    .modal-body h3 { margin-top: 0; }
                    .concepto-unidad { color: #555; margin-top: 0.25rem; }
                    .resumen-financiero { margin: 1rem 0; }
                    .resumen-item { display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #f0f0f0; }
                    .resumen-item.total { font-weight: 700; font-size: 1.05rem; border-top: 2px solid #eee; padding-top: 0.6rem; }
                    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
                    .cta-button { background-color: #0d6efd; color: white; padding: 0.5rem 1rem; border-radius: 6px; border: none; cursor: pointer; }
                    .secondary-button { background: transparent; border: 1px solid #ddd; padding: 0.45rem 0.9rem; border-radius: 6px; cursor: pointer; }
                `}</style>
            </div>
        </div>
    );
}

export default NotaVentaModalFixed;
