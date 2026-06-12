import React, { useState, useEffect, useCallback } from "react";
import { Modal, Button, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import apiConfig, { getSocket } from "../../utils/apiConfig";
import { resolveCashierPrintersForPrint } from "../../utils/printerHelpers.jsx";
import { toast } from "sonner";
import { t } from "../../utils/translations";
import { getCurrencySymbol } from "../../utils/formatPrice";
import "../ReportModal/ReportModal.css";
import "./SalesShiftModal.css";

const money = (n) => {
    const v = Number(n);
    if (Number.isNaN(v)) return "0.00";
    return v.toFixed(2);
};

function tryParseSnapshot(row) {
    if (!row?.report_snapshot) return null;
    try {
        return JSON.parse(row.report_snapshot);
    } catch {
        return null;
    }
}

const buildShiftPrintHtml = ({
    profileName,
    logoSrc,
    openedAt,
    closedAt,
    terminalLabel,
    openedBy,
    closedBy,
    startingCash,
    summary,
    footerNote,
    baseFontPx,
}) => {
    const fs = (baseSize) => `${baseSize + (Number(baseFontPx) || 0)}px`;
    const empRows = (summary?.byEmployee || [])
        .map((r) => `<tr><td>${escapeHtml(r.name)}</td><td class="r">${r.checks_count}</td><td class="r">${money(r.total)}</td></tr>`)
        .join("");
    const smRows = (summary?.bySaleMethod || [])
        .map((r) => `<tr><td>${escapeHtml(r.name)}</td><td class="r">${r.count}</td><td class="r">${money(r.total)}</td></tr>`)
        .join("");
    const payRows = Object.entries(summary?.payments || {})
        .map(([n, a]) => `<tr><td>${escapeHtml(n)}</td><td class="r">${money(a)}</td></tr>`)
        .join("");
    const unpaidRows = Object.entries(summary?.unpaid_payments || {})
        .map(([n, a]) => `<tr><td>${escapeHtml(n)}</td><td class="r">${money(a)}</td></tr>`)
        .join("");
    const tagRows = Object.entries(summary?.tags || {})
        .map(([t, d]) => `<tr><td>${escapeHtml(t)} (${d.count})</td><td class="r">${money(d.total)}</td></tr>`)
        .join("");
    const catRows = (summary?.byCategory || [])
        .map((cat) => `<tr class="cat-row"><td><b>${escapeHtml(cat.name)}</b></td><td class="r"><b>${cat.quantity?.toFixed(2)}</b></td><td class="r"><b>${money(cat.total)}</b></td></tr>`)
        .join("");

    return `
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; color: #000; }
  body { font-family: 'Consolas', 'Courier New', monospace; font-size: ${fs(9)}; color: #000; }
  .divider { border: none; border-top: 1px solid #000; margin: 3px 0; }
  .logo-wrap { text-align: center; margin-bottom: 4px; }
  .logo-wrap img { max-width: 60px; max-height: 40px; object-fit: contain; }
  .title { font-size: ${fs(10)}; font-weight: 900; text-align: center; margin-bottom: 1px; letter-spacing: 1px; }
  .profile { font-size: ${fs(9)}; font-weight: 700; text-align: center; margin-bottom: 2px; }
  .kv { display: flex; justify-content: space-between; font-size: ${fs(8)}; margin-bottom: 2px; }
  .kv-label { color: #000; }
  .kv-value { font-weight: 700; color: #000; text-align: right; }
  .section-title { font-size: ${fs(8)}; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin: 4px 0 2px; }
  table { width: 100%; border-collapse: collapse; font-size: ${fs(8)}; color: #000; margin-bottom: 2px; }
  th { font-weight: 900; text-align: left; padding: 2px 1px; border-bottom: 1px solid #000; font-size: ${fs(7)}; text-transform: uppercase; color: #000; }
  td { padding: 2px 1px; border-bottom: 1px dashed #000; color: #000; }
  tbody tr:last-child td { border-bottom: none; }
  .r { text-align: right; }
  .cat-row td { font-weight: 900; border-bottom: 1px solid #000; }
  .total-row { display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px; padding-top: 2px; border-top: 2px solid #000; }
  .total-label { font-size: ${fs(9)}; font-weight: 900; text-transform: uppercase; color: #000; }
  .total-amount { font-size: ${fs(10)}; font-weight: 900; color: #000; }
  .footer-note { text-align: center; font-size: ${fs(7)}; margin-top: 4px; border-top: 1px dashed #000; padding-top: 4px; }
</style>
${logoSrc ? `<div class="logo-wrap"><img src="${logoSrc}" alt="logo"/></div>` : ""}
${profileName ? `<div class="profile">${escapeHtml(profileName)}</div>` : ""}
<div class="title">{t("satis_novbesi̇_hesabati")}</div>
<hr class="divider"/>
<div class="kv"><span class="kv-label">{t("acilis")}</span><span class="kv-value">${escapeHtml(openedAt || "—")}</span></div>
<div class="kv"><span class="kv-label">{t("baglanma")}</span><span class="kv-value">${escapeHtml(closedAt || "—")}</span></div>
<div class="kv"><span class="kv-label">{t("terminal")}</span><span class="kv-value">${escapeHtml(terminalLabel || "Hamısı")}</span></div>
<div class="kv"><span class="kv-label">{t("acan")}</span><span class="kv-value">${escapeHtml(openedBy || "—")}</span></div>
<div class="kv"><span class="kv-label">{t("baglayan")}</span><span class="kv-value">${escapeHtml(closedBy || "—")}</span></div>
${Number(startingCash) > 0 ? `<div class="kv"><span class="kv-label">{t("baslangic_qaliq")}</span><span class="kv-value">${money(startingCash)} &#8380;</span></div>` : ""}
<hr class="divider"/>
<div class="section-title">{t("umumi")}</div>
<div class="kv"><span class="kv-label">{t("baglanmis_cek")}</span><span class="kv-value">${summary?.checksCount ?? 0}</span></div>
<div class="total-row"><span class="total-label">{t("cem_mebleg")}</span><span class="total-amount">${money(summary?.grossTotal)} &#8380;</span></div>
<hr class="divider" style="margin-top:8px"/>
<div class="section-title">{t("satis_hesabati")}</div>
<div class="kv"><span class="kv-label">{t("cem")}</span><span class="kv-value">${money(summary?.total_amount)} &#8380;</span></div>
<div class="kv"><span class="kv-label">Vergi</span><span class="kv-value">${money(summary?.total_tax)} &#8380;</span></div>
<div class="kv"><span class="kv-label">{t("i̇kram")}</span><span class="kv-value">${money(summary?.total_gift)} &#8380;</span></div>
<div class="kv"><span class="kv-label">{t("xidmet")}</span><span class="kv-value">${money(summary?.total_service)} &#8380;</span></div>
<div class="kv"><span class="kv-label">Endirim</span><span class="kv-value">${money(summary?.total_discount)} &#8380;</span></div>
<div class="kv"><span class="kv-label">{t("catdirilma_haqqi")}</span><span class="kv-value">${money(summary?.delivery_fee)} &#8380;</span></div>
<div class="kv"><span class="kv-label">{t("refund")}</span><span class="kv-value">${money(summary?.total_refund)} &#8380;</span></div>
<div class="kv"><span class="kv-label">{t("silinmeler")}</span><span class="kv-value">${money(summary?.total_deleted)} &#8380;</span></div>
${(Number(summary?.total_paid || 0) > 0 || Number(summary?.total_unpaid || 0) > 0) ? `<div class="kv" style="border-top:1px dashed #000;margin-top:3px;padding-top:3px"><span class="kv-label">{t("odenisli_baglamalar")}</span><span class="kv-value">${money(summary?.total_paid)} &#8380;</span></div><div class="kv"><span class="kv-label">{t("odenissiz_baglamalar")}</span><span class="kv-value">${money(summary?.total_unpaid)} &#8380;</span></div>` : ""}
<div class="total-row" style="margin-top:3px"><span class="total-label">Yekun</span><span class="total-amount">${money(summary?.net_total)} &#8380;</span></div>
${Number(summary?.guest_count || 0) > 0 ? `<div class="kv" style="margin-top:3px"><span class="kv-label">{t("guest_count")}</span><span class="kv-value">${summary?.guest_count ?? 0}</span></div>` : ""}
<hr class="divider" style="margin-top:8px"/>
<div class="section-title">{t("ofisiant_uzre")}</div>
<table><thead><tr><th>Ad</th><th class="r">{t("cek")}</th><th class="r">{t("mebleg")}</th></tr></thead><tbody>${empRows || "<tr><td colspan='3' style='text-align:center'>—</td></tr>"}</tbody></table>
<hr class="divider"/>
<div class="section-title">{t("satis_tipi_1")}</div>
<table><thead><tr><th>{t("type")}</th><th class="r">Say</th><th class="r">{t("mebleg")}</th></tr></thead><tbody>${smRows || "<tr><td colspan='3' style='text-align:center'>—</td></tr>"}</tbody></table>
${payRows ? `<hr class="divider"/><div class="section-title">{t("odenis_usullari")}</div><table><thead><tr><th>{t("usul")}</th><th class="r">{t("mebleg")}</th></tr></thead><tbody>${payRows}</tbody></table>` : ""}
${unpaidRows ? `<hr class="divider"/><div class="section-title">{t("odenissiz_baglamalar")}</div><table><thead><tr><th>{t("usul")}</th><th class="r">{t("mebleg")}</th></tr></thead><tbody>${unpaidRows}</tbody></table>` : ""}
${tagRows ? `<hr class="divider"/><div class="section-title">{t("etiketler")}</div><table><thead><tr><th>Etiket</th><th class="r">{t("mebleg")}</th></tr></thead><tbody>${tagRows}</tbody></table>` : ""}
${catRows ? `<hr class="divider"/><div class="section-title">{t("kateqoriya_hesabati")}</div><table><thead><tr><th>Kateqoriya</th><th class="r">Say</th><th class="r">{t("mebleg")}</th></tr></thead><tbody>${catRows}</tbody></table>` : ""}
${footerNote ? `<div class="footer-note">${escapeHtml(footerNote)}</div>` : ""}`;
};

function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function toastShiftError(e, fallback) {
    const raw =
        e?.response?.data?.message ||
        e?.response?.data?.original?.sqlMessage ||
        e?.message ||
        "";
    const s = String(raw).toLowerCase();
    if (s.includes("sales_shifts") && (s.includes("doesn't exist") || s.includes("does not exist"))) {
        toast.error(
            "Növbə cədvəli bazada yoxdur. Backend (Node) prosesini tam bağlayıb tətbiqi yenidən açın — cədvəl avtomatik yaradılacaq.",
        );
        return;
    }
    if (typeof raw === "string" && raw.length > 0 && raw.length < 160) {
        toast.error(raw);
        return;
    }
    toast.error(fallback);
}

function ShiftHistoryDetailBody({ row, snapshot, profileName }) {
    const s = snapshot?.summary;
    const closedLabel = row?.closed_at ? new Date(row.closed_at).toLocaleString("az-AZ") : "—";
    const openedLabel = row?.opened_at ? new Date(row.opened_at).toLocaleString("az-AZ") : "—";

    return (
        <div className="ssd-body-inner">
            <div className="ssd-center-title">
                <h4>{profileName || "Bağlanmış növbə"}</h4>
                <div className="ssd-status-pill">
                    <span className="ssd-status-pill-dot" aria-hidden />{t("arxiv_·_bagli")}</div>
            </div>

            {/* Məlumat kartı */}
            <div className="ssd-card">
                <div className="ssd-card-title">
                    <i className="bi bi-info-circle-fill" aria-hidden />{t("melumat")}</div>
                <div className="ssd-kv">
                    <span>{t("baglanma")}</span>
                    <span>{closedLabel}</span>
                </div>
                <div className="ssd-kv">
                    <span>{t("acilis")}</span>
                    <span>{openedLabel}</span>
                </div>
                <div className="ssd-kv">
                    <span>{t("terminal")}</span>
                    <span>{row?.terminal_id || "—"}</span>
                </div>
                <div className="ssd-kv">
                    <span>{t("acan")}</span>
                    <span>{row?.opened_by_name || "—"}</span>
                </div>
                <div className="ssd-kv">
                    <span>{t("baglayan")}</span>
                    <span>{row?.closed_by_name || "—"}</span>
                </div>
                {Number(row?.starting_cash || snapshot?.startingCash) > 0 && (
                    <div className="ssd-kv">
                        <span>{t("baslangic_qaliq")}</span>
                        <span>{money(row?.starting_cash || snapshot?.startingCash)} {getCurrencySymbol()}</span>
                    </div>
                )}
            </div>

            {!s ? (
                <div className="ssd-empty-msg">{t("bu_novbe_ucun_saxlanmis_hesabat_tapilmadi")}</div>
            ) : (
                <>
                    {/* Ümumi kart */}
                    <div className="ssd-card">
                        <div className="ssd-card-title">
                            <i className="bi bi-bar-chart-fill" aria-hidden />{t("umumi")}</div>
                        <div className="ssd-kv">
                            <span>{t("baglanmis_cek")}</span>
                            <span>{s.checksCount ?? 0}</span>
                        </div>
                        <div className="ssd-total-row">
                            <span>{t("cem_mebleg")}</span>
                            <span>{money(s.grossTotal)} {getCurrencySymbol()}</span>
                        </div>
                    </div>

                    {/* Satış hesabatı */}
                    <div className="ssd-card">
                        <div className="ssd-card-title">
                            <i className="bi bi-receipt" aria-hidden />{t("satis_hesabati")}</div>
                        <div className="ssd-kv"><span>{t("cem")}</span><span>{money(s.total_amount)} {getCurrencySymbol()}</span></div>
                        <div className="ssd-kv"><span>Vergi</span><span>{money(s.total_tax)} {getCurrencySymbol()}</span></div>
                        <div className="ssd-kv"><span>{t("i̇kram")}</span><span>{money(s.total_gift)} {getCurrencySymbol()}</span></div>
                        <div className="ssd-kv"><span>{t("xidmet")}</span><span>{money(s.total_service)} {getCurrencySymbol()}</span></div>
                        <div className="ssd-kv"><span>Endirim</span><span>{money(s.total_discount)} {getCurrencySymbol()}</span></div>
                        <div className="ssd-kv"><span>{t("catdirilma_haqqi")}</span><span>{money(s.delivery_fee)} {getCurrencySymbol()}</span></div>
                        <div className="ssd-kv"><span>{t("refund")}</span><span>{money(s.total_refund)} {getCurrencySymbol()}</span></div>
                        <div className="ssd-kv"><span>{t("silinmeler")}</span><span>{money(s.total_deleted)} {getCurrencySymbol()}</span></div>
                        {(s.total_paid > 0 || s.total_unpaid > 0) && (
                            <>
                                <div className="ssd-kv" style={{borderTop:'1px dashed #e2e8f0',marginTop:4,paddingTop:4}}><span>{t("odenisli_baglamalar")}</span><span>{money(s.total_paid)} {getCurrencySymbol()}</span></div>
                                <div className="ssd-kv"><span>{t("odenissiz_baglamalar")}</span><span>{money(s.total_unpaid)} {getCurrencySymbol()}</span></div>
                            </>
                        )}
                        <div className="ssd-total-row"><span>Yekun</span><span>{money(s.net_total)} {getCurrencySymbol()}</span></div>
                    </div>
                    {(s.guest_count > 0) && (
                        <div className="ssd-card">
                            <div className="ssd-kv"><span>{t("guest_count")}</span><span>{s.guest_count ?? 0}</span></div>
                        </div>
                    )}

                    {/* Ofisiant */}
                    <div className="ssd-card">
                        <div className="ssd-card-title">
                            <i className="bi bi-person-fill" aria-hidden />{t("waiter")}</div>
                        <div className="ssd-table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Ad</th>
                                        <th className="num">{t("cek")}</th>
                                        <th className="num">{t("mebleg")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(s.byEmployee || []).length ? (
                                        s.byEmployee.map((r) => (
                                            <tr key={r.name}>
                                                <td>{r.name}</td>
                                                <td className="num">{r.checks_count}</td>
                                                <td className="num">{money(r.total)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="ssm-table-empty">—</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Satış tipi */}
                    <div className="ssd-card">
                        <div className="ssd-card-title">
                            <i className="bi bi-tag-fill" aria-hidden />{t("satis_tipi_1")}</div>
                        <div className="ssd-table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>{t("type")}</th>
                                        <th className="num">Say</th>
                                        <th className="num">{t("mebleg")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(s.bySaleMethod || []).length ? (
                                        s.bySaleMethod.map((r) => (
                                            <tr key={r.name}>
                                                <td>{r.name}</td>
                                                <td className="num">{r.count}</td>
                                                <td className="num">{money(r.total)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="ssm-table-empty">—</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Ödəniş üsulları */}
                    <div className="ssd-card">
                        <div className="ssd-card-title">
                            <i className="bi bi-credit-card-fill" aria-hidden />{t("odenis_usullari")}</div>
                        <div className="ssd-table-wrap">
                            <table>
                                <thead><tr><th>{t("usul")}</th><th className="num">{t("mebleg")}</th></tr></thead>
                                <tbody>
                                    {Object.keys(s.payments || {}).length ? (
                                        Object.entries(s.payments).map(([name, amount]) => (
                                            <tr key={name}><td>{name}</td><td className="num">{money(amount)}</td></tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={2} className="ssm-table-empty">{t("melumat_yoxdur")}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Ödənişsiz bağlamalar */}
                    <div className="ssd-card">
                        <div className="ssd-card-title">
                            <i className="bi bi-x-circle-fill" aria-hidden />{t("odenissiz_baglamalar")}</div>
                        <div className="ssd-table-wrap">
                            <table>
                                <thead><tr><th>{t("usul")}</th><th className="num">{t("mebleg")}</th></tr></thead>
                                <tbody>
                                    {Object.keys(s.unpaid_payments || {}).length ? (
                                        Object.entries(s.unpaid_payments).map(([name, amount]) => (
                                            <tr key={name}><td>{name}</td><td className="num">{money(amount)}</td></tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={2} className="ssm-table-empty">{t("melumat_yoxdur")}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Etiketlər */}
                    <div className="ssd-card">
                        <div className="ssd-card-title">
                            <i className="bi bi-bookmark-fill" aria-hidden />{t("etiketler")}</div>
                        <div className="ssd-table-wrap">
                            <table>
                                <thead><tr><th>Etiket</th><th className="num">Say</th><th className="num">{t("mebleg")}</th></tr></thead>
                                <tbody>
                                    {Object.keys(s.tags || {}).length ? (
                                        Object.entries(s.tags).map(([tag, details]) => (
                                            <tr key={tag}><td>{tag}</td><td className="num">{details.count}</td><td className="num">{money(details.total)}</td></tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={3} className="ssm-table-empty">{t("melumat_yoxdur")}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Kateqoriya hesabatı */}
                    <div className="ssd-card">
                        <div className="ssd-card-title">
                            <i className="bi bi-grid-fill" aria-hidden />{t("kateqoriya_hesabati")}</div>
                        <div className="ssd-table-wrap">
                            <table>
                                <thead><tr><th>{t("kateqoriya_/_mehsul")}</th><th className="num">Say</th><th className="num">{t("mebleg")}</th></tr></thead>
                                <tbody>
                                    {(s.byCategory || []).length ? (
                                        s.byCategory.map((cat) => (
                                            <React.Fragment key={cat.name}>
                                                <tr style={{ background: '#f0f4ff' }}>
                                                    <td style={{ fontWeight: 700, color: '#053796' }}>{cat.name}</td>
                                                    <td className="num" style={{ fontWeight: 700, color: '#053796' }}>{cat.quantity?.toFixed(2)}</td>
                                                    <td className="num" style={{ fontWeight: 700, color: '#053796' }}>{money(cat.total)}</td>
                                                </tr>
                                                {(cat.products || []).map((p) => (
                                                    <tr key={p.name}>
                                                        <td style={{ paddingLeft: 24, color: '#64748b' }}>{p.name}</td>
                                                        <td className="num">{p.quantity?.toFixed(2)}</td>
                                                        <td className="num">{money(p.total)}</td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        <tr><td colSpan={3} className="ssm-table-empty">{t("melumat_yoxdur")}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

const SalesShiftModal = ({ show, onHide }) => {
    const profile = useSelector((state) => state.LoginSlice?.loginedProfileData?.data?.profile);
    const terminalInfo = useSelector((state) => state.LoginSlice?.loginedProfileData?.data?.terminal) || {};
    const waiter = useSelector((state) => state.WaitersSlice?.loginedWaiter?.data);
    // Waiter yoxdursa (admin/manager rejimi) — tam icazə; waiter varsa — onun icazəsini yoxla
    const canSeeShiftHistory = !waiter || Number(waiter.can_see_shift_history) === 1;
    const profileId = profile?.id;
    const terminalId = terminalInfo?.terminal_id || null;

    const [loading, setLoading] = useState(false);
    const [currentShift, setCurrentShift] = useState(null);
    const [livePayload, setLivePayload] = useState(null);
    const [history, setHistory] = useState([]);
    const [cashierPrinters, setCashierPrinters] = useState([]);
    const [showClosePrompt, setShowClosePrompt] = useState(false);
    const [extraSnapshots, setExtraSnapshots] = useState({});
    /** { row, snapshot, loading } | null */
    const [shiftDetailModal, setShiftDetailModal] = useState(null);
    const [startingCash, setStartingCash] = useState("");
    const [historyFrom, setHistoryFrom] = useState("");
    const [historyTo, setHistoryTo] = useState("");

    const baseReceiptFont = Number(terminalInfo?.customer_receipt || profile?.customer_receipt || 0);
    const profileDisplayName = profile?.company_name || profile?.name || "";

    useEffect(() => {
        if (!show) {
            setShowClosePrompt(false);
            setExtraSnapshots({});
            setShiftDetailModal(null);
            setStartingCash("");
            setHistoryFrom("");
            setHistoryTo("");
        }
    }, [show]);

    useEffect(() => {
        if (!currentShift) setShowClosePrompt(false);
    }, [currentShift]);

    const loadPrinter = useCallback(async () => {
        if (!profileId) return;
        try {
            const res = await apiConfig.get(`/pos/printers/${profileId}`);
            if (res.data?.data) {
                const list = resolveCashierPrintersForPrint(res.data.data);
                setCashierPrinters(list);
            }
        } catch {
            /* ignore */
        }
    }, [profileId]);

    const fetchCurrent = useCallback(async () => {
        if (!profileId) return null;
        const res = await apiConfig.get(`/sales-shifts/${profileId}/current`);
        const row = res.data?.data ?? null;
        setCurrentShift(row);
        return row;
    }, [profileId]);

    const fetchLive = useCallback(async () => {
        if (!profileId) return;
        const res = await apiConfig.get(`/sales-shifts/${profileId}/live-summary`);
        setLivePayload(res.data?.data ?? null);
    }, [profileId]);

    const fetchHistory = useCallback(async (from, to) => {
        if (!profileId) return;
        if (!canSeeShiftHistory) return;
        const params = { limit: 80 };
        if (from) params.from = from;
        if (to) params.to = to;
        const res = await apiConfig.get(`/sales-shifts/${profileId}/history`, { params });
        setHistory(Array.isArray(res.data?.data) ? res.data.data : []);
    }, [profileId, canSeeShiftHistory]);

    const refreshAll = useCallback(async () => {
        if (!profileId) return;
        setLoading(true);
        try {
            const open = await fetchCurrent();
            if (open) await fetchLive();
            else setLivePayload(null);
            await fetchHistory();
        } catch (e) {
            console.error(e);
            toastShiftError(e, "Növbə məlumatı alınmadı");
        } finally {
            setLoading(false);
        }
    }, [profileId, fetchCurrent, fetchLive, fetchHistory]);

    useEffect(() => {
        if (show && profileId) {
            loadPrinter();
            refreshAll();
        }
    }, [show, profileId, loadPrinter, refreshAll]);

    // Digər terminaldan gələn növbə dəyişikliyi
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        const onShiftUpdated = () => {
            if (profileId) refreshAll().catch(() => { });
        };
        socket.on("shift_updated", onShiftUpdated);
        return () => socket.off("shift_updated", onShiftUpdated);
    }, [profileId, refreshAll]);

    useEffect(() => {
        if (!show || !currentShift) return;
        const t = setInterval(() => {
            fetchLive().catch(() => { });
        }, 45000);
        return () => clearInterval(t);
    }, [show, currentShift, fetchLive]);

    const printToCashier = async (html) => {
        if (!window.electronAPI?.printReceipt || !cashierPrinters.length) {
            toast.warning(t("kassa_printeri_tapilmadi_ve_ya_electron_capi_yoxdur"));
            return;
        }
        for (const cashierPrinter of cashierPrinters) {
            const connType = cashierPrinter.connection_type;
            const isNetwork = connType === "network" || (connType !== "usb" && connType !== "com" && !!cashierPrinter.ip);
            const hasUsbName = !!(cashierPrinter.usb_name && cashierPrinter.usb_name.trim() && cashierPrinter.usb_name !== 'RASTER');
            const printerSettings = {
                paper_size: cashierPrinter.paper_size || '80',
                cut_mode: cashierPrinter.cut_mode || 'full',
                sound_notify: cashierPrinter.sound_notify || 0,
                cash_drawer: cashierPrinter.cash_drawer || 0,
                open_drawer_without_print: cashierPrinter.open_drawer_without_print || 0,
                encoding: cashierPrinter.encoding || 'utf8',
                copies: cashierPrinter.copies || 1,
                darkness: cashierPrinter.darkness || 5,
                trailing_space: cashierPrinter.trailing_space || 0,
                receipt_header: cashierPrinter.receipt_header || null,
                receipt_footer: cashierPrinter.receipt_footer || null,
                bold_header: cashierPrinter.bold_header || 0,
                double_height_header: cashierPrinter.double_height_header || 0,
                font_family: cashierPrinter.font_family || 'Arial',
                fast_print: cashierPrinter.fast_print ? 1 : 0,
                print_logo: cashierPrinter.print_logo != null ? Number(cashierPrinter.print_logo) : 1,
                rotate_180: cashierPrinter.rotate_180 ? 1 : 0,
                usb_name: hasUsbName ? cashierPrinter.usb_name : null,
                printer_label: cashierPrinter.local_name || cashierPrinter.name || "",
            };

            let payload;
            if (isNetwork && cashierPrinter.ip && !hasUsbName) {
                payload = {
                    html,
                    printerName: "",
                    printerIp: String(cashierPrinter.ip),
                    printerPort: Number(cashierPrinter.port) || 9100,
                    printerSettings,
                };
            } else {
                const targetPrinter = hasUsbName ? cashierPrinter.usb_name : (cashierPrinter.local_name || cashierPrinter.name);
                payload = { html, printerName: targetPrinter, printerSettings };
            }

            await window.electronAPI.printReceipt(payload);
        }
    };

    const handlePrintSnapshot = async (snapshot, shiftRow, { isReprint } = {}) => {
        if (!snapshot?.summary) {
            toast.error(t("hesabat_melumati_yoxdur"));
            return;
        }
        const validLogo = (logo) =>
            logo && logo !== "null" && logo !== "undefined" && logo !== "data:directory;base64,";
        const resolveLogoUrl = (logo) => {
            if (!validLogo(logo)) return null;
            if (logo.startsWith("http") || logo.startsWith("data:")) return logo;
            return `http://46.224.8.157:35627/${logo}`;
        };
        const logoSrc =
            resolveLogoUrl(terminalInfo?.logoPrint) || resolveLogoUrl(profile?.logo) || null;
        const html = buildShiftPrintHtml({
            profileName: profile?.company_name || profile?.name || `Profil #${profileId}`,
            logoSrc,
            openedAt: snapshot.openedAt,
            closedAt: snapshot.closedAt,
            terminalLabel: snapshot.terminalId || "Hamısı",
            openedBy: shiftRow?.opened_by_name || "—",
            closedBy: shiftRow?.closed_by_name || "—",
            startingCash: snapshot.startingCash || Number(shiftRow?.starting_cash) || 0,
            summary: snapshot.summary,
            footerNote: isReprint ? "TƏKRAR ÇAP" : "",
            baseFontPx: baseReceiptFont,
        });
        await printToCashier(html);
    };

    const handleOpenShift = async () => {
        if (!profileId) return;
        setLoading(true);
        try {
            const res = await apiConfig.post(`/sales-shifts/${profileId}/open`, {
                terminalId,
                waiterId: waiter?.id,
                waiterName: waiter?.name,
                startingCash: Number(startingCash) || 0,
            });
            if (res.data?.message === "success") {
                toast.success(t("satis_novbesi_acildi"));
                setStartingCash("");
                window.dispatchEvent(new CustomEvent("salesShiftChanged"));
                await refreshAll();
            }
        } catch (e) {
            if (e.response?.data?.message === "open_exists") {
                toast.warning(t("bu_terminal_ucun_artiq_aciq_novbe_var"));
                await refreshAll();
            } else {
                toastShiftError(e, "Növbə açılmadı");
            }
        } finally {
            setLoading(false);
        }
    };

    const executeCloseShift = async () => {
        if (!profileId || !currentShift?.uuid) return;
        setShowClosePrompt(false);
        setLoading(true);
        try {
            const res = await apiConfig.post(`/sales-shifts/${profileId}/${currentShift.uuid}/close`, {
                waiterId: waiter?.id,
                waiterName: waiter?.name,
                terminalId,
            });
            if (res.data?.message === "success") {
                const { shift, summary, range } = res.data.data;
                const snapshot = {
                    closedAt: range?.endStr,
                    openedAt: range?.startStr,
                    terminalId: terminalId || shift?.terminal_id || null,
                    startingCash: Number(shift?.starting_cash) || 0,
                    summary,
                    profileId: Number(profileId),
                };
                await handlePrintSnapshot(snapshot, shift, { isReprint: false });
                toast.success(t("novbe_baglandi"));
                window.dispatchEvent(new CustomEvent("salesShiftChanged"));
                setCurrentShift(null);
                setLivePayload(null);
                await fetchHistory();
                await fetchCurrent();
            }
        } catch (e) {
            toastShiftError(e, "Növbə bağlanmadı");
        } finally {
            setLoading(false);
        }
    };

    const handleReprintFromHistory = async (row) => {
        let snap = tryParseSnapshot(row) || extraSnapshots[row.uuid];
        if (!snap) {
            try {
                const res = await apiConfig.get(`/sales-shifts/${profileId}/shift/${row.uuid}`);
                const d = res.data?.data;
                snap = d?.snapshot;
                if (snap) setExtraSnapshots((prev) => ({ ...prev, [row.uuid]: snap }));
            } catch {
                /* ignore */
            }
        }
        await handlePrintSnapshot(snap, row, { isReprint: true });
    };

    const getSnapshotForHistoryRow = (h) => tryParseSnapshot(h) || extraSnapshots[h.uuid] || null;

    const openShiftDetailModal = async (h) => {
        let snap = getSnapshotForHistoryRow(h);
        setShiftDetailModal({ row: h, snapshot: snap, loading: !snap });
        if (!snap && profileId) {
            try {
                const res = await apiConfig.get(`/sales-shifts/${profileId}/shift/${h.uuid}`);
                const d = res.data?.data;
                snap = d?.snapshot;
                if (snap) setExtraSnapshots((prev) => ({ ...prev, [h.uuid]: snap }));
            } catch {
                /* ignore */
            }
        }
        setShiftDetailModal({ row: h, snapshot: snap, loading: false });
    };

    const summary = livePayload?.summary;

    const currentShiftBody = !currentShift ? (
        <>
            <p className="sales-shift-hint mb-0">{t("aciq_novbe_yoxdur_novbeni_ac_ile_basladin_bu_terminal_uzre_baglanmis_cekler_izlenecek_novbeni_baglayanda_kassa_printerinden_hesabat_cap_olunacaq")}</p>
            <div className="ssm-starting-cash-card mt-3">
                <div className="ssm-starting-cash-icon">
                    <i className="bi bi-cash-stack" aria-hidden />
                </div>
                <div className="ssm-starting-cash-body">
                    <label className="ssm-starting-cash-label" htmlFor="startingCashInput">{t("baslangic_qaliq")}</label>
                    <span className="ssm-starting-cash-hint">{t("novbe_baslamazdan_evvel_kassadaki_pul")}</span>
                </div>
                <div className="ssm-starting-cash-input-wrap">
                    <input
                        id="startingCashInput"
                        type="number"
                        min="0"
                        step="0.01"
                        className="ssm-starting-cash-input"
                        placeholder="0.00"
                        value={startingCash}
                        onChange={(e) => setStartingCash(e.target.value)}
                        disabled={loading}
                    />
                    <span className="ssm-starting-cash-currency">{getCurrencySymbol()}</span>
                </div>
            </div>
            <div className="sales-shift-actions mt-3">
                <Button variant="primary" onClick={handleOpenShift} disabled={loading || !profileId}>{t("novbeni_ac")}</Button>
                <Button variant="outline-secondary" onClick={refreshAll} disabled={loading}>{t("refresh")}</Button>
            </div>
        </>
    ) : (
        <>
            {/* Məlumat kartı */}
            <div className="ssm-info-card">
                <div className="ssm-info-row">
                    <span className="ssm-info-label">{t("acilis")}</span>
                    <span className="ssm-info-value">
                        {currentShift.opened_at ? new Date(currentShift.opened_at).toLocaleString("az-AZ") : "—"}
                    </span>
                </div>
                <div className="ssm-info-row">
                    <span className="ssm-info-label">{t("acan")}</span>
                    <span className="ssm-info-value">{currentShift.opened_by_name || "—"}</span>
                </div>
                <div className="ssm-info-row">
                    <span className="ssm-info-label">{t("terminal")}</span>
                    <span className="ssm-info-value">{currentShift.terminal_id || terminalId || "—"}</span>
                </div>
                {Number(currentShift.starting_cash) > 0 && (
                    <div className="ssm-info-row">
                        <span className="ssm-info-label">{t("baslangic_qaliq")}</span>
                        <span className="ssm-info-value">{money(currentShift.starting_cash)} {getCurrencySymbol()}</span>
                    </div>
                )}
                {currentShift.closed_by_name && (
                    <div className="ssm-info-row">
                        <span className="ssm-info-label">{t("baglayan")}</span>
                        <span className="ssm-info-value">{currentShift.closed_by_name}</span>
                    </div>
                )}
            </div>

            <div className="sales-shift-actions">
                <Button variant="outline-secondary" onClick={() => fetchLive()} disabled={loading}>
                    <i className="bi bi-arrow-clockwise" aria-hidden />{t("canli_yenile")}</Button>
                {!showClosePrompt && (
                    <Button variant="danger" onClick={() => setShowClosePrompt(true)} disabled={loading}>
                        <i className="bi bi-printer-fill" aria-hidden />{t("bagla_ve_cap_et")}</Button>
                )}
            </div>

            {showClosePrompt && (
                <div className="sales-shift-close-confirm">
                    <p className="mb-0">{t("novbeni_baglamaq_isteyirsiniz_kassa_printerine_baglanmis_novbe_hesabati_gonderilecek")}</p>
                    <div className="sales-shift-close-confirm-actions mt-2">
                        <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => setShowClosePrompt(false)}
                            disabled={loading}
                        >{t("cancel")}</Button>
                        <Button variant="danger" size="sm" onClick={executeCloseShift} disabled={loading}>
                            <i className="bi bi-printer-fill me-1" aria-hidden />{t("beli_bagla")}</Button>
                    </div>
                </div>
            )}

            {summary && (
                <>
                    {/* Ümumi xülasə */}
                    <div className="ssm-section-header">
                        <i className="bi bi-bar-chart-fill" aria-hidden />{t("novbe_xulasesi")}</div>
                    <div className="ssm-info-card">
                        <div className="ssm-info-row">
                            <span className="ssm-info-label">{t("baglanmis_cek")}</span>
                            <span className="ssm-info-value">{summary.checksCount ?? 0}</span>
                        </div>
                        <div className="ssm-info-row ssm-total-row">
                            <span>{t("cem_mebleg")}</span>
                            <span>{money(summary.grossTotal)} {getCurrencySymbol()}</span>
                        </div>
                        <div className="ssm-info-row ssm-total-row" style={{ borderTop: '1px dashed #e2e8f0', marginTop: 4, paddingTop: 4 }}>
                            <span>{t("ceklerin_cemi_yekun")}</span>
                            <span>{money(summary.net_total)} {getCurrencySymbol()}</span>
                        </div>
                    </div>

                    {/* Satış hesabatı */}
                    <div className="ssm-section-header">
                        <i className="bi bi-receipt" aria-hidden />{t("satis_hesabati")}</div>
                    <div className="ssm-info-card">
                        <div className="ssm-info-row"><span className="ssm-info-label">{t("cem")}</span><span className="ssm-info-value">{money(summary.total_amount)} {getCurrencySymbol()}</span></div>
                        <div className="ssm-info-row"><span className="ssm-info-label">Vergi</span><span className="ssm-info-value">{money(summary.total_tax)} {getCurrencySymbol()}</span></div>
                        <div className="ssm-info-row"><span className="ssm-info-label">{t("i̇kram")}</span><span className="ssm-info-value">{money(summary.total_gift)} {getCurrencySymbol()}</span></div>
                        <div className="ssm-info-row"><span className="ssm-info-label">{t("xidmet")}</span><span className="ssm-info-value">{money(summary.total_service)} {getCurrencySymbol()}</span></div>
                        <div className="ssm-info-row"><span className="ssm-info-label">Endirim</span><span className="ssm-info-value">{money(summary.total_discount)} {getCurrencySymbol()}</span></div>
                        <div className="ssm-info-row"><span className="ssm-info-label">{t("catdirilma_haqqi")}</span><span className="ssm-info-value">{money(summary.delivery_fee)} {getCurrencySymbol()}</span></div>
                        <div className="ssm-info-row"><span className="ssm-info-label">{t("refund")}</span><span className="ssm-info-value">{money(summary.total_refund)} {getCurrencySymbol()}</span></div>
                        <div className="ssm-info-row"><span className="ssm-info-label">{t("silinmeler")}</span><span className="ssm-info-value">{money(summary.total_deleted)} {getCurrencySymbol()}</span></div>
                        {(summary.total_paid > 0 || summary.total_unpaid > 0) && (
                            <>
                                <div className="ssm-info-row" style={{borderTop:'1px dashed #e2e8f0',marginTop:4,paddingTop:4}}><span className="ssm-info-label">{t("odenisli_baglamalar")}</span><span className="ssm-info-value">{money(summary.total_paid)} {getCurrencySymbol()}</span></div>
                                <div className="ssm-info-row"><span className="ssm-info-label">{t("odenissiz_baglamalar")}</span><span className="ssm-info-value">{money(summary.total_unpaid)} {getCurrencySymbol()}</span></div>
                            </>
                        )}
                        <div className="ssm-info-row ssm-total-row"><span>Yekun</span><span>{money(summary.net_total)} {getCurrencySymbol()}</span></div>
                    </div>
                    <div className="ssm-info-card">
                        <div className="ssm-info-row"><span className="ssm-info-label">{t("guest_count")}</span><span className="ssm-info-value">{summary.guest_count ?? 0}</span></div>
                    </div>

                    {/* Ofisiant cədvəli */}
                    <div className="ssm-section-header">
                        <i className="bi bi-person-fill" aria-hidden />{t("ofisiant_canli")}</div>
                    <div className="ssm-table-card">
                        <table className="ssm-table">
                            <thead>
                                <tr>
                                    <th>Ad</th>
                                    <th className="num">{t("cek")}</th>
                                    <th className="num">{t("mebleg")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(summary.byEmployee || []).length ? (
                                    summary.byEmployee.map((r) => (
                                        <tr key={r.name}>
                                            <td>{r.name}</td>
                                            <td className="num">{r.checks_count}</td>
                                            <td className="num">{money(r.total)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="ssm-table-empty">{t("hele_baglanmis_cek_yoxdur")}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Satış tipi cədvəli */}
                    <div className="ssm-section-header">
                        <i className="bi bi-tag-fill" aria-hidden />{t("satis_tipi_canli")}</div>
                    <div className="ssm-table-card">
                        <table className="ssm-table">
                            <thead>
                                <tr>
                                    <th>{t("type")}</th>
                                    <th className="num">Say</th>
                                    <th className="num">{t("mebleg")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(summary.bySaleMethod || []).length ? (
                                    summary.bySaleMethod.map((r) => (
                                        <tr key={r.name}>
                                            <td>{r.name}</td>
                                            <td className="num">{r.count}</td>
                                            <td className="num">{money(r.total)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="ssm-table-empty">{t("melumat_yoxdur")}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Ödəniş üsulları */}
                    <div className="ssm-section-header">
                        <i className="bi bi-credit-card-fill" aria-hidden />{t("odenis_usullari")}</div>
                    <div className="ssm-table-card">
                        <table className="ssm-table">
                            <thead>
                                <tr>
                                    <th>{t("usul")}</th>
                                    <th className="num">{t("mebleg")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.keys(summary.payments || {}).length ? (
                                    Object.entries(summary.payments).map(([name, amount]) => (
                                        <tr key={name}>
                                            <td>{name}</td>
                                            <td className="num">{money(amount)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={2} className="ssm-table-empty">{t("melumat_yoxdur")}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Ödənişsiz bağlamalar */}
                    <div className="ssm-section-header">
                        <i className="bi bi-x-circle-fill" aria-hidden />{t("odenissiz_baglamalar")}</div>
                    <div className="ssm-table-card">
                        <table className="ssm-table">
                            <thead>
                                <tr>
                                    <th>{t("usul")}</th>
                                    <th className="num">{t("mebleg")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.keys(summary.unpaid_payments || {}).length ? (
                                    Object.entries(summary.unpaid_payments).map(([name, amount]) => (
                                        <tr key={name}>
                                            <td>{name}</td>
                                            <td className="num">{money(amount)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={2} className="ssm-table-empty">{t("melumat_yoxdur")}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Etiketlər */}
                    <div className="ssm-section-header">
                        <i className="bi bi-bookmark-fill" aria-hidden />{t("etiketler")}</div>
                    <div className="ssm-table-card">
                        <table className="ssm-table">
                            <thead>
                                <tr>
                                    <th>Etiket</th>
                                    <th className="num">Say</th>
                                    <th className="num">{t("mebleg")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.keys(summary.tags || {}).length ? (
                                    Object.entries(summary.tags).map(([tag, details]) => (
                                        <tr key={tag}>
                                            <td>{tag}</td>
                                            <td className="num">{details.count}</td>
                                            <td className="num">{money(details.total)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={3} className="ssm-table-empty">{t("melumat_yoxdur")}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Kateqoriya hesabatı */}
                    <div className="ssm-section-header">
                        <i className="bi bi-grid-fill" aria-hidden />{t("kateqoriya_hesabati")}</div>
                    <div className="ssm-table-card">
                        <table className="ssm-table">
                            <thead>
                                <tr>
                                    <th>{t("kateqoriya_/_mehsul")}</th>
                                    <th className="num">Say</th>
                                    <th className="num">{t("mebleg")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(summary.byCategory || []).length ? (
                                    summary.byCategory.map((cat) => (
                                        <React.Fragment key={cat.name}>
                                            <tr style={{ background: '#f0f4ff' }}>
                                                <td style={{ fontWeight: 700, color: '#053796' }}>{cat.name}</td>
                                                <td className="num" style={{ fontWeight: 700, color: '#053796' }}>{cat.quantity?.toFixed(2)}</td>
                                                <td className="num" style={{ fontWeight: 700, color: '#053796' }}>{money(cat.total)}</td>
                                            </tr>
                                            {(cat.products || []).map((p) => (
                                                <tr key={p.name}>
                                                    <td style={{ paddingLeft: 24, color: '#64748b' }}>{p.name}</td>
                                                    <td className="num">{p.quantity?.toFixed(2)}</td>
                                                    <td className="num">{money(p.total)}</td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <tr><td colSpan={3} className="ssm-table-empty">{t("melumat_yoxdur")}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </>
    );

    const historyBody =
        !canSeeShiftHistory ? (
            <div className="sales-shift-empty-right">
                <i className="bi bi-lock-fill me-2" aria-hidden />{t("i̇cazeniz_yoxdur")}</div>
        ) : history.length === 0 ? (
            <div className="sales-shift-empty-right">{t("hele_baglanmis_novbe_yoxdur")}</div>
        ) : (
            <div className="sales-shift-history-strip-wrap">
                <div
                    className="sales-shift-history-strip"
                    role="list"
                    aria-label="Keçmiş satış növbələri"
                >
                    {history.map((h) => {
                        const snap = getSnapshotForHistoryRow(h);
                        const gross = snap?.summary?.grossTotal;
                        const checks = snap?.summary?.checksCount;

                        return (
                            <div
                                key={h.uuid || h.id}
                                className="sales-shift-history-card"
                                role="listitem"
                            >
                                <div className="sales-shift-history-card-head">
                                    <div className="sales-shift-history-card-dot" aria-hidden />
                                    <div className="sales-shift-history-card-info">
                                        <div className="sales-shift-history-time">
                                            {h.closed_at ? new Date(h.closed_at).toLocaleString("az-AZ") : "—"}
                                        </div>
                                        <div className="sales-shift-history-sub">
                                            Açılış:{" "}
                                            {h.opened_at ? new Date(h.opened_at).toLocaleString("az-AZ") : "—"}
                                            {h.terminal_id != null && h.terminal_id !== ""
                                                ? ` · Term. ${h.terminal_id}`
                                                : ""}
                                            {checks != null && ` · Çek ${checks}`}
                                            {gross != null && ` · ${money(gross)} ₼`}
                                        </div>
                                    </div>
                                    {gross != null && (
                                        <div className="sales-shift-history-gross">{money(gross)} {getCurrencySymbol()}</div>
                                    )}
                                </div>
                                <div className="sales-shift-history-card-actions">
                                    <Button
                                        variant="outline-secondary"
                                        className="btn-detail-outline"
                                        onClick={() => openShiftDetailModal(h)}
                                        disabled={loading}
                                    >
                                        <i className="bi bi-layout-text-sidebar-reverse" aria-hidden />
                                        Detallar
                                    </Button>
                                    <Button
                                        variant="primary"
                                        className="sales-shift-btn-reprint"
                                        onClick={() => handleReprintFromHistory(h)}
                                        disabled={loading}
                                    >
                                        <i className="bi bi-printer-fill" aria-hidden />{t("tekrar_cap")}</Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );

    const detailRow = shiftDetailModal?.row;
    const detailSnap = shiftDetailModal?.snapshot;

    return (
        <>
            <Modal
                show={show}
                onHide={onHide}
                centered
                className="report-modal sales-shift-report-root"
                dialogClassName="report-modal-dialog sales-shift-report-dialog"
                contentClassName="sales-shift-modal-content"
            >
                <Modal.Header className="report-modal-header" closeButton closeVariant="white">
                    <div className="sales-shift-main-header-inner">
                        <Modal.Title as="h5" className="report-modal-title mb-0">{t("sales_shift")}</Modal.Title>
                        <span
                            className={`sales-shift-header-status ${currentShift ? "sales-shift-header-status--open" : "sales-shift-header-status--closed"
                                }`}
                            title={currentShift ? "Bu terminalda növbə açıqdır" : "Açıq növbə yoxdur"}
                        >
                            <span className="sales-shift-header-status-dot" aria-hidden />
                            {currentShift ? "Açıq" : "Bağlı"}
                        </span>
                    </div>
                </Modal.Header>
                <Modal.Body className="p-0 d-flex flex-column flex-grow-1 min-vh-0">
                    <div className="sales-shift-loading-wrap">
                        {loading && (
                            <div className="sales-shift-loading-overlay">
                                <Spinner animation="border" size="sm" variant="primary" />
                            </div>
                        )}
                        <div className="sales-shift-modal-body">
                            <div className="sales-shift-col-left">
                                <h6 className="sales-shift-panel-title">
                                    <i className="bi bi-lightning-charge-fill" aria-hidden />{t("cari_novbe")}</h6>
                                {currentShiftBody}
                            </div>
                            <div className="sales-shift-col-right">
                                <h6 className="sales-shift-panel-title">
                                    <i className="bi bi-clock-history" aria-hidden />
                                    Keçmiş növbələr
                                    {history.length > 0 && (
                                        <span className="ssm-history-count">{history.length}</span>
                                    )}
                                </h6>
                                <div className="ssm-history-filter">
                                    <div className="ssm-history-filter-row">
                                        <div className="ssm-history-filter-field">
                                            <label htmlFor="historyFrom">{t("baslangic")}</label>
                                            <input
                                                id="historyFrom"
                                                type="date"
                                                value={historyFrom}
                                                onChange={(e) => setHistoryFrom(e.target.value)}
                                                disabled={loading}
                                            />
                                        </div>
                                        <div className="ssm-history-filter-field">
                                            <label htmlFor="historyTo">Son</label>
                                            <input
                                                id="historyTo"
                                                type="date"
                                                value={historyTo}
                                                onChange={(e) => setHistoryTo(e.target.value)}
                                                disabled={loading}
                                            />
                                        </div>
                                        <Button
                                            variant="primary"
                                            className="ssm-history-filter-btn"
                                            disabled={loading}
                                            onClick={() => fetchHistory(historyFrom, historyTo)}
                                        >
                                            <i className="bi bi-funnel-fill" aria-hidden />
                                        </Button>
                                        {(historyFrom || historyTo) && (
                                            <Button
                                                variant="outline-secondary"
                                                className="ssm-history-filter-btn ssm-history-filter-clear"
                                                disabled={loading}
                                                onClick={() => {
                                                    setHistoryFrom("");
                                                    setHistoryTo("");
                                                    fetchHistory("", "");
                                                }}
                                            >
                                                <i className="bi bi-x-lg" aria-hidden />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                {historyBody}
                            </div>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>

            <Modal
                show={!!shiftDetailModal}
                onHide={() => setShiftDetailModal(null)}
                centered
                className="sales-shift-detail-nested"
                enforceFocus={false}
                restoreFocus={false}
            >
                <Modal.Header closeButton closeVariant="white">
                    <Modal.Title>{t("novbe_detallari")}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {shiftDetailModal?.loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" size="sm" variant="primary" />
                            <p className="text-muted small mt-2 mb-0">{t("yuklenir…")}</p>
                        </div>
                    ) : (
                        detailRow && (
                            <ShiftHistoryDetailBody
                                row={detailRow}
                                snapshot={detailSnap}
                                profileName={profileDisplayName}
                            />
                        )
                    )}
                </Modal.Body>
                {!shiftDetailModal?.loading && detailRow && (
                    <Modal.Footer className="p-0 border-0">
                        <div className="ssd-footer-print">
                            <Button
                                variant="primary"
                                className="ssd-print-btn"
                                onClick={async () => {
                                    await handleReprintFromHistory(detailRow);
                                }}
                            >
                                <i className="bi bi-printer-fill" aria-hidden />{t("tekrar_cap_et")}</Button>
                        </div>
                    </Modal.Footer>
                )}
            </Modal>
        </>
    );
};

export default SalesShiftModal;
