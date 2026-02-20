import React from "react";
import QRCode from "react-qr-code";

const CustomerReceipt = ({
    orderedItems,
    checkData,
    profileData,
    tableName,
    hallName,
}) => {
    // Extract terminal info from profile data or use defaults
    const terminalInfo = profileData?.data?.terminal || {};
    const filialName = profileData?.data?.profile?.restaurant_name ||
        profileData?.data?.profile?.company_name ||
        terminalInfo?.filial ||
        "RESTORAN";

    // Logo priority: Terminal Logo -> Profile Logo -> Profile Img
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
        return <div style={styles.receipt}>Yüklənir...</div>;

    const now = new Date();
    const currentTime = `${now.getFullYear()}-${String(
        now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
        now.getHours()
    ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const baseFont = Number(terminalInfo?.customer_receipt || 0);

    const fs = (n) => `${baseFont + n}pt`;

    const isQrHidden = Number(terminalInfo?.qr_on_check) === 1;

    const styles = {
        receipt: {
            width: "100%",
            padding: "0px",
            boxSizing: "border-box",
            background: "#fff",
            fontFamily: "'Consolas','Fira Code', monospace",
            fontSize: fs(8), // Reduced
            color: "#000",
            fontWeight: "900",
            overflow: "hidden",
        },

        header: { textAlign: "center" },

        restaurantName: {
            fontSize: fs(12), // Reduced
            fontWeight: "900",
            marginBottom: "1mm", // Reduced
            textTransform: "uppercase"
        },

        line: {
            borderBottom: "1px dashed #000",
            margin: "0.5mm 0", // Compacted
        },

        infoSection: { fontSize: fs(8.5) }, // Reduced

        infoRow: {
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "0.2mm", // Compacted
        },

        label: { fontWeight: "900", minWidth: "26mm" },

        value: { textAlign: "right", flex: 1, marginLeft: "1mm" },

        items: { fontSize: fs(9) }, // Reduced

        itemsHeader: {
            display: "flex",
            fontWeight: "900",
            borderBottom: "1px solid #000",
            paddingBottom: "0.5mm",
            marginBottom: "0.5mm", // Reduced
            fontSize: fs(9),
        },

        colName: {
            flex: 1,
            whiteSpace: "normal",
            wordWrap: "break-word",
            wordBreak: "break-word",
            lineHeight: "1",
        },

        colQty: { width: "8mm", textAlign: "center", fontWeight: "900" },

        colPrice: { width: "12mm", textAlign: "right", fontWeight: "900" },

        colTotal: {
            width: "19mm",
            textAlign: "right",
            fontWeight: "900",
            paddingRight: "1mm",
        },

        itemRow: {
            display: "flex",
            padding: "0.5mm 0", // Reduced
            borderBottom: "1px dashed #c1c1c1",
            fontSize: fs(8.5), // Reduced
            fontWeight: "900",
            lineHeight: "1",
            alignItems: "center",
        },

        summaryRow: {
            display: "flex",
            marginBottom: "0.5mm", // Reduced
            fontSize: fs(9),
            fontWeight: "900",
        },

        total: {
            display: "flex",
            fontWeight: "900",
            fontSize: fs(11), // Reduced
            marginTop: "1mm", // Reduced
        },

        footer: {
            display: "flex",
            marginTop: "2mm", // Reduced
            paddingTop: "1mm",
            fontWeight: "900",
        },

        qr: { width: "25mm" },

        thanks: {
            flex: 1,
            paddingLeft: isQrHidden ? "0" : "3mm",
            textAlign: isQrHidden ? "center" : "left",
        },

        thankText: { marginBottom: "0.5mm", fontSize: fs(9), fontWeight: "900" }, // Reduced

        link: { fontSize: fs(7), wordBreak: "break-word", fontWeight: "900" },

        note: { fontSize: fs(8), fontStyle: "italic", marginTop: "1mm" }, // Reduced

        modifier: {
            fontSize: fs(7.5),
            fontStyle: "italic",
            marginTop: "0px",
            fontWeight: "500",
        },

        statusBox: {
            textAlign: "center",
            marginTop: "3mm",
            marginBottom: "3mm",
            borderTop: "1px dashed #000",
            borderBottom: "1px dashed #000",
            padding: "2mm 0",
            width: "100%",
            display: "block",
            boxSizing: "border-box"
        },
        statusText: {
            fontSize: fs(12),
            fontWeight: "900",
            textTransform: "uppercase",
            letterSpacing: "2px",
            display: "block",
            textAlign: "center"
        }
    };

    // Check if fully paid
    const isPaid = checkData?.payments &&
        checkData.payments.length > 0 &&
        checkData.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0) >= checkData.total;

    // Use payments if available, otherwise empty
    const payments = checkData?.payments || [];

    // Map Sale Types
    const getSaleTypeName = (type, typeName) => {
        if (typeName) return typeName;
        if (type == 1 || type === "takeaway") return "Al-götür";
        if (type == 2 || type === "delivery") return "Çatdırılma";
        return "Restoranda";
    };

    const displaySaleType = getSaleTypeName(checkData?.sale_type, checkData?.sale_type_name);

    const itemsToRender = (orderedItems && orderedItems.length > 0) ? orderedItems : (checkData?.orders_items || []);

    return (
        <div style={styles.receipt}>
            {/* HEADER */}
            <div style={styles.header}>
                {logoSrc && (
                    <img
                        src={logoSrc}
                        alt="Logo"
                        style={{
                            width: "50%",
                            maxWidth: "150px",
                            objectFit: "contain",
                            borderRadius: "8px",
                            display: "block",
                            margin: "0 auto 2mm auto",
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
                {terminalInfo?.address && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Ünvan</span>
                        <span style={styles.value}>{terminalInfo.address}</span>
                    </div>
                )}

                {terminalInfo?.phone && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Əlaqə</span>
                        <span style={styles.value}>{terminalInfo.phone}</span>
                    </div>
                )}

                {checkData?.orderId && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Çek №</span>
                        <span style={styles.value}>#{checkData.orderId}</span>
                    </div>
                )}

                {/* Customer Info if available */}
                {checkData?.customer_name && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Müştəri</span>
                        <span style={styles.value}>{checkData.customer_name}</span>
                    </div>
                )}

                {(hallName || tableName) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Satış yeri</span>
                        <span style={styles.value}>
                            {hallName}
                            {hallName && tableName ? "-" : ""}
                            {tableName}
                        </span>
                    </div>
                )}

                {checkData?.startDate && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Açılma tarixi</span>
                        <span style={styles.value}>{checkData.startDate.slice(0, 16)}</span>
                    </div>
                )}

                <div style={styles.infoRow}>
                    <span style={styles.label}>Çap tarixi</span>
                    <span style={styles.value}>{currentTime}</span>
                </div>

                <div style={styles.infoRow}>
                    <span style={styles.label}>Ofisiant</span>
                    <span style={styles.value}>{checkData?.waiter_name || checkData?.waiter?.name || "-"}</span>
                </div>

                {/* ✅ SATIŞ TİPİ */}
                {displaySaleType !== "Restoranda" && (
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

                {/* TIMER ROW FIXED */}
                {checkData?.rate_per_minute &&
                    Number(checkData?.rate_per_minute) !== 0 ? (
                    <div style={styles.itemRow}>
                        <span style={styles.colName}>Timer</span>
                        <span style={styles.colQty}></span>
                        <span style={styles.colPrice}></span>
                        <span style={styles.colTotal}>
                            {parseFloat(checkData.rate_per_minute).toFixed(2)} ₼
                        </span>
                    </div>
                ) : null}

                {itemsToRender
                    .filter((item) => (Number(item.quantity) > 0 || Number(item.count) > 0))
                    .map((item, i) => {
                        const params = {
                            name: item.name || item.product?.name || "Naməlum",
                            quantity: Number(item.quantity || item.count || 0),
                            price: Number(item.price || 0),
                            is_gift: Number(item.is_gift || 0) === 1,
                            modifiers: Array.isArray(item.modifiers)
                                ? item.modifiers
                                : typeof item.modifiers === "string"
                                    ? JSON.parse(item.modifiers || "[]")
                                    : []
                        };

                        return (
                            <div key={i} style={styles.itemRow}>
                                <div style={styles.colName}>
                                    {params.name}
                                    {params.modifiers.length > 0 && (
                                        <div style={styles.modifier}>
                                            ({params.modifiers.map((m) => m.count > 0 ? `${m.name} (x${m.count})` : m.name).join(", ")})
                                        </div>
                                    )}
                                    {item.comment && (
                                        <div style={{ ...styles.modifier, fontStyle: 'italic' }}>
                                            - {item.comment}
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
                                        {params.price.toFixed(2)}
                                    </span>
                                )}

                                <span style={styles.colTotal}>
                                    {(params.price * params.quantity).toFixed(2)} ₼
                                </span>
                            </div>
                        );
                    })}
            </div>

            <div style={styles.line}></div>

            {/* ÖDƏNİLMƏYİB STATUS - Only if Not Paid */}
            {!isPaid && (
                <div style={styles.statusBox}>
                    <span style={styles.statusText}>ÖDƏNİLMƏYİB</span>
                </div>
            )}

            {/* SUMMARY */}
            <div style={styles.summary}>
                {checkData?.discount > 0 && (
                    <div style={styles.summaryRow}>
                        <span style={{ flex: 1 }}>
                            Endirim{" "}
                            {checkData.discountType === "percent" // Changed from percentage to handle different data
                                ? `(${checkData.discount}%)`
                                : ""}
                        </span>

                        <span style={styles.colTotal}>
                            -{Number(checkData.discountValue || checkData.discount_value || 0).toFixed(2)} ₼
                        </span>
                    </div>
                )}

                {checkData?.serviceFee > 0 && (
                    <div style={styles.summaryRow}>
                        <span style={{ flex: 1 }}>
                            Xidmət haqqı{" "}
                            {checkData.serviceFeeType === "percent"
                                ? `(${checkData.serviceFee}%)`
                                : ""}
                        </span>

                        <span style={styles.colTotal}>
                            {Number(checkData.serviceFeeValue || checkData.service_fee_value || 0).toFixed(2)} ₼
                        </span>
                    </div>
                )}

                {checkData?.deposit > 0 && (
                    <div style={styles.summaryRow}>
                        <span style={{ flex: 1 }}>Depozit</span>
                        <span style={styles.colTotal}>{Number(checkData.deposit || 0).toFixed(2)} ₼</span>
                    </div>
                )}

                {checkData?.note && (
                    <div style={styles.note}>Qeyd: {checkData.note}</div>
                )}
            </div>

            {/* TOTAL */}
            <div style={styles.total}>
                <span style={{ flex: 1 }}>YEKUN</span>
                <span style={styles.colTotal}>{Number(checkData?.total || 0).toFixed(2)} ₼</span>
            </div>

            {/* ÖDƏNİŞ METODLARI */}
            {payments.length > 0 && (
                <div style={{ marginTop: "2mm" }}>
                    <div style={styles.line}></div>

                    <div
                        style={{
                            fontWeight: "900",
                            marginBottom: "1mm",
                            marginTop: "1mm",
                            fontSize: fs(10),
                        }}
                    >
                        Ödəniş üsulları:
                    </div>

                    {payments.map((pay, idx) => (
                        <div key={idx} style={styles.summaryRow}>
                            <span style={{ flex: 1 }}>
                                {pay.paymentMethodName || pay.name || pay.method_name || "Nağd"}
                            </span>
                            <span>
                                {parseFloat(pay.paidAmount || pay.amount || 0).toFixed(2)} ₼
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* ÖDƏNİLİB STATUS */}
            {isPaid && (
                <div style={{ ...styles.statusBox, border: "3px solid #000" }}>
                    <span style={styles.statusText}>ÖDƏNİLİB</span>
                </div>
            )}

            {/* FOOTER */}
            <div style={styles.footer}>
                {!isQrHidden && (
                    <div style={styles.qr}>
                        <QRCode value={qrCodeValue} size={80} level="H" />
                    </div>
                )}

                <div style={styles.thanks}>
                    <div style={styles.thankText}>Təşəkkür edirik!</div>
                    <div style={styles.link}>unipos.tech</div>
                </div>
            </div>
        </div>
    );
};

export default CustomerReceipt;
