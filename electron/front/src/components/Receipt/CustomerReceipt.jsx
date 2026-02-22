import React from "react";
import QRCode from "react-qr-code";

const CustomerReceipt = ({
    orderedItems,
    checkData,
    profileData,
    tableName,
    hallName,
}) => {
    const terminalInfo = profileData?.data?.terminal || {};
    const filialName = profileData?.data?.profile?.restaurant_name ||
        profileData?.data?.profile?.company_name ||
        terminalInfo?.filial ||
        "RESTORAN";

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

    const baseFont = Number(terminalInfo?.customer_receipt || profileData?.data?.customer_receipt || profileData?.data?.profile?.customer_receipt || 0);
    const fs = (baseSize) => `${baseSize + baseFont}px`;

    const isQrHidden = Number(terminalInfo?.qr_on_check) === 1;

    const styles = {
        receipt: {
            width: "100%",
            boxSizing: "border-box",
            padding: "0 4px",
            margin: "0",
            background: "#fff",
            fontFamily: "'Consolas', monospace",
            fontSize: fs(12),
            color: "#000",
            fontWeight: "bold",
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
            width: "125px", // STRICT 125px out of 300px
            whiteSpace: "normal",
            wordWrap: "break-word",
            wordBreak: "break-word",
            lineHeight: "1.3",
            paddingRight: "4px"
        },
        colQty: { width: "35px", textAlign: "center", fontWeight: "900", whiteSpace: "nowrap" },
        colPrice: { width: "65px", textAlign: "right", fontWeight: "900", paddingRight: "4px", whiteSpace: "nowrap" },
        colTotal: {
            width: "75px",
            textAlign: "right",
            fontWeight: "900",
            whiteSpace: "nowrap",
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
        note: { fontSize: fs(10), fontStyle: "italic", marginTop: "3px" },
        modifier: {
            fontSize: fs(9),
            fontStyle: "italic",
            marginTop: "1px",
            fontWeight: "500",
        },
        statusBox: {
            textAlign: "center",
            marginTop: "4px",
            marginBottom: "4px",
            borderTop: "1px dashed #000",
            borderBottom: "1px dashed #000",
            padding: "3px 0",
            width: "100%",
            display: "block",
            boxSizing: "border-box"
        },
        statusText: {
            fontSize: fs(14),
            fontWeight: "900",
            textTransform: "uppercase",
            letterSpacing: "2px",
            display: "block",
            textAlign: "center"
        }
    };

    const isPaid = checkData?.payments &&
        checkData.payments.length > 0 &&
        checkData.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0) >= checkData.total;

    const payments = checkData?.payments || [];

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
                            width: "40%",
                            maxWidth: "80px",
                            objectFit: "contain",
                            display: "block",
                            margin: "0 auto 2px auto",
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

                {(checkData?.customer_name || checkData?.customerName || checkData?.customer?.name || checkData?.customer?.full_name) && (
                    <div style={styles.infoRow}>
                        <span style={styles.label}>Müştəri</span>
                        <span style={styles.value}>{checkData.customer_name || checkData.customerName || checkData.customer?.name || checkData.customer?.full_name}</span>
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
                            name: item.product_name || item.name || item.product?.name || "Naməlum",
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
                            <div key={i} style={{
                                ...styles.itemRow,
                                borderBottom: i === itemsToRender.length - 1 ? "none" : styles.itemRow.borderBottom
                            }}>
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



            {/* ÖDƏNİLMƏYİB STATUS */}
            {!isPaid && (
                <div style={styles.statusBox}>
                    <span style={styles.statusText}>ÖDƏNİLMƏYİB</span>
                </div>
            )}

            {/* SUMMARY */}
            <div>
                {checkData?.discount > 0 && (
                    <div style={styles.summaryRow}>
                        <span style={{ flex: 1 }}>
                            Endirim{" "}
                            {checkData.discountType === "percent"
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
                <div style={{ ...styles.statusBox, border: "2px solid #000" }}>
                    <span style={styles.statusText}>ÖDƏNİLİB</span>
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
                    <div style={styles.thankText}>Təşəkkür edirik!</div>
                    <div style={styles.link}>unipos.tech</div>
                </div>
            </div>
        </div>
    );
};

export default CustomerReceipt;
