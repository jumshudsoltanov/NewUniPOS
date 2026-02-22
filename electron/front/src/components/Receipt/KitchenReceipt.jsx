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
    selectedCustomer,
    isDecrease,
}) => {
    const now = new Date();
    const currentTime = `${now.getFullYear()}-${String(
        now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
        now.getHours()
    ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const items = orderedItems.length > 0 ? orderedItems : [];
    const hasDecrease = isDecrease || items.some((i) => i.changeType === "decrease");

    const cleanTable = String(table).replace(/masa/gi, "").trim();
    const cleanWaiter = String(waiter).replace(/ofisiant/gi, "").trim();

    const baseFont = Number(terminalInfo?.kitchen_receipt || 0);
    const fs = (n) => `${n + baseFont}px`;

    const styles = {
        receipt: {
            width: "100%",
            boxSizing: "border-box",
            padding: "0 2px",
            margin: "0",
            background: "#fff",
            fontFamily: "'Consolas', monospace",
            fontSize: fs(12),
            color: "#000",
            fontWeight: "bold",
        },
        header: { textAlign: "center", marginBottom: "4px" },
        title: {
            fontSize: fs(16),
            fontWeight: "900",
            letterSpacing: "1px",
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
        value: { textAlign: "right", flex: "1 1 auto", marginLeft: "4px", wordBreak: "break-word" },
        items: { fontSize: fs(12) },
        itemsHeader: {
            display: "flex",
            fontWeight: "900",
            borderBottom: "1px solid #000",
            paddingBottom: "2px",
            marginBottom: "2px",
            fontSize: fs(12),
        },
        colName: {
            flex: "1 1 70%",
            whiteSpace: "normal",
            wordWrap: "break-word",
            wordBreak: "break-word",
            lineHeight: "1.2",
            paddingRight: "2px"
        },
        colQty: { flex: "0 0 30%", textAlign: "right", fontWeight: "900" },
        itemRow: {
            display: "flex",
            padding: "3px 0",
            borderBottom: "1px dashed #000",
            fontSize: fs(13),
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
            fontSize: fs(11),
            fontWeight: "900",
        },
        modifier: {
            fontSize: fs(10),
            fontStyle: "italic",
            marginTop: "1px",
            fontWeight: "500",
        },
    };

    return (
        <div style={styles.receipt}>
            {/* HEADER */}
            <div style={styles.header}>
                <div style={styles.title}>MƏTBƏX ÇEKİ</div>
                <div style={{ fontSize: fs(11), marginTop: "2px", fontWeight: "900" }}>{currentTime}</div>
            </div>

            <div style={styles.line}></div>

            {/* ORDER INFO */}
            <div style={styles.infoSection}>
                <div style={styles.infoRow}>
                    <span style={styles.label}>Ofisiant</span>
                    <span style={styles.value}>{cleanWaiter}</span>
                </div>

                <div style={styles.infoRow}>
                    <span style={styles.label}>Çek №</span>
                    <span style={styles.value}>#{checkData?.id || orderId?.toString().slice(0, 8)}</span>
                </div>

                {hallName && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Satış yeri</span>
                        <span style={styles.value}>
                            {hallName}
                            {cleanTable ? `-${cleanTable}` : ""}
                        </span>
                    </div>
                )}

                <div style={styles.infoRow}>
                    <span style={styles.label}>Satış tipi</span>
                    <span style={styles.value}>{typeName || "Restoranda"}</span>
                </div>

                {(selectedCustomer || checkData?.customerName) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Müştəri</span>
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

                {items.map((item, idx) => {
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

                    const itemName = item.product_name || item.name || item.product?.name || "Naməlum";

                    return (
                        <div key={idx} style={styles.itemRow}>
                            <div style={styles.colName}>
                                {itemName}
                                {item.comment && (
                                    <div style={styles.modifier}>* {item.comment}</div>
                                )}
                                {item.reasonName && (
                                    <div style={styles.modifier}>! {item.reasonName}</div>
                                )}
                                {mods.length > 0 && (
                                    <div style={styles.modifier}>
                                        + {mods.map((m) => (m.count > 0 ? `${m.name || m.product_name || "Adsız"} (x${m.count})` : m.name || m.product_name || "Adsız")).join(", ")}
                                    </div>
                                )}
                            </div>

                            <div style={styles.colQty}>
                                {item.changeType === "decrease" ? `-${item.diff}` : `${item.quantity}`}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={styles.line}></div>

            {/* FOOTER */}
            <div style={styles.footer}>Mətbəxə uğurlar!</div>
        </div>
    );
};

export default KitchenReceipt;
