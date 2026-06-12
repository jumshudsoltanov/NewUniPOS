import React, { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import { t } from "../../utils/translations";
import "./ManualPriceModal.css";

const ManualPriceModal = ({ show, onClose, product, onConfirm }) => {
    const [price, setPrice] = useState("");

    useEffect(() => {
        if (show) {
            setPrice("");
        }
    }, [show]);

    const handleNumpad = (val) => {
        if (val === "backspace") {
            setPrice((prev) => prev.slice(0, -1));
        } else if (val === ".") {
            if (!price.includes(".")) {
                setPrice((prev) => prev + val);
            }
        } else {
            setPrice((prev) => prev + val);
        }
    };

    const handleConfirm = () => {
        if (!price || parseFloat(price) <= 0) return;
        onConfirm(parseFloat(price));
        onClose();
    };

    return (
        <Modal
            show={show}
            onHide={onClose}
            centered
            className="manual-price-modal"
            backdrop="static"
            animation={false}
        >
            <div className="modal-content-wrapper">
                <div className="modal-header-custom">
                    <div className="modal-title-custom">
                        <div className="header-icon">
                            <i className="bi bi-tag-fill"></i>
                        </div>
                        <span>{product?.name || "Qiymət təyin et"}</span>
                    </div>
                    <button className="btn-close-custom" onClick={onClose}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div className="modal-body-custom">
                    <div className="price-display-box">
                        <div className="currency-symbol">₼</div>
                        <input
                            type="text"
                            className="price-input"
                            value={price}
                            readOnly
                            placeholder="0.00"
                        />
                    </div>

                    <div className="numpad-grid">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <button
                                key={num}
                                className="num-key"
                                onClick={() => handleNumpad(num.toString())}
                            >
                                {num}
                            </button>
                        ))}
                        <button className="num-key" onClick={() => handleNumpad(".")}>.</button>
                        <button className="num-key" onClick={() => handleNumpad("0")}>0</button>
                        <button
                            className="num-key"
                            onClick={() => handleNumpad("backspace")}
                        >
                            <i className="bi bi-backspace"></i>
                        </button>
                    </div>

                    <button className="confirm-btn" onClick={handleConfirm} disabled={!price || parseFloat(price) <= 0}>
                        <i className="bi bi-check2 me-2" style={{ fontSize: '1.5rem' }}></i>{t("elave_et")}</button>
                </div>
            </div>
        </Modal>
    );
};

export default ManualPriceModal;
