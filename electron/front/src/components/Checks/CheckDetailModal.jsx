import React from "react";
import { Modal, Button, Row, Col } from "react-bootstrap";
import "./CheckDetailModal.css";

const CheckDetailModal = ({ show, onHide, order }) => {
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
            <Modal.Body>
                <div className="d-flex flex-column flex-lg-row">
                    {/* Left Side: Meta Info */}
                    <div className="meta-section border-end-lg">
                        <div className="meta-items-container">
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

                            {/* Always render this block if it might exist, or conditionally if sure. User said "baglanam tarixi end_datedir". */}
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
                    </div>

                    {/* Right Side: Order Items */}
                    <div className="items-section flex-grow-1">
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

                        <div className="summary-section">
                            <div className="summary-row">
                                <span className="summary-label">Cəm:</span>
                                <span className="summary-value">{(order.total || 0).toFixed(2)} ₼</span>
                            </div>

                            {Number(order.discount) > 0 && (
                                <div className="summary-row">
                                    <span className="summary-label">Endirim:</span>
                                    <span className="summary-value text-danger" style={{ fontWeight: 600 }}>
                                        -{Number(order.discount).toFixed(2)} ₼
                                    </span>
                                </div>
                            )}

                            {Number(order.service_charge) > 0 && (
                                <div className="summary-row">
                                    <span className="summary-label">Servis haqqı:</span>
                                    <span className="summary-value">
                                        {Number(order.service_charge).toFixed(2)} ₼
                                    </span>
                                </div>
                            )}

                            <div className="summary-row total-row">
                                <span className="summary-label">Yekun:</span>
                                <span className="summary-value">{(Number(order.total) - Number(order.discount || 0) + Number(order.service_charge || 0)).toFixed(2)} ₼</span>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer className="p-0 border-0">
                <div className="w-100 d-flex gap-0" style={{ background: "#fff" }}>
                    <Button
                        variant="light"
                        className="footer-btn-link d-flex align-items-center justify-content-center flex-grow-1 border-0 border-end rounded-0"
                        onClick={() => console.log("Çek tarixçəsi")}
                        style={{ height: "60px", color: "#5f6368", borderRight: "1px solid #e8eaed" }}
                    >
                        <i className="bi bi-clock-history me-2 fs-5"></i> TARİXÇƏ
                    </Button>
                    <Button
                        variant="warning"
                        className="footer-btn-orange d-flex align-items-center justify-content-center flex-grow-1 rounded-0"
                        onClick={() => console.log("Çeki yenidən aç")}
                        style={{ backgroundColor: "#f39c12", color: "#fff", border: "none", height: "60px" }}
                    >
                        <i className="bi bi-arrow-counterclockwise me-2 fs-5"></i> YENİDƏN AÇ
                    </Button>
                    <Button
                        variant="primary"
                        className="footer-btn-blue d-flex align-items-center justify-content-center flex-grow-1 rounded-0"
                        onClick={() => window.print()}
                        style={{ backgroundColor: "#053796", border: "none", height: "60px" }}
                    >
                        <i className="bi bi-printer me-2 fs-5"></i> ÇAP ET
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};

export default CheckDetailModal;
