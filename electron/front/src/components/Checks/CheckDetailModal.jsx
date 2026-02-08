import { Modal, Button, Row, Col, Form } from "react-bootstrap";
import "./CheckDetailModal.css";
import { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchLogs } from "../../redux/Slices/OrdersSlice";
import { toast } from "sonner";

const CheckDetailModal = ({ show, onHide, order }) => {
    const dispatch = useDispatch();
    const [activeView, setActiveView] = useState("details"); // 'details' | 'history'
    const [logFilter, setLogFilter] = useState("all");
    const { orderLogs = [] } = useSelector((state) => state.OrderSlice);

    useEffect(() => {
        if (!show) {
            setActiveView("details");
            setLogFilter("all");
        }
    }, [show]);

    useEffect(() => {
        if (show && activeView === "history" && order?.uuid) {
            dispatch(fetchLogs(order.uuid));
        }
    }, [show, activeView, order?.uuid, dispatch]);

    const filteredLogs = useMemo(() => {
        if (logFilter === "all") return orderLogs;
        return orderLogs.filter(log => log.action === logFilter);
    }, [orderLogs, logFilter]);

    const logTypes = useMemo(() => {
        const types = new Set(orderLogs.map(log => log.action));
        return Array.from(types);
    }, [orderLogs]);

    if (!order) return null;

    const formatFullDateTime = (date) => {
        if (!date) return "";
        return new Date(date).toLocaleString("az-AZ", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }).replace(/\//g, "-");
    };

    const saleTypeLabels = {
        dine_in: "Restoranda",
        takeaway: "Gəl götür",
        delivery: "Çatdırılma",
    };

    return (
        <Modal show={show} onHide={onHide} size="lg" centered className="check-detail-modal-custom">
            <Modal.Header closeButton>
                <Modal.Title>Çek #{order.id}</Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-0">
                <div className="d-flex flex-column flex-lg-row modal-body-split">
                    {/* Left Sidebar: Meta Info OR History */}
                    <div className="sidebar-section border-end-lg">
                        {activeView === "details" ? (
                            <div className="meta-items-container p-4">
                                <div className="meta-item-box">
                                    <div className="meta-icon-col">
                                        <i className="bi bi-arrow-right-short text-success fs-3"></i>
                                    </div>
                                    <div className="meta-content-col">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '11px' }}>Açıldı</small>
                                        <div className="meta-value">{formatFullDateTime(order.start_date)}</div>
                                        <div className="meta-sub">ID:{order.waiter_id}</div>
                                    </div>
                                </div>

                                <div className="meta-item-box closed-date-box">
                                    <div className="meta-icon-col">
                                        <i className="bi bi-check-circle text-primary fs-5 pt-1"></i>
                                    </div>
                                    <div className="meta-content-col">
                                        <small className="text-primary text-uppercase fw-bold" style={{ fontSize: '11px' }}>
                                            {order.status === 3 ? "Silindi" : "Bağlandı"}
                                        </small>
                                        <div className="meta-value text-primary">{formatFullDateTime(order.end_date)}</div>
                                        <div className="meta-sub">ID:{order.waiter_id}</div>
                                    </div>
                                </div>

                                <div className="meta-item-box">
                                    <div className="meta-icon-col">
                                        <i className="bi bi-box-seam fs-5 text-secondary"></i>
                                    </div>
                                    <div className="meta-content-col">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '11px' }}>Satış üsulu</small>
                                        <div className="meta-value">{saleTypeLabels[order.sale_type] || order.sale_type}</div>
                                    </div>
                                </div>

                                <div className="meta-item-box">
                                    <div className="meta-icon-col">
                                        <i className="bi bi-person fs-5 text-secondary"></i>
                                    </div>
                                    <div className="meta-content-col">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '11px' }}>Ofisiant</small>
                                        <div className="meta-value">{order.waiter?.name || "Naməlum"}</div>
                                    </div>
                                </div>

                                <div className="meta-item-box">
                                    <div className="meta-icon-col">
                                        <i className="bi bi-wallet2 fs-5 text-secondary"></i>
                                    </div>
                                    <div className="meta-content-col">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '11px' }}>Ödəniş üsulu</small>
                                        <div className="meta-value">
                                            {order.status === 3 ? (
                                                <span className="text-danger">Silinib</span>
                                            ) : order.order_payments?.length > 0 ? (
                                                order.order_payments.map((p, i) => (
                                                    <div key={i} className="d-flex justify-content-between w-100">
                                                        <span>{p.payment_method?.name || p.tag?.name || (p.without_payment_method_id ? "Ödənişsiz" : "Naməlum")}</span>
                                                        <span className="ms-2">{Number(p.paid).toFixed(2)}₼</span>
                                                    </div>
                                                ))
                                            ) : (
                                                "Gözləyir"
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="history-section bg-white p-0">
                                <div className="history-filter-bar px-4 py-3 border-bottom">
                                    <Form.Select
                                        value={logFilter}
                                        onChange={(e) => setLogFilter(e.target.value)}
                                        className="history-filter-select border-0 shadow-none ps-0"
                                        style={{ fontWeight: 500, color: "#202124" }}
                                    >
                                        <option value="all">Hərəkətlər</option>
                                        {logTypes.map((type, idx) => (
                                            <option key={idx} value={type}>{type}</option>
                                        ))}
                                    </Form.Select>
                                </div>

                                <div className="history-timeline-container overflow-auto" style={{ maxHeight: '460px', scrollbarWidth: 'thin' }}>
                                    <div className="timeline-wrapper position-relative ps-5 pt-4">
                                        <div className="timeline-line-custom"></div>
                                        {filteredLogs.length === 0 ? (
                                            <div className="text-center py-5 text-muted">Hərəkət tapılmadı</div>
                                        ) : (
                                            filteredLogs.map((log, idx) => (
                                                <div key={idx} className="timeline-item-custom mb-4 position-relative">
                                                    <div className="timeline-dot-custom"></div>
                                                    <div className="timeline-content-custom">
                                                        <div className="action-name fw-bold text-dark mb-1" style={{ fontSize: '14px' }}>
                                                            {log.action}
                                                        </div>
                                                        <div className="d-flex align-items-center gap-3 text-secondary mb-1" style={{ fontSize: '12px' }}>
                                                            <div className="d-flex align-items-center gap-1">
                                                                <i className="bi bi-clock text-secondary opacity-75"></i>
                                                                <span>{new Date(log.time || log.createdAt).toLocaleDateString('az-AZ')} {new Date(log.time || log.createdAt).toLocaleTimeString('az-AZ')}</span>
                                                            </div>
                                                            <div className="d-flex align-items-center gap-1">
                                                                <i className="bi bi-person text-secondary opacity-75"></i>
                                                                <span>{log.waiterName || "Naməlum"}</span>
                                                            </div>
                                                        </div>
                                                        {log.terminal_id && (
                                                            <div className="d-flex align-items-center gap-1 text-secondary" style={{ fontSize: '12px' }}>
                                                                <i className="bi bi-display text-secondary opacity-75"></i>
                                                                <span>ID:{log.terminal_id} {log.details}</span>
                                                            </div>
                                                        )}
                                                        {!log.terminal_id && log.details && (
                                                            <div className="details-text text-secondary" style={{ fontSize: '12px' }}>
                                                                {log.details}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Main Content: Order Items */}
                    <div className="items-section flex-grow-1 p-4">
                        <div className="table-responsive">
                            <table className="table table-borderless table-sm order-items-table">
                                <thead>
                                    <tr>
                                        <th className="text-muted fw-normal">Ad</th>
                                        <th className="text-muted fw-normal">Miq</th>
                                        <th className="text-muted fw-normal">Qiymət</th>
                                        <th className="text-muted fw-normal text-end">Cəm</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.orders_items?.map((item, i) => (
                                        <tr key={i}>
                                            <td>{item.product?.name || "Məhsul"}</td>
                                            <td>{item.count}</td>
                                            <td>{Number(item.price).toFixed(2)}</td>
                                            <td className="text-end">{(item.count * item.price).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="summary-section mt-auto">
                            <div className="summary-row d-flex justify-content-between mb-2">
                                <span className="summary-label text-muted">Cəm:</span>
                                <span className="summary-value fw-bold">{(order.total || 0).toFixed(2)} ₼</span>
                            </div>

                            <div className="summary-row d-flex justify-content-between align-items-center pt-2 border-top">
                                <span className="summary-label fw-bold" style={{ fontSize: '18px' }}>Yekun:</span>
                                <span className="summary-value fw-bold text-primary" style={{ fontSize: '24px' }}>{(Number(order.total) - Number(order.discount || 0) + Number(order.service_charge || 0)).toFixed(2)} ₼</span>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Custom Flush Footer */}
                <div className="w-100 d-flex gap-0" style={{ background: "#f8f9fa", borderTop: "1px solid #dee2e6" }}>
                    {/* Foot Left: Toggle */}
                    <div className="footer-left" style={{ width: "40%", borderRight: "1px solid #dee2e6" }}>
                        <Button
                            variant="light"
                            className="w-100 h-100 d-flex align-items-center justify-content-center border-0 rounded-0 py-3"
                            onClick={() => setActiveView(activeView === "details" ? "history" : "details")}
                            style={{ color: "#0d6efd", background: "transparent", fontWeight: 500 }}
                        >
                            <i className={`bi ${activeView === "details" ? "bi-clock-history" : "bi-info-circle"} me-2 fs-5`}></i>
                            {activeView === "details" ? "TARİXÇƏ" : "ÇEK MƏLUMATLARI"}
                        </Button>
                    </div>
                    {/* Foot Right: Actions */}
                    <div className="footer-right d-flex flex-grow-1">
                        <Button
                            variant="warning"
                            className="flex-grow-1 d-flex align-items-center justify-content-center border-0 rounded-0 py-3"
                            onClick={() => console.log("Çeki yenidən aç")}
                            style={{ backgroundColor: "#f39c12", color: "#fff" }}
                        >
                            <i className="bi bi-arrow-counterclockwise me-2 fs-5"></i> ÇEKİ YENİDƏN AÇ
                        </Button>
                        <Button
                            variant="primary"
                            className="flex-grow-1 d-flex align-items-center justify-content-center border-0 rounded-0 py-3"
                            onClick={() => window.print()}
                            style={{ backgroundColor: "#0d6efd" }}
                        >
                            <i className="bi bi-printer me-2 fs-5"></i> ÇAP ET
                        </Button>
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default CheckDetailModal;
