import React from "react";
import QRCode from "react-qr-code";

const KitchenReceipt = ({
    orderedItems = [],
    table = "",
    waiter = "",
    hallName,
    orderId,
    terminalInfo,
    typeName,
    checkData,
    selectedCustomer,
    isDecrease,
    previewSettings,
}) => {
    const now = new Date();
    const currentTime = `${now.getFullYear()}-${String(
        now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
        now.getHours()
    ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const items = orderedItems.length > 0 ? orderedItems : [];

    // Group items by name, modifiers, and other properties
    const groupedItems = React.useMemo(() => {
        const groups = new Map();

        items.forEach(item => {
            const itemName = item.product_name || item.name || item.product?.name || "Naməlum";
            
            // Normalize modifiers for key generation
            let mods = [];
            try {
                if (Array.isArray(item.modifiers)) {
                    mods = item.modifiers;
                } else if (typeof item.modifiers === "string") {
                    const parsed = JSON.parse(item.modifiers);
                    if (Array.isArray(parsed)) mods = parsed;
                }
            } catch (e) {
                mods = [];
            }
            // Sort modifiers by ID or name to ensure consistent key
            const sortedMods = [...mods].sort((a, b) => (a.id || a.name || "").toString().localeCompare((b.id || b.name || "").toString()));
            const modsKey = JSON.stringify(sortedMods.map(m => ({ id: m.id, count: m.count })));

            // Create a unique key for grouping
            const key = `${itemName}|${modsKey}|${item.comment || ""}|${item.reasonName || ""}|${item.changeType || ""}|${item.isModifierStandalone || ""}|${item.parentName || ""}`;

            if (groups.has(key)) {
                const existing = groups.get(key);
                if (item.changeType === "decrease") {
                    existing.quantity = (existing.quantity || 0) + (Number(item.diff || item.quantity || item.qty || item.count || 0));
                } else {
                    existing.quantity = (existing.quantity || 0) + (Number(item.quantity || item.count || 0));
                }
            } else {
                const qty = item.changeType === "decrease" 
                    ? Number(item.diff || item.quantity || item.qty || item.count || 0)
                    : Number(item.quantity || item.count || 0);
                
                groups.set(key, {
                    ...item,
                    itemName,
                    mods, // Store original mods for rendering
                    quantity: qty
                });
            }
        });

        return Array.from(groups.values());
    }, [items]);

    const hasDecrease = isDecrease || items.some((i) => i.changeType === "decrease");

    const cleanTable = String(table).replace(/masa/gi, "").trim();
    const cleanWaiter = String(waiter).replace(/ofisiant/gi, "").trim();

    let localSettings = {};
    try {
        localSettings = JSON.parse(localStorage.getItem("pos_receipt_settings"))?.kitchen || {};
    } catch(e) {}
    if (previewSettings) localSettings = previewSettings;

    const baseFont = Number(localSettings.fontSizeOffset !== undefined ? localSettings.fontSizeOffset : (terminalInfo?.kitchen_receipt || checkData?.kitchen_receipt || 0));
    // If baseFont is non-zero, apply a more significant increase (e.g. baseFont * 2)
    const fs = (n) => {
        if (baseFont === 0) return `${n}px`;
        return `${n + (baseFont * 2)}px`;
    };

    const isVisible = (key, defaultVal = true) => {
        if (localSettings[key] !== undefined) return localSettings[key];
        return defaultVal;
    };

    const showWaiter = isVisible("showWaiter", true);
    const showCheckNumber = isVisible("showCheckNumber", true);
    const showHallTable = isVisible("showHallTable", true);
    const showSaleType = isVisible("showSaleType", true);
    const showCustomer = isVisible("showCustomer", true);
    const showHeaderDate = isVisible("showHeaderDate", true);
    const customFooterText = localSettings.footerText !== undefined && localSettings.footerText !== "" ? localSettings.footerText : "Mətbəxə uğurlar!";
    const fontFamily = localSettings.fontFamily || "'Consolas', 'Courier New', 'Lucida Console', monospace";
    const padTop = localSettings.paddingTop ?? 0;
    const padBottom = localSettings.paddingBottom ?? 0;
    const padLeft = localSettings.paddingLeft ?? 0;
    const padRight = localSettings.paddingRight ?? 0;

    const styles = {
        receipt: {
            width: "100%",
            boxSizing: "border-box",
            padding: `${padTop}px ${12 + padRight}px ${padBottom}px ${12 + padLeft}px`,
            margin: "0 auto",
            maxWidth: "100%",
            background: "#fff",
            fontFamily: fontFamily,
            fontSize: fs(13),
            color: "#000",
            fontWeight: "700",
        },
        header: { textAlign: "center", marginBottom: "4px" },
        title: {
            fontSize: fs(18),
            fontWeight: "900",
            letterSpacing: "1px",
        },
        line: {
            borderBottom: "1px dashed #000",
            margin: "3px 0",
        },
        infoSection: { fontSize: fs(13), textAlign: "center", fontWeight: "700" },
        infoRow: {
            textAlign: "center",
            marginBottom: "1px",
        },
        label: { fontWeight: "900" },
        value: { wordBreak: "break-word" },
        items: { fontSize: fs(14) },
        itemsHeader: {
            display: "flex",
            fontWeight: "900",
            borderBottom: "1px solid #000",
            paddingBottom: "2px",
            marginBottom: "2px",
            fontSize: fs(14),
        },
        colName: {
            width: "220px", // Kitchen only has name and qty usually: 220px name
            whiteSpace: "normal",
            wordWrap: "break-word",
            wordBreak: "break-word",
            lineHeight: "1.3",
            paddingRight: "6px"
        },
        colQty: { width: "80px", textAlign: "right", fontWeight: "900", whiteSpace: "nowrap" },
        itemRow: {
            display: "flex",
            padding: "3px 0",
            borderBottom: "1px dashed #000",
            fontSize: fs(15),
            fontWeight: "900",
            lineHeight: "1.2",
            alignItems: "center",
        },
        status: {
            textAlign: "center",
            fontSize: fs(16),
            fontWeight: "900",
            padding: "4px 0",
            wordBreak: "break-word",
            letterSpacing: "1px",
        },
        footer: {
            textAlign: "center",
            marginTop: "6px",
            fontSize: fs(13),
            fontWeight: "900",
        },
        modifier: {
            fontSize: fs(10),
            fontStyle: "italic",
            marginTop: "1px",
            fontWeight: "500",
        },
    };

    // Çek №: yalnız rəqəmsal ID göstərilsin
    const displayCheckId = checkData?.id || "";

    return (
        <div style={styles.receipt}>
            {/* HEADER */}
            {showHeaderDate && (
                <div style={styles.header}>
                    <div style={{ fontSize: fs(13), marginTop: "2px", fontWeight: "900" }}>{currentTime}</div>
                </div>
            )}
            {showHeaderDate && <div style={styles.line}></div>}

            {/* ORDER INFO - mərkəzdə */}
            <div style={styles.infoSection}>
                {showWaiter && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Ofisiant: </span>
                        <span style={styles.value}>{cleanWaiter}</span>
                    </div>
                )}

                {showCheckNumber && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Çek №: </span>
                        <span style={styles.value}>#{displayCheckId}</span>
                    </div>
                )}

                {showHallTable && hallName && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Satış yeri: </span>
                        <span style={styles.value}>
                            {hallName}
                            {cleanTable ? `-${cleanTable}` : ""}
                        </span>
                    </div>
                )}

                {showSaleType && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Satış tipi: </span>
                        <span style={styles.value}>{typeName || "Restoranda"}</span>
                    </div>
                )}

                {showCustomer && (selectedCustomer || checkData?.customerName) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Müştəri: </span>
                        <span style={styles.value}>
                            {selectedCustomer?.name || checkData?.customerName}
                        </span>
                    </div>
                )}
            </div>

            <div style={styles.line}></div>

            {/* STATUS */}
            <div style={styles.status}>
                {hasDecrease ? "SİLİNƏN MƏHSULLAR" : "YENİ SİFARİŞ"}
            </div>

            <div style={styles.line}></div>

            {/* ITEMS */}
            <div style={styles.items}>
                <div style={styles.itemsHeader}>
                    <span style={styles.colName}>Məhsul</span>
                    <span style={styles.colQty}>Say</span>
                </div>

                {groupedItems.map((item, idx) => {
                    const mods = item.mods || [];
                    const itemName = item.itemName;

                    return (
                        <div key={idx} style={{
                            ...styles.itemRow,
                            borderBottom: idx === groupedItems.length - 1 ? "none" : styles.itemRow.borderBottom
                        }}>
                            <div style={styles.colName}>
                                <span>
                                    {item.isModifierStandalone && <span style={{ color: '#d32f2f' }}>ƏLAVƏ: </span>}
                                    {itemName}
                                    {item.portion_name && (
                                        <span style={{ fontSize: fs(11), display: 'block', fontWeight: '700', color: '#333', fontStyle: 'italic' }}>
                                            [{item.portion_name}]
                                        </span>
                                    )}
                                    {item.isModifierStandalone && item.parentName && (
                                        <span style={{ fontSize: fs(10), display: 'block', color: '#666' }}>
                                            ({item.parentName} üçün)
                                        </span>
                                    )}
                                </span>
                                {item.comment && (
                                    <div style={{ ...styles.modifier, fontWeight: "900", fontStyle: "italic", fontSize: fs(12) }}>
                                        * Qeyd: {item.comment}
                                    </div>
                                )}
                                {item.reasonName && item.changeType === "decrease" && (
                                    <div style={{ ...styles.modifier, fontWeight: "900", fontSize: fs(12), border: "1px solid #000", display: "block", width: "fit-content", padding: "1px 3px", marginTop: "2px" }}>
                                        SƏBƏB: {item.reasonName}
                                    </div>
                                )}
                                {mods.length > 0 && (
                                    <div style={styles.modifier}>
                                        + {mods.map((m) => (m.count > 0 ? `${m.name || m.product_name || "Adsız"} (x${m.count})` : m.name || m.product_name || "Adsız")).join(", ")}
                                    </div>
                                )}
                            </div>

                            <div style={styles.colQty}>
                                {item.changeType === "decrease" ? `-${item.quantity}` : `${item.quantity}`}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={styles.line}></div>

            {/* FOOTER */}
            <div style={styles.footer}>{customFooterText}</div>

            {/* QR CODE - Mətbəx çekində orijinal drayverdə olduğu üçün əlavə edildi */}
            {orderId && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px', paddingBottom: '10px' }}>
                    <div style={{ background: 'white', padding: '5px' }}>
                        <QRCode value={String(orderId)} size={60} level="M" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default KitchenReceipt;
