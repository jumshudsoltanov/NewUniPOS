import React, { useState } from "react";
import { Modal, Row, Col, Form } from "react-bootstrap";
import "./ReportModal.css";

const ReportModal = ({ show, onClose }) => {
    // Default dates (today and tomorrow)
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0];

    // State for form inputs
    const [startDate, setStartDate] = useState(today);
    const [startTime, setStartTime] = useState("06:00");
    const [endDate, setEndDate] = useState(tomorrow);
    const [endTime, setEndTime] = useState("06:00");
    const [terminal, setTerminal] = useState("all");
    const [reportType, setReportType] = useState("simple");
    const [showTransactions, setShowTransactions] = useState(false);
    const [showAccounts, setShowAccounts] = useState(false);

    const terminals = [
        { id: "all", name: "Hamısı" },
        // ... add more if available
    ];

    const reportTypes = [
        { id: "simple", name: "Sadə" },
        // ... add more if available
    ];

    const handleCreateReport = () => {
        console.log("Creating report with:", {
            startDate, startTime, endDate, endTime, terminal, reportType, showTransactions, showAccounts
        });
        // Logic to fetch report data would go here
    };

    return (
        <Modal
            show={show}
            onHide={onClose}
            size="xl"
            centered
            className="report-modal"
            dialogClassName="report-modal-dialog"
            backdrop="static"
        >
            <div className="report-modal-header">
                <span className="report-modal-title">Hesabat</span>
                <button className="report-modal-close-btn" onClick={onClose}>
                    <i className="bi bi-x-lg"></i>
                </button>
            </div>

            <Modal.Body className="report-modal-body">
                <Row className="h-100 g-0 w-100">
                    {/* Left Sidebar - Filters */}
                    <Col md={5} lg={4} className="report-sidebar">
                        <Form.Group className="mb-3">
                            <Form.Label>Bu tarixdən</Form.Label>
                            <div className="date-time-row">
                                <Form.Control
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                                <Form.Select
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                >
                                    {Array.from({ length: 48 }, (_, i) => {
                                        const hour = Math.floor(i / 2).toString().padStart(2, '0');
                                        const minute = (i % 2 === 0 ? '00' : '30');
                                        const time = `${hour}:${minute}`;
                                        return <option key={time} value={time}>{time}</option>;
                                    })}
                                </Form.Select>
                            </div>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Bu tarixə qədər</Form.Label>
                            <div className="date-time-row">
                                <Form.Control
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                                <Form.Select
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                >
                                    {Array.from({ length: 48 }, (_, i) => {
                                        const hour = Math.floor(i / 2).toString().padStart(2, '0');
                                        const minute = (i % 2 === 0 ? '00' : '30');
                                        const time = `${hour}:${minute}`;
                                        return <option key={time} value={time}>{time}</option>;
                                    })}
                                </Form.Select>
                            </div>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Terminallar</Form.Label>
                            <Form.Select
                                value={terminal}
                                onChange={(e) => setTerminal(e.target.value)}
                            >
                                {terminals.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Hesabat növü</Form.Label>
                            <Form.Select
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                            >
                                {reportTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>

                        <Form.Group className="mb-2">
                            <Form.Check
                                type="switch"
                                id="transactions-switch"
                                label="Əməliyyatlarla"
                                checked={showTransactions}
                                onChange={(e) => setShowTransactions(e.target.checked)}
                            />
                        </Form.Group>

                        <Form.Group className="mb-4">
                            <Form.Check
                                type="switch"
                                id="accounts-switch"
                                label="Hesablar"
                                checked={showAccounts}
                                onChange={(e) => setShowAccounts(e.target.checked)}
                            />
                        </Form.Group>

                        <button className="report-create-btn mt-auto" onClick={handleCreateReport}>
                            <i className="bi bi-file-earmark-bar-graph-fill me-2"></i>
                            Hesabat yarat
                        </button>
                    </Col>

                    {/* Right Content - Results Placeholder */}
                    <Col md={7} lg={8} className="report-content d-flex align-items-center justify-content-center text-center">
                        <div className="text-muted">
                            <p className="mb-0 fs-5">
                                Məlumatları görmək üçün "Hesabat yarat"<br />düyməsini seçin
                            </p>
                        </div>
                    </Col>
                </Row>
            </Modal.Body>
        </Modal>
    );
};

export default ReportModal;
