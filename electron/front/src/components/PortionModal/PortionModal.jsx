import React, { useState, useEffect } from "react";
import { Modal } from "react-bootstrap";
import { t } from "../../utils/translations";
import "./PortionModal.css";

const PortionModal = ({ show, onHide, product, onConfirm }) => {
    const [portionName, setPortionName] = useState("");
    const [portionPrice, setPortionPrice] = useState("");
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        if (show) {
            setPortionName("");
            setPortionPrice(product?.price != null ? String(parseFloat(product.price)) : "");
            setQuantity(1);
        }
    }, [show, product]);

    const handleConfirm = () => {
        const price = parseFloat(portionPrice);
        if (isNaN(price) || price < 0) return;
        onConfirm({
            ...product,
            price,
            quantity: quantity,
            portion_name: portionName.trim() || null,
        });
        onHide();
    };

    const handleNumpad = (val) => {
        setPortionPrice(prev => {
            if (val === "⌫") return prev.slice(0, -1);
            if (val === "." && prev.includes(".")) return prev;
            if (val === "." && prev === "") return "0.";
            return prev + val;
        });
    };

    if (!product) return null;

    const displayPrice = portionPrice === "" ? "0" : portionPrice;
    const total = (parseFloat(displayPrice || 0) * quantity).toFixed(2);

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            backdrop="static"
            keyboard={false}
            dialogClassName="portion-modal"
        >
            <div className="portion-modal-header">
                <div className="header-left">
                    <div className="header-icon-circle">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="16" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                    </div>
                    <h5 className="modal-title">{product.name}</h5>
                </div>
                <div className="product-price-badge">
                    {parseFloat(product.price || 0).toFixed(2)} ₼
                </div>
                <button className="close-btn" onClick={onHide}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            <Modal.Body className="portion-modal-body">
                {/* Portion name input */}
                <div className="portion-name-row">
                    <input
                        className="portion-name-input"
                        type="text"
                        placeholder={t("porsiya_adi_isteye_bagli")}
                        value={portionName}
                        onChange={e => setPortionName(e.target.value)}
                        maxLength={40}
                    />
                </div>

                {/* Price display */}
                <div className="portion-price-display">
                    <span className="price-label">{t("qiymet")}</span>
                    <span className="price-value">{parseFloat(displayPrice || 0).toFixed(2)} ₼</span>
                </div>

                {/* Numpad */}
                <div className="portion-numpad">
                    {["7","8","9","4","5","6","1","2","3",".","0","⌫"].map((key) => (
                        <button
                            key={key}
                            className={`numpad-key${key === "⌫" ? " backspace" : ""}`}
                            onClick={() => handleNumpad(key)}
                        >
                            {key === "⌫" ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                                    <line x1="18" y1="9" x2="12" y2="15" />
                                    <line x1="12" y1="9" x2="18" y2="15" />
                                </svg>
                            ) : key}
                        </button>
                    ))}
                </div>

                {/* Quantity stepper */}
                <div className="portion-qty-row">
                    <span className="qty-label">Say</span>
                    <div className="qty-stepper">
                        <button className="qty-btn" onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
                        <span className="qty-value">{quantity}</span>
                        <button className="qty-btn" onClick={() => setQuantity(q => q + 1)}>+</button>
                    </div>
                    <span className="qty-total">{total} ₼</span>
                </div>
            </Modal.Body>

            <div className="portion-modal-footer">
                <button className="portion-cancel-btn" onClick={onHide}>{t("cancel")}</button>
                <button className="portion-add-btn" onClick={handleConfirm}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Əlavə et ({quantity})
                </button>
            </div>
        </Modal>
    );
};

export default PortionModal;
