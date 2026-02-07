import React, { useState } from 'react';
import { Container, Col, Row, Form } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import Header from "../Header/Header";
import "./CheckOver.css";

const CheckOver = () => {
    const navigate = useNavigate();
    const [calcValue, setCalcValue] = useState("");
    const [selectedPayment, setSelectedPayment] = useState("Nağd");
    const [viewMode, setViewMode] = useState("PAYMENT"); // 'PAYMENT' or 'UNPAID'
    const [printCheck, setPrintCheck] = useState(false);
    const [unpaidReason, setUnpaidReason] = useState("Qarson səhvi");
    const [comment, setComment] = useState("");

    const handleNumClick = (val) => {
        if (val === "." && calcValue.includes(".")) return;
        setCalcValue(prev => prev + val);
    };

    const handleDelete = () => {
        setCalcValue(prev => prev.slice(0, -1));
    };

    const numpadButtons = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "DEL"];

    return (
        <div className="check-over-page">
            <Header showBack={true} onBack={() => navigate(-1)} />
            <Container fluid className="check-over-content p-0">
                <Row className="g-0 h-100">
                    {/* Left side: Calculator */}
                    <Col lg={5} md={6} className="calculator-section p-4 d-none d-md-flex flex-column">
                        <div className="calc-display-container mb-4">
                            <Form.Control
                                type="text"
                                className="calc-input text-end"
                                placeholder="Qalıq hesablayıcı"
                                value={calcValue || "0.00"}
                                readOnly
                            />
                            <span className="currency-symbol">₼</span>
                        </div>
                        <div className="numpad-grid">
                            {numpadButtons.map((btn, idx) => (
                                <button
                                    key={idx}
                                    className={`numpad-btn ${btn === "DEL" ? "del-btn" : ""}`}
                                    onClick={() => btn === "DEL" ? handleDelete() : handleNumClick(btn)}
                                >
                                    {btn === "DEL" ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 4H8L1 12L8 20H21C21.5304 20 22.0391 19.7893 22.4142 19.4142C22.7893 19.0391 23 18.5304 23 18V6C23 5.46957 22.7893 4.96086 22.4142 4.58579C22.0391 4.21071 21.5304 4 21 4Z" />
                                            <line x1="18" y1="9" x2="12" y2="15" />
                                            <line x1="12" y1="9" x2="18" y2="15" />
                                        </svg>
                                    ) : btn}
                                </button>
                            ))}
                        </div>
                    </Col>

                    {/* Right side: Payment details */}
                    <Col lg={7} md={6} xs={12} className="payment-section p-4 bg-white d-flex flex-column">
                        {viewMode === "PAYMENT" ? (
                            <>
                                <div className="payment-header d-flex justify-content-between align-items-center mb-4">
                                    <h2 className="payment-title">Ödənilməli</h2>
                                    <div className="total-amount-display">
                                        <span className="amount">400.00</span>
                                        <span className="symbol">₼</span>
                                    </div>
                                </div>

                                <div className="payment-methods gap-3 d-flex flex-column">
                                    <div
                                        className={`payment-method-item ${selectedPayment === "Nağd" ? "active" : ""}`}
                                        onClick={() => setSelectedPayment("Nağd")}
                                    >
                                        <span className="method-name">Nağd</span>
                                        <div className="method-amount">
                                            <span>400.00</span>
                                            <span className="symbol">₼</span>
                                        </div>
                                    </div>
                                    <div
                                        className={`payment-method-item ${selectedPayment === "Müştəri Balansı" ? "active" : ""}`}
                                        onClick={() => setSelectedPayment("Müştəri Balansı")}
                                    >
                                        <span className="method-name">Müştəri Balansı</span>
                                        <div className="method-amount">
                                            <span>0.00</span>
                                            <span className="symbol">₼</span>
                                        </div>
                                    </div>
                                    <div
                                        className={`payment-method-item card-method ${selectedPayment === "Kart" ? "active" : ""}`}
                                        onClick={() => setSelectedPayment("Kart")}
                                    >
                                        <span className="method-name">Kart</span>
                                    </div>
                                </div>

                                <div
                                    className="print-toggle-section mt-5 pt-3 d-flex justify-content-between align-items-center clickable-row"
                                    onClick={() => setPrintCheck(!printCheck)}
                                >
                                    <span className="toggle-label">Çeki çap et</span>
                                    <Form.Check
                                        type="switch"
                                        id="print-check-switch"
                                        className="large-switch"
                                        checked={printCheck}
                                        onChange={(e) => setPrintCheck(e.target.checked)}
                                    />
                                </div>

                                <div className="action-buttons-section mt-auto d-flex justify-content-between align-items-center">
                                    <button className="unpaid-mode-btn" onClick={() => setViewMode("UNPAID")}>
                                        Ödənişsiz bağla
                                    </button>
                                    <button className="confirm-close-btn green-btn">Bağla</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="payment-header d-flex justify-content-between align-items-center mb-4">
                                    <h2 className="payment-title">Ödənişsiz bağla</h2>
                                    <div className="total-amount-display strikethrough">
                                        <span className="amount">400.00</span>
                                        <span className="symbol">₼</span>
                                    </div>
                                </div>

                                <div className="unpaid-reasons gap-1 d-flex flex-column">
                                    {["Qonaq tərk etdi", "Şirkət hesabına", "Qarson səhvi"].map((reason) => (
                                        <div
                                            key={reason}
                                            className={`unpaid-reason-item d-flex justify-content-between align-items-center py-3 ${unpaidReason === reason ? "active" : ""}`}
                                            onClick={() => setUnpaidReason(reason)}
                                        >
                                            <span className="reason-label">{reason}</span>
                                            <Form.Check
                                                type="radio"
                                                name="unpaidReason"
                                                id={`reason-${reason}`}
                                                checked={unpaidReason === reason}
                                                onChange={() => setUnpaidReason(reason)}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="comment-section mt-4">
                                    <Form.Control
                                        as="textarea"
                                        rows={4}
                                        placeholder="Çekə şərh yaz"
                                        className="comment-textarea"
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                    />
                                </div>

                                <div
                                    className="print-toggle-section mt-4 pt-3 d-flex justify-content-between align-items-center clickable-row"
                                    onClick={() => setPrintCheck(!printCheck)}
                                >
                                    <span className="toggle-label">Çeki çap et</span>
                                    <Form.Check
                                        type="switch"
                                        id="print-check-switch-unpaid"
                                        className="large-switch"
                                        checked={printCheck}
                                        onChange={(e) => setPrintCheck(e.target.checked)}
                                    />
                                </div>

                                <div className="action-buttons-section mt-auto d-flex justify-content-between align-items-center">
                                    <button className="back-to-payment-btn" onClick={() => setViewMode("PAYMENT")}>
                                        Ödənişə qayıt
                                    </button>
                                    <button className="confirm-close-btn maroon-btn">Bağla</button>
                                </div>
                            </>
                        )}
                    </Col>
                </Row>
            </Container>
        </div>
    );
}

export default CheckOver;