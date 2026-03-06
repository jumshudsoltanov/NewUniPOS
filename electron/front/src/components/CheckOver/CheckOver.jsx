import React, { useState, useMemo, useEffect } from 'react';
import { Container, Col, Row, Form, Modal } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Header from "../Header/Header";
import "./CheckOver.css";
import "../Customers-Modal/CustomersModal.css";
import { getTagsList } from '../../redux/Slices/TagsSlice';
import { getPaymentMethods } from '../../redux/Slices/PaymentMethodsSlice';
import { closeOrder, saveLog } from '../../redux/Slices/OrdersSlice';
import { printCustomerReceipt } from "../../utils/printerHelpers.jsx";
import { toast } from "sonner";
import axios from "axios";
import apiConfig, { localApi } from "../../utils/apiConfig";
import { addNotification } from "../../utils/notificationService";

const CheckOver = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [calcValue, setCalcValue] = useState("");

    // Payment State
    const [selectedMethods, setSelectedMethods] = useState([]); // [{id, name, amount, is_split}]

    const [viewMode, setViewMode] = useState("PAYMENT"); // 'PAYMENT' or 'UNPAID'
    const [printCheck, setPrintCheck] = useState(false);
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
    const { paymentMethods } = useSelector((state) => state.PaymentMethodsSlice);
    const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
    const { customers } = useSelector((state) => state.CustomersSlice);
    const dispatch = useDispatch();

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
                if (fetchedTags.length > 0) {
                    setUnpaidReason(fetchedTags[0].name || fetchedTags[0].text);
                }

                // Fetch payment methods
                const payRes = await dispatch(getPaymentMethods(profileId)).unwrap();
                if (payRes.data && payRes.data.length > 0) {
                    const cashMethod = payRes.data.find(m => m.name.toLowerCase().includes("nağd") || m.name.toLowerCase().includes("cash"));
                    const defaultMethod = cashMethod || payRes.data[0];
                    setSelectedMethods([{ ...defaultMethod, amount: "" }]);
                }
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

    const calcTotal = useMemo(() => {
        if (!currentOrder) return { total: 0, sumTotal: "0.00" };

        let total = 0;
        currentOrder.orders_items?.forEach((item) => {
            const count = Number(item.count || item.quantity || 0);
            const price = Number(item.price || 0);
            total += count * price;
        });

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
                serviceAmount = (total * serviceValue) / 100;
            } else {
                serviceAmount = serviceValue;
            }
        } else if (currentOrder.service_charge) {
            serviceAmount = Number(currentOrder.service_charge);
        }

        const depositAmount = Number(currentOrder.deposit || 0);
        let sumTotal = total - discountAmount + serviceAmount + depositAmount;
        if (sumTotal < 0) sumTotal = 0;

        return {
            total: total.toFixed(2),
            sumTotal: sumTotal.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            serviceAmount: serviceAmount.toFixed(2),
            depositAmount: depositAmount.toFixed(2)
        };
    }, [currentOrder]);

    useEffect(() => {
        if (currentOrder && Number(currentOrder.is_tax) === 1) {
            setTaxPrint(true);
        }
    }, [currentOrder?.is_tax]);

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

        const canSplit = selectedMethods.some(m => Number(m.is_split) === 1) || Number(method.is_split) === 1;

        if (canSplit && selectedMethods.length < 2) {
            const firstAmount = Number(selectedMethods[0]?.amount || (calcTotal.sumTotal / 2)).toFixed(2);
            const secondAmount = (Number(calcTotal.sumTotal) - Number(firstAmount)).toFixed(2);

            const newMethods = [
                { ...selectedMethods[0], amount: firstAmount },
                { ...method, amount: secondAmount }
            ];
            setSelectedMethods(newMethods);
        } else {
            setSelectedMethods([{ ...method, amount: "" }]);
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

    const handleConfirmReady = () => {
        const taxConfigs = loginedProfileData?.data?.taxes || [];
        if (viewMode === "PAYMENT" && taxPrint && taxConfigs.length > 1) {
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

        try {
            await dispatch(closeOrder({
                orderId: id,
                payments,
                status,
                profileId,
                waiterId,
                note: noteStr,
                waiterName,
                is_tax: viewMode === "PAYMENT" && taxPrint ? 1 : 0
            })).unwrap();

            // Persistent Log
            dispatch(saveLog({
                orderId: id,
                action: "Çek bağlandı",
                waiterName,
                details: noteStr ? `Bağlandı. Qeyd: ${noteStr}` : "Sifariş müvəffəqiyyətlə bağlandı"
            }));

            // Log Print if checked
            if (printCheck) {
                dispatch(saveLog({
                    orderId: id,
                    action: "Çek çap edildi",
                    waiterName,
                    details: "Bağlanış çeki"
                }));

                // Trigger actual print
                const paidValue = Number(calcValue) || totalPaidInMethods || 0;
                const changeValue = Number(remainingBalance) || 0;

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
                        waiter_name: waiterName
                    },
                    tableName: currentOrder?.table_name || "",
                    hallName: currentOrder?.hall_name || "",
                    waiterName
                }, loginedProfileData);
            }

            if (viewMode === "PAYMENT" && taxPrint) {
                const allTaxConfigs = loginedProfileData?.data?.taxes || [];
                const taxConfigsToUse = selectedTaxForPrint ? [selectedTaxForPrint] : allTaxConfigs;

                if (taxConfigsToUse.length > 0) {
                    try {
                        const saleItems = (currentOrder?.orders_items || []).map(item => ({
                            ...item,
                            name: item.product?.name || item.name || 'Məhsul',
                            count: item.count || 1,
                            price: item.price || 0
                        }));
                        const taxResult = await localApi.post('/tax/sale', {
                            taxConfigs: taxConfigsToUse,
                            saleData: {
                                items: saleItems,
                                payments,
                                cashierName: waiterName,
                                orderId: currentOrder?.id || id
                            }
                        });
                        if (taxResult.data?.success) {
                            toast.success('Vergi çeki kəsildi');
                            const firstSuccess = taxResult.data.results?.find(r => r.success && r.data);
                            if (firstSuccess?.data) {
                                const fd = firstSuccess.data;
                                localApi.patch(`/tax/save-fiscal/${id}`, {
                                    fiscal_id: fd.long_id || '',
                                    fiscal_doc_number: String(fd.document_number || ''),
                                    fiscal_short_id: fd.short_id || ''
                                }).catch(err => console.error('Save fiscal data error:', err));
                            }
                        } else {
                            toast.warning('Vergi çeki xətası');
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

            navigate("/tables");
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
                                                                        onChange={(e) => {
                                                                            const idx = selectedMethods.findIndex(m => m.id === method.id);
                                                                            handleAmountChange(idx, e.target.value);
                                                                        }}
                                                                        autoFocus
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

                                {loginedProfileData?.data?.taxes?.length > 0 && (
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

            <Modal show={showTaxSelectionModal} onHide={() => setShowTaxSelectionModal(false)} centered className="customers-modal" dialogClassName="checkover-tax-modal-wide" backdrop="static" animation={false}>
                <div className="modal-content-wrapper" style={{ borderRadius: '6px' }}>
                    <div className="customers-modal-header" style={{ background: '#5D99FF', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>
                        <div className="customers-header-content">
                            <div className="customers-icon-circle" style={{ borderRadius: '6px' }}>
                                <i className="bi bi-receipt"></i>
                            </div>
                            <div className="customers-modal-title">Kassa Seçimi</div>
                        </div>
                        <button className="btn-close-custom" onClick={() => setShowTaxSelectionModal(false)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <div className="customers-modal-body" style={{ padding: '24px', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px' }}>
                        <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '16px' }}>
                            Zəhmət olmasa təsdiqləmək üçün kassalardan birini seçin:
                        </p>
                        <div className="d-flex flex-column gap-3">
                            {(loginedProfileData?.data?.taxes || []).map((tax, idx) => {
                                const taxKey = tax.id || `${tax.ip_addr}:${tax.port_addr}`;
                                const localName = taxLocalNames[taxKey] || tax.tax_cash_type || 'E-kassa';
                                return (
                                    <div
                                        key={idx}
                                        style={{
                                            border: '1px solid #e2e8f0', background: '#fff', padding: '16px 20px',
                                            borderRadius: '6px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '16px',
                                            transition: 'all 0.2s ease-in-out'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#5D99FF';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(93, 153, 255, 0.15)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = '#e2e8f0';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                        onClick={() => {
                                            setShowTaxSelectionModal(false);
                                            handleConfirmClose(tax);
                                        }}
                                    >
                                        <div style={{ width: '48px', height: '48px', borderRadius: '6px', background: 'rgba(93, 153, 255, 0.1)', color: '#5D99FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                            <i className="bi bi-receipt"></i>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <h5 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', margin: '0 0 4px 0' }}>{localName}</h5>
                                            <span style={{ fontSize: '13px', color: '#64748b' }}>IP: {tax.ip_addr}:{tax.port_addr}</span>
                                        </div>
                                        <div style={{ marginLeft: 'auto', background: '#f8fafc', width: '36px', height: '36px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <i className="bi bi-chevron-right" style={{ color: '#5D99FF', fontSize: '16px', strokeWidth: 1 }}></i>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default CheckOver;
