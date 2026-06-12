import React from "react";
import { t } from "../../utils/translations";
import "./TableShapeModal.css";

const TableShapeModal = ({ show, onHide, onSelect, currentShape }) => {
    const shapes = [
        {
            id: "square",
            name: "Kvadrat",
            icon: (
                <div className="shape-preview shape-square"></div>
            ),
        },
        {
            id: "round",
            name: "Dəyirmi",
            icon: (
                <div className="shape-preview shape-round"></div>
            ),
        },
        {
            id: "rectangle",
            name: "Düzbucaqlı",
            icon: (
                <div className="shape-preview shape-rectangle"></div>
            ),
        },
        {
            id: "billiard",
            name: "Bilyard",
            icon: (
                <div className="shape-preview shape-billiard">
                    <div className="seat-dot seat-top-left"></div>
                    <div className="seat-dot seat-top-right"></div>
                    <div className="seat-dot seat-bottom-left"></div>
                    <div className="seat-dot seat-bottom-right"></div>
                    <div className="seat-dot seat-top-center"></div>
                    <div className="seat-dot seat-bottom-center"></div>
                </div>
            ),
        },
    ];

    return (
        <div className="table-shape-modal" style={{ display: show ? 'block' : 'none' }}>
            <div className="modal-backdrop" style={{ display: show ? 'block' : 'none' }} onClick={onHide}></div>
            <div className="modal-dialog" role="document">
                <div className="modal-content">
                    {/* Header */}
                    <div className="tsm-header">
                        <div className="tsm-header-left">
                            <div className="tsm-header-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="7" height="7" rx="1" />
                                    <rect x="14" y="3" width="7" height="7" rx="1" />
                                    <rect x="3" y="14" width="7" height="7" rx="1" />
                                    <rect x="14" y="14" width="7" height="7" rx="1" />
                                </svg>
                            </div>
                            <span className="tsm-title">{t("masa_formasini_secin")}</span>
                        </div>
                        <button type="button" className="tsm-close-btn" onClick={onHide}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    {/* Body */}
                    <div className="tsm-body">
                        <div className="shapes-grid">
                            {shapes.map((shape) => (
                                <div
                                    key={shape.id}
                                    className={`shape-option ${currentShape === shape.id ? "selected" : ""}`}
                                    onClick={() => onSelect(shape.id)}
                                >
                                    <div className="shape-icon-wrapper">{shape.icon}</div>
                                    <span className="shape-name">{shape.name}</span>
                                    {currentShape === shape.id && (
                                        <div className="check-badge">
                                            <i className="bi bi-check-circle-fill"></i>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="tsm-footer">
                        <button className="tsm-footer-btn" onClick={onHide}>{t("bagla")}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TableShapeModal;
