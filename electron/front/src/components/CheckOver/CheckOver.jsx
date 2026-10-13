import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Container, Col, Row, Form, Modal } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Header from "../Header/Header";
import "./CheckOver.css";
import "../Checks/TaxCashPickerModal.css";
import "../Customers-Modal/CustomersModal.css";
import { getTagsList } from "../../redux/Slices/TagsSlice";
import { getPaymentMethods } from "../../redux/Slices/PaymentMethodsSlice";
import { closeOrder, saveLog } from "../../redux/Slices/OrdersSlice";
import { removeOrderOptimisticFromTables } from "../../redux/Slices/TablesSlice";
import { removeOrderOptimistic } from "../../redux/Slices/BooksSlice";
import { printCustomerReceipt, printBankReceipt } from "../../utils/printerHelpers.jsx";
import { toast } from "sonner";
import _axios from "axios";
import apiConfig, { getSocket, TAX_HTTP_TIMEOUT_MS } from "../../utils/apiConfig";
import { addNotification } from "../../utils/notificationService";
import { getModifiersTotalPerUnit, mapOrderPaymentForTax, isTimerItem, getOrderItemLineTotal, computeTimerItemTotal as _computeTimerItemTotal, getTimerElapsedSeconds as _getTimerElapsedSeconds } from "../../utils/orderItemLineTotal";
import { isPacksOnlyWaiter } from "../../utils/waiterPermissions";
import { isPosBlocked, isPaymentExpired } from "../../utils/dateHelpers";
import VirtualKeyboard from "../VirtualKeyboard/VirtualKeyboard";
import RoomChargeModal from "../RoomChargeModal/RoomChargeModal";
import { updateFolioBalance, fetchRooms } from "../../redux/Slices/HotelSlice";
import { t } from "../../utils/translations";
import { getCurrencySymbol } from "../../utils/formatPrice";
import { getPartialPaidTotal, getItemPaymentsList, getItemPaymentShares } from "../../utils/itemPayments";
import { isNoServiceFeeItem } from "../../utils/serviceFeeRules";

const CheckOver = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { id } = useParams();
    const [calcValue, setCalcValue] = useState("");
    const [isClosing, setIsClosing] = useState(false);

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

    const [showRoomCharge, setShowRoomCharge] = useState(false);
    const [roomChargeMethod, setRoomChargeMethod] = useState(null);

    // Virtual Keyboard logic
    const [activeInputMode, setActiveInputMode] = useState(null); // 'comment' or 'split-0', 'split-1'
    const posKeyboardEnabled = useMemo(() => {
        try {
            return localStorage.getItem("pos_keyboard_enabled") === "1";
        } catch {
            return false;
        }
    }, []);

    // Fetch tax names
    useEffect(() => {
        const stored = localStorage.getItem("tax_local_names");
        if (stored) {
            try { setTaxLocalNames(JSON.parse(stored)); } catch { /* nəzərə alınmır */ }
        }
    }, []);

    const { books } = useSelector((state) => state.BooksSlice);
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);
    const { menu: menuCatalog } = useSelector((state) => state.OrderSlice);

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
            toast.error(t("i̇cazeniz_yoxdur_cek_baglamaq_huququnuz_yoxdur"));
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

    const { orders: reduxOrder } = useSelector((state) => state.OrderSlice);

    const currentOrder = useMemo(() => {
        if (reduxOrder && reduxOrder.uuid === id) {
            return reduxOrder;
        }
        if (!books?.data) return null;
        return books.data.find(o => o.uuid === id);
    }, [books, reduxOrder, id]);

    const calcTotal = useMemo(() => {
        if (!currentOrder) return { total: "0.00", sumTotal: "0.00", discountAmount: "0.00", serviceAmount: "0.00", depositAmount: "0.00" };

        const normalizeMoney = (value) => {
            const n = Number(value || 0);
            const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
            return Math.abs(rounded) < 0.005 ? 0 : rounded;
        };

        let total = 0;
        let totalForService = 0;
        let totalForDiscount = 0;
        const _hasProductTimer = (currentOrder.orders_items || []).some(it => isTimerItem(it, menuCatalog || []));

        currentOrder.orders_items?.forEach((item) => {
            const count = Number(item.count || item.quantity || 0);
            const price = Number(item.price || 0);
            const modifiersPerUnit = getModifiersTotalPerUnit(item);
            const isTimer = isTimerItem(item, menuCatalog || []);

            // Baza məbləğ (taymersiz) — endirim və xidmət haqqı yalnız bundan hesablanır.
            // Çek ekranı (CheckBottom) və masa kartı ilə eyni qayda; əvvəl burada taymer
            // məbləği də servisə daxil edilirdi və ödəniş ekranı çekdən fərqli cəm göstərirdi.
            const baseTotal = count * (price + modifiersPerUnit);
            const itemTotal = isTimer ? getOrderItemLineTotal(item, currentOrder) : baseTotal;
            total += itemTotal;
            totalForDiscount += baseTotal;

            // Ortaq qayda — çek ekranı ilə eyni nəticə verir (bax: serviceFeeRules.js).
            const isNoService = isNoServiceFeeItem(item, menuCatalog);
            if (!isNoService) {
                totalForService += baseTotal;
            }
        });

        const effH = Number(currentOrder.table?.hourly_price || 0);
        if (effH > 0) {
            let totalSeconds = 0;
            if (currentOrder.is_timer_clock && String(currentOrder.is_timer_clock).includes(':')) {
                const parts = currentOrder.is_timer_clock.split(':').map(Number);
                if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else {
                totalSeconds = parseInt(currentOrder.is_timer_clock || "0", 10);
            }
            total += (effH / 3600) * totalSeconds;
        }
        total = normalizeMoney(total);
        totalForDiscount = normalizeMoney(Math.max(0, totalForDiscount));
        totalForService = normalizeMoney(Math.max(0, totalForService));

        const discountValueRaw = currentOrder.discount_value;
        const hasExplicitDiscountValue = discountValueRaw !== null && discountValueRaw !== undefined;
        const discountValue = Number(discountValueRaw || 0);
        const discountType = currentOrder.discount_type || "percent";
        let discountAmount = 0;

        if (discountValue > 0) {
            if (discountType === "percent") {
                discountAmount = (totalForDiscount * discountValue) / 100;
            } else {
                discountAmount = discountValue;
            }
        } else if (!hasExplicitDiscountValue && Number(currentOrder.discount) > 0) {
            discountAmount = Number(currentOrder.discount);
        }
        discountAmount = normalizeMoney(Math.min(discountAmount, total));

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
        serviceAmount = normalizeMoney(serviceAmount);

        const depositAmount = normalizeMoney(Number(currentOrder.deposit || 0));
        const deliveryFee = normalizeMoney(Number(currentOrder.delivery_fee || 0));
        
        const baseTotal = normalizeMoney(total - discountAmount + serviceAmount);
        let fullTotal = normalizeMoney(Math.max(baseTotal, depositAmount) + deliveryFee);
        if (fullTotal < 0) fullTotal = 0;
        // Məhsul üzrə əvvəlcədən ödənilənlər çıxılır — sumTotal artıq ÖDƏNİLMƏLİ qalıqdır
        const partialPaid = Math.min(getPartialPaidTotal(currentOrder), fullTotal);
        const sumTotal = normalizeMoney(Math.max(0, fullTotal - partialPaid));

        return {
            total: total.toFixed(2),
            sumTotal: sumTotal.toFixed(2),
            fullTotal: fullTotal.toFixed(2),
            partialPaid: partialPaid.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            serviceAmount: serviceAmount.toFixed(2),
            depositAmount: depositAmount.toFixed(2)
        };
    }, [currentOrder, menuCatalog]);

    // Auto-select payment method (only when POS is blocked + auto mode)
    const autoSelectedRef = useRef(false);
    useEffect(() => {
        if (viewMode !== "PAYMENT" || autoSelectedRef.current || paymentMethods.length === 0) return;

        // Yalnız POS blok vəziyyətində işləsin
        const profile = loginedProfileData?.data?.profile;
        if (!profile) return;
        const isBlocked = isPosBlocked(profile.is_pos_block) || isPaymentExpired(profile.next_payment_date);
        if (!isBlocked) return;

        const autoEnabled = localStorage.getItem("pos_auto_payment_enabled") === "true";
        if (!autoEnabled) return;

        // İlk ödəniş üsulunu seç (adətən Nəğd)
        const defaultMethod = paymentMethods[0];
        if (defaultMethod) {
            setSelectedMethods([{ ...defaultMethod, amount: calcTotal.sumTotal }]);
            autoSelectedRef.current = true;
        }
    }, [viewMode, paymentMethods, calcTotal.sumTotal]);

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

    // is_tax=1 olan ödəniş üsulu seçiləndə vergi çekini yandır (söndürmə — yalnız əl ilə)
    useEffect(() => {
        if (Number(loginedWaiter?.data?.can_see_tax) !== 1 || viewMode !== "PAYMENT") return;
        if (selectedMethods.some(m => Number(m.is_tax) === 1)) {
            setTaxPrint(true);
        }
    }, [viewMode, selectedMethods, loginedWaiter?.data?.can_see_tax]);

    const isHotelMode = Number(loginedProfileData?.data?.profile?.is_hotel_mode) === 1;
    const { rooms: hotelRooms } = useSelector((state) => state.HotelSlice);

    const handleRoomCharge = (room) => {
        const method = {
            id: `room_${room.id}`,
            name: `Otağa Yaz - ${room.room_number}`,
            type: 'room',
            amount: calcTotal.sumTotal,
            is_tax: 0,
            is_split: 0,
            room_id: room.id,
            room_number: room.room_number,
        };
        setSelectedMethods([method]);
        setShowRoomCharge(false);
        setRoomChargeMethod(method);
    };

    const handleMethodSelect = (method) => {
        // Clear room charge if a regular method is selected
        if (roomChargeMethod) {
            setRoomChargeMethod(null);
        }
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
        if (activeInputMode?.startsWith("split-")) {
            const index = parseInt(activeInputMode.split("-")[1]);
            const currentObj = selectedMethods[index];
            if (!currentObj) return;
            const currentAmount = String(currentObj.amount || "");
            if (val === "." && currentAmount.includes(".")) return;
            handleAmountChange(index, currentAmount + val);
        } else {
            if (val === "." && calcValue.includes(".")) return;
            setCalcValue(prev => prev + val);
        }
    };

    const handleDelete = () => {
        if (activeInputMode?.startsWith("split-")) {
            const index = parseInt(activeInputMode.split("-")[1]);
            const currentObj = selectedMethods[index];
            if (!currentObj) return;
            const currentAmount = String(currentObj.amount || "");
            handleAmountChange(index, currentAmount.slice(0, -1));
        } else {
            setCalcValue(prev => prev.slice(0, -1));
        }
    };

    const handleVirtualKeyboardKeyPress = (key) => {
        if (activeInputMode === "comment") {
            setComment((prev) => prev + key);
        } else if (activeInputMode?.startsWith("split-")) {
            if (!/^[0-9.]$/.test(key)) return;
            handleNumClick(key);
        }
    };

    const handleVirtualKeyboardBackspace = () => {
        if (activeInputMode === "comment") {
            setComment((prev) => prev.slice(0, -1));
        } else if (activeInputMode?.startsWith("split-")) {
            handleDelete();
        }
    };

    const numpadButtons = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "DEL"];

    const totalPaidInMethods = useMemo(() => {
        return selectedMethods.reduce((sum, m) => sum + Number(m.amount || 0), 0);
    }, [selectedMethods]);

    const remainingBalance = useMemo(() => {
        const paid = Number(calcValue || totalPaidInMethods || 0);
        const toPay = Number(calcTotal.sumTotal);
        const diff = paid - toPay;
        return diff > 0 ? diff.toFixed(2) : "0.00";
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
            toast.error(t("zehmet_olmasa_odenis_usulunu_secin"));
            return;
        }
        if (viewMode === "UNPAID" && !unpaidReason) {
            toast.error(t("zehmet_olmasa_odenissiz_baglanis_sebebini_secin"));
            return;
        }
        if (viewMode === "PAYMENT") {
            const paid = roomChargeMethod
                ? Number(totalPaidInMethods)
                : Number(calcValue || totalPaidInMethods || 0);
            const toPay = Number(calcTotal.sumTotal);
            
            const paidFixed = Number(paid.toFixed(2));
            const toPayFixed = Number(toPay.toFixed(2));

            if (paidFixed < toPayFixed) {
                toast.error(`Ödəniş çatışmır! ${(toPayFixed - paidFixed).toFixed(2)} ₼ əskikdir`);
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
        if (isClosing) return; // Təkrar klik: eyni çeki paralel bağlama sorğuları göndərmənin qarşısını alır
        const profileId = loginedProfileData?.data?.profile?.id;
        const waiterId = currentOrder?.waiter_id || loginedWaiter?.data?.id;
        const waiterName = loginedWaiter?.data?.name || loginedWaiter?.name || loginedProfileData?.data?.profile?.name || currentOrder?.waiter?.name || t("unknown");

        if (!profileId || !waiterId || !id) return;
        setIsClosing(true);

        let payments = [];
        let status = 2; // Closed
        let noteStr = comment;

        if (viewMode === "PAYMENT") {
            payments = selectedMethods.map(m => ({
                payment_method_id: m.id,
                name: m.name,
                type: m.type,
                amount: selectedMethods.length === 1 ? calcTotal.sumTotal : (Number(m.amount) || 0),
                ...(m.room_id ? { room_id: m.room_id, room_number: m.room_number } : {})
            }));
            if (payments.length === 0 && paymentMethods && paymentMethods.length > 0) {
                const def = paymentMethods[0];
                payments = [{
                    payment_method_id: def.id,
                    name: def.name,
                    type: def.type,
                    amount: calcTotal.sumTotal
                }];
            }
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

        // Fiskal çek/qəbz bütün çek üçün kəsilir: əvvəlki qismən ödənişlər də daxil edilir
        const partialPaymentsAll = [];
        {
            const grouped = new Map();
            getItemPaymentsList(currentOrder).forEach((row) => {
                getItemPaymentShares(row).forEach((p) => {
                    const key = `${p.payment_method_id}|${p.name || ""}`;
                    const cur = grouped.get(key) || {
                        payment_method_id: p.payment_method_id,
                        name: p.name,
                        type: (paymentMethods || []).find((pm) => Number(pm.id) === Number(p.payment_method_id))?.type,
                        amount: 0,
                    };
                    cur.amount += parseFloat(p.amount) || 0;
                    grouped.set(key, cur);
                });
            });
            grouped.forEach((g) => partialPaymentsAll.push({ ...g, amount: Math.round(g.amount * 100) / 100 }));
        }
        const paymentsAll = [...partialPaymentsAll, ...payments];

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

        // Müştərini gözlətməmək üçün UI-ı DƏRHAL (server cavabını gözləmədən) yeniləyib
        // masalara qayıdırıq — çekin silinməsindəki eyni optimistik yanaşma. Əsl bağlama
        // sorğusu, loglar və çap arxa planda davam edir; uğursuz olarsa aşağıdakı catch-də
        // xəbərdarlıq göstərilir.
        dispatch(removeOrderOptimisticFromTables(currentOrder?.uuid || id));
        dispatch(removeOrderOptimistic(currentOrder?.uuid || id));
        {
            const socket = getSocket();
            if (socket?.connected) {
                socket.emit("order_closed", { orderId: currentOrder?.uuid || id });
            }
        }
        const isPacksOnly = isPacksOnlyWaiter(loginedWaiter?.data);
        navigate(isPacksOnly ? "/checks" : "/tables");

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

            // Hotel room charge: update folio_balance
            if (roomChargeMethod?.room_id && profileId) {
                const checkTotal = Number(calcTotal.sumTotal || 0);
                const roomData = hotelRooms.find(r => Number(r.id) === Number(roomChargeMethod.room_id));
                const currentBalance = Number(roomData?.folio_balance || 0);
                try {
                    await dispatch(updateFolioBalance({
                        roomId: roomChargeMethod.room_id,
                        profileId,
                        balance: currentBalance + checkTotal
                    })).unwrap();
                    dispatch(fetchRooms(profileId));
                } catch (err) {
                    console.error("Folio balance update error:", err);
                }
            }

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
                                const reduxTaxType = loginedProfileData?.data?.profile?.tax_type;
                                const localTaxType = (() => { try { return JSON.parse(localStorage.getItem("profile") || "{}")?.tax_type; } catch { return null; } })();
                                const profileTaxType = reduxTaxType ?? localTaxType;
                                console.log('[TAX vatType] redux tax_type:', reduxTaxType, '| localStorage tax_type:', localTaxType, '| used vatType:', profileTaxType);
                                const saleItems = (currentOrder?.orders_items || [])
                                    .filter((item) => Number(item.count ?? item.quantity ?? 0) > 0)
                                    .map((item) => {
                                        const unitBase = Number(item.price || 0);
                                        const unitWithMods = unitBase + getModifiersTotalPerUnit(item);
                                        return {
                                            ...item,
                                            name: item.product?.name || item.name || 'Məhsul',
                                            count: Number(item.count ?? item.quantity ?? 1),
                                            price: unitWithMods,
                                            ...(profileTaxType != null && profileTaxType !== ''
                                                ? { vatType: Number(profileTaxType) }
                                                : {}),
                                        };
                                    });
                        if (saleItems.length === 0) {
                            toast.warning(t("fiskal_cek_ucun_mehsul_siyahisi_bosdur_gonderilmedi"));
                        } else {
                            // Call tax sale API in the background (as requested: do not wait for fiscal device)
                            let paymentsForTax;
                            try {
                                paymentsForTax = paymentsAll.map((m) =>
                                    mapOrderPaymentForTax({
                                        payment_method_id: m?.payment_method_id,
                                        without_payment_method_id: m?.without_payment_method_id,
                                        payment_method: { name: m?.name, type: m?.type },
                                        paid: m?.amount,
                                    })
                                );
                            } catch (mapErr) {
                                console.error('Fiskal ödəniş xəritəsi:', mapErr);
                                paymentsForTax = paymentsAll;
                            }
                            const isCardOrBankTaxPayment = paymentsForTax.some((p) => {
                                const type = String(p?.type || '').toLowerCase();
                                return (
                                    type === 'nagdsiz' ||
                                    type === 'cashless' ||
                                    type === 'card' ||
                                    type === 'bank'
                                );
                            });
                            const taxOrderTotal = Number(calcTotal.fullTotal) || 0;
                            const minCardTaxAmount = 0; // DATAPAY üçün minimumu cihaz özü idarə etsin.
                            if (isCardOrBankTaxPayment && taxOrderTotal > 0 && taxOrderTotal < minCardTaxAmount) {
                                const msg = 'DATAPAY kart/bank fiskal çeki üçün məbləğ çox kiçikdir. Minimum 0.10 AZN ilə test edin.';
                                toast.warning(msg);
                                addNotification('Fiskal Çek Xətası', msg, { category: 'system', type: 'warning' });
                                return;
                            }
                            apiConfig.post('/tax/sale', {
                                taxConfigs: taxConfigsToUse,
                                saleData: {
                                    items: saleItems,
                                    payments: paymentsForTax,
                                    cashierName: waiterName,
                                    orderId: currentOrder?.id || id,
                                    serviceFee: Number(calcTotal.serviceAmount) || 0,
                                    ...(Number(calcTotal.discountAmount) > 0 ? { discountAmount: Number(calcTotal.discountAmount) } : {}),
                                    deliveryFee: Number(currentOrder?.delivery_fee) || 0,
                                    orderTotal: taxOrderTotal
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
                                        if (fd.bank_receipt) {
                                            printBankReceipt(fd.bank_receipt, { orderId: currentOrder?.id || id }, loginedProfileData)
                                                .catch(err => console.error('Bank receipt print error:', err));
                                        }
                                    }
                                } else {
                                    const errDetails = results.map(r => r.error).filter(Boolean).join('; ') || 'Vergi çeki kəsilə bilmədi';
                                    const isConn = /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ENETUNREACH/i.test(errDetails);
                                    const shortMsg = isConn
                                        ? 'Vergi cihazı (DATAPAY) şəbəkədə əlçatmazdır. IP, port 2222 və cihazda servis işlədiyini yoxlayın.'
                                        : errDetails;
                                    addNotification('Fiskal Çek Xətası', shortMsg, { category: 'system', type: 'error' });
                                }
                            }).catch(taxErr => {
                                console.error('Tax sale error:', taxErr);
                                const errMsg = taxErr.response?.data?.message || taxErr.message;
                                const isConn = /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ENETUNREACH/i.test(String(errMsg));
                                const shortMsg = isConn
                                    ? 'Vergi cihazı (DATAPAY) şəbəkədə əlçatmazdır. IP, port 2222 və cihazda servis işlədiyini yoxlayın.'
                                    : errMsg;
                                addNotification('Fiskal Çek Xətası', shortMsg, { category: 'system', type: 'error' });
                            });
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
                        total: calcTotal.fullTotal,
                        payments: paymentsAll,
                        paidAmount: paidValue,
                        change: changeValue,
                        customer_name: selectedCustomer?.name || currentOrder?.customer_name || "",
                        customer_phone: selectedCustomer?.phone || currentOrder?.customer_phone || currentOrder?.customer?.phone || "",
                        customer_address: selectedCustomer?.address || currentOrder?.customer_address || currentOrder?.customer?.address || "",
                        waiter_name: orderWaiter
                    },
                    tableName: receiptTableName,
                    hallName: receiptHallName,
                    hall: currentOrder?.table?.hall,
                    waiterName,
                    menuCatalog,
                }, loginedProfileData, { dispatch, loginedWaiter }).catch(err => {
                    console.error("Background print failed:", err);
                });
            }
        } catch (err) {
            console.error("Close order failed:", err);
            const errMsg = err?.response?.data?.message || err?.message || t("namelum_xeta");
            toast.error(`Çek bağlana bilmədi: ${errMsg}`);
            setIsClosing(false);
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
                                placeholder={t("meblegi_daxil_edin")}
                                value={calcValue}
                                readOnly
                                onFocus={() => setActiveInputMode(null)}
                            />
                            <span className="currency-symbol">{getCurrencySymbol()}</span>
                        </div>

                        {Number(calcTotal.partialPaid) > 0 && (
                            <div className="mb-2 text-success" style={{ fontSize: 13, fontWeight: 600 }}>
                                Məhsul üzrə əvvəl ödənilib: {calcTotal.partialPaid} {getCurrencySymbol()} (çekin cəmi {calcTotal.fullTotal} {getCurrencySymbol()})
                            </div>
                        )}
                        <div className="calc-info-grid mb-4">
                            <div className="calc-info-card">
                                <span className="label">{t("odenilmeli")}</span>
                                <span className="value">{calcTotal.sumTotal} {getCurrencySymbol()}</span>
                            </div>
                            <div className="calc-info-card highlighted">
                                <span className="label">{t("odenilen")}</span>
                                <span className="value">{(Number(calcValue) || totalPaidInMethods || 0).toFixed(2)} {getCurrencySymbol()}</span>
                            </div>
                            <div className={`calc-info-card ${Number(remainingBalance) >= 0 ? 'positive' : 'negative'}`}>
                                <span className="label">{t("qaliq")}</span>
                                <span className="value">{remainingBalance} {getCurrencySymbol()}</span>
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
                                        <h2 className="payment-title">{t("odenilmeli")}</h2>
                                        {selectedCustomer && (
                                            <div className="customer-info-tag">
                                                <i className="bi bi-person-fill me-1"></i>
                                                {selectedCustomer.name} {selectedCustomer.group ? `(${selectedCustomer.group.name})` : ''}
                                            </div>
                                        )}
                                    </div>
                                    <div className="total-amount-display">
                                        <span className="amount">{calcTotal.sumTotal}</span>
                                        <span className="symbol">{getCurrencySymbol()}</span>
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
                                                                        onFocus={() => setActiveInputMode(`split-${idx}`)}
                                                                        autoFocus={idx === 0}
                                                                    />
                                                                    <span className="currency-sym">{getCurrencySymbol()}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="method-amount">
                                                                    <span>{isSelected.amount || calcTotal.sumTotal}</span>
                                                                    <span className="symbol">{getCurrencySymbol()}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {isHotelMode && (
                                    <div
                                        className="payment-method-item room-charge-btn mt-3"
                                        style={{
                                            border: roomChargeMethod ? '2px solid #F59E0B' : undefined,
                                            background: roomChargeMethod ? '#FFFBEB' : undefined,
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => setShowRoomCharge(true)}
                                    >
                                        <div className="d-flex align-items-center gap-3">
                                            <div className={`custom-selection-indicator ${roomChargeMethod ? 'selected' : ''}`}>
                                                {roomChargeMethod && <i className="bi bi-check-lg"></i>}
                                            </div>
                                            <span className="method-name">{t("otaga_yaz")}</span>
                                        </div>
                                        {roomChargeMethod && (
                                            <div className="method-right-content">
                                                <div className="method-amount">
                                                    <span style={{ fontSize: '12px', color: '#F59E0B', marginRight: '8px' }}>
                                                        {roomChargeMethod.room_number}
                                                    </span>
                                                    <span>{roomChargeMethod.amount || calcTotal.sumTotal}</span>
                                                    <span className="symbol">{getCurrencySymbol()}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {loginedProfileData?.data?.taxes?.length > 0 && Number(loginedWaiter?.data?.can_see_tax) === 1 && (
                                    <div
                                        className="print-toggle-section mt-3 pt-3 d-flex justify-content-between align-items-center clickable-row"
                                        onClick={() => setTaxPrint(!taxPrint)}
                                    >
                                        <span className="toggle-label">{t("vergi_ile_cap")}</span>
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
                                    <span className="toggle-label">{t("ceki_cap_et")}</span>
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
                                        <span className="change-label">{t("qaliq_1")}</span>
                                        <span className="change-amount">{remainingBalance} {getCurrencySymbol()}</span>
                                    </div>
                                )}

                                <div className="action-buttons-section mt-auto">
                                    <button
                                        className="unpaid-mode-btn"
                                        onClick={() => {
                                            if (Number(loginedWaiter?.data?.can_close_without_payment) === 1) {
                                                setViewMode("UNPAID");
                                            } else {
                                                toast.error(t("i̇cazeniz_yoxdur_odenissiz_baglamaq_huququnuz_yoxdur"));
                                            }
                                        }}
                                        style={{
                                            opacity: Number(loginedWaiter?.data?.can_close_without_payment) === 1 ? 1 : 0.5,
                                            cursor: Number(loginedWaiter?.data?.can_close_without_payment) === 1 ? 'pointer' : 'not-allowed'
                                        }}
                                    >{t("odenissiz_bagla")}</button>
                                    <button
                                        className="confirm-close-btn green-btn"
                                        onClick={handleConfirmReady}
                                        disabled={isClosing}
                                        style={{ opacity: isClosing ? 0.6 : 1, cursor: isClosing ? 'not-allowed' : 'pointer' }}
                                    >{isClosing ? '...' : t("bagla")}</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="payment-header d-flex justify-content-between align-items-center mb-4">
                                    <h2 className="payment-title">{t("odenissiz_bagla")}</h2>
                                    <div className="total-amount-display strikethrough">
                                        <span className="amount">{calcTotal.sumTotal}</span>
                                        <span className="symbol">{getCurrencySymbol()}</span>
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
                                        placeholder={t("ceke_serh_yaz_1")}
                                        className="comment-textarea"
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        onFocus={() => setActiveInputMode("comment")}
                                    />
                                </div>

                                <div
                                    className="print-toggle-section mt-4 pt-3 d-flex justify-content-between align-items-center clickable-row"
                                    onClick={() => setPrintCheck(!printCheck)}
                                >
                                    <span className="toggle-label">{t("ceki_cap_et")}</span>
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
                                        {t("odenise_qayit")}
                                    </button>
                                    <button
                                        className="confirm-close-btn maroon-btn"
                                        onClick={handleConfirmReady}
                                        disabled={isClosing}
                                        style={{ opacity: isClosing ? 0.6 : 1, cursor: isClosing ? 'not-allowed' : 'pointer' }}
                                    >{isClosing ? '...' : t("bagla")}</button>
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
                                <div className="customers-modal-title">{t("kassa_secimi")}</div>
                                <div style={{ fontSize: "12px", fontWeight: 500, opacity: 0.92, marginTop: "2px" }}>{t("cek_baglanisi")}</div>
                            </div>
                        </div>
                        <button type="button" className="btn-close-custom" onClick={() => setShowTaxSelectionModal(false)} aria-label={t("bagla")}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <div className="tax-kassa-modal-body-inner">
                        <div className="tax-kassa-modal-intro">
                            <p className="tax-kassa-modal-intro-title">{t("hansi_vergi_kassasina_gondermek_isteyirsiniz")}</p>
                            <p className="tax-kassa-modal-intro-sub">{t("baglanan_cek_ucun_vergi_ceki_secdiyiniz_kassada_kesilecek")}</p>
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
                            <button type="button" className="btn-imtina" onClick={() => setShowTaxSelectionModal(false)}>{t("i̇mtina")}</button>
                        </div>
                    </div>
                </div>
            </Modal>

            <RoomChargeModal
                show={showRoomCharge}
                onHide={() => setShowRoomCharge(false)}
                onSelect={handleRoomCharge}
                profileId={loginedProfileData?.data?.profile?.id}
            />

            {posKeyboardEnabled && activeInputMode && (
                <VirtualKeyboard
                    onKeyPress={handleVirtualKeyboardKeyPress}
                    onBackspace={handleVirtualKeyboardBackspace}
                    onClose={() => setActiveInputMode(null)}
                />
            )}
        </div>
    );
};

export default CheckOver;
