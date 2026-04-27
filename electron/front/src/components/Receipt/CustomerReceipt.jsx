import React from "react";
import QRCode from "react-qr-code";
import {
    findCatalogProduct,
    getDisplayProductName,
    resolveModifiersForDisplay,
} from "../../utils/orderItemDisplayHelpers";
import { getCustomerFacingServiceFeeLabel } from "../../utils/posOperationNames";

const CustomerReceipt = ({
    orderedItems,
    checkData,
    profileData,
    tableName,
    hallName,
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

    const qrCodeValue =
        `https://menu.unipos.tech/?r=${terminalInfo?.username}` ||
        "https://unipos.tech";

    if (!checkData || !orderedItems)
        return <div style={{ padding: "16px", fontFamily: "sans-serif" }}>Yüklənir...</div>;

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
    } catch(e) {}
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
        itemsHeader: {
            display: "flex",
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
        colQty: { width: "30px", textAlign: "center", fontWeight: "900", whiteSpace: "nowrap", flexShrink: 0 },
        colPrice: { width: "55px", textAlign: "right", fontWeight: "900", paddingRight: "4px", whiteSpace: "nowrap", flexShrink: 0 },
        colTotal: {
            width: "65px",
            textAlign: "right",
            fontWeight: "900",
            whiteSpace: "nowrap",
            flexShrink: 0,
        },
        itemRow: {
            display: "flex",
            padding: "4px 0",
            borderBottom: "1px dashed #000",
            fontSize: fs(11),
            fontWeight: "900",
            lineHeight: "1.3",
            alignItems: "flex-start",
        },
        summaryRow: {
            display: "flex",
            marginBottom: "2px",
            fontSize: fs(12),
            fontWeight: "900",
        },
        total: {
            display: "flex",
            fontWeight: "900",
            fontSize: fs(14),
            marginTop: "4px",
            whiteSpace: "nowrap",
        },
        footer: {
            display: "flex",
            marginTop: "6px",
            paddingTop: "4px",
            fontWeight: "900",
        },
        qr: { width: "60px" },
        thanks: {
            flex: 1,
            paddingLeft: isQrHidden ? "0" : "6px",
            textAlign: isQrHidden ? "center" : "left",
        },
        thankText: { marginBottom: "2px", fontSize: fs(11), fontWeight: "900" },
        link: { fontSize: fs(10), wordBreak: "break-word", fontWeight: "900" },
        note: { fontSize: fs(11), fontStyle: "italic", fontWeight: "700", marginTop: "3px" },
        modifier: {
            fontSize: fs(9),
            fontStyle: "italic",
            marginTop: "1px",
            fontWeight: "500",
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
        if (type == 1 || type === "takeaway") return "Gəl götür";
        if (type == 2 || type === "delivery") return "Çatdırılma";
        return "Restoranda";
    };

    const displaySaleType = getSaleTypeName(checkData?.sale_type, checkData?.sale_type_name);

    const itemsToRender = (orderedItems && orderedItems.length > 0) ? orderedItems : (checkData?.orders_items || []);

    const subtotal = itemsToRender.reduce((sum, item) => {
        const qty = Number(item.quantity || item.count || 0);
        const price = Number(item.price || 0);
        const isGift = Number(item.is_gift || 0) === 1;

        // Modifiers
        let modifiersTotal = 0;
        try {
            let mods = item.modifiers;
            if (typeof mods === 'string') mods = JSON.parse(mods);
            if (Array.isArray(mods)) {
                modifiersTotal = mods.reduce((mSum, mod) => mSum + (Number(mod.price || 0) * Number(mod.count || 1)), 0);
            }
        } catch (e) { /* ignore */ }

        return sum + (isGift ? 0 : qty * (price + modifiersTotal));
    }, 0) + (Number(checkData?.rate_per_minute) || 0);

    const calcPercent = (val, total) => {
        if (!total || total === 0 || !val) return 0;
        const p = (val / total) * 100;
        return p % 1 === 0 ? p.toFixed(0) : p.toFixed(1);
    };

    const maxDiscountAmount = subtotal;

    // Helper to extract financial values safely
    const getDiscountInfo = () => {
        const type = checkData.discount_type || checkData.discountType || "";
        const value = Number(checkData.discountValue || checkData.discount_value || checkData.discount || 0);

        let rawAmount;
        if (type === "percent") {
            rawAmount = (subtotal * value) / 100;
        } else {
            rawAmount = value;
        }
        // Endirim cəmdən (subtotal) artıq olmasın
        const amount = Math.min(rawAmount, maxDiscountAmount);
        return {
            amount,
            percent: calcPercent(amount, subtotal),
            isPercent: type === "percent"
        };
    };

    const getServiceInfo = () => {
        const type = checkData.serviceFeeType || checkData.service_fee_type || "";
        const value = Number(checkData.serviceFeeValue || checkData.service_fee_value || checkData.serviceFee || checkData.service_charge || 0);

        // Base for service calculation should be the items' subtotal
        const serviceBase = subtotal;

        if (type === "percent") {
            return {
                amount: (serviceBase * value) / 100,
                percent: value,
                isPercent: true
            };
        }
        return {
            amount: value,
            percent: calcPercent(value, subtotal),
            isPercent: false
        };
    };

    const discountInfo = getDiscountInfo();
    const serviceInfo = getServiceInfo();

    // Use stored total (already correct: max(subtotal-discount+service, deposit)+delivery)
    const displayTotal = checkData?.total != null
        ? Number(checkData.total)
        : Math.max(0, subtotal - discountInfo.amount + serviceInfo.amount);

    // Ödəniş sətirləri: server/bağlanışdakı real məbləğlər (yekun artıq max(məhsul, depozit)+çatdırılma ilə düzdür; depoziti burada çıxma).
    const totalPaymentsSum = payments.reduce((sum, p) => sum + Number(p.paidAmount || p.amount || 0), 0);
    const isPaid = payments.length > 0 && totalPaymentsSum + 1e-6 >= displayTotal;
    const displayPaymentRows = payments
        .map((p) => ({
            ...p,
            _displayAmount: Number(p.paidAmount || p.amount || 0),
        }))
        .filter((p) => p._displayAmount > 0.001);

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
                        <span style={styles.label}>Ünvan</span>
                        <span style={styles.value}>{address}</span>
                    </div>
                )}

                {showPhone && phone && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Əlaqə</span>
                        <span style={styles.value}>{phone}</span>
                    </div>
                )}

                {showCheckNumber && (checkData?.orderId || checkData?.id) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Çek №</span>
                        <span style={styles.value}>#{checkData.orderId || checkData.id}</span>
                    </div>
                )}

                {showCustomer && (checkData?.customer_name || checkData?.customerName || checkData?.customer?.name || checkData?.customer?.full_name) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Müştəri</span>
                        <span style={styles.value}>{checkData.customer_name || checkData.customerName || checkData.customer?.name || checkData.customer?.full_name}</span>
                    </div>
                )}

                {showTags && checkData?.tags && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Qəbz etiketi</span>
                        <span style={styles.value}>{checkData.tags}</span>
                    </div>
                )}

                {showHallTable && (hallName || tableName) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Satış yeri</span>
                        <span style={styles.value}>
                            {hallName}
                            {hallName && tableName ? "-" : ""}
                            {tableName}
                        </span>
                    </div>
                )}

                {showDates && (checkData?.startDate || checkData?.start_date) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Açılma tarixi</span>
                        <span style={styles.value}>{formatLocalDate(checkData.startDate || checkData.start_date)}</span>
                    </div>
                )}

                {showDates && (checkData?.endDate || checkData?.end_date) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Bağlanma tarixi</span>
                        <span style={styles.value}>{formatLocalDate(checkData.endDate || checkData.end_date)}</span>
                    </div>
                )}

                {showPrintDate && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Çap tarixi</span>
                        <span style={styles.value}>{currentTime}</span>
                    </div>
                )}

                {showWaiter && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Ofisiant</span>
                        <span style={styles.value}>{checkData?.waiter_name || checkData?.waiter?.name || "-"}</span>
                    </div>
                )}

                {showGuestCount && Number(checkData?.guest_count || 0) > 0 && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Qonaq sayı</span>
                        <span style={styles.value}>{checkData.guest_count}</span>
                    </div>
                )}

                {showSaleType && displaySaleType !== "Restoranda" && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Satış tipi</span>
                        <span style={styles.value}>{displaySaleType}</span>
                    </div>
                )}
            </div>

            <div style={styles.line}></div>

            {/* ITEMS */}
            <div style={styles.items}>
                <div style={styles.itemsHeader}>
                    <span style={styles.colName}>Məhsul</span>
                    <span style={styles.colQty}>Say</span>
                    <span style={styles.colPrice}>Qiy</span>
                    <span style={styles.colTotal}>Cəm</span>
                </div>

                {checkData?.rate_per_minute &&
                    Number(checkData?.rate_per_minute) !== 0 ? (
                    <div style={styles.itemRow}>
                        <span style={styles.colName}>Timer {checkData?.is_timer_clock ? `(${checkData.is_timer_clock})` : ''}</span>
                        <span style={styles.colQty}></span>
                        <span style={styles.colPrice}></span>
                        <span style={styles.colTotal}>
                            {parseFloat(checkData.rate_per_minute).toFixed(2)} ₼
                        </span>
                    </div>
                ) : null}

                {(() => {
                    const filtered = itemsToRender.filter((item) => (Number(item.quantity) > 0 || Number(item.count) > 0));

                    // Group identical items (same name + price + modifiers + comment + is_gift)
                    const groupedMap = new Map();
                    filtered.forEach(item => {
                        const cat = findCatalogProduct(menuCatalog, item.product_id || item.id);
                        const name = getDisplayProductName(item, cat) || "Naməlum";
                        const price = Number(item.price || 0);
                        const isGift = Number(item.is_gift || 0) === 1;
                        const comment = item.comment || '';
                        let mods = item.modifiers;
                        if (typeof mods === 'string') { try { mods = JSON.parse(mods); } catch (e) { mods = []; } }
                        if (!Array.isArray(mods)) mods = [];
                        mods = resolveModifiersForDisplay(mods, cat);
                        const modsKey = mods.map(m => `${m.name}:${m.price}:${m.count}`).sort().join('|');
                        const key = `${name}__${price}__${isGift}__${modsKey}__${comment}`;

                        if (groupedMap.has(key)) {
                            groupedMap.get(key)._qty += Number(item.quantity || item.count || 0);
                        } else {
                            groupedMap.set(key, { ...item, _qty: Number(item.quantity || item.count || 0), modifiers: mods });
                        }
                    });
                    const grouped = Array.from(groupedMap.values()).map(item => ({
                        ...item,
                        quantity: item._qty,
                        count: item._qty,
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
                            name: getDisplayProductName(item, rowCat) || "Naməlum",
                            quantity: Number(item.quantity || item.count || 0),
                            price: Number(item.price || 0),
                            is_gift: Number(item.is_gift || 0) === 1,
                            modifiers: rowMods,
                        };

                        return (
                            <div key={i} style={{
                                ...styles.itemRow,
                                borderBottom: i === grouped.length - 1 ? "1.5px solid #000" : styles.itemRow.borderBottom
                            }}>
                                <div style={styles.colName}>
                                    {params.name}
                                    {params.modifiers.length > 0 && (
                                        <div style={styles.modifier}>
                                            ({params.modifiers.map((m) => m.count > 0 ? `${m.name} (x${m.count})` : m.name).join(", ")})
                                        </div>
                                    )}
                                </div>

                                <span style={styles.colQty}>{params.quantity}</span>

                                {params.is_gift ? (
                                    <span style={{ ...styles.colPrice, fontSize: fs(8) }}>
                                        İKRAM
                                    </span>
                                ) : (
                                    <span style={styles.colPrice}>
                                        {(params.price + (params.modifiers.reduce((s, m) => s + (Number(m.price || 0) * Number(m.count || 1)), 0))).toFixed(2)}
                                    </span>
                                )}

                                <span style={styles.colTotal}>
                                    {((params.price + (params.modifiers.reduce((s, m) => s + (Number(m.price || 0) * Number(m.count || 1)), 0))) * params.quantity).toFixed(2)} ₼
                                </span>
                            </div>
                        );
                    });
                })()}

                {/* TAYMER MƏLUMATI */}
                {Number(checkData?.is_timer_status) === 1 && (
                    <div style={{
                        ...styles.itemRow,
                        fontWeight: "bold",
                        borderTop: "1px dashed #000",
                        paddingTop: "2px",
                        marginTop: "2px"
                    }}>
                        <div style={styles.colName}>
                            Masa Taymeri ({checkData.is_timer_clock || "00:00:00"})
                        </div>
                        <span style={styles.colQty}>1</span>
                        <span style={styles.colPrice}>
                            {(Number(checkData.rate_per_minute) || 0).toFixed(2)}
                        </span>
                        <span style={styles.colTotal}>
                            {(Number(checkData.rate_per_minute) || 0).toFixed(2)} ₼
                        </span>
                    </div>
                )}
            </div>



            {/* ÖDƏNİLMƏYİB STATUS */}
            {!isPaid && (
                <div style={styles.statusBox}>
                    <span style={styles.statusText}>ÖDƏNİLMƏYİB</span>
                </div>
            )}

            {/* SUMMARY */}
            <div style={{ marginTop: "10px" }}>
                {discountInfo.amount > 0 && (
                    <div style={styles.summaryRow}>
                        <span style={{ flex: 1 }}>
                            Endirim ({discountInfo.percent}%)
                        </span>
                        <span style={styles.colTotal}>
                            {discountInfo.amount.toFixed(2)} ₼
                        </span>
                    </div>
                )}

                {serviceInfo.amount > 0 && (
                    <div style={styles.summaryRow}>
                        <span style={{ flex: 1 }}>
                            {getCustomerFacingServiceFeeLabel()} ({serviceInfo.percent}%)
                        </span>
                        <span style={styles.colTotal}>
                            {serviceInfo.amount.toFixed(2)} ₼
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
                    {displayTotal.toFixed(2)} ₼
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
                    >
                        Ödəniş üsulları:
                    </div>

                    {displayPaymentRows.map((pay, idx) => (
                        <div key={idx} style={styles.summaryRow}>
                            <span style={{ flex: 1 }}>
                                {pay.paymentMethodName || pay.name || pay.method_name || "Nağd"}
                            </span>
                            <span>
                                {pay._displayAmount.toFixed(2)} ₼
                            </span>
                        </div>
                    ))}

                    {/* NEW: Paid and Change */}
                    {(checkData?.paid_amount !== undefined || checkData?.paidAmount !== undefined) && (
                        <div style={{ ...styles.summaryRow, marginTop: "4px", borderTop: "1px dashed #000", paddingTop: "2px" }}>
                            <span style={{ flex: 1 }}>VERİLƏN</span>
                            <span>{parseFloat(checkData.paid_amount || checkData.paidAmount || 0).toFixed(2)} ₼</span>
                        </div>
                    )}

                    {(checkData?.change !== undefined) && (
                        <div style={styles.summaryRow}>
                            <span style={{ flex: 1 }}>QALIQ</span>
                            <span>{Math.max(0, parseFloat(checkData.change || 0)).toFixed(2)} ₼</span>
                        </div>
                    )}
                </div>
            )}

            {/* ÖDƏNİLİB STATUS */}
            {isPaid && (
                <div style={styles.statusBox}>
                    <span style={styles.statusText}>ÖDƏNİLİB — {displayTotal.toFixed(2)} ₼</span>
                </div>
            )}

            {/* FOOTER */}
            <div style={styles.footer}>
                {!isQrHidden && (
                    <div style={styles.qr}>
                        <QRCode value={qrCodeValue} size={60} level="H" />
                    </div>
                )}

                <div style={styles.thanks}>
                    <div style={styles.thankText}>{customFooterText}</div>
                    <div style={styles.link}>unipos.tech</div>
                </div>
            </div>
        </div>
    );
};

export default CustomerReceipt;
