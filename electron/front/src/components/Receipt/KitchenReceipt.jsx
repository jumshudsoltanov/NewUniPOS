import React from "react";

const KitchenReceipt = ({
    orderedItems = [],
    table = "",
    waiter = "",
    hallName,
    orderId,
    terminalInfo,
    typeName,
    checkData,
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
    const hasDecrease = items.some((i) => i.changeType === "decrease");

    // Təkrarçılığın qarşısını alırıq
    const cleanTable = String(table).replace(/masa/gi, "").trim();
    const cleanWaiter = String(waiter)
        .replace(/ofisiant/gi, "")
        .trim();

    return (
        <div style={styles.receipt(fs)}>
            <style>
                {`
        @media print {
          @page { margin: 0; size: auto; }
          body { margin: 0; padding: 0; width: 100%; box-sizing: border-box; }
        }
      `}
            </style>

            {/* HEADER */}
            <div style={styles.header}>
                <div style={styles.title(fs)}>MƏTBƏX ÇEKİ</div>
                <div style={styles.sub(fs)}>{formatDate(now)}</div>
                <div style={styles.meta(fs)}>
                    {(checkData?.sale_type === 0 || checkData?.sale_type === "dine_in" || !checkData?.sale_type) && hallName ? `${hallName} - MASA: ${cleanTable}` : ""}
                </div>
                <div style={styles.meta(fs)}>
                    OFİSİANT: {cleanWaiter} • #{checkData?.id || orderId?.toString().slice(0, 8)}
                </div>
                <div style={styles.meta(fs)}>
                    Satış üsulu: {typeName || "Restoranda"}
                </div>
            </div>

            <div style={styles.line}></div>

            {/* STATUS */}
            <div style={styles.status(fs)}>
                {hasDecrease ? "SİLİNƏN MƏHSULLAR" : "YENİ SİFARİŞ"}
            </div>

            <div style={styles.line}></div>

            {/* ITEMS */}
            <div style={{ width: "100%" }}>
                {items.map((item, idx) => (
                    <div key={idx} style={styles.item}>
                        <div style={styles.itemLeft}>
                            <div style={styles.itemName(fs)}>{item.name}</div>
                            {item.comment && (
                                <div style={styles.comment(fs)}>* {item.comment}</div>
                            )}
                            {item.reasonName && (
                                <div style={styles.comment(fs)}>! {item.reasonName}</div>
                            )}
                            {/* MODIFIERS */}
                            {(() => {
                                let mods = [];
                                try {
                                    if (Array.isArray(item.modifiers)) {
                                        mods = item.modifiers;
                                    } else if (typeof item.modifiers === "string") {
                                        // Check if it's a JSON string representing an array
                                        const parsed = JSON.parse(item.modifiers);
                                        if (Array.isArray(parsed)) mods = parsed;
                                    }
                                } catch (e) {
                                    console.error("Modifier parse error in Receipt:", e);
                                    mods = [];
                                }

                                return (
                                    mods.length > 0 &&
                                    mods.map((mod, mIdx) => (
                                        <div key={mIdx} style={styles.comment(fs)}>
                                            + {mod.count > 0 ? `${mod.name || mod.product_name || "Adsız"} (x${mod.count})` : (mod.name || mod.product_name || "Adsız")}
                                        </div>
                                    ))
                                );
                            })()}
                        </div>
                        {/* SAY HİSSƏSİ - Sabit genişlik verdik ki, heç vaxt itməsin */}
                        <div style={styles.qty(fs)}>
                            {item.changeType === "decrease"
                                ? `-${item.diff}`
                                : `${item.quantity}`}
                        </div>
                    </div>
                ))}
            </div>

            <div style={styles.line}></div>

            {/* FOOTER */}
            <div style={styles.footer(fs)}>Mətbəxə uğurlar!</div>
        </div>
    );
};

export default KitchenReceipt;

const styles = {
    receipt: (fs) => ({
        width: "100%",
        padding: "0",
        margin: "0",
        boxSizing: "border-box",
        background: "#fff",
        fontFamily: "monospace",
        color: "#000",
    }),

    header: { textAlign: "center", marginBottom: "1px", width: "100%" },

    title: (fs) => ({
        fontSize: fs(6),
        fontWeight: "900",
        letterSpacing: "1px",
        wordBreak: "break-word",
    }),

    sub: (fs) => ({
        fontSize: fs(1),
        fontWeight: "700",
        marginBottom: "2px",
    }),

    meta: (fs) => ({
        fontSize: fs(2),
        fontWeight: "800",
        lineHeight: "1.3",
        wordBreak: "break-word",
    }),

    line: {
        borderBottom: "1px dashed #000",
        margin: "1px 0",
        width: "100%",
    },

    status: (fs) => ({
        textAlign: "center",
        fontSize: fs(4),
        fontWeight: "900",
        padding: "2px 0",
        wordBreak: "break-word",
    }),

    item: {
        display: "flex",
        width: "100%",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "2px 0",
        borderBottom: "1px solid #eee",
    },

    itemLeft: {
        flex: 1,
        minWidth: 0,
        paddingRight: "4px",
    },

    itemName: (fs) => ({
        fontSize: fs(3),
        fontWeight: "900",
        wordBreak: "break-word",
        lineHeight: "1.2",
    }),

    comment: (fs) => ({
        fontSize: fs(1),
        fontWeight: "700",
        wordBreak: "break-word",
        marginTop: "2px",
    }),

    qty: (fs) => ({
        width: "40px", // Reduced width slightly to prevent cutoff on tight margins
        flexShrink: 0,
        fontSize: fs(4),
        fontWeight: "900",
        textAlign: "right",
        whiteSpace: "nowrap",
    }),

    footer: (fs) => ({
        textAlign: "center",
        marginTop: "4px",
        fontSize: fs(2),
        fontWeight: "900",
    }),
};
