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
}) => {
    const now = new Date();
    const currentTime = `${now.getFullYear()}-${String(
        now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
        now.getHours()
    ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const items = orderedItems.length > 0 ? orderedItems : [];
    const hasDecrease = items.some((i) => i.changeType === "decrease");

    const cleanTable = String(table).replace(/masa/gi, "").trim();
    const cleanWaiter = String(waiter).replace(/ofisiant/gi, "").trim();

    // 🔵 GLOBAL FONTSIZE
    const baseFont = Number(terminalInfo?.kitchen_receipt || 9);

    // 🔵 FONT HESABLAMA FUNKSIYASI
    const fs = (n) => `${baseFont + n}pt`;

    const styles = {
        receipt: {
            width: "100%",
            padding: "0px",
            boxSizing: "border-box",
            background: "#fff",
            fontFamily: "'Consolas','Fira Code', monospace",
            fontSize: fs(9),
            color: "#000",
            fontWeight: "900",
            overflow: "hidden",
        },

        header: { textAlign: "center" },

        title: {
            fontSize: fs(13),
            fontWeight: "900",
        },

        line: {
            borderBottom: "1px dashed #000",
            margin: "1mm 0",
        },

        infoSection: { fontSize: fs(9.5) },

        infoRow: {
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "0.6mm",
        },

        label: { fontWeight: "900", minWidth: "26mm" },

        value: { textAlign: "right", flex: 1, marginLeft: "1mm" },

        items: { fontSize: fs(10) },

        itemsHeader: {
            display: "flex",
            fontWeight: "900",
            borderBottom: "1px solid #000",
            paddingBottom: "0.5mm",
            marginBottom: "1mm",
            fontSize: fs(10),
        },

        colName: {
            flex: 1,
            whiteSpace: "normal",
            wordWrap: "break-word",
            wordBreak: "break-word",
            lineHeight: "1.05",
        },

        colQty: { width: "12mm", textAlign: "right", fontWeight: "900" },

        itemRow: {
            display: "flex",
            padding: "1mm 0",
            borderBottom: "1px dashed #c1c1c1",
            fontSize: fs(9.8),
            fontWeight: "900",
            lineHeight: "1.05",
            alignItems: "center",
        },

        status: {
            textAlign: "center",
            fontSize: fs(12),
            fontWeight: "900",
            padding: "2mm 0",
            wordBreak: "break-word",
        },

        footer: {
            textAlign: "center",
            marginTop: "4mm",
            fontSize: fs(10),
            fontWeight: "900",
        },

        modifier: {
            fontSize: fs(8.5),
            fontStyle: "italic",
            marginTop: "1px",
            fontWeight: "500",
        },
    };

    return (
        <div style={styles.receipt}>
            <style>
                {`
        @media print {
          @page {
            size: auto;
            margin: 0mm; /* Printerin öz marginlərini ləğv edir */
          }
          html, body {
            margin: 0px !important;
            padding: 0px !important;
            width: 100%;
          }
          /* Mümkün sürüşmələrin qarşısını almaq üçün containeri məcbur edirik */
          div {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}
            </style>

            {/* HEADER */}
            <div style={styles.header}>
                <div style={styles.title}>MƏTBƏX ÇEKİ</div>
                <div style={{ fontSize: fs(9.5), marginTop: "1mm", fontWeight: "900" }}>{currentTime}</div>
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

                {(checkData?.sale_type === 0 || checkData?.sale_type === "dine_in" || !checkData?.sale_type) && hallName && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Satış yeri</span>
                        <span style={styles.value}>
                            {hallName}
                            {tableName || cleanTable ? "-" : ""}
                            {tableName || cleanTable}
                        </span>
                    </div>
                )}

                <div style={styles.infoRow}>
                    <span style={styles.label}>Satış tipi</span>
                    <span style={styles.value}>{typeName || "Restoranda"}</span>
                </div>

                {/* CUSTOMER INFO */}
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

                    return (
                        <div key={idx} style={styles.itemRow}>
                            <div style={styles.colName}>
                                {item.name}
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
