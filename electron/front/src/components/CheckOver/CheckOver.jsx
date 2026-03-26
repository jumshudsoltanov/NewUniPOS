import React, { useState, useMemo, useEffect } from 'react';
import { Container, Col, Row, Form, Modal } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Header from "../Header/Header";
import "./CheckOver.css";
import "../Checks/TaxCashPickerModal.css";
import "../Customers-Modal/CustomersModal.css";
import { getTagsList } from '../../redux/Slices/TagsSlice';
import { getPaymentMethods } from '../../redux/Slices/PaymentMethodsSlice';
import { closeOrder, saveLog } from '../../redux/Slices/OrdersSlice';
import { printCustomerReceipt } from "../../utils/printerHelpers.jsx";
import { toast } from "sonner";
import axios from "axios";
import apiConfig, { getSocket, TAX_HTTP_TIMEOUT_MS } from "../../utils/apiConfig";
import { addNotification } from "../../utils/notificationService";
import { isPacksOnlyWaiter } from "../../utils/waiterPermissions";
import { getModifiersTotalPerUnit } from "../../utils/orderItemLineTotal";

const CheckOver = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { id } = useParams();
    const [calcValue, setCalcValue] = useState("");

    // Payment State
    const [selectedMethods, setSelectedMethods] = useState([]); // [{id, name, amount, is_split}]

    const [viewMode, setViewMode] = useState("PAYMENT"); // 'PAYMENT' or 'UNPAID'
    const [printCheck, setPrintCheck] = useState(() => {
        const authStr = localStorage.getItem("authResult");
        const storedProfile = JSON.parse(localStorage.getItem("profile") || "{}");
        const authProfile = authStr ? (JSON.parse(authStr)?.data?.profile || {}) : {};
        const merged = { ...authProfile, ...storedProfile };
        return Number(merged.is_customer_receipt_auto_print) === 1;
    });
    const [taxPrint, setTaxPrint] = useState(false);
    const [unpaidReason, setUnpaidReason] = useState("");
    const [comment, setComment] = useState("");
    const [tagsListData, setTagsListData] = useState([])

    const [showTaxSelectionModal, setShowTaxSelectionModal] = useState(false);
    const [taxLocalNames, setTaxLocalNames] = useState({});

    // Fetch tax names
    useEffect(() => {
        const stored = localStorage.getItem("tax_local_names");
        if (stored) {
            try { setTaxLocalNames(JSON.parse(stored)); } catch (e) { }
        }
    }, []);

    const { books } = useSelector((state) => state.BooksSlice);
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);

    // taxPrint default false (sonulu) - yalnız ödəniş metodu seçəndə is_tax varsa yansın
    const { paymentMethods } = useSelector((state) => state.PaymentMethodsSlice);
    const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
    const { customers } = useSelector((state) => state.CustomersSlice);

    // CheckBottom ilə eyni: cannot_close_check === 1 olmayan birbaşa URL ilə gələ bilməz (master/slave istisnası yoxdur)
    useEffect(() => {
        if (!id) return;
        const w = loginedWaiter?.data;
        if (w == null) return;
        if (Number(w.cannot_close_check) !== 1) {
            toast.error("İcazəniz yoxdur: Çek bağlamaq hüququnuz yoxdur.");
            navigate(`/check/${id}`, { replace: true });
        }
    }, [id, loginedWaiter?.data, navigate]);

    useEffect(() => {
        const fetchData = async () => {
            const profileId = loginedProfileData?.data?.profile?.id;
            if (!profileId) return;

            try {
                // Fetch tags
                const tagRes = await dispatch(getTagsList(profileId)).unwrap();
                const fetchedTags = Array.isArray(tagRes.data)
                    ? tagRes.data.filter(tag => Number(tag.type) === 3)
                    : [];
                setTagsListData(fetchedTags);

                // Fetch payment methods
                await dispatch(getPaymentMethods(profileId)).unwrap();
            } catch (err) {
                console.error("fetch error:", err);
            }
        };

        fetchData();
    }, [dispatch, loginedProfileData?.data?.profile?.id]);

    const currentOrder = useMemo(() => {
        if (!books?.data) return null;
        return books.data.find(o => o.uuid === id);
    }, [books, id]);

    const selectedCustomer = useMemo(() => {
        if (!currentOrder?.customer_id || !customers) return null;
        return customers.find(c => c.id === currentOrder.customer_id);
    }, [currentOrder?.customer_id, customers]);

    // Çap üçün: zal/masa yalnız restoranda (dine_in) — takeaway/delivery və s. üçün göstərilmir
    const receiptHallName = useMemo(() => {
        if (currentOrder?.sale_type !== "dine_in") return "";
        return currentOrder?.hall_name || currentOrder?.table?.hall?.name || "";
    }, [currentOrder?.sale_type, currentOrder?.hall_name, currentOrder?.table?.hall?.name]);

    const receiptTableName = useMemo(() => {
        if (currentOrder?.sale_type !== "dine_in") return "";
        return currentOrder?.table_name || currentOrder?.table?.name || "";
    }, [currentOrder?.sale_type, currentOrder?.table_name, currentOrder?.table?.name]);

    const calcTotal = useMemo(() => {
        if (!currentOrder) return { total: 0, sumTotal: "0.00" };

        let total = 0;
        let totalForService = 0;
        currentOrder.orders_items?.forEach((item) => {
            const count = Number(item.count || item.quantity || 0);
            const price = Number(item.price || 0);
            const modifiersPerUnit = getModifiersTotalPerUnit(item);
            const itemTotal = count * (price + modifiersPerUnit);
            total += itemTotal;

            const isNoService = (item.no_service_fee === 1 || item.product?.no_service_fee === 1);
            if (!isNoService) {
                totalForService += itemTotal;
            }
        });

        // Add Timer Charge
        if (currentOrder.rate_per_minute) {
            total += Number(currentOrder.rate_per_minute);
        }

        const discountValue = Number(currentOrder.discount_value || 0);
        const discountType = currentOrder.discount_type || "percent";
        let discountAmount = 0;

        if (discountValue > 0) {
            if (discountType === "percent") {
                discountAmount = (total * discountValue) / 100;
            } else {
                discountAmount = discountValue;
            }
        } else if (currentOrder.discount) {
            discountAmount = Number(currentOrder.discount);
        }

        let serviceValue = Number(currentOrder.service_value || 0);
        let serviceType = currentOrder.service_type || "percent";
        let serviceAmount = 0;

        if (serviceValue > 0) {
            if (serviceType === "percent") {
                serviceAmount = (totalForService * serviceValue) / 100;
            } else {
                serviceAmount = serviceValue;
            }
        } else if (currentOrder.service_charge) {
            serviceAmount = Number(currentOrder.service_charge);
        }

        const depositAmount = Number(currentOrder.deposit || 0);
        const deliveryFee = Number(currentOrder.delivery_fee || 0);
        // Backend və Table.jsx ilə eyni: depozit cəmə əlavə deyil — max(subtotal+service, depozit)+çatdırılma
        const baseTotal = total - discountAmount + serviceAmount;
        let sumTotal = Math.max(baseTotal, depositAmount) + deliveryFee;
        if (sumTotal < 0) sumTotal = 0;

        return {
            total: total.toFixed(2),
            sumTotal: sumTotal.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            serviceAmount: serviceAmount.toFixed(2),
            depositAmount: depositAmount.toFixed(2)
        };
    }, [currentOrder]);

    // Əgər əvvəlcədən çekdə vergi qeyd olunubsa, taxPrint yansın (yalnız can_see_tax=1 olan garson üçün)
    useEffect(() => {
        if (Number(loginedWaiter?.data?.can_see_tax) === 1 && currentOrder && Number(currentOrder.is_tax) > 0) {
            setTaxPrint(true);
        }
    }, [currentOrder?.is_tax, loginedWaiter?.data?.can_see_tax]);

    // Ödəniş metodu seçəndə: əgər seçilənlər arasında is_tax olan varsa, vergi checkbox yansın (yalnız can_see_tax=1 olan garson üçün)
    useEffect(() => {
        if (Number(loginedWaiter?.data?.can_see_tax) === 1 && viewMode === "PAYMENT" && selectedMethods.some(m => Number(m.is_tax) === 1)) {
            setTaxPrint(true);
        }
    }, [viewMode, selectedMethods, loginedWaiter?.data?.can_see_tax]);

    const handleMethodSelect = (method) => {
        const isAlreadySelected = selectedMethods.find(m => m.id === method.id);

        if (isAlreadySelected) {
            if (selectedMethods.length > 1) {
                const remaining = selectedMethods.filter(m => m.id !== method.id);
                // Reset the remaining one to full amount
                remaining[0].amount = calcTotal.sumTotal;
                setSelectedMethods(remaining);
            }
            return;
        }

        const canSplit = selectedMethods.length === 1 && (
            selectedMethods.some(m => Number(m.is_split) === 1) || Number(method.is_split) === 1
        );

        if (canSplit) {
            const half = (Number(calcTotal.sumTotal) / 2).toFixed(2);
            const secondAmount = (Number(calcTotal.sumTotal) - Number(half)).toFixed(2);
            const newMethods = [
                { ...selectedMethods[0], amount: half },
                { ...method, amount: secondAmount }
            ];
            setSelectedMethods(newMethods);
        } else {
            setSelectedMethods([{ ...method, amount: calcTotal.sumTotal }]);
        }
    };

    const handleAmountChange = (index, value) => {
        const newMethods = [...selectedMethods];
        const numValue = Number(value);
        const total = Number(calcTotal.sumTotal);

        newMethods[index].amount = value;

        // Auto-calculate the other method if in split mode
        if (newMethods.length === 2) {
            const otherIndex = index === 0 ? 1 : 0;
            const remainder = Math.max(0, total - numValue).toFixed(2);
            newMethods[otherIndex].amount = remainder;
        }

        setSelectedMethods(newMethods);
    };

    const handleNumClick = (val) => {
        if (val === "." && calcValue.includes(".")) return;
        setCalcValue(prev => prev + val);
    };

    const handleDelete = () => {
        setCalcValue(prev => prev.slice(0, -1));
    };

    const numpadButtons = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "DEL"];

    const totalPaidInMethods = useMemo(() => {
        return selectedMethods.reduce((sum, m) => sum + Number(m.amount || 0), 0);
    }, [selectedMethods]);

    const remainingBalance = useMemo(() => {
        const paid = Number(calcValue || totalPaidInMethods || 0);
        const toPay = Number(calcTotal.sumTotal);
        return (paid - toPay).toFixed(2);
    }, [calcValue, totalPaidInMethods, calcTotal.sumTotal]);

    const isSplitActive = selectedMethods.length > 1;

    /** Birdən çox vergi kassası olanda yalnız seçilənə göndər; əks halda hər ikisinə paralel satış gedirdi */
    const resolveTaxConfigsForSale = (allTaxConfigs, selectedTaxForPrint) => {
        if (selectedTaxForPrint) return [selectedTaxForPrint];
        if (!allTaxConfigs?.length) return [];
        if (allTaxConfigs.length === 1) return allTaxConfigs;
        return [allTaxConfigs[0]];
    };

    const handleConfirmReady = () => {
        if (viewMode === "PAYMENT" && selectedMethods.length === 0) {
            toast.error("Zəhmət olmasa ödəniş üsulunu seçin");
            return;
        }
        if (viewMode === "UNPAID" && !unpaidReason) {
            toast.error("Zəhmət olmasa ödənişsiz bağlanış səbəbini seçin");
            return;
        }
        if (viewMode === "PAYMENT") {
            const paid = Number(calcValue || totalPaidInMethods || 0);
            const toPay = Number(calcTotal.sumTotal);
            if (paid < toPay) {
                toast.error(`Ödəniş çatışmır! ${(toPay - paid).toFixed(2)} ₼ əskikdir`);
                return;
            }
        }

        const taxConfigs = loginedProfileData?.data?.taxes || [];
        // Ödənişsiz bağlanışda vergi çeki / kassa seçimi — yalnız ödənişli bağlanışda
        const needTaxCashPicker =
            viewMode === "PAYMENT" &&
            taxPrint &&
            Number(loginedWaiter?.data?.can_see_tax) === 1 &&
            taxConfigs.length > 1;
        if (needTaxCashPicker) {
            setShowTaxSelectionModal(true);
        } else {
            handleConfirmClose(null);
        }
    };

    const handleConfirmClose = async (selectedTaxForPrint = null) => {
        const profileId = loginedProfileData?.data?.profile?.id;
        const waiterId = currentOrder?.waiter_id || loginedWaiter?.data?.id;
        const waiterName = loginedWaiter?.data?.name || loginedWaiter?.name || loginedProfileData?.data?.profile?.name || currentOrder?.waiter?.name || "Naməlum";

        if (!profileId || !waiterId || !id) return;

        let payments = [];
        let status = 2; // Closed
        let noteStr = comment;

        if (viewMode === "PAYMENT") {
            payments = selectedMethods.map(m => ({
                payment_method_id: m.id,
                name: m.name,
                type: m.type,
                amount: m.amount || (selectedMethods.length === 1 ? calcTotal.sumTotal : 0)
            }));
        } else {
            // Unpaid mode
            const tag = tagsListData.find(t => (t.name || t.text) === unpaidReason);
            payments = [{
                without_payment_method_id: tag?.id || 0,
                name: unpaidReason,
                amount: calcTotal.sumTotal
            }];
            noteStr = `Ödənişsiz: ${unpaidReason}. ${comment}`;
        }

        let taxPercentageToSave = 0;
        if (viewMode === "PAYMENT" && taxPrint && Number(loginedWaiter?.data?.can_see_tax) === 1) {
            const allTaxConfigs = loginedProfileData?.data?.taxes || [];
            const taxConfigsToUse = resolveTaxConfigsForSale(allTaxConfigs, selectedTaxForPrint);
            if (taxConfigsToUse.length > 0) {
                taxPercentageToSave = Number(taxConfigsToUse[0].tax_percent || loginedProfileData?.data?.profile?.tax_percent || 1);
            } else {
                taxPercentageToSave = 1; /* Fallback to simple indicator if percent unknown */
            }
        }

        try {
            await dispatch(closeOrder({
                orderId: id,
                payments,
                status,
                profileId,
                waiterId,
                note: noteStr,
                waiterName,
                is_tax: taxPercentageToSave
            })).unwrap();

            dispatch(saveLog({
                orderId: id,
                action: "Çek bağlandı",
                waiterName,
                details: noteStr ? `Bağlandı. Qeyd: ${noteStr}` : "Sifariş müvəffəqiyyətlə bağlandı"
            }));

            if (printCheck) {
                dispatch(saveLog({
                    orderId: id,
                    action: "Çek çap edildi",
                    waiterName,
                    details: "Bağlanış çeki"
                }));
            }

            // Vergi fiskal çeki yalnız ödənişli bağlanışda (ödənişsizdə göndərilmir)
            if (viewMode === "PAYMENT" && taxPrint && Number(loginedWaiter?.data?.can_see_tax) === 1) {
                const allTaxConfigs = loginedProfileData?.data?.taxes || [];
                const taxConfigsToUse = resolveTaxConfigsForSale(allTaxConfigs, selectedTaxForPrint);

                if (taxConfigsToUse.length > 0) {
                    try {
                        const saleItems = (currentOrder?.orders_items || [])
                            .filter((item) => Number(item.count ?? item.quantity ?? 0) > 0)
                            .map((item) => {
                                const unitBase = Number(item.price || 0);
                                const unitWithMods = unitBase + getModifiersTotalPerUnit(item);
                                return {
                                    ...item,
                                    name: item.product?.name || item.name || 'Məhsul',
                                    count: Number(item.count ?? item.quantity ?? 1),
                                    price: unitWithMods
                                };
                            });
                        if (saleItems.length === 0) {
                            toast.warning('Fiskal çek üçün məhsul siyahısı boşdur — göndərilmədi.');
                        } else {
                        // Call tax sale API in the background (as requested: do not wait for fiscal device)
                        apiConfig.post('/tax/sale', {
                            taxConfigs: taxConfigsToUse,
                            saleData: {
                                items: saleItems,
                                payments,
                                cashierName: waiterName,
                                orderId: currentOrder?.id || id
                            }
                        }, { timeout: TAX_HTTP_TIMEOUT_MS }).then(taxResult => {
                            const results = taxResult.data?.results || [];
                            const successCount = results.filter(r => r.success).length;
                            const failCount = results.filter(r => !r.success).length;
                            if (successCount > 0) {
                                toast.success(failCount > 0
                                    ? `Vergi çeki: ${successCount} kassada uğurlu, ${failCount} kassada xəta`
                                    : 'Vergi çeki kəsildi');
                                const firstSuccess = results.find(r => r.success && r.data);
                                if (firstSuccess?.data) {
                                    const fd = firstSuccess.data;
                                    const cfg = firstSuccess.config;
                                    const taxId = cfg?.id ?? (cfg?.ip_addr && cfg?.port_addr
                                        ? Math.abs((cfg.ip_addr + ':' + cfg.port_addr).split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0) & 0x7FFFFFFF)
                                        : null);
                                    apiConfig.patch(`/tax/save-fiscal/${id}`, {
                                        fiscal_id: fd.long_id || '',
                                        fiscal_doc_number: String(fd.document_number || ''),
                                        fiscal_short_id: fd.short_id || '',
                                        tax_cash_id: taxId
                                    }).catch(err => console.error('Save fiscal data error:', err));
                                }
                            } else {
                                const errDetails = results.map(r => r.error).filter(Boolean).join('; ') || 'Vergi çeki kəsilə bilmədi';
                                addNotification('Fiskal Çək Xətası', errDetails, { category: 'system', type: 'error' });
                            }
                        }).catch(taxErr => {
                            console.error('Tax sale error:', taxErr);
                            const errMsg = taxErr.response?.data?.message || taxErr.message;
                            addNotification('Fiskal Çək Xətası', errMsg, { category: 'system', type: 'error' });
                        });

                        // Proceed without waiting for taxResult
                        toast.info('Vergi çeki arxa planda kəsilir...');
                        }
                    } catch (taxErr) {
                        console.error('Tax sale error:', taxErr);
                        const errMsg = taxErr.response?.data?.message || taxErr.message;
                        toast.warning('Vergi \u00E7\u0259ki g\u00F6nd\u0259ril\u0259 bilm\u0259di: ' + errMsg);
                        addNotification('Fiskal \u00C7\u0259k X\u0259tas\u0131', errMsg, { category: 'system', type: 'error' });
                        dispatch(saveLog({
                            orderId: currentOrder?.uuid,
                            action: 'Vergi çeki xətası',
                            waiterName,
                            details: errMsg
                        }));
                    }
                }
            }

            // Notify all other terminals that this order is closed
            const socket = getSocket();
            if (socket?.connected) {
                socket.emit("order_closed", { orderId: currentOrder?.uuid || id });
            }
            const isPacksOnly = isPacksOnlyWaiter(loginedWaiter?.data);
            navigate(isPacksOnly ? "/checks" : "/tables");

            // Print in background after navigation (non-blocking)
            if (printCheck) {
                const paidValue = Number(calcValue) || totalPaidInMethods || 0;
                const changeValue = Number(remainingBalance) || 0;
                const orderWaiter = currentOrder?.waiter?.name || currentOrder?.waiter_name || waiterName;
                printCustomerReceipt({
                    items: currentOrder?.orders_items || [],
                    checkData: {
                        ...currentOrder,
                        orderId: currentOrder?.id,
                        total: calcTotal.sumTotal,
                        payments: payments,
                        paidAmount: paidValue,
                        change: changeValue,
                        customer_name: selectedCustomer?.name || currentOrder?.customer_name || "",
                        waiter_name: orderWaiter
                    },
                    tableName: receiptTableName,
                    hallName: receiptHallName,
                    waiterName
                }, loginedProfileData, { dispatch, loginedWaiter }).catch(err => {
                    console.error("Background print failed:", err);
                });
            }
        } catch (err) {
            console.error("Close order failed:", err);
        }
    };

    return (
        <div className="check-over-page">
            <Header showBack={true} onBack={() => navigate(-1)} hideWaiterName={true} />
            <Container fluid className="check-over-content p-0">
                <Row className="g-0 h-100">
                    <Col lg={5} md={6} className="calculator-section p-4 d-none d-md-flex flex-column">
                        <div className="calc-display-container mb-4">
                            <Form.Control
                                type="text"
                                className="calc-input text-end"
                                placeholder="Məbləği daxil edin"
                                value={calcValue}
                                readOnly
                            />
                            <span className="currency-symbol">₼</span>
                        </div>

                        <div className="calc-info-grid mb-4">
                            <div className="calc-info-card">
                                <span className="label">Ödənilməli</span>
                                <span className="value">{calcTotal.sumTotal} ₼</span>
                            </div>
                            <div className="calc-info-card highlighted">
                                <span className="label">Ödənilən</span>
                                <span className="value">{(Number(calcValue) || totalPaidInMethods || 0).toFixed(2)} ₼</span>
                            </div>
                            <div className={`calc-info-card ${Number(remainingBalance) >= 0 ? 'positive' : 'negative'}`}>
                                <span className="label">Qalıq</span>
                                <span className="value">{remainingBalance} ₼</span>
                            </div>
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

                    <Col lg={7} md={6} xs={12} className="payment-section p-4 bg-white d-flex flex-column">
                        {viewMode === "PAYMENT" ? (
                            <>
                                <div className="payment-header d-flex justify-content-between align-items-center mb-4">
                                    <div className="payment-title-group">
                                        <h2 className="payment-title">Ödənilməli</h2>
                                        {selectedCustomer && (
                                            <div className="customer-info-tag">
                                                <i className="bi bi-person-fill me-1"></i>
                                                {selectedCustomer.name} {selectedCustomer.group ? `(${selectedCustomer.group.name})` : ''}
                                            </div>
                                        )}
                                    </div>
                                    <div className="total-amount-display">
                                        <span className="amount">{calcTotal.sumTotal}</span>
                                        <span className="symbol">₼</span>
                                    </div>
                                </div>

                                <div className="payment-methods gap-3 d-flex flex-column">
                                    {paymentMethods?.map((method) => {
                                        const isSelected = selectedMethods.find(m => m.id === method.id);
                                        const idx = selectedMethods.findIndex(m => m.id === method.id);
                                        return (
                                            <div key={method.id}>
                                                <div
                                                    className={`payment-method-item ${isSelected ? "active" : ""} ${method.name.toLowerCase().includes("kart") ? "card-method" : ""}`}
                                                    onClick={() => handleMethodSelect(method)}
                                                >
                                                    <div className="d-flex align-items-center gap-3">
                                                        <div className={`custom-selection-indicator ${isSelected ? 'selected' : ''}`}>
                                                            {isSelected && <i className="bi bi-check-lg"></i>}
                                                        </div>
                                                        <span className="method-name">{method.name}</span>
                                                    </div>

                                                    {isSelected && (
                                                        <div className="method-right-content">
                                                            {isSplitActive ? (
                                                                <div className="split-input-wrapper" onClick={(e) => e.stopPropagation()}>
                                                                    <Form.Control
                                                                        type="number"
                                                                        className="split-amount-input"
                                                                        value={isSelected.amount}
                                                                        onChange={(e) => handleAmountChange(idx, e.target.value)}
                                                                        autoFocus={idx === 0}
                                                                    />
                                                                    <span className="currency-sym">₼</span>
                                                                </div>
                                                            ) : (
                                                                <div className="method-amount">
                                                                    <span>{isSelected.amount || calcTotal.sumTotal}</span>
                                                                    <span className="symbol">₼</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {loginedProfileData?.data?.taxes?.length > 0 && Number(loginedWaiter?.data?.can_see_tax) === 1 && (
                                    <div
                                        className="print-toggle-section mt-3 pt-3 d-flex justify-content-between align-items-center clickable-row"
                                        onClick={() => setTaxPrint(!taxPrint)}
                                    >
                                        <span className="toggle-label">Vergi ilə çap</span>
                                        <Form.Check
                                            type="switch"
                                            id="tax-print-switch"
                                            className="large-switch"
                                            checked={taxPrint}
                                            onChange={(e) => setTaxPrint(e.target.checked)}
                                        />
                                    </div>
                                )}

                                <div
                                    className="print-toggle-section mt-3 pt-3 d-flex justify-content-between align-items-center clickable-row"
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

                                {Number(remainingBalance) > 0 && (
                                    <div className="change-display">
                                        <span className="change-label">Qalıq:</span>
                                        <span className="change-amount">{remainingBalance} ₼</span>
                                    </div>
                                )}

                                <div className="action-buttons-section mt-auto">
                                    <button
                                        className="unpaid-mode-btn"
                                        onClick={() => {
                                            if (Number(loginedWaiter?.data?.can_close_without_payment) === 1) {
                                                setViewMode("UNPAID");
                                            } else {
                                                toast.error("İcazəniz yoxdur: Ödənişsiz bağlamaq hüququnuz yoxdur.");
                                            }
                                        }}
                                        style={{
                                            opacity: Number(loginedWaiter?.data?.can_close_without_payment) === 1 ? 1 : 0.5,
                                            cursor: Number(loginedWaiter?.data?.can_close_without_payment) === 1 ? 'pointer' : 'not-allowed'
                                        }}
                                    >
                                        Ödənişsiz bağla
                                    </button>
                                    <button
                                        className="confirm-close-btn green-btn"
                                        onClick={handleConfirmReady}
                                    >
                                        Bağla
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="payment-header d-flex justify-content-between align-items-center mb-4">
                                    <h2 className="payment-title">Ödənişsiz bağla</h2>
                                    <div className="total-amount-display strikethrough">
                                        <span className="amount">{calcTotal.sumTotal}</span>
                                        <span className="symbol">₼</span>
                                    </div>
                                </div>

                                <div className="unpaid-reasons gap-1 d-flex flex-column">
                                    {tagsListData.map((tag, index) => {
                                        const reasonName = tag.name || tag.text || `Reason ${index + 1}`;
                                        const isSelected = unpaidReason === reasonName;
                                        return (
                                            <div
                                                key={tag.id || index}
                                                className={`unpaid-reason-item d-flex justify-content-between align-items-center py-3 ${isSelected ? "active" : ""}`}
                                                onClick={() => setUnpaidReason(reasonName)}
                                            >
                                                <div className="d-flex align-items-center gap-3">
                                                    <div className={`custom-selection-indicator ${isSelected ? 'selected' : ''}`}>
                                                        {isSelected && <i className="bi bi-check-lg"></i>}
                                                    </div>
                                                    <span className="reason-label">{reasonName}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
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

                                <div className="action-buttons-section mt-auto">
                                    <button className="back-to-payment-btn" onClick={() => setViewMode("PAYMENT")}>
                                        Ödənişə qayıt
                                    </button>
                                    <button
                                        className="confirm-close-btn maroon-btn"
                                        onClick={handleConfirmReady}
                                    >
                                        Bağla
                                    </button>
                                </div>
                            </>
                        )}
                    </Col>
                </Row>
            </Container>

            <Modal
                show={showTaxSelectionModal}
                onHide={() => setShowTaxSelectionModal(false)}
                centered
                className="customers-modal tax-kassa-picker-modal"
                dialogClassName="checkover-tax-modal-wide tax-kassa-picker-dialog"
                backdrop="static"
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
                                <div style={{ fontSize: "12px", fontWeight: 500, opacity: 0.92, marginTop: "2px" }}>Çek bağlanışı</div>
                            </div>
                        </div>
                        <button type="button" className="btn-close-custom" onClick={() => setShowTaxSelectionModal(false)} aria-label="Bağla">
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
                                Bağlanan çek üçün vergi çeki seçdiyiniz kassada kəsiləcək.
                            </p>
                        </div>
                        <div className="tax-kassa-modal-list-wrap">
                            <div className="d-flex flex-column gap-3">
                                {(loginedProfileData?.data?.taxes || []).map((tax, idx) => {
                                    const taxKey = tax.id || `${tax.ip_addr}:${tax.port_addr}`;
                                    const localName = taxLocalNames[taxKey] || tax.tax_cash_type || "E-kassa";
                                    return (
                                        <div
                                            key={idx}
                                            role="button"
                                            tabIndex={0}
                                            className="tax-kassa-row"
                                            aria-label={`${localName}, ${tax.ip_addr}:${tax.port_addr}`}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    setShowTaxSelectionModal(false);
                                                    handleConfirmClose(tax);
                                                }
                                            }}
                                            onClick={() => {
                                                setShowTaxSelectionModal(false);
                                                handleConfirmClose(tax);
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
                            <button type="button" className="btn-imtina" onClick={() => setShowTaxSelectionModal(false)}>
                                İmtina
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default CheckOver;
