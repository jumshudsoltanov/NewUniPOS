import { Modal } from "react-bootstrap";
import { t } from "../../utils/translations";
import { getCurrencySymbol } from "../../utils/formatPrice";
import "./CheckReceiptModal.css";

const CheckReceiptModal = ({ show, onClose, order }) => {
    if (!order) return null;

    const formatDate = (date) => {
        if (!date) return "—";
        const d = new Date(date);
        return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    const saleTypeLabels = {
        dine_in: "Restoranda",
        takeaway: "Gəl götür",
        delivery: "Çatdırılma",
    };

    const getStatusPill = () => {
        if (order.status === 3) return (
            <span className="receipt-status-pill deleted">
                <i className="bi bi-x-circle-fill"></i> Silinib
            </span>
        );
        if (order.status === 2) return (
            <span className="receipt-status-pill closed">
                <i className="bi bi-check-circle-fill"></i>{t("baglanib")}</span>
        );
        return (
            <span className="receipt-status-pill active">
                <i className="bi bi-circle-fill"></i> Aktiv
            </span>
        );
    };

    const subtotal = order.orders_items?.reduce((sum, item) => sum + (Number(item.count) * Number(item.price)), 0) || 0;
    const discount = Number(order.discount || 0);
    const serviceCharge = Number(order.service_charge || 0);
    const grandTotal = subtotal - discount + serviceCharge;

    const formatMoney = (val) => {
        return Number(val).toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <Modal show={show} onHide={onClose} centered className="check-receipt-modal">
            <Modal.Header closeButton>
                <Modal.Title>{t("cek")}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="receipt-container">

                    {/* Brand Header */}
                    <div className="receipt-brand-header">
                        <div className="receipt-brand-logo">Çek #{order.id}</div>
                        <div className="receipt-check-number">{getStatusPill()}</div>
                    </div>

                    {/* Info Card */}
                    <div className="receipt-info-card">
                        {order.waiter?.name && (
                            <div className="receipt-info-row">
                                <span className="receipt-info-label">{t("waiter")}</span>
                                <span className="receipt-info-value">{order.waiter.name}</span>
                            </div>
                        )}
                        <div className="receipt-info-row">
                            <span className="receipt-info-label">{t("satis_usulu_1")}</span>
                            <span className="receipt-info-value">
                                {saleTypeLabels[order.sale_type] || order.sale_type || t("unknown")}
                            </span>
                        </div>
                        {order.guest_count && (
                            <div className="receipt-info-row">
                                <span className="receipt-info-label">{t("guest_count")}</span>
                                <span className="receipt-info-value">{order.guest_count}</span>
                            </div>
                        )}
                        <div className="receipt-info-row">
                            <span className="receipt-info-label">{t("acildi_1")}</span>
                            <span className="receipt-info-value">{formatDate(order.start_date)}</span>
                        </div>
                        {order.end_date && (
                            <div className="receipt-info-row">
                                <span className="receipt-info-label">{t("baglandi_1")}</span>
                                <span className="receipt-info-value">{formatDate(order.end_date)}</span>
                            </div>
                        )}
                    </div>

                    {/* Items Card */}
                    <div className="receipt-items-card">
                        <div className="receipt-items-title">{t("products")}</div>
                        <table className="receipt-items-table">
                            <thead>
                                <tr>
                                    <th>{t("ad_name")}</th>
                                    <th>{t("miq")}</th>
                                    <th>{t("qiymet")}</th>
                                    <th>{t("cem")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const groupedItems = [];
                                    order.orders_items?.forEach(item => {
                                        const prodName = item.product?.name || item.product_name || t("product");
                                        const price = Number(item.price);
                                        const isGift = item.is_gift === 1 || item.is_gift === true;
                                        
                                        // Find if this specific combination already exists
                                        const existing = groupedItems.find(gi => 
                                            gi.name === prodName && 
                                            gi.price === price && 
                                            gi.isGift === isGift
                                        );

                                        if (existing) {
                                            existing.count += Number(item.count);
                                        } else {
                                            groupedItems.push({
                                                name: prodName,
                                                count: Number(item.count),
                                                price: price,
                                                isGift: isGift
                                            });
                                        }
                                    });

                                    return groupedItems.map((item, i) => {
                                        const itemTotal = item.count * item.price;
                                        return (
                                            <tr key={i} className={item.isGift ? 'gift-row' : ''}>
                                                <td>
                                                    {item.name}
                                                    {item.isGift && " 🎁"}
                                                </td>
                                                <td>{item.count}</td>
                                                <td>{formatMoney(item.price)}</td>
                                                <td>{formatMoney(itemTotal)}</td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals Card */}
                    <div className="receipt-totals-card">
                        <div className="receipt-total-row">
                            <span className="receipt-total-label">{t("cem")}</span>
                            <span className="receipt-total-value">{formatMoney(subtotal)} {getCurrencySymbol()}</span>
                        </div>
                        {discount > 0 && (
                            <div className="receipt-total-row">
                                <span className="receipt-total-label">{t("endirim")}</span>
                                <span className="receipt-total-value" style={{ color: '#e74c3c' }}>-{formatMoney(discount)} {getCurrencySymbol()}</span>
                            </div>
                        )}
                        {serviceCharge > 0 && (
                            <div className="receipt-total-row">
                                <span className="receipt-total-label">{t("servis_haqqi_2")}</span>
                                <span className="receipt-total-value">{formatMoney(serviceCharge)} {getCurrencySymbol()}</span>
                            </div>
                        )}
                        <div className="receipt-total-row grand-total">
                            <span className="receipt-total-label">{t("yekun")}</span>
                            <span className="receipt-total-value">{formatMoney(grandTotal)} {getCurrencySymbol()}</span>
                        </div>
                    </div>

                    {/* Payment Card */}
                    {order.order_payments?.length > 0 && (
                        <div className="receipt-payment-card">
                            <div className="receipt-payment-title">{t("odenis_usulu")}</div>
                            {order.order_payments.map((p, i) => (
                                <div key={i} className="receipt-payment-row">
                                    <span className="receipt-payment-method">
                                        <i className="bi bi-credit-card"></i>
                                        {p.payment_method?.name || p.tag?.name || (p.without_payment_method_id ? t("odenissiz") : t("nagd"))}
                                    </span>
                                    <span className="receipt-payment-amount">{formatMoney(p.paid)} {getCurrencySymbol()}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="receipt-modal-footer">
                        <div className="receipt-powered-by">Powered by <span>Unipos</span></div>
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default CheckReceiptModal;
