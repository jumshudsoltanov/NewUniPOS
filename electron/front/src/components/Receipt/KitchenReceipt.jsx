import React from "react";

const KitchenReceipt = ({
    orderedItems = [],
    table = "",
    waiter = "",
    hallName,
    orderId, // This is UUID, used for internal/meta if needed
    terminalInfo,
    typeName,
    checkData,
    isDecrease = false,
}) => {
    const now = new Date();

    const formatDate = (date) =>
        `${String(date.getHours()).padStart(2, "0")}:${String(
            date.getMinutes()
        ).padStart(2, "0")}  ${String(date.getDate()).padStart(2, "0")}.${String(
            date.getMonth() + 1
        ).padStart(2, "0")}.${date.getFullYear()}`;

    const baseFont = Number(terminalInfo?.kitchen_receipt || 14);
    const fs = (n) => `${baseFont + n}px`;

    const items = orderedItems.length > 0 ? orderedItems : [];
    const hasDecrease = isDecrease || items.some((i) => i.changeType === "decrease");

    const cleanTable = String(table || "").replace(/masa/gi, "").trim();
    const cleanWaiter = String(waiter || "").replace(/ofisiant/gi, "").trim();

    // Use Numeric ID for display if available
    const displayId = checkData?.id || orderId?.toString().slice(0, 8);

    return (
        <div id="kitchen-receipt-content" style={styles.receipt(fs)}>
            <style>
                {`
                @media print {
                  @page { margin: 0; size: auto; }
                  body { margin: 0; padding: 0; }
                }
              `}
            </style>

            {/* HEADER */}
            <div style={styles.header}>
                <div style={styles.title(fs)}>*** MƏTBƏX ÇEKİ ***</div>
                <div style={styles.sub(fs)}>{formatDate(now)}</div>

                <div style={styles.metaRow}>
                    <div style={styles.metaLabel(fs)}>ÇEK №:</div>
                    <div style={styles.metaValueLarge(fs)}>{displayId}</div>
                </div>

                <div style={styles.line}></div>

                <div style={styles.headerGrid}>
                    <div style={styles.gridItem}>
                        <div style={styles.metaLabelSmall(fs)}>MASA:</div>
                        <div style={styles.metaValue(fs)}>{checkData?.sale_type == 0 ? `${hallName || ""} ${cleanTable}` : typeName || "Paket"}</div>
                    </div>
                    <div style={styles.gridItem}>
                        <div style={styles.metaLabelSmall(fs)}>OFİSİANT:</div>
                        <div style={styles.metaValue(fs)}>{cleanWaiter}</div>
                    </div>
                </div>
            </div>

            <div style={styles.lineBold}></div>

            {/* STATUS BADGE */}
            <div style={styles.statusBox(hasDecrease, fs)}>
                {hasDecrease ? "!!! MƏHSUL SİLİNDİ !!!" : "YENİ SİFARİŞ"}
            </div>

            <div style={styles.lineBold}></div>

            {/* ITEMS TABLE */}
            <div style={{ width: "100%", marginTop: "5px" }}>
                <div style={styles.tableHeader}>
                    <div style={styles.thName(fs)}>MƏHSUL ADI</div>
                    <div style={styles.thQty(fs)}>SAY</div>
                </div>
                {items.map((item, idx) => (
                    <div key={idx} style={styles.itemRow}>
                        <div style={styles.itemInfo}>
                            <div style={styles.itemName(fs)}>{item.name}</div>
                            {item.comment && (
                                <div style={styles.comment(fs)}>{"-"} {item.comment}</div>
                            )}
                            {item.reasonName && (
                                <div style={styles.reasonBox(fs)}>SƏBƏB: {item.reasonName}</div>
                            )}

                            {/* MODIFIERS */}
                            {(() => {
                                let mods = [];
                                try {
                                    if (Array.isArray(item.modifiers)) {
                                        mods = item.modifiers;
                                    } else if (typeof item.modifiers === "string") {
                                        const parsed = JSON.parse(item.modifiers);
                                        if (Array.isArray(parsed)) mods = parsed;
                                    }
                                } catch (e) { mods = []; }

                                return (
                                    mods.length > 0 &&
                                    mods.map((mod, mIdx) => (
                                        <div key={mIdx} style={styles.modifier(fs)}>
                                            + {mod.count > 0 ? `${mod.name || mod.product_name} (x${mod.count})` : (mod.name || mod.product_name)}
                                        </div>
                                    ))
                                );
                            })()}
                        </div>
                        <div style={styles.qtyBox(hasDecrease, fs)}>
                            {item.changeType === "decrease" || isDecrease || hasDecrease
                                ? `-${item.qty || item.quantity || item.count || 0}`
                                : `${item.quantity || item.count}`}
                        </div>
                    </div>
                ))}
            </div>

            <div style={styles.lineBold}></div>

            {/* FOOTER */}
            <div style={styles.footer(fs)}>
                <div style={styles.footerLine}>Mətbəxə uğurlar!</div>
                <div style={styles.footerLineSmall}>POS System v2.0</div>
            </div>
        </div>
    );
};

export default KitchenReceipt;

const styles = {
    receipt: (fs) => ({
        width: "100%",
        maxWidth: "80mm",
        padding: "5px 10px",
        boxSizing: "border-box",
        background: "#fff",
        fontFamily: "'Courier New', Courier, monospace",
        color: "#000",
    }),

    header: { textAlign: "center", marginBottom: "5px" },

    title: (fs) => ({
        fontSize: fs(5),
        fontWeight: "900",
        borderBottom: "1px double #000",
        display: "inline-block",
        paddingBottom: "2px",
        marginBottom: "4px"
    }),

    sub: (fs) => ({
        fontSize: fs(0),
        fontWeight: "700",
        marginBottom: "6px",
    }),

    metaRow: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "8px",
        margin: "4px 0"
    },

    metaLabel: (fs) => ({ fontSize: fs(2), fontWeight: "700" }),
    metaLabelSmall: (fs) => ({ fontSize: fs(0), fontWeight: "700", opacity: 0.8 }),
    metaValue: (fs) => ({ fontSize: fs(2), fontWeight: "900" }),
    metaValueLarge: (fs) => ({ fontSize: fs(5), fontWeight: "900" }),

    headerGrid: {
        display: "flex",
        justifyContent: "space-between",
        textAlign: "left",
        margin: "5px 0"
    },

    gridItem: { flex: 1 },

    statusBox: (isDecrease, fs) => ({
        textAlign: "center",
        fontSize: fs(4),
        fontWeight: "900",
        padding: "6px 0",
        background: isDecrease ? "#000" : "transparent",
        color: isDecrease ? "#fff" : "#000",
        border: isDecrease ? "none" : "1px solid #000",
        margin: "4px 0"
    }),

    line: { borderBottom: "1px dashed #000", margin: "4px 0" },
    lineBold: { borderBottom: "2px solid #000", margin: "2px 0" },

    tableHeader: {
        display: "flex",
        justifyContent: "space-between",
        borderBottom: "1px solid #000",
        paddingBottom: "2px",
        marginBottom: "4px"
    },

    thName: (fs) => ({ fontSize: fs(0), fontWeight: "900" }),
    thQty: (fs) => ({ fontSize: fs(0), fontWeight: "900", width: "50px", textAlign: "right" }),

    itemRow: {
        display: "flex",
        width: "100%",
        padding: "5px 0",
        borderBottom: "1px dotted #ccc",
    },

    itemInfo: { flex: 1, minWidth: 0 },

    itemName: (fs) => ({
        fontSize: fs(4),
        fontWeight: "900",
        lineHeight: "1.1",
        textTransform: "uppercase"
    }),

    qtyBox: (isDecrease, fs) => ({
        width: "60px",
        fontSize: fs(6),
        fontWeight: "900",
        textAlign: "right",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end"
    }),

    comment: (fs) => ({ fontSize: fs(1), fontWeight: "700", fontStyle: "italic", marginTop: "3px" }),
    modifier: (fs) => ({ fontSize: fs(1), fontWeight: "700", color: "#333" }),
    reasonBox: (fs) => ({
        fontSize: fs(1),
        fontWeight: "900",
        marginTop: "4px",
        padding: "2px 4px",
        border: "1px solid #000",
        display: "inline-block"
    }),

    footer: (fs) => ({ textAlign: "center", marginTop: "10px" }),
    footerLine: { fontSize: "14px", fontWeight: "900" },
    footerLineSmall: { fontSize: "10px", opacity: 0.5, marginTop: "2px" }
};
