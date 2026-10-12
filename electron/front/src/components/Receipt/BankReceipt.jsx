import React from "react";

const fmtAmt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : String(v ?? "");
};

const BankReceipt = ({ bank = {}, orderId, restaurantName, copyLabel }) => {
    const approved = String(bank.status || "").toUpperCase() === "APPROVED" || (bank.rrn && (!bank.hostRespCode || bank.hostRespCode === "00"));
    const fs = (n) => `${n}px`;
    const styles = {
        receipt: {
            width: "100%",
            boxSizing: "border-box",
            padding: "0 2px",
            margin: 0,
            background: "#fff",
            fontFamily: "'Consolas', 'Courier New', 'Lucida Console', monospace",
            fontSize: fs(14),
            color: "#000",
            fontWeight: "500",
        },
        center: { textAlign: "center" },
        title: { fontSize: fs(19), fontWeight: "900", textTransform: "uppercase", marginBottom: "2px" },
        sub: { fontSize: fs(13) },
        line: { borderBottom: "1px dashed #000", margin: "5px 0" },
        row: { display: "flex", justifyContent: "space-between", fontSize: fs(13), marginBottom: "2px" },
        label: { fontWeight: "900" },
        value: { textAlign: "right", flex: 1, marginLeft: "4px" },
        amount: { display: "flex", justifyContent: "space-between", fontSize: fs(19), fontWeight: "900", margin: "7px 0" },
        status: { fontSize: fs(17), fontWeight: "900", margin: "5px 0", letterSpacing: "1px" },
        footer: { fontSize: fs(13), marginTop: "6px", paddingBottom: "30px" },
    };

    return (
        <div style={styles.receipt}>
            <div style={styles.center}>
                <div style={styles.title}>{bank.bankOwner || "BANK"}</div>
                <div style={styles.sub}>{bank.merchant || restaurantName || ""}</div>
                {copyLabel && <div style={styles.sub}>{copyLabel}</div>}
            </div>

            <div style={styles.line} />

            <div style={styles.row}><span style={styles.label}>Əməliyyat</span><span style={styles.value}>{bank.pmtName || "Satış"}</span></div>
            <div style={styles.row}><span style={styles.label}>Tarix</span><span style={styles.value}>{bank.dateTime || ""}</span></div>
            <div style={styles.row}><span style={styles.label}>Terminal</span><span style={styles.value}>{bank.terminal || ""}</span></div>
            {orderId && <div style={styles.row}><span style={styles.label}>Çek №</span><span style={styles.value}>{orderId}</span></div>}

            <div style={styles.line} />

            <div style={styles.row}><span style={styles.label}>Kart</span><span style={styles.value}>{bank.cardMask || ""}</span></div>
            {bank.cardLabel && <div style={styles.row}><span style={styles.label}>Növ</span><span style={styles.value}>{bank.cardLabel}</span></div>}

            <div style={styles.amount}>
                <span>MƏBLƏĞ</span>
                <span>{fmtAmt(bank.amount)} AZN</span>
            </div>

            <div style={styles.line} />

            <div style={styles.row}><span style={styles.label}>RRN</span><span style={styles.value}>{bank.rrn || ""}</span></div>
            <div style={styles.row}><span style={styles.label}>Təsdiq kodu</span><span style={styles.value}>{bank.authCode || ""}</span></div>
            {bank.trxId && <div style={styles.row}><span style={styles.label}>Tranzaksiya</span><span style={styles.value}>{bank.trxId}</span></div>}
            {(bank.stan || bank.batch) && (
                <div style={styles.row}>
                    <span style={styles.label}>STAN / Batch</span>
                    <span style={styles.value}>{bank.stan || "-"} / {bank.batch || "-"}</span>
                </div>
            )}

            <div style={styles.line} />

            <div style={{ ...styles.center, ...styles.status }}>{approved ? "TƏSDİQLƏNDİ" : (bank.status || "RƏDD EDİLDİ")}</div>
            <div style={{ ...styles.center, ...styles.footer }}>UniPOS Tech</div>
        </div>
    );
};

export default BankReceipt;
