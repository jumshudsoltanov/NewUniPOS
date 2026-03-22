import { Modal, Button, Row, Col, Form } from "react-bootstrap";
import "./CheckDetailModal.css";
import "./TaxCashPickerModal.css";
import "../Customers-Modal/CustomersModal.css";
import { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchLogs, reopenOrder, saveLog } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { toast } from "sonner";
import CheckDeleteModal from "../CheckDeleteModal/CheckDeleteModal";
import { printCustomerReceipt } from "../../utils/printerHelpers.jsx";
import apiConfig, { TAX_HTTP_TIMEOUT_MS } from "../../utils/apiConfig";
import axios from "axios";
import { addNotification } from "../../utils/notificationService";
import { sumOrderItemsLinesTotal, getOrderItemLineTotal } from "../../utils/orderItemLineTotal";

const getTaxConfigId = (c) => c?.id ?? (c?.ip_addr && c?.port_addr
    ? Math.abs((c.ip_addr + ':' + c.port_addr).split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0) & 0x7FFFFFFF)
    : null);

const CheckDetailModal = ({ show, onClose, order }) => {
    const dispatch = useDispatch();
    const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);
    const [currentView, setCurrentView] = useState("details"); // 'details' | 'history'
    const [logFilter, setLogFilter] = useState("all");
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [taxLoading, setTaxLoading] = useState(false);
    const [showTaxResendModal, setShowTaxResendModal] = useState(false);
    const [taxLocalNames, setTaxLocalNames] = useState({});
    const { orderLogs = [] } = useSelector((state) => state.OrderSlice);

    useEffect(() => {
        const stored = localStorage.getItem("tax_local_names");
        if (stored) {
            try {
                setTaxLocalNames(JSON.parse(stored));
            } catch (e) {
                /* ignore */
            }
        }
    }, []);

    useEffect(() => {
        if (!show) {
            setCurrentView("details");
            setLogFilter("all");
            setShowTaxResendModal(false);
        }
    }, [show]);

    useEffect(() => {
        if (show && currentView === "history" && order?.uuid) {
            dispatch(fetchLogs(order.uuid));
        }
    }, [show, currentView, order?.uuid, dispatch]);

    const filteredLogs = useMemo(() => {
        if (logFilter === "all") return orderLogs;
        return orderLogs.filter(log => log.action === logFilter);
    }, [orderLogs, logFilter]);

    const logTypes = useMemo(() => {
        const types = new Set(orderLogs.map(log => log.action));
        return Array.from(types);
    }, [orderLogs]);

    const subtotal = useMemo(() => {
        return sumOrderItemsLinesTotal(order?.orders_items || []);
    }, [order?.orders_items]);

    const groupedItems = useMemo(() => {
        const map = {};
        const parseMods = (raw) => {
            try {
                let m = raw?.modifiers;
                if (typeof m === "string") m = JSON.parse(m || "[]");
                return Array.isArray(m) ? m : [];
            } catch {
                return [];
            }
        };
        (order?.orders_items || []).forEach((item) => {
            const name = item.product?.name || item.name || "Məhsul";
            const price = Number(item.price || 0);
            const modifiers = parseMods(item);
            const modKey = JSON.stringify(modifiers);
            const key = `${name}__${price}__${modKey}`;
            const cnt = Number(item.count || 0);
            const lineTotal = getOrderItemLineTotal(item);
            if (map[key]) {
                map[key].count += cnt;
                map[key].lineTotal += lineTotal;
            } else {
                map[key] = {
                    ...item,
                    name,
                    count: cnt,
                    price,
                    modifiers,
                    lineTotal,
                };
            }
        });
        return Object.values(map);
    }, [order?.orders_items]);

    const discountPercentage = useMemo(() => {
        if (order?.discount_percentage) return order.discount_percentage;
        if (!subtotal || !order?.discount) return 0;
        return ((Math.abs(Number(order.discount)) / subtotal) * 100).toFixed(0);
    }, [subtotal, order?.discount, order?.discount_percentage]);

    const servicePercentage = useMemo(() => {
        if (order?.service_percentage) return order.service_percentage;
        if (!subtotal || !order?.service_charge) return 0;
        return ((Number(order.service_charge) / subtotal) * 100).toFixed(0);
    }, [subtotal, order?.service_charge, order?.service_percentage]);

    const handleReopenConfirm = async ({ reason, reasonName }) => {
        try {
            const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
            await dispatch(reopenOrder({
                orderId: order.uuid,
                reasonId: reason,
                reasonName,
                waiterName
            })).unwrap();

            // Refresh data
            if (loginedProfileData?.data?.profile?.id) {
                const profileId = loginedProfileData.data.profile.id;
                await Promise.all([
                    dispatch(getTableGroups(profileId)),
                    dispatch(getActiveOrders({ profileId }))
                ]);
            }

            setShowReasonModal(false);
            onClose();
        } catch (error) {
            console.error("Çek yenidən açma xətası:", error);
            toast.error("Xəta baş verdi");
        }
    };

    const handlePrint = async () => {
        if (!order || isPrinting) return;
        setIsPrinting(true);

        const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || order.waiter?.name || "Naməlum";

        // Map data for consistent receipt format
        const mappedItems = (order.orders_items || []).map(item => ({
            ...item,
            product_name: item.product?.name || item.name || "Məhsul",
            quantity: item.count || 0
        }));

        const mappedPayments = (order.order_payments || []).map(p => ({
            ...p,
            name: p.payment_method?.name || p.tag?.name || (p.without_payment_method_id ? "Ödənişsiz" : "Nağd"),
            amount: p.paid
        }));

        const receiptOrderData = {
            items: mappedItems,
            checkData: {
                ...order,
                orderId: order.id, // Display ID
                startDate: order.start_date,
                waiter_name: order.waiter?.name || order.waiter_name,
                payments: mappedPayments
            },
            tableName: order.table?.name || "Masa",
            hallName: order.table?.hall?.name || "",
            waiterName: waiterName
        };

        try {
            const result = await printCustomerReceipt(receiptOrderData, loginedProfileData);
            if (result.success) {
                toast.success("Çek çap edildi");

                // Log print event
                dispatch(saveLog({
                    orderId: order.uuid,
                    action: "Çek çap edildi",
                    waiterName,
                    details: "Arxivdən təkrar çap"
                }));
            }
        } catch (error) {
            console.error("Print error:", error);
            toast.error("Çap zamanı xəta baş verdi");
        } finally {
            setIsPrinting(false);
        }
    };

    const hasTax = Number(order?.is_tax) > 0;
    const taxConfigs = loginedProfileData?.data?.taxes || [];

    const handleTaxMoneyBack = async () => {
        if (taxLoading || !order || taxConfigs.length === 0) return;

        if (!order.fiscal_id) {
            toast.error('Bu çekin fiskal ID-si yoxdur. Geri qaytarma mümkün deyil.');
            return;
        }

        // Yalnız orijinal satışın edildiyi cihaza göndər – digər kassalar müstəqil qalır
        const targetConfig = taxConfigs.find(c => getTaxConfigId(c) === order.tax_cash_id);
        if (!targetConfig) {
            toast.error('Bu çekin vergi kassası tapılmadı. Geri qaytarma yalnız orijinal kassaya göndərilə bilər.');
            return;
        }
        const configsToSend = [targetConfig];

        setTaxLoading(true);
        try {
            const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
            const items = (order.orders_items || [])
                .filter((item) => Number(item.count ?? item.quantity ?? 0) > 0)
                .map(item => ({
                    ...item,
                    name: item.product?.name || 'Məhsul',
                    count: Number(item.count ?? item.quantity ?? 1),
                    price: item.price || 0
                }));
            const payments = (order.order_payments || []).map(p => ({
                name: p.payment_method?.name || 'Nağd',
                type: p.payment_method?.type || 'cash',
                amount: p.paid
            }));
            const result = await apiConfig.post('/tax/money-back', {
                taxConfigs: configsToSend,
                moneyBackData: {
                    items,
                    payments,
                    cashierName: waiterName,
                    parentFiscalId: order.fiscal_id || '',
                    documentNumber: String(order.fiscal_doc_number || order.id || ''),
                    shortDocId: order.fiscal_short_id || '',
                    orderId: order.uuid || order.id
                }
            }, { timeout: TAX_HTTP_TIMEOUT_MS });
            if (result.data?.success) {
                toast.success('Vergi geri qaytarma uğurlu');
                dispatch(saveLog({
                    orderId: order.uuid,
                    action: 'Vergi geri qaytarma',
                    waiterName,
                    details: 'Fiskal cihazdan geri qaytarma'
                }));
            } else {
                toast.error('Vergi geri qaytarma xətası');
            }
        } catch (error) {
            console.error('Tax moneyback error:', error);
            const errMsg = error.response?.data?.message || error.message;
            toast.error('Vergi geri qaytarma x\u0259tas\u0131: ' + errMsg);
            addNotification('Fiskal Geri Qaytarma X\u0259tas\u0131', errMsg, { category: 'system', type: 'error' });
            const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || 'Nam\u0259lum';
            dispatch(saveLog({
                orderId: order.uuid,
                action: 'Vergi geri qaytarma x\u0259tas\u0131',
                waiterName,
                details: errMsg
            }));
        } finally {
            setTaxLoading(false);
        }
    };

    const handleTaxReceiptCopy = async () => {
        if (taxLoading || !order || taxConfigs.length === 0) return;

        const targetConfig = taxConfigs.find(c => getTaxConfigId(c) === order.tax_cash_id);
        if (!targetConfig) {
            toast.error('Bu çekin vergi kassası tapılmadı. Təkrar çap yalnız orijinal kassadan edilə bilər.');
            return;
        }
        const configsToSend = [targetConfig];

        setTaxLoading(true);
        try {
            const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
            const result = await apiConfig.post('/tax/receipt-copy', {
                taxConfigs: configsToSend,
                fiscalId: order.fiscal_id || ''
            }, { timeout: TAX_HTTP_TIMEOUT_MS });
            if (result.data?.success) {
                toast.success('Vergi çeki təkrar çap edildi');
                dispatch(saveLog({
                    orderId: order.uuid,
                    action: 'Vergi təkrar çap',
                    waiterName,
                    details: 'Fiskal çek təkrar çap edildi'
                }));
            } else {
                toast.error('Vergi təkrar çap xətası');
            }
        } catch (error) {
            console.error('Tax receipt copy error:', error);
            const errMsg = error.response?.data?.message || error.message;
            toast.error('Vergi t\u0259krar \u00e7ap x\u0259tas\u0131: ' + errMsg);
            addNotification('Fiskal T\u0259krar \u00C7ap X\u0259tas\u0131', errMsg, { category: 'system', type: 'error' });
            const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || 'Nam\u0259lum';
            dispatch(saveLog({
                orderId: order.uuid,
                action: 'Vergi t\u0259krar \u00e7ap x\u0259tas\u0131',
                waiterName,
                details: errMsg
            }));
        } finally {
            setTaxLoading(false);
        }
    };

    /** Təkrar satış üçün məhsul/ödəniş siyahısı */
    const getResendSaleItemsAndPayments = () => {
        const items = (order.orders_items || [])
            .filter((item) => Number(item.count ?? item.quantity ?? 0) > 0)
            .map((item) => ({
                ...item,
                name: item.product?.name || item.name || "Məhsul",
                count: Number(item.count ?? item.quantity ?? 1),
                price: item.price || 0,
            }));
        if (items.length === 0) {
            toast.error("Fiskal satış üçün məhsul siyahısı boşdur.");
            return null;
        }
        const payments = (order.order_payments || []).map((p) => ({
            payment_method_id: p.payment_method_id,
            without_payment_method_id: p.without_payment_method_id,
            name: p.payment_method?.name || p.tag?.name || (p.without_payment_method_id ? "Ödənişsiz" : "Nağd"),
            type: p.payment_method?.type || "cash",
            amount: p.paid,
        }));
        if (payments.length === 0) {
            toast.error("Ödəniş məlumatı yoxdur — fiskal satış göndərilmədi.");
            return null;
        }
        return { items, payments };
    };

    /** Birdən çox vergi kassası: modal; tək kassa: birbaşa göndəriş */
    const handleTaxResendSaleClick = () => {
        if (taxLoading || !order || taxConfigs.length === 0) return;
        const data = getResendSaleItemsAndPayments();
        if (!data) return;

        if (taxConfigs.length > 1) {
            setShowTaxResendModal(true);
            return;
        }
        executeTaxResendSale(taxConfigs[0]);
    };

    /** Bağlanmış çek üçün fiskal satışı təkrar göndər (/tax/sale) — CheckOver ilə eyni payload */
    const executeTaxResendSale = async (targetConfig) => {
        if (taxLoading || !order || !targetConfig) return;

        const data = getResendSaleItemsAndPayments();
        if (!data) return;
        const { items, payments } = data;

        if (order.fiscal_id) {
            const ok = window.confirm(
                "Bu çekdə artıq fiskal qeydiyyatı var. Təkrar göndərsəniz, cihazda yeni satış əməliyyatı və yeni fiskal məlumat yaradılacaq. Davam edilsin?"
            );
            if (!ok) return;
        }

        setTaxLoading(true);
        try {
            const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
            const result = await apiConfig.post(
                "/tax/sale",
                {
                    taxConfigs: [targetConfig],
                    saleData: {
                        items,
                        payments,
                        cashierName: waiterName,
                        orderId: order.id,
                    },
                },
                { timeout: TAX_HTTP_TIMEOUT_MS }
            );

            const results = result.data?.results || [];
            const successCount = results.filter((r) => r.success).length;
            if (successCount > 0) {
                toast.success("Vergi satışı təkrar göndərildi");
                const firstSuccess = results.find((r) => r.success && r.data);
                if (firstSuccess?.data) {
                    const fd = firstSuccess.data;
                    const cfg = firstSuccess.config;
                    const taxId =
                        cfg?.id ??
                        (cfg?.ip_addr && cfg?.port_addr
                            ? Math.abs(
                                  (cfg.ip_addr + ":" + cfg.port_addr)
                                      .split("")
                                      .reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0) & 0x7fffffff
                              )
                            : null);
                    await apiConfig
                        .patch(`/tax/save-fiscal/${order.uuid}`, {
                            fiscal_id: fd.long_id || "",
                            fiscal_doc_number: String(fd.document_number || ""),
                            fiscal_short_id: fd.short_id || "",
                            tax_cash_id: taxId,
                        })
                        .catch((err) => console.error("Save fiscal data error:", err));
                }
                dispatch(
                    saveLog({
                        orderId: order.uuid,
                        action: "Vergi təkrar satış",
                        waiterName,
                        details: "Təkrar vergiyə göndərildi (fiskal satış)",
                    })
                );
            } else {
                const errDetails = results.map((r) => r.error).filter(Boolean).join("; ") || "Vergi satışı uğursuz";
                toast.error(errDetails);
                addNotification("Fiskal Satış Xətası", errDetails, { category: "system", type: "error" });
            }
        } catch (error) {
            console.error("Tax resend sale error:", error);
            const errMsg = error.response?.data?.message || error.message;
            toast.error("Vergi təkrar satış xətası: " + errMsg);
            addNotification("Fiskal Satış Xətası", errMsg, { category: "system", type: "error" });
            const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
            dispatch(
                saveLog({
                    orderId: order.uuid,
                    action: "Vergi təkrar satış xətası",
                    waiterName,
                    details: errMsg,
                })
            );
        } finally {
            setTaxLoading(false);
        }
    };

    const [mobileActiveTab, setMobileActiveTab] = useState("info"); // 'info' | 'items' | 'history'
    const [isMobileSize, setIsMobileSize] = useState(window.innerWidth < 992);

    useEffect(() => {
        const handleResize = () => setIsMobileSize(window.innerWidth < 992);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

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
        <>
            <Modal show={show} onHide={onClose} size="lg" centered className="check-detail-modal-custom">
                <Modal.Header closeButton className="justify-content-center position-relative">
                    <Modal.Title className="w-100 text-center pe-4">Çek #{order.id}</Modal.Title>
                </Modal.Header>
                {hasTax && taxConfigs.length > 0 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '8px',
                        padding: '8px 16px',
                        background: '#f0f4ff',
                        borderBottom: '1px solid #e2e8f0'
                    }}>
                        <button
                            onClick={handleTaxReceiptCopy}
                            disabled={taxLoading}
                            style={{
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 600,
                                border: 'none',
                                borderRadius: '4px',
                                background: '#10b981',
                                color: '#fff',
                                cursor: taxLoading ? 'not-allowed' : 'pointer',
                                opacity: taxLoading ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <i className="bi bi-receipt"></i> Vergi Çap
                        </button>
                        <button
                            type="button"
                            onClick={handleTaxResendSaleClick}
                            disabled={taxLoading}
                            style={{
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 600,
                                border: 'none',
                                borderRadius: '4px',
                                background: '#2563eb',
                                color: '#fff',
                                cursor: taxLoading ? 'not-allowed' : 'pointer',
                                opacity: taxLoading ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <i className="bi bi-arrow-repeat"></i> Təkrar vergiyə göndər
                        </button>
                        <button
                            onClick={handleTaxMoneyBack}
                            disabled={taxLoading}
                            style={{
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 600,
                                border: 'none',
                                borderRadius: '4px',
                                background: '#dc2626',
                                color: '#fff',
                                cursor: taxLoading ? 'not-allowed' : 'pointer',
                                opacity: taxLoading ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <i className="bi bi-arrow-return-left"></i> Vergi Qaytar
                        </button>
                    </div>
                )}
                <Modal.Body className="p-0 border-0">
                    {/* Mobile Tabs Navigation */}
                    {isMobileSize && (
                        <div className="mobile-tabs-nav d-flex border-bottom">
                            <div
                                className={`mobile-tab-item flex-grow-1 text-center py-3 ${mobileActiveTab === 'info' ? 'active' : ''}`}
                                onClick={() => setMobileActiveTab('info')}
                            >
                                Məlumat
                            </div>
                            <div
                                className={`mobile-tab-item flex-grow-1 text-center py-3 ${mobileActiveTab === 'items' ? 'active' : ''}`}
                                onClick={() => setMobileActiveTab('items')}
                            >
                                Sifariş
                            </div>
                            <div
                                className={`mobile-tab-item flex-grow-1 text-center py-3 ${mobileActiveTab === 'history' ? 'active' : ''}`}
                                onClick={() => setMobileActiveTab('history')}
                            >
                                Tarixçə
                            </div>
                        </div>
                    )}

                    <div className="d-flex flex-column flex-lg-row modal-body-split">
                        {/* Left Sidebar: Meta Info OR History (Desktop) / Mobile Conditional */}
                        {(!isMobileSize || mobileActiveTab === 'info' || mobileActiveTab === 'history') && (
                            <div className={`sidebar-section border-end-lg ${isMobileSize && mobileActiveTab === 'history' ? 'flex-grow-1' : ''}`}
                                style={isMobileSize ? { display: (mobileActiveTab === 'info' || mobileActiveTab === 'history') ? 'block' : 'none' } : {}}>

                                {((!isMobileSize && currentView === "details") || (isMobileSize && mobileActiveTab === 'info')) ? (
                                    <div className="meta-items-container p-4">
                                        <div className="meta-item-box">
                                            <div className="meta-icon-col">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                                                    <path d="M5 12h14m-7-7 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </div>
                                            <div className="meta-content-col">
                                                <div className="meta-label">AÇILDI</div>
                                                <div className="meta-value">{formatFullDateTime(order.start_date)}</div>
                                                <div className="meta-sub text-muted">ID:{order.waiter_id}</div>
                                            </div>
                                        </div>

                                        <div className="meta-item-box">
                                            <div className="meta-icon-col">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F85F4" strokeWidth="2.5">
                                                    <path d="M20 6L9 17L4 12" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </div>
                                            <div className="meta-content-col">
                                                <div className="meta-label status-label text-primary">
                                                    {order.status === 3 ? "SİLİNDİ" : "BAĞLANDI"}
                                                </div>
                                                <div className="meta-value text-primary">{formatFullDateTime(order.end_date)}</div>
                                                <div className="meta-sub text-muted">ID:{order.waiter_id}</div>
                                            </div>
                                        </div>

                                        <div className="meta-item-box">
                                            <div className="meta-icon-col">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeLinecap="round" strokeLinejoin="round" />
                                                    <polyline points="7.5 4.21 12 6.81 16.5 4.21" strokeLinecap="round" strokeLinejoin="round" />
                                                    <polyline points="7.5 19.79 7.5 14.6 3 12" strokeLinecap="round" strokeLinejoin="round" />
                                                    <polyline points="21 12 16.5 14.6 16.5 19.79" strokeLinecap="round" strokeLinejoin="round" />
                                                    <polyline points="12 22.71 12 12.3" strokeLinecap="round" strokeLinejoin="round" />
                                                    <line x1="12" y1="12" x2="20.29" y2="7.21" strokeLinecap="round" strokeLinejoin="round" />
                                                    <line x1="12" y1="12" x2="3.71" y2="7.21" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </div>
                                            <div className="meta-content-col">
                                                <div className="meta-label">SATIŞ ÜSULU</div>
                                                <div className="meta-value">
                                                    {(() => {
                                                        if (!order.sale_type) return "Naməlum";
                                                        if (saleTypeLabels[order.sale_type]) return saleTypeLabels[order.sale_type];
                                                        return order.sale_type.charAt(0).toUpperCase() + order.sale_type.slice(1);
                                                    })()}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="meta-item-box">
                                            <div className="meta-icon-col">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                                                    <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </div>
                                            <div className="meta-content-col">
                                                <div className="meta-label">OFİSİANT</div>
                                                <div className="meta-value">{order.waiter?.name || "Naməlum"}</div>
                                            </div>
                                        </div>

                                        {(order.is_timer_status === 1 || (order.is_timer_clock && order.is_timer_clock !== "00:00:00")) && (
                                            <div className="meta-item-box">
                                                <div className="meta-icon-col">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="2.5">
                                                        <circle cx="12" cy="12" r="10"></circle>
                                                        <polyline points="12 6 12 12 16 14"></polyline>
                                                    </svg>
                                                </div>
                                                <div className="meta-content-col">
                                                    <div className="meta-label" style={{ color: '#053796' }}>TAYMER</div>
                                                    <div className="meta-value" style={{ fontWeight: '700' }}>
                                                        {order.is_timer_clock}
                                                        {order.is_timer_status === 1 ? ' (Aktiv)' : ' (Dayandırılıb)'}
                                                    </div>
                                                    {Number(order.rate_per_minute || 0) > 0 && (
                                                        <div className="meta-sub text-primary fw-bold">{Number(order.rate_per_minute).toFixed(2)} ₼</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="meta-item-box">
                                            <div className="meta-icon-col">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                                                    <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M18 12c0-1.1.9-2 2-2h2v4h-2a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </div>
                                            <div className="meta-content-col">
                                                <div className="meta-label">ÖDƏNİŞ ÜSULU</div>
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

                                        {hasTax && (
                                            <div className="meta-item-box">
                                                <div className="meta-icon-col">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                                                        <path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l4.58-4.58c.94-.94.94-2.48 0-3.42L9 5z" strokeLinecap="round" strokeLinejoin="round" />
                                                        <path d="M6 9h.01" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </div>
                                                <div className="meta-content-col">
                                                    <div className="meta-label" style={{ color: '#10b981' }}>VERGİ ÇEKİ</div>
                                                    <div className="meta-value" style={{ color: '#10b981' }}>Fiskal çek kəsilib</div>
                                                    {order.fiscal_id && (
                                                        <div className="meta-sub text-muted" style={{ fontSize: '11px', wordBreak: 'break-all' }}>
                                                            ID: {order.fiscal_short_id || order.fiscal_id}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="history-section bg-white p-0">
                                        <div className="history-filter-bar p-3 px-4">
                                            <div className="filter-label mb-2 text-muted" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                FİLTRLƏ:
                                            </div>
                                            <Form.Select
                                                value={logFilter}
                                                onChange={(e) => setLogFilter(e.target.value)}
                                                className="history-filter-select shadow-none"
                                            >
                                                <option value="all">Siyahı (Hamısı)</option>
                                                {logTypes.map((type, idx) => (
                                                    <option key={idx} value={type}>{type}</option>
                                                ))}
                                            </Form.Select>
                                        </div>

                                        <div className="history-timeline-container overflow-auto" style={{ maxHeight: isMobileSize ? 'none' : '460px', scrollbarWidth: 'thin' }}>
                                            <div style={{ padding: '16px 20px' }}>
                                                {filteredLogs.length === 0 ? (
                                                    <div className="text-center py-5 text-muted">Hərəkət tapılmadı</div>
                                                ) : (
                                                    filteredLogs.map((log, idx) => (
                                                        <div key={idx} style={{ display: 'flex', gap: '14px' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#053796', border: '2px solid #fff', boxShadow: '0 0 0 2px #053796', flexShrink: 0 }}></div>
                                                                {idx < filteredLogs.length - 1 && (
                                                                    <div style={{ width: '2px', flex: 1, background: '#e2e8f0', minHeight: '20px' }}></div>
                                                                )}
                                                            </div>
                                                            <div style={{ paddingBottom: '20px', flex: 1 }}>
                                                                <div className="fw-bold text-dark mb-1" style={{ fontSize: '14px' }}>
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
                        )}

                        {/* Right Main Content: Order Items (Desktop) / Mobile Conditional */}
                        {(!isMobileSize || mobileActiveTab === 'items') && (
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
                                            {groupedItems.map((item, i) => {
                                                const safeCount = Math.max(0, Number(item.count) || 0);
                                                const unitWithMods =
                                                    safeCount > 0
                                                        ? Number(item.lineTotal || 0) / safeCount
                                                        : Number(item.price || 0);
                                                return (
                                                <tr key={i}>
                                                    <td>
                                                        <div>{item.name}</div>
                                                        {item.modifiers && item.modifiers.length > 0 && (
                                                            <div className="check-detail-item-modifiers">
                                                                {item.modifiers.map((m, mi) => {
                                                                    const mc = Number(m.count || 1);
                                                                    const mline = Number(m.price || 0) * mc;
                                                                    return (
                                                                        <span key={mi} className="check-detail-modifier-tag">
                                                                            {m.name || "—"}
                                                                            {mc > 1 ? ` (x${mc})` : ""}{" "}
                                                                            +{mline.toFixed(2)}₼
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>{item.count}</td>
                                                    <td>{unitWithMods.toFixed(2)}</td>
                                                    <td className="text-end">{Number(item.lineTotal || 0).toFixed(2)}</td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="summary-section mt-auto">
                                    <div className="summary-row d-flex justify-content-between mb-2">
                                        <span className="summary-label text-muted">Cəm:</span>
                                        <span className="summary-value fw-bold">{(subtotal || 0).toFixed(2)} ₼</span>
                                    </div>

                                    {Number(order.discount || 0) !== 0 && (
                                        <div className="summary-row d-flex justify-content-between mb-2">
                                            <span className="summary-label text-muted">Endirim ({discountPercentage}%):</span>
                                            <span className="summary-value text-danger fw-bold">
                                                {Number(order.discount) > 0 ? '-' : ''}{Math.abs(Number(order.discount)).toFixed(2)} ₼
                                            </span>
                                        </div>
                                    )}

                                    {Number(order.deposit || 0) > (subtotal - Number(order.discount || 0)) && (
                                        <div className="summary-row d-flex justify-content-between mb-2">
                                            <span className="summary-label text-muted">Depozit (Minimal):</span>
                                            <span className="summary-value fw-bold">{Number(order.deposit).toFixed(2)} ₼</span>
                                        </div>
                                    )}

                                    {Number(order.service_charge || 0) !== 0 && (
                                        <div className="summary-row d-flex justify-content-between mb-2">
                                            <span className="summary-label text-muted">Servis haqqı ({servicePercentage}%):</span>
                                            <span className="summary-value fw-bold">{Number(order.service_charge).toFixed(2)} ₼</span>
                                        </div>
                                    )}

                                    {Number(order.delivery_fee || 0) > 0 && (
                                        <div className="summary-row d-flex justify-content-between mb-2">
                                            <span className="summary-label text-muted">Çatdırılma:</span>
                                            <span className="summary-value fw-bold">{Number(order.delivery_fee).toFixed(2)} ₼</span>
                                        </div>
                                    )}

                                    {Number(order.rate_per_minute || 0) > 0 && (
                                        <div className="summary-row d-flex justify-content-between mb-2">
                                            <span className="summary-label text-muted">Taymer:</span>
                                            <span className="summary-value fw-bold">{Number(order.rate_per_minute).toFixed(2)} ₼</span>
                                        </div>
                                    )}

                                    <div className="summary-row d-flex justify-content-between align-items-center pt-2 border-top mt-2">
                                        <span className="summary-label fw-bold" style={{ fontSize: '18px' }}>
                                            {Number(order.deposit || 0) > (subtotal - Number(order.discount || 0)) ? 'Minimal məbləğ:' : 'Yekun:'}
                                        </span>
                                        <span className="summary-value fw-bold text-primary" style={{ fontSize: '24px' }}>
                                            {(Math.max(subtotal - Number(order.discount || 0), Number(order.deposit || 0)) + Number(order.service_charge || 0) + Number(order.delivery_fee || 0) + Number(order.rate_per_minute || 0)).toFixed(2)} ₼
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Custom Flush Footer - Hidden on Mobile if we use Bottom Tabs or refined actions */}
                    <div className="w-100 d-flex gap-0" style={{ background: "#f8f9fa", borderTop: "1px solid #dee2e6" }}>
                        {!isMobileSize && (
                            <div className="footer-left" style={{ width: "40%", borderRight: "1px solid #dee2e6" }}>
                                <Button
                                    variant="light"
                                    className="w-100 h-100 d-flex align-items-center justify-content-center border-0 rounded-0 py-3"
                                    onClick={() => setCurrentView(currentView === "details" ? "history" : "details")}
                                    style={{ color: "#0d6efd", background: "transparent", fontWeight: 500 }}
                                >
                                    <i className={`bi ${currentView === "details" ? "bi-clock-history" : "bi-info-circle"} me-2 fs-5`}></i>
                                    {currentView === "details" ? "TARİXÇƏ" : "ÇEK MƏLUMATLARI"}
                                </Button>
                            </div>
                        )}
                        {/* Foot Right: Actions */}
                        <div className={`footer-right d-flex ${isMobileSize ? 'w-100' : 'flex-grow-1'}`}>
                            <Button
                                variant="warning"
                                className="flex-grow-1 d-flex align-items-center justify-content-center border-0 rounded-0 py-3"
                                onClick={() => {
                                    if (Number(loginedWaiter?.data?.can_return_receipt) !== 1) return;
                                    setShowReasonModal(true);
                                }}
                                style={{ backgroundColor: "#f39c12", color: "#fff" }}
                            >
                                <i className="bi bi-arrow-counterclockwise me-2 fs-5"></i> ÇEKİ QAYTAR
                            </Button>
                            <Button
                                variant="primary"
                                className="flex-grow-1 d-flex align-items-center justify-content-center border-0 rounded-0 py-3"
                                onClick={handlePrint}
                                disabled={isPrinting}
                                style={{ backgroundColor: "#0d6efd", opacity: isPrinting ? 0.7 : 1 }}
                            >
                                {isPrinting ? (
                                    <>
                                        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                                        ÇAP...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-printer me-2 fs-5"></i> ÇAP
                                    </>
                                )}
                            </Button>

                        </div>
                    </div>
                </Modal.Body>
            </Modal>

            <Modal
                show={showTaxResendModal}
                onHide={() => !taxLoading && setShowTaxResendModal(false)}
                centered
                className="customers-modal tax-kassa-picker-modal"
                dialogClassName="checkover-tax-modal-wide tax-kassa-picker-dialog"
                backdrop="static"
                keyboard={!taxLoading}
                animation={false}
            >
                <div className="modal-content-wrapper" style={{ borderRadius: "8px", overflow: "hidden" }}>
                    <div className="customers-modal-header" style={{ background: "#5D99FF", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                        <div className="customers-header-content">
                            <div className="customers-icon-circle" style={{ borderRadius: "8px" }}>
                                <i className="bi bi-receipt"></i>
                            </div>
                            <div>
                                <div className="customers-modal-title">Kassa seçimi</div>
                                <div style={{ fontSize: "12px", fontWeight: 500, opacity: 0.92, marginTop: "2px" }}>Təkrar vergi satışı</div>
                            </div>
                        </div>
                        <button type="button" className="btn-close-custom" disabled={taxLoading} onClick={() => setShowTaxResendModal(false)} aria-label="Bağla">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <div className="tax-kassa-modal-body-inner">
                        <div className="tax-kassa-modal-intro">
                            <p className="tax-kassa-modal-intro-title">Hansı vergi kassasına göndərmək istəyirsiniz?</p>
                            <p className="tax-kassa-modal-intro-sub">
                                Seçdiyiniz cihazda yeni fiskal satış əməliyyatı başlayacaq. Əvvəl bu çekdə istifadə olunan kassa xüsusi işarələnib.
                            </p>
                        </div>
                        <div className="tax-kassa-modal-list-wrap">
                            <div className="d-flex flex-column gap-3">
                                {(loginedProfileData?.data?.taxes || []).map((tax, idx) => {
                                    const taxKey = tax.id || `${tax.ip_addr}:${tax.port_addr}`;
                                    const localName = taxLocalNames[taxKey] || tax.tax_cash_type || "E-kassa";
                                    const isOriginal = order && getTaxConfigId(tax) === order.tax_cash_id;
                                    const rowClass =
                                        "tax-kassa-row" +
                                        (isOriginal ? " tax-kassa-row--original" : "") +
                                        (taxLoading ? " tax-kassa-row--disabled" : "");
                                    return (
                                        <div
                                            key={idx}
                                            role="button"
                                            tabIndex={taxLoading ? -1 : 0}
                                            className={rowClass}
                                            aria-label={`${localName}, ${tax.ip_addr}:${tax.port_addr}`}
                                            aria-disabled={taxLoading}
                                            onKeyDown={(e) => {
                                                if (taxLoading) return;
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    setShowTaxResendModal(false);
                                                    executeTaxResendSale(tax);
                                                }
                                            }}
                                            onClick={() => {
                                                if (taxLoading) return;
                                                setShowTaxResendModal(false);
                                                executeTaxResendSale(tax);
                                            }}
                                        >
                                            <div className="tax-kassa-row-icon">
                                                <i className="bi bi-receipt"></i>
                                            </div>
                                            <div className="tax-kassa-row-text">
                                                <h5 className="tax-kassa-row-name">{localName}</h5>
                                                <span className="tax-kassa-row-ip">
                                                    {tax.ip_addr}:{tax.port_addr}
                                                </span>
                                                {isOriginal && (
                                                    <span className="tax-kassa-row-badge">Bu çekdə fiskal bu kassada</span>
                                                )}
                                            </div>
                                            <div className="tax-kassa-row-chevron">
                                                <i className="bi bi-chevron-right"></i>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="tax-kassa-modal-footer">
                            <button
                                type="button"
                                className="btn-imtina"
                                disabled={taxLoading}
                                onClick={() => setShowTaxResendModal(false)}
                            >
                                İmtina
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>

            <CheckDeleteModal
                show={showReasonModal}
                onClose={() => setShowReasonModal(false)}
                onConfirm={handleReopenConfirm}
                type="checks"
                order={order}
                tagsType={5} // Return reasons
                actionName="Aç"
                title="Çeki qaytarma səbəbi"
            />
        </>
    );
};

export default CheckDetailModal;
