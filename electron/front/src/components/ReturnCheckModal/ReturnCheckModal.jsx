import React, { useState, useEffect } from "react";
import { Modal, Row, Col } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import axios from "../../utils/apiConfig";
import { saveLog } from "../../redux/Slices/OrdersSlice";
import CheckDeleteModal from "../CheckDeleteModal/CheckDeleteModal";
import { buildFiscalLineItemsFromOrderItems, mapOrderPaymentForTax, computeFiscalCheckTotalsFromOrder } from "../../utils/orderItemLineTotal";
import "./ReturnCheckModal.css";

const TAX_HTTP_TIMEOUT_MS = 180000;

const ReturnCheckModal = ({ show, onClose }) => {
    const dispatch = useDispatch();
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);
    const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
    const [taxLoading, setTaxLoading] = useState(false);

    const getTaxConfigId = (config) => config?.id ?? config?.tax_cash_id ?? null;

    const [checkId, setCheckId] = useState("");
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [activeMobileTab, setActiveMobileTab] = useState("keypad"); // 'keypad' or 'details'

    const isMobile = window.innerWidth < 768;

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!show) {
            setCheckId("");
            setOrder(null);
            setError("");
            setActiveMobileTab("keypad");
        }
    }, [show]);

    // Keypad handler
    const handleKeyPress = (key) => {
        if (key === "backspace") {
            setCheckId((prev) => prev.slice(0, -1));
        } else if (key === "clear") {
            setCheckId("");
        } else {
            setCheckId((prev) => prev + key);
        }
    };

    // Search order by ID
    const handleSearch = async () => {
        if (!checkId) return;

        setLoading(true);
        setError("");
        setOrder(null);

        try {
            const profileId = loginedProfileData?.data?.profile?.id;
            const response = await axios.get(
                `/orders/${checkId}?profileId=${profileId}`
            );

            if (response.data?.data) {
                const foundOrder = response.data.data;
                // Only allow closed or deleted orders
                if (foundOrder.status === 2 || foundOrder.status === 3) {
                    setOrder(foundOrder);
                    if (isMobile) setActiveMobileTab("details");
                } else {
                    setError("Bu çek hələ açıqdır. Yalnız bağlanmış çekləri qaytarmaq olar.");
                    if (isMobile) setActiveMobileTab("details");
                }
            } else {
                setError("Çek tapılmadı");
                if (isMobile) setActiveMobileTab("details");
            }
        } catch (err) {
            console.error("Search error:", err);
            setError("Çek tapılmadı");
            if (isMobile) setActiveMobileTab("details");
        } finally {
            setLoading(false);
        }
    };

    // Handle return confirmation
    const handleReturnConfirm = async ({ reason, orderId }) => {
        const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
        const taxConfigs = loginedProfileData?.data?.taxes || [];

        // 1. Fiskal geri qaytarma — fiskal_id varsa və cihaz tapılırsa
        if (order?.fiscal_id && taxConfigs.length > 0) {
            const targetConfig = taxConfigs.find(c => (c?.id ?? c?.tax_cash_id ?? null) === order.tax_cash_id);
            if (targetConfig) {
                setTaxLoading(true);
                try {
                    const items = buildFiscalLineItemsFromOrderItems(order);
                    const payments = (order.order_payments || []).map(mapOrderPaymentForTax);
                    const ft = computeFiscalCheckTotalsFromOrder(order);
                    const orderTotalFiscal =
                        order.total != null && order.total !== "" && !Number.isNaN(Number(order.total)) && Number(order.total) > 0
                            ? Number(order.total)
                            : ft.sumTotal;

                    const mbResult = await axios.post('/tax/money-back', {
                        taxConfigs: [targetConfig],
                        moneyBackData: {
                            items,
                            payments,
                            cashierName: waiterName,
                            parentFiscalId: order.fiscal_id,
                            documentNumber: String(order.fiscal_doc_number || order.id || ''),
                            shortDocId: order.fiscal_short_id || '',
                            orderId: order.uuid || order.id,
                            serviceFee: ft.serviceAmount,
                            ...(Number(ft.discountAmount) > 0 ? { discountAmount: ft.discountAmount } : {}),
                            deliveryFee: ft.deliveryFee,
                            orderTotal: orderTotalFiscal
                        }
                    }, { timeout: TAX_HTTP_TIMEOUT_MS });

                    if (mbResult.data?.success) {
                        toast.success('Vergi geri qaytarma uğurlu');
                    } else {
                        toast.warning('Vergi geri qaytarma uğursuz oldu, lakin çek geri qaytarılır');
                    }
                } catch (taxErr) {
                    console.error('Tax moneyback error:', taxErr);
                    toast.warning('Vergi cihazı xətası: ' + (taxErr.response?.data?.message || taxErr.message));
                } finally {
                    setTaxLoading(false);
                }
            }
        }

        // 2. DB-də geri qaytarma
        try {
            await axios.patch(
                `/orders-items/${orderId}/return`,
                {
                    is_return: 1,
                    is_delete_reason_id: reason
                }
            );

            dispatch(saveLog({
                orderId,
                action: "Çek geri qaytarma",
                waiterName,
                details: `Çek #${order?.id} geri qaytarıldı`
            }));

            toast.success(`Çek #${order?.id} geri qaytarıldı`);
            setShowReasonModal(false);
            setOrder(null);
            setCheckId("");
            onClose();
        } catch (err) {
            console.error("Return error:", err);
            toast.error('Geri qaytarma xətası: ' + (err.response?.data?.message || err.message));
        }
    };

    // Calculate totals
    const calculateTotal = () => {
        if (!order) return { subtotal: 0, discount: 0, service: 0, total: 0 };

        const subtotal = Number(order.amount) || 0;
        const discount = Number(order.discount) || 0;
        const service = Number(order.service_charge) || 0;
        const total = subtotal - discount + service;

        return { subtotal, discount, service, total };
    };

    const totals = calculateTotal();

    return (
        <>
            <Modal
                show={show}
                onHide={onClose}
                size="lg"
                centered
                className="return-check-modal"
                backdrop="static"
            >
                <div className="return-header">
                    <span className="return-header-title">Çek axtar</span>
                    <button className="return-close-btn" onClick={onClose}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>

                {isMobile && (
                    <div className="return-mobile-tabs">
                        <div
                            className={`return-mobile-tab ${activeMobileTab === "keypad" ? "active" : ""}`}
                            onClick={() => setActiveMobileTab("keypad")}
                        >
                            Axtarış
                        </div>
                        <div
                            className={`return-mobile-tab ${activeMobileTab === "details" ? "active" : ""}`}
                            onClick={() => setActiveMobileTab("details")}
                        >
                            Nəticə {order && <span className="tab-dot"></span>}
                        </div>
                    </div>
                )}

                <Modal.Body className="return-body p-0">
                    <Row className="g-0 h-100">
                        {/* Left Side - Keypad */}
                        {(!isMobile || activeMobileTab === "keypad") && (
                            <Col md={5} className="return-keypad-section">
                                <div className="return-check-id-display">
                                    <span className="return-check-id-label">Çek</span>
                                    <div className="return-check-id-value">{checkId || "—"}</div>
                                </div>

                                <div className="return-keypad-grid">
                                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"].map((key) => (
                                        <button
                                            key={key}
                                            className="return-keypad-btn"
                                            onClick={() => handleKeyPress(key)}
                                        >
                                            {key}
                                        </button>
                                    ))}
                                    <button
                                        className="return-keypad-btn return-backspace-btn"
                                        onClick={() => handleKeyPress("backspace")}
                                    >
                                        <i className="bi bi-backspace"></i>
                                    </button>
                                </div>

                                <button
                                    className="return-search-btn"
                                    onClick={handleSearch}
                                    disabled={!checkId || loading}
                                >
                                    {loading ? "Axtarılır..." : "Axtar"}
                                </button>
                            </Col>
                        )}

                        {/* Right Side - Order Details */}
                        {(!isMobile || activeMobileTab === "details") && (
                            <Col md={7} className="return-details-section">
                                {error && (
                                    <div className="return-error-message">
                                        <i className="bi bi-exclamation-circle me-2"></i>
                                        {error}
                                    </div>
                                )}


                                {!order && !error && (
                                    <div className="return-empty-state">
                                        <i className="bi bi-receipt"></i>
                                        <p>Çek ID-sini daxil edin və axtarın</p>
                                    </div>
                                )}

                                {order && (
                                    <>
                                        <div className="return-order-header">
                                            <span className="return-order-id">Çek #{order.id}</span>
                                            <span className={`return-order-status ${order.status === 3 ? "deleted" : "closed"}`}>
                                                {order.status === 3 ? "Silinib" : "Bağlı"}
                                            </span>
                                        </div>

                                        <div className="return-order-items">
                                            <table className="return-items-table">
                                                <thead>
                                                    <tr>
                                                        <th>Məhsul</th>
                                                        <th>Miq</th>
                                                        <th>Qiymət</th>
                                                        <th className="text-end">Cəm</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {order.orders_items?.map((item, i) => (
                                                        <tr key={i}>
                                                            <td>{item.product?.name || "Məhsul"}</td>
                                                            <td>{item.count}</td>
                                                            <td>{Number(item.price).toFixed(2)}</td>
                                                            <td className="text-end">
                                                                {(item.count * item.price).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="return-order-summary">
                                            <div className="return-summary-row">
                                                <span>Cəm:</span>
                                                <span>{totals.subtotal.toFixed(2)} ₼</span>
                                            </div>
                                            {totals.discount > 0 && (
                                                <div className="return-summary-row return-discount">
                                                    <span>Endirim:</span>
                                                    <span>-{totals.discount.toFixed(2)} ₼</span>
                                                </div>
                                            )}
                                            {totals.service > 0 && (
                                                <div className="return-summary-row">
                                                    <span>Servis:</span>
                                                    <span>{totals.service.toFixed(2)} ₼</span>
                                                </div>
                                            )}
                                            <div className="return-summary-row return-total">
                                                <span>Yekun:</span>
                                                <span>{totals.total.toFixed(2)} ₼</span>
                                            </div>
                                        </div>

                                        <button
                                            className="return-action-btn"
                                            onClick={() => setShowReasonModal(true)}
                                        >
                                            <i className="bi bi-arrow-return-left me-2"></i>
                                            Geri qaytar
                                        </button>
                                    </>
                                )}
                            </Col>
                        )}
                    </Row>
                </Modal.Body>
            </Modal>

            {/* Reason Selection Modal */}
            <CheckDeleteModal
                show={showReasonModal}
                onClose={() => setShowReasonModal(false)}
                onConfirm={handleReturnConfirm}
                type="checks"
                order={order}
                tagsType={5}
                title="Geri qaytarılma səbəbi"
            />
        </>
    );
};

export default ReturnCheckModal;


