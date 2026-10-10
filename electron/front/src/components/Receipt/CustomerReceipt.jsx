import React from "react";
import QRCode from "react-qr-code";
import {
    findCatalogProduct,
    getDisplayProductName,
    resolveModifiersForDisplay,
} from "../../utils/orderItemDisplayHelpers";
import { getCustomerFacingServiceFeeLabel } from "../../utils/posOperationNames";
import { t } from "../../utils/translations";
import { getCurrencySymbol } from "../../utils/formatPrice";
import { getOrderItemLineTotal, getTimerElapsedSeconds } from "../../utils/orderItemLineTotal";

const CustomerReceipt = ({
    orderedItems,
    checkData,
    profileData,
    tableName,
    hallName,
    hall,
    previewSettings,
    menuCatalog,
}) => {
    const terminalInfo = profileData?.data?.terminal || {};
    const filialName = profileData?.data?.profile?.restaurant_name ||
        profileData?.data?.profile?.company_name ||
        terminalInfo?.filial ||
        "RESTORAN";

    const address = profileData?.data?.profile?.address || "";
    const phone = profileData?.data?.profile?.phone || "";

    const validLogo = (logo) => logo && logo !== "null" && logo !== "undefined" && logo !== "data:directory;base64,";

    let logoSrc = null;
    if (validLogo(terminalInfo?.logoPrint)) {
        logoSrc = terminalInfo.logoPrint.startsWith("http") || terminalInfo.logoPrint.startsWith("data:")
            ? terminalInfo.logoPrint
            : `http://46.224.8.157:35627/${terminalInfo.logoPrint}`;
    } else if (validLogo(profileData?.data?.profile?.logo)) {
        logoSrc = profileData.data.profile.logo.startsWith("http") || profileData.data.profile.logo.startsWith("data:")
            ? profileData.data.profile.logo
            : `http://46.224.8.157:35627/${profileData.data.profile.logo}`;
    }

    // Diqqət: əvvəl burada `` `...${username}` || "https://unipos.tech" `` yazılmışdı.
    // Şablon sətri HƏMİŞƏ doğrudur, ona görə ehtiyat ünvan heç vaxt işləmirdi:
    // username boş olanda müştəri çekinə `?r=undefined` olan YANLIŞ QR çap olunurdu.
    const menuUsername = terminalInfo?.username;
    const qrCodeValue = menuUsername
        ? `https://menu.unipos.tech/?r=${encodeURIComponent(menuUsername)}`
        : "https://unipos.tech";

    if (!checkData || !orderedItems)
        return <div style={{ padding: "16px", fontFamily: "sans-serif" }}>{t("loading")}</div>;

    const formatLocalDate = (dateStr) => {
        if (!dateStr) return "—";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return String(dateStr).slice(0, 16);
        // Azerbaijan vaxt zonası ilə formatla (UTC+4)
        const bakuOffset = 4 * 60; // +4 saat dəqiqə ilə
        const utc = d.getTime() + d.getTimezoneOffset() * 60000;
        const baku = new Date(utc + bakuOffset * 60000);
        const yy = baku.getFullYear();
        const mm = String(baku.getMonth() + 1).padStart(2, "0");
        const dd = String(baku.getDate()).padStart(2, "0");
        const hh = String(baku.getHours()).padStart(2, "0");
        const mi = String(baku.getMinutes()).padStart(2, "0");
        return `${dd}.${mm}.${yy} ${hh}:${mi}`;
    };

    const now = new Date();
    const currentTime = formatLocalDate(now);

    let localSettings = {};
    try {
        localSettings = JSON.parse(localStorage.getItem("pos_receipt_settings"))?.customer || {};
    } catch (e) { }
    const isReceiptPreview =
        previewSettings != null && typeof previewSettings === "object";
    if (isReceiptPreview) localSettings = previewSettings;

    const profileReceiptBump = Number(
        terminalInfo?.customer_receipt ??
        profileData?.data?.customer_receipt ??
        profileData?.data?.profile?.customer_receipt ??
        0,
    );

    let baseFont;
    if (isReceiptPreview) {
        baseFont = Math.round(Number(previewSettings.fontSizeOffset ?? 0));
    } else if (
        localSettings.fontSizeOffset !== undefined &&
        localSettings.fontSizeOffset !== null &&
        String(localSettings.fontSizeOffset).trim() !== ""
    ) {
        baseFont = Math.round(Number(localSettings.fontSizeOffset));
    } else {
        baseFont = Math.round(Number(profileReceiptBump));
    }
    if (!Number.isFinite(baseFont)) baseFont = 0;

    /** fontSizeOffset (-5…5) — hər addım üçün daha görünən fərq (çap + önizləmə). */
    const fs = (baseSize) => {
        const extra = baseFont * 4;
        return `${Math.max(4, baseSize + extra)}px`;
    };

    const isVisible = (key, defaultVal = true) => {
        if (localSettings[key] !== undefined) return localSettings[key];
        return defaultVal;
    };

    const isQrHidden = !isVisible("showQrCode", Number(terminalInfo?.qr_on_check) !== 1);
    const showLogo = isVisible("showLogo", true);
    const showAddress = isVisible("showAddress", true);
    const showPhone = isVisible("showPhone", true);
    const showCheckNumber = isVisible("showCheckNumber", true);
    const showCustomer = isVisible("showCustomer", true);
    const showCustomerPhone = isVisible("showCustomerPhone", true);
    const showCustomerAddress = isVisible("showCustomerAddress", true);
    const showTags = isVisible("showTags", true);
    const showHallTable = isVisible("showHallTable", true);
    const showDates = isVisible("showDates", true);
    const showPrintDate = isVisible("showPrintDate", true);
    const showWaiter = isVisible("showWaiter", true);
    const showGuestCount = isVisible("showGuestCount", true);
    const showSaleType = isVisible("showSaleType", true);
    const customFooterText = localSettings.footerText !== undefined && localSettings.footerText !== "" ? localSettings.footerText : "Təşəkkür edirik!";
    const fontFamily = localSettings.fontFamily || "'Consolas', 'Courier New', 'Lucida Console', monospace";
    const padTop = localSettings.paddingTop ?? 0;
    const padBottom = localSettings.paddingBottom ?? 0;
    const padLeft = localSettings.paddingLeft ?? 0;
    const padRight = localSettings.paddingRight ?? 0;

    const styles = {
        receipt: {
            width: "100%",
            boxSizing: "border-box",
            padding: `${padTop}px ${2 + padRight}px ${padBottom}px ${2 + padLeft}px`,
            margin: "0",
            background: "#fff",
            fontFamily: fontFamily,
            fontSize: fs(12),
            color: "#000",
            fontWeight: "500",
        },
        header: { textAlign: "center" },
        restaurantName: {
            fontSize: fs(16),
            fontWeight: "900",
            marginBottom: "2px",
            textTransform: "uppercase"
        },
        line: {
            borderBottom: "1px dashed #000",
            margin: "3px 0",
        },
        infoSection: { fontSize: fs(11) },
        infoRow: {
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "1px",
        },
        label: { fontWeight: "900" },
        value: { textAlign: "right", flex: 1, marginLeft: "4px" },
        items: { fontSize: fs(11) },
        itemsGrid: {
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) max-content max-content max-content",
            columnGap: "0.35em",
            alignItems: "start",
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
        },
        itemsHeader: {
            fontWeight: "900",
            borderBottom: "1px solid #000",
            paddingBottom: "2px",
            marginBottom: "2px",
            fontSize: fs(11),
        },
        colName: {
            flex: 1,
            whiteSpace: "normal",
            wordWrap: "break-word",
            wordBreak: "break-word",
            lineHeight: "1.3",
            paddingRight: "4px",
            minWidth: 0,
        },
        colQty: { minWidth: "2ch", textAlign: "center", fontWeight: "900", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
        colPrice: { minWidth: "4.6ch", textAlign: "right", fontWeight: "900", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
        colTotal: {
            minWidth: "6.8ch",
            textAlign: "right",
            fontWeight: "900",
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
        },
        itemRow: {
            padding: "4px 0",
            borderBottom: "1px dashed #000",
            fontSize: fs(11),
            fontWeight: "900",
            lineHeight: "1.3",
        },
        summaryRow: {
            display: "flex",
            marginBottom: "2px",
            fontSize: fs(12),
            fontWeight: "900",
            alignItems: "baseline",
            gap: "0.35em",
        },
        total: {
            display: "flex",
            fontWeight: "900",
            fontSize: fs(14),
            marginTop: "4px",
            whiteSpace: "nowrap",
            alignItems: "baseline",
            gap: "0.35em",
        },
        moneyInline: {
            display: "inline-flex",
            alignItems: "baseline",
            justifyContent: "flex-end",
            gap: "0.12em",
            whiteSpace: "nowrap",
            direction: "ltr",
            unicodeBidi: "isolate",
            fontVariantNumeric: "tabular-nums",
        },
        footer: {
            display: "flex",
            marginTop: "6px",
            paddingTop: "4px",
            paddingBottom: "30px",
            fontWeight: "900",
            alignItems: "center",
        },
        qr: { width: "80px", minWidth: "80px", minHeight: "80px", flexShrink: 0 },
        thanks: {
            flex: 1,
            paddingLeft: isQrHidden ? "0" : "6px",
            textAlign: isQrHidden ? "center" : "left",
        },
        thankText: { marginBottom: "2px", fontSize: fs(11), fontWeight: "900" },
        link: { fontSize: fs(10), wordBreak: "break-word", fontWeight: "900" },
        note: { fontSize: fs(11), fontStyle: "italic", fontWeight: "700", marginTop: "3px" },
        modifier: {
            fontSize: fs(11),
            fontStyle: "italic",
            marginTop: "1px",
            fontWeight: "bold",
        },
        statusBox: {
            textAlign: "center",
            marginTop: "6px",
            marginBottom: "6px",
            border: "2px solid #000",
            padding: "2px 0",
            width: "100%",
            display: "block",
            boxSizing: "border-box"
        },
        statusText: {
            fontSize: fs(12),
            fontWeight: "900",
            textTransform: "uppercase",
            letterSpacing: "1px",
            display: "block",
            textAlign: "center"
        }
    };

    const payments = checkData?.payments || [];

    const getSaleTypeName = (type, typeName) => {
        if (typeName) return typeName;
        if (type == 1 || type === "takeaway") return t("takeaway");
        if (type == 2 || type === "delivery") return t("delivery");
        return t("dine_in");
    };

    const displaySaleType = getSaleTypeName(checkData?.sale_type, checkData?.sale_type_name);

    const itemsToRender = (orderedItems && orderedItems.length > 0) ? orderedItems : (checkData?.orders_items || []);

    const rawSubtotal = itemsToRender.reduce((sum, item) => {
        return sum + getOrderItemLineTotal(item, checkData);
    }, 0);

    const checkIntervals = (val) => {
        if (!val) return false;
        if (Array.isArray(val)) return val.length > 0;
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed === "" || trimmed === "[]" || trimmed === "null" || trimmed === "undefined" || trimmed === "0") return false;
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.length > 0;
            } catch(e) {}
        }
        return false;
    };
    const hasProductTimer = itemsToRender.some(item => {
        const cat = findCatalogProduct(menuCatalog, item.product_id || item.id);
        return String(item.product_type || item.product?.product_type || '').toLowerCase() === 'timer' ||
            checkIntervals(item.timer_intervals) || checkIntervals(item.product?.timer_intervals) || checkIntervals(cat?.timer_intervals);
    });

    let tableTimerCharge = 0;
    const effH = Number(checkData?.table?.hourly_price || 0);
    if (effH > 0) {
        let totalSeconds = 0;
        if (checkData.is_timer_clock && String(checkData.is_timer_clock).includes(':')) {
            const parts = String(checkData.is_timer_clock).split(':').map(Number);
            if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else {
            totalSeconds = parseInt(checkData.is_timer_clock || "0", 10);
        }
        tableTimerCharge = (effH / 3600) * totalSeconds;
    }
    const subtotal = rawSubtotal + tableTimerCharge;
    const calcPercent = (val, total) => {
        if (!total || total === 0 || !val) return 0;
        const p = (val / total) * 100;
        return p % 1 === 0 ? p.toFixed(0) : p.toFixed(1);
    };

    const getDiscountInfo = () => {
        const discountValueRaw = checkData.discount_value;
        const hasExplicitDiscountValue = discountValueRaw !== null && discountValueRaw !== undefined;
        const type = checkData.discount_type || "percent";
        const value = Number(discountValueRaw || 0);

        const totalForDiscount = itemsToRender.reduce((sum, item) => {
            const rowCat = findCatalogProduct(menuCatalog, item.product_id || item.id);
            const isNoDiscount = item.no_discount === 1 || rowCat?.no_discount === 1;
            if (isNoDiscount) return sum;
            
            const qty = Number(item.quantity) > 0 ? Number(item.quantity) : Number(item.count || 0);
            const price = parseFloat(item.price || item.amount || 0);
            const isGift = item.is_gift ? 1 : 0;
            
            let modifiersTotal = 0;
            try {
                let mods = typeof item.modifiers === "string" ? JSON.parse(item.modifiers) : item.modifiers;
                if (Array.isArray(mods)) {
                    modifiersTotal = mods.reduce((mSum, m) => mSum + Number(m.price || 0) * Number(m.count || 1), 0);
                }
            } catch (e) { }
            
            const baseTotal = isGift ? 0 : qty * (price + modifiersTotal);
            return sum + baseTotal;
        }, 0);

        let rawAmount = 0;
        if (value > 0) {
            if (type === "percent") {
                rawAmount = (totalForDiscount * value) / 100;
            } else {
                rawAmount = value;
            }
        } else if (!hasExplicitDiscountValue && Number(checkData.discount) > 0) {
            rawAmount = Number(checkData.discount);
        }

        const maxDiscountAmount = totalForDiscount;
        const amount = Math.min(rawAmount, maxDiscountAmount);
        return {
            amount,
            percent: calcPercent(amount, subtotal),
            isPercent: type === "percent",
            rawValue: value
        };
    };

    const getServiceInfo = () => {
        const serviceValueRaw = checkData.serviceFeeValue ?? checkData.service_value;
        const hasExplicitServiceValue = serviceValueRaw !== null && serviceValueRaw !== undefined;
        const type = checkData.serviceFeeType || checkData.service_type || "percent";
        const value = Number(serviceValueRaw || 0);

        const totalForService = itemsToRender.reduce((sum, item) => {
            const rowCat = findCatalogProduct(menuCatalog, item.product_id || item.id);
            const isNoService = item.no_service_fee === 1 || rowCat?.no_service_fee === 1;
            if (isNoService) return sum;
            
            const qty = Number(item.quantity) > 0 ? Number(item.quantity) : Number(item.count || 0);
            const price = parseFloat(item.price || item.amount || 0);
            const isGift = item.is_gift ? 1 : 0;
            
            let modifiersTotal = 0;
            try {
                let mods = typeof item.modifiers === "string" ? JSON.parse(item.modifiers) : item.modifiers;
                if (Array.isArray(mods)) {
                    modifiersTotal = mods.reduce((mSum, m) => mSum + Number(m.price || 0) * Number(m.count || 1), 0);
                }
            } catch (e) { }
            
            const baseTotal = isGift ? 0 : qty * (price + modifiersTotal);
            return sum + baseTotal;
        }, 0);

        let amount = 0;
        let percent = 0;
        let isPercent = false;

        if (value > 0) {
            if (type === "percent") {
                amount = (totalForService * value) / 100;
                percent = value;
                isPercent = true;
            } else {
                amount = value;
                percent = calcPercent(value, totalForService);
            }
        } else if (!hasExplicitServiceValue && Number(checkData.service_charge) > 0) {
            amount = Number(checkData.service_charge);
            percent = calcPercent(amount, totalForService);
        } else if (!hasExplicitServiceValue && hall && Number(hall.service_fee) > 0) {
            amount = (totalForService * Number(hall.service_fee)) / 100;
            percent = Number(hall.service_fee);
            isPercent = true;
        }

        return { amount, percent, isPercent, rawValue: value };
    };

    const discountInfo = getDiscountInfo();
    const serviceInfo = getServiceInfo();

    /** CheckBottom ilə uyğun: yekun həmişə qəbzdəki məhsul cəmindən — silinən/miqdar azaldılanda DB-dəki total gec yenilənə bilər */
    const normalizeMoney = (value) => {
        const n = Number(value || 0);
        const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
        return Math.abs(rounded) < 0.005 ? 0 : rounded;
    };

    const depositAmount = normalizeMoney(Number(checkData?.deposit || 0));
    const deliveryFee = normalizeMoney(Number(checkData?.delivery_fee || 0));
    const discountAmt = normalizeMoney(discountInfo.amount);
    const serviceAmount = normalizeMoney(serviceInfo.amount);

    let subtotalAfterDiscount = normalizeMoney(subtotal - discountAmt);
    if (subtotalAfterDiscount < 0) subtotalAfterDiscount = 0;

    const displayTotal = normalizeMoney(
        Math.max(subtotalAfterDiscount, depositAmount) + serviceAmount + deliveryFee,
    );

    // Ödəniş sətirləri: server/bağlanışdakı real məbləğlər (yekun artıq max(məhsul, depozit)+çatdırılma ilə düzdür; depoziti burada çıxma).
    const totalPaymentsSum = payments.reduce((sum, p) => sum + Number(p.paidAmount || p.amount || 0), 0);
    const isPaid = payments.length > 0 && totalPaymentsSum + 1e-6 >= displayTotal;
    const displayPaymentRows = payments
        .map((p) => ({
            ...p,
            _displayAmount: Number(p.paidAmount || p.amount || 0),
        }))
        .filter((p) => p._displayAmount > 0.001);

    const formatMoney = (value) => normalizeMoney(value).toFixed(2);
    const renderMoney = (value) => (
        <span style={styles.moneyInline}>
            <span>{formatMoney(value)}</span>
            <span>{getCurrencySymbol()}</span>
        </span>
    );

    return (
        <div style={styles.receipt}>
            {/* HEADER */}
            <div style={styles.header}>
                {showLogo && logoSrc && (
                    <img
                        src={logoSrc}
                        alt="Logo"
                        style={{
                            width: "65%",
                            maxWidth: "140px",
                            objectFit: "contain",
                            display: "block",
                            margin: "0 auto 4px auto",
                        }}
                        onError={(e) => (e.target.style.display = "none")}
                    />
                )}

                <div style={styles.restaurantName}>
                    {filialName}
                </div>
            </div>

            <div style={styles.line}></div>

            {/* ORDER INFO */}
            <div style={styles.infoSection}>
                {showAddress && address && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t("unvan_1")}</span>
                        <span style={styles.value}>{address}</span>
                    </div>
                )}

                {showPhone && phone && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t("elaqe")}</span>
                        <span style={styles.value}>{phone}</span>
                    </div>
                )}

                {showCheckNumber && (checkData?.orderId || checkData?.id) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t("cek_№")}</span>
                        <span style={styles.value}>#{checkData.orderId || checkData.id}</span>
                    </div>
                )}

                {showCustomer && (checkData?.customer_name || checkData?.customerName || checkData?.customer?.name || checkData?.customer?.full_name) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t("customer")}</span>
                        <span style={styles.value}>{checkData.customer_name || checkData.customerName || checkData.customer?.name || checkData.customer?.full_name}</span>
                    </div>
                )}

                {showCustomerPhone && (checkData?.customerPhone || checkData?.customer_phone || checkData?.customer?.phone) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t("must_tel")}</span>
                        <span style={styles.value}>{checkData.customerPhone || checkData.customer_phone || checkData.customer?.phone}</span>
                    </div>
                )}

                {showCustomerAddress && (checkData?.customerAddress || checkData?.customer_address || checkData?.customer?.address) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t("must_unvan")}</span>
                        <span style={styles.value}>{checkData.customerAddress || checkData.customer_address || checkData.customer?.address}</span>
                    </div>
                )}

                {showTags && checkData?.tags && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t("qebz_etiketi")}</span>
                        <span style={styles.value}>{checkData.tags}</span>
                    </div>
                )}

                {showHallTable && (hallName || tableName) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t("satis_yeri")}</span>
                        <span style={styles.value}>
                            {hallName}
                            {hallName && tableName ? "-" : ""}
                            {tableName}
                        </span>
                    </div>
                )}

                {showDates && (checkData?.startDate || checkData?.start_date) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t("acilma_tarixi")}</span>
                        <span style={styles.value}>{formatLocalDate(checkData.startDate || checkData.start_date)}</span>
                    </div>
                )}

                {showDates && (checkData?.endDate || checkData?.end_date) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t("baglanma_tarixi")}</span>
                        <span style={styles.value}>{formatLocalDate(checkData.endDate || checkData.end_date)}</span>
                    </div>
                )}

                {showPrintDate && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t("cap_tarixi_1")}</span>
                        <span style={styles.value}>{currentTime}</span>
                    </div>
                )}

                {showWaiter && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t("waiter")}</span>
                        <span style={styles.value}>{checkData?.waiter_name || checkData?.waiter?.name || "-"}</span>
                    </div>
                )}

                {showGuestCount && Number(checkData?.guest_count || 0) > 0 && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t("guest_count")}</span>
                        <span style={styles.value}>{checkData.guest_count}</span>
                    </div>
                )}

                {showSaleType && displaySaleType !== t("dine_in") && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>{t("satis_tipi_1")}</span>
                        <span style={styles.value}>{displaySaleType}</span>
                    </div>
                )}
            </div>

            <div style={styles.line}></div>

            {/* ITEMS */}
            <div style={styles.items}>
                <div style={{ ...styles.itemsGrid, ...styles.itemsHeader }}>
                    <span style={styles.colName}>{t("product")}</span>
                    <span style={styles.colQty}>Say</span>
                    <span style={styles.colPrice}>Qiy</span>
                    <span style={styles.colTotal}>{t("cem")}</span>
                </div>

                {/* Top timer block removed, using the bottom one */}

                {(() => {
                    const filtered = itemsToRender.filter((item) => (Number(item.quantity) > 0 || Number(item.count) > 0));

                    // Group identical items (same name + price + modifiers + comment + is_gift)
                    const groupedMap = new Map();
                    filtered.forEach(item => {
                        const cat = findCatalogProduct(menuCatalog, item.product_id || item.id);
                        const name = getDisplayProductName(item, cat) || t("unknown");
                        const price = Number(item.price || 0);
                        const isGift = Number(item.is_gift || 0) === 1;
                        const comment = item.comment || '';
                        let mods = item.modifiers;
                        if (typeof mods === 'string') { try { mods = JSON.parse(mods); } catch (e) { mods = []; } }
                        if (!Array.isArray(mods)) mods = [];
                        mods = resolveModifiersForDisplay(mods, cat);
                        const modsKey = mods.map(m => `${m.name}:${m.price}:${m.count}`).sort().join('|');
                        const isTimer = String(item.product_type || item.product?.product_type || '').toLowerCase() === 'timer' || checkIntervals(item.timer_intervals) || checkIntervals(item.product?.timer_intervals) || checkIntervals(cat?.timer_intervals);
                        const key = isTimer ? `${name}__${price}__${isGift}__${modsKey}__${comment}__${item.id}` : `${name}__${price}__${isGift}__${modsKey}__${comment}`;

                        // Calculate line total for this instance
                        const instanceLineTotal = getOrderItemLineTotal(item, checkData);

                        if (groupedMap.has(key)) {
                            const existing = groupedMap.get(key);
                            existing._qty += Number(item.quantity || item.count || 0);
                            existing._lineTotal += instanceLineTotal;
                        } else {
                            groupedMap.set(key, {
                                ...item,
                                _qty: Number(item.quantity || item.count || 0),
                                modifiers: mods,
                                isTimer,
                                _lineTotal: instanceLineTotal
                            });
                        }
                    });
                    const grouped = Array.from(groupedMap.values()).map(item => ({
                        ...item,
                        quantity: item._qty,
                        count: item._qty,
                        lineTotal: item._lineTotal
                    }));

                    return grouped.map((item, i) => {
                        const rowCat = findCatalogProduct(menuCatalog, item.product_id || item.id);
                        let rowMods = Array.isArray(item.modifiers)
                            ? item.modifiers
                            : typeof item.modifiers === "string"
                                ? (() => { try { return JSON.parse(item.modifiers || "[]"); } catch { return []; } })()
                                : [];
                        rowMods = resolveModifiersForDisplay(rowMods, rowCat);
                        const params = {
                            name: getDisplayProductName(item, rowCat) || t("unknown"),
                            quantity: Number(item.quantity || item.count || 0),
                            price: Number(item.price || 0),
                            is_gift: Number(item.is_gift || 0) === 1,
                            modifiers: rowMods,
                        };

                        return (
                            <div key={i} style={{ ...styles.itemsGrid, ...styles.itemRow, borderBottom: i === grouped.length - 1 ? "1.5px solid #000" : styles.itemRow.borderBottom }}>
                                <div style={styles.colName}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span>{params.name}</span>
                                    </div>
                                    {item.isTimer && (
                                        <div style={{ fontSize: fs(11), color: "#000", marginTop: "2px", fontWeight: "bold" }}>
                                            {(() => {
                                                const secs = getTimerElapsedSeconds(item, checkData);
                                                const h = Math.floor(secs / 3600);
                                                const m = Math.floor((secs % 3600) / 60);
                                                const s = secs % 60;
                                                const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                                                
                                                const baseModsTotal = params.price + params.modifiers.reduce((s, m) => s + (Number(m.price || 0) * Number(m.count || 1)), 0);
                                                const timerProfit = item.lineTotal - (params.quantity * baseModsTotal);
                                                const profitStr = timerProfit > 0 ? ` (+${timerProfit.toFixed(2)} ₼)` : '';
                                                
                                                return timeStr + profitStr;
                                            })()}
                                        </div>
                                    )}
                                    {params.modifiers.length > 0 && (
                                        <div style={styles.modifier}>
                                            ({params.modifiers.map((m) => m.count > 0 ? `${m.name} (x${m.count})` : m.name).join(", ")})
                                        </div>
                                    )}
                                </div>

                                <span style={styles.colQty}>{params.quantity}</span>

                                {params.is_gift ? (
                                    <span style={{ ...styles.colPrice, fontSize: fs(8) }}>{t("i̇kram_1")}</span>
                                ) : (
                                    <span style={styles.colPrice}>
                                        {(item.isTimer && params.quantity > 0) ? (item.lineTotal / params.quantity).toFixed(2) : (params.price + (params.modifiers.reduce((s, m) => s + (Number(m.price || 0) * Number(m.count || 1)), 0))).toFixed(2)}
                                    </span>
                                )}

                                <span style={styles.colTotal}>
                                    {renderMoney(params.is_gift ? 0 : item.lineTotal)}
                                </span>
                            </div>
                        );
                    });
                })()}

                {/* TAYMER MƏLUMATI */}
                {tableTimerCharge > 0 && (
                    <div style={{
                        ...styles.itemsGrid,
                        ...styles.itemRow,
                        fontWeight: "bold",
                        borderTop: "1px dashed #000",
                        paddingTop: "2px",
                        marginTop: "2px"
                    }}>
                        <div style={styles.colName}>
                            Masa Taymeri ({checkData.is_timer_clock || "00:00:00"})
                        </div>
                        <span style={styles.colQty}></span>
                        <span style={styles.colPrice}></span>
                        <span style={styles.colTotal}>{renderMoney(tableTimerCharge)}</span>
                    </div>
                )}
            </div>



            {/* ÖDƏNİLMƏYİB STATUS */}
            {!isPaid && (
                <div style={styles.statusBox}>
                    <span style={styles.statusText}>{t("odeni̇lmeyi̇b")}</span>
                </div>
            )}

            {/* SUMMARY */}
            <div style={{ marginTop: "10px" }}>
                {discountInfo.amount > 0 && (
                    <div style={styles.summaryRow}>
                        <span style={{ flex: 1 }}>
                            Endirim {discountInfo.isPercent ? `(${discountInfo.rawValue}%)` : ""}
                        </span>
                        <span style={styles.colTotal}>
                            -{renderMoney(discountInfo.amount)}
                        </span>
                    </div>
                )}

                {serviceInfo.amount > 0 && (
                    <div style={styles.summaryRow}>
                        <span style={{ flex: 1 }}>
                            {getCustomerFacingServiceFeeLabel()} {serviceInfo.isPercent ? `(${serviceInfo.rawValue}%)` : ""}
                        </span>
                        <span style={styles.colTotal}>
                            +{renderMoney(serviceInfo.amount)}
                        </span>
                    </div>
                )}

                {checkData?.note && (
                    <div style={styles.note}>Qeyd: {checkData.note}</div>
                )}
            </div>

            {/* TOTAL */}
            <div style={styles.total}>
                <span style={{ flex: 1 }}>YEKUN</span>
                <span style={styles.colTotal}>
                    {renderMoney(displayTotal)}
                </span>
            </div>

            {/* ÖDƏNİŞ METODLARI */}
            {payments.length > 0 && (
                <div style={{ marginTop: "4px" }}>


                    <div
                        style={{
                            fontWeight: "900",
                            marginBottom: "3px",
                            marginTop: "3px",
                            fontSize: fs(12),
                        }}
                    >{t("odenis_usullari_1")}</div>

                    {displayPaymentRows.map((pay, idx) => (
                        <div key={idx} style={styles.summaryRow}>
                            <span style={{ flex: 1 }}>
                                {pay.paymentMethodName || pay.name || pay.method_name || t("nagd")}
                            </span>
                            <span style={styles.colTotal}>
                                {renderMoney(pay._displayAmount)}
                            </span>
                        </div>
                    ))}

                    {/* NEW: Paid and Change */}
                    {(checkData?.paid_amount !== undefined || checkData?.paidAmount !== undefined) && (
                        <div style={{ ...styles.summaryRow, marginTop: "4px", borderTop: "1px dashed #000", paddingTop: "2px" }}>
                            <span style={{ flex: 1 }}>{t("veri̇len")}</span>
                            <span style={styles.colTotal}>{renderMoney(checkData.paid_amount || checkData.paidAmount || 0)}</span>
                        </div>
                    )}

                    {(checkData?.change !== undefined) && (
                        <div style={styles.summaryRow}>
                            <span style={{ flex: 1 }}>QALIQ</span>
                            <span style={styles.colTotal}>{renderMoney(Math.max(0, parseFloat(checkData.change || 0)))}</span>
                        </div>
                    )}
                </div>
            )}

            {/* ÖDƏNİLİB STATUS */}
            {isPaid && (
                <div style={styles.statusBox}>
                    <span style={styles.statusText}>
                        ÖDƏNİLİB — {renderMoney(displayTotal)}
                    </span>
                </div>
            )}

            {/* FOOTER */}
            <div style={styles.footer}>
                {!isQrHidden && (
                    <div style={styles.qr}>
                        <QRCode value={qrCodeValue} size={80} level="H" style={{ width: "80px", height: "80px", minWidth: "80px", minHeight: "80px" }} />
                    </div>
                )}

                <div style={styles.thanks}>
                    <div style={styles.thankText}>{customFooterText}</div>
                </div>
            </div>
        </div>
    );
};

export default CustomerReceipt;
