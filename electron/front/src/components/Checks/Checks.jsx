import { useState } from "react";
import { Container, Row, Col } from "react-bootstrap";
import "./Checks.css";

const Checks = () => {
    const [activeTab, setActiveTab] = useState("open");
    const [activeFilter, setActiveFilter] = useState("all");
    const [selectedDate, setSelectedDate] = useState("today");

    // Sample check data
    const checksData = [
        {
            id: "#9ba4e56b",
            status: "open",
            date: "29 yanvar 2026",
            time: "10 dəq",
            user: "Anar Rasulov",
            amount: "0.00₼"
        },
        {
            id: "#be02b013",
            status: "closed",
            date: "29 yanvar 2026",
            time: "1 Saat",
            user: "Anar Rasulov",
            amount: "0.00₼"
        },
        {
            id: "#4d0ea36e",
            status: "open",
            date: "29 yanvar 2026",
            time: "1 Saat",
            user: "Anar Rasulov",
            amount: "0.00₼"
        },
        {
            id: "#42630",
            status: "paid",
            date: "26 yanvar 2026",
            time: "16:44",
            user: "Anar Rasulov",
            amount: "4,875.00₼",
            badges: ["Səbəyə yönləndirilə...", "Ön çək !"]
        },
        {
            id: "#42629",
            status: "paid",
            date: "25 yanvar 2026",
            time: "22:38",
            user: "Anar Rasulov",
            amount: "11,800.00₼"
        }
    ];

    const getStatusColor = (status) => {
        switch (status) {
            case "open":
                return "#2196F3";
            case "closed":
                return "#9E9E9E";
            case "paid":
                return "#28a745";
            default:
                return "#9E9E9E";
        }
    };

    return (
        <Container fluid className="checks-container">
            {/* Top Navigation Tabs */}
            <div className="checks-nav-tabs">
                <button
                    className={`checks-nav-tab ${activeTab === "open" ? "active" : ""}`}
                    onClick={() => setActiveTab("open")}
                >
                    Açıq
                </button>
                <button
                    className={`checks-nav-tab ${activeTab === "archive" ? "active" : ""}`}
                    onClick={() => setActiveTab("archive")}
                >
                    Arxiv
                </button>
                <button
                    className={`checks-nav-tab ${activeTab === "offline" ? "active" : ""}`}
                    onClick={() => setActiveTab("offline")}
                >
                    Offline arxiv
                </button>
            </div>

            {/* Filters Bar */}
            <div className="checks-filters-bar">
                <Row className="align-items-center w-100 m-0">
                    <Col xs={6} sm={4} md={2} className="p-1">
                        <select className="checks-filter-dropdown">
                            <option>Əməkdaş</option>
                            <option>Anar Rasulov</option>
                            <option>Digər</option>
                        </select>
                    </Col>

                    <Col xs={6} sm={4} md={2} className="p-1">
                        <select className="checks-filter-dropdown">
                            <option>Zal</option>
                            <option>Zal 1</option>
                            <option>Zal 2</option>
                        </select>
                    </Col>

                    <Col xs={6} sm={4} md={2} className="p-1">
                        <select className="checks-filter-dropdown">
                            <option>Satış üsulu</option>
                            <option>Yerində</option>
                            <option>Takeaway</option>
                            <option>Çatdırılma</option>
                        </select>
                    </Col>

                    <Col xs={6} sm={4} md={2} className="p-1">
                        <select className="checks-filter-dropdown">
                            <option>Masa</option>
                            <option>Masa 1</option>
                            <option>Masa 2</option>
                        </select>
                    </Col>

                    <Col xs={6} sm={4} md={2} className="p-1">
                        <select className="checks-filter-dropdown">
                            <option>Kuryer</option>
                            <option>Kuryer 1</option>
                            <option>Kuryer 2</option>
                        </select>
                    </Col>

                    <Col xs={6} sm={4} md={2} className="p-1">
                        <button className="checks-filter-dropdown checks-filter-btn-style">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                            </svg>
                            <span>Ön çək</span>
                        </button>
                    </Col>
                </Row>
            </div>

            {/* Summary Bar */}
            <div className="checks-summary-bar">
                <div className="checks-summary-left">
                    <span className="checks-summary-label">Çek sayı:</span>
                    <span className="checks-summary-value">{checksData.length}</span>
                </div>
                <div className="checks-summary-right">
                    <span className="checks-summary-label">Cəm:</span>
                    <span className="checks-summary-value checks-total">95,935.00₼</span>
                    <button className="checks-summary-sort-btn">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M3 9.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 6.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 3a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1H3z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Checks List */}
            <div className="checks-list">
                {checksData.map((check, index) => {
                    // Group by date
                    const showDateHeader = index === 0 || checksData[index - 1].date !== check.date;

                    return (
                        <div key={check.id}>
                            {showDateHeader && (
                                <div className="checks-date-header">{check.date}</div>
                            )}
                            <div className="checks-check-item">
                                <div className="checks-check-left">
                                    <div className="checks-check-id-row">
                                        <span
                                            className="checks-status-dot"
                                            style={{ backgroundColor: getStatusColor(check.status) }}
                                        ></span>
                                        <span className="checks-check-id">{check.id}</span>
                                        {check.badges && (
                                            <div className="checks-check-badges">
                                                {check.badges.map((badge, i) => (
                                                    <span
                                                        key={i}
                                                        className={`checks-check-badge ${i === 1 ? "warning" : ""}`}
                                                    >
                                                        {badge}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="checks-check-info">
                                        <span className="checks-check-time">{check.time}</span>
                                        <span className="checks-check-user">
                                            <svg
                                                width="12"
                                                height="12"
                                                viewBox="0 0 16 16"
                                                fill="currentColor"
                                            >
                                                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z" />
                                            </svg>
                                            {check.user}
                                        </span>
                                    </div>
                                </div>
                                <div className="checks-check-right">
                                    <span className="checks-check-amount">{check.amount}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Container>
    );
};

export default Checks;
