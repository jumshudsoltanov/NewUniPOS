import React, { useState, useEffect, Fragment } from "react";
import { Modal, Row, Col, Form, Table } from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import { fetchCustomersFromAdmin } from "../../redux/Slices/CustomersSlice";
import axios from "../../utils/apiConfig";
import { resolveCashierPrintersForPrint } from "../../utils/printerHelpers.jsx";
import { toast } from "sonner";
import "./ReportModal.css";

/** API uğursuz olanda da cədvəllər sıfır ilə göstərilsin */
/** Müştəri / ofisant üçün — sətirlərin üzərinə gəldikdə izah (tooltip) */
const REPORT_HINTS = {
    sumTotal: "Bağlanmış çeklərdə məhsul + timer məbləği cəmi (ərazi üzrə).",
    tax: "Seçilmiş hesabat dövründə bağlanmış çeklərdə hesablanmış vergi məbləği.",
    gift: "İkram olunmuş məhsulların nominal dəyəri (məhsul qiyməti üzrə).",
    service: "Xidmət haqqı cəmi.",
    discount: "Endirimlər üzrə çıxılan məbləğ cəmi.",
    delivery: "Çatdırılma haqqı (əgər sifarişlərdə varsa).",
    refund: "Geri qaytarılmış sifarişlərin məbləği.",
    deleted: "Silinmiş və ya ləğv səbəbi ilə bağlanmış əməliyyatların məbləğ göstəricisi (dövr üzrə).",
    paidClose: "Ödəniş üsulu ilə bağlanmış çeklərdə ödənilmiş məbləğ cəmi.",
    unpaidClose: "Ödənişsiz bağlama ilə bağlanmış çeklərin məbləği.",
    net: "Bağlanmış çeklərin yekun məbləği (sistemdəki net cəm).",
    openCount: "Hələ açıq (bağlanmamış) sifariş sayı.",
    openSum: "Açıq sifarişlərin məbləğ cəmi.",
    guests: "Qərara alınmış qonaq sayısı.",
    paymentMethod: "Bu ödəniş üsulu ilə bağlanmış çeklərdə ödənilən məbləğ.",
    unpaidTag: "Ödənişsiz bağlama ilə bağlanmış çeklərin məbləği.",
    tagRow: "Bu etiketlə bağlanmış çeklərin məbləği.",
};

const DEFAULT_REPORT_SUMMARY = {
    total_amount: 0,
    total_discount: 0,
    total_service: 0,
    total_gift: 0,
    total_refund: 0,
    total_deleted: 0,
    total_tax: 0,
    net_total: 0,
    guest_count: 0,
    open_orders_count: 0,
    open_orders_total: 0,
    total_paid: 0,
    total_unpaid: 0,
    payments: {},
    unpaid_payments: {},
    tags: {}
};

const ReportModal = ({ show, onClose }) => {
    const profile = useSelector((state) => state.LoginSlice?.loginedProfileData?.data?.profile);
    const terminalInfo = useSelector((state) => state.LoginSlice?.loginedProfileData?.data?.terminal) || {};
    const profileId = profile?.id;
    const customers = useSelector((state) => state.CustomersSlice?.customers || []);
    const dispatch = useDispatch();

    // Default dates (today and tomorrow)
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0];

    // State for form inputs
    const [startDate, setStartDate] = useState(today);
    const [startTime, setStartTime] = useState("06:00");
    const [endDate, setEndDate] = useState(tomorrow);
    const [endTime, setEndTime] = useState("06:00");
    const [terminal, setTerminal] = useState("all");
    const [reportType, setReportType] = useState("simple");
    const [showTransactions, setShowTransactions] = useState(false);
    const [showAccounts, setShowAccounts] = useState(false);
    const [activeMobileTab, setActiveMobileTab] = useState("filters"); // 'filters' or 'result'
    const isMobile = window.innerWidth < 992;

    // Dynamic states
    const [terminals, setTerminals] = useState([{ id: "all", name: "Hamısı" }]);
    const [reportResults, setReportResults] = useState(null);
    const [reportSummary, setReportSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    /** Kateqoriya hesabatı: hansı kateqoriyalar printerə getsin (indeks → true/false, default true) */
    const [categoryPrintInclude, setCategoryPrintInclude] = useState({});

    const reportTypes = [
        { id: "simple", name: "Sadə" },
        { id: "products", name: "Məhsullar" },
        { id: "hall", name: "Zal" },
        { id: "tables", name: "Masalar" },
        { id: "checks", name: "Çek" },
        { id: "department", name: "Şöbə" },
        { id: "inventory", name: "Ehtiyat" },
        { id: "sale_method", name: "Satış üsulu" },
        { id: "employee", name: "Əməkdaş" },
        { id: "category", name: "Kateqoriya" },
        { id: "refunds", name: "Geri qaytarılma" },
        { id: "gifted_products", name: "İkram olunmuş məhsul" },
        { id: "financial", name: "Maliyyə hesabatı" },
        { id: "customers", name: "Müştərilər" },
    ];

    const [cashierPrinters, setCashierPrinters] = useState([]);

    useEffect(() => {
        if (show && profileId) {
            fetchTerminals();
            fetchCashierPrinter();
            dispatch(fetchCustomersFromAdmin({ limit: 500 }));
        }
    }, [show, profileId]);

    useEffect(() => {
        if (reportResults?.type === "category" && Array.isArray(reportResults.data)) {
            const next = {};
            reportResults.data.forEach((_, i) => {
                next[i] = true;
            });
            setCategoryPrintInclude(next);
        }
    }, [reportResults]);

    const fetchTerminals = async () => {
        try {
            const response = await axios.get(`/reports/${profileId}/terminals`);
            if (response.data.status === "success") {
                setTerminals([{ id: "all", name: "Hamısı" }, ...response.data.data]);
            }
        } catch (error) {
            console.error("Error fetching terminals:", error);
        }
    };

    const fetchCashierPrinter = async () => {
        try {
            const response = await axios.get(`/pos/printers/${profileId}`);
            if (response.data?.data) {
                const list = resolveCashierPrintersForPrint(response.data.data);
                setCashierPrinters(list);
            }
        } catch (e) {}
    };

    const handlePrint = async () => {
        const reportEl = document.querySelector('.report-view');
        if (!reportEl) return;

        const clone = reportEl.cloneNode(true);
        clone.querySelectorAll('.report-print-exclude').forEach((el) => el.remove());
        clone.querySelectorAll('.report-category-print-col').forEach((el) => el.remove());

        // Müştəri çeki (CustomerReceipt) ilə eyni ölçü: customer_receipt ofseti + termal üçün kiçik px
        const baseFont = Number(terminalInfo?.customer_receipt || profile?.customer_receipt || 0);
        const fs = (baseSize) => `${baseSize + baseFont * 2}px`;

        const html = `
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Courier New', 'Courier', monospace; color: #000 !important; }
                .report-view { width: 100%; max-width: 80mm; padding: 0 3mm; font-size: ${fs(14)}; line-height: 1.35; }
                .report-data-header { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 10px; text-align: left; }
                .report-data-info p { font-size: ${fs(13)}; margin-bottom: 4px; font-weight: 700; line-height: 1.35; }
                .report-data-info p span { font-weight: bold; margin-right: 5px; }
                .report-data-time { margin-top: 6px; }
                .report-data-time span { font-size: ${fs(13)}; font-weight: 700; }
                .section-title { font-weight: 900; font-size: ${fs(14)}; border-bottom: 1px solid #000; padding-bottom: 4px; margin: 12px 0 8px; text-transform: uppercase; text-align: center; line-height: 1.3; }
                .receipt-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #666; align-items: center; }
                .receipt-row > span:first-child { font-size: ${fs(13)}; font-weight: 700; }
                .receipt-row .dots { display: none; }
                .receipt-row .value { font-size: ${fs(13)}; font-weight: 700; }
                .total-line { border-top: 2px solid #000; border-bottom: 2px double #000; margin-top: 8px; padding: 6px 0; }
                .total-line > span:first-child { font-size: ${fs(14)} !important; font-weight: 900 !important; text-transform: uppercase; }
                .total-line .value { font-size: ${fs(15)} !important; font-weight: 900 !important; }
                .report-details-section { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #000; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: ${fs(13)}; }
                th { border-bottom: 1px solid #000; padding: 4px 2px; font-size: ${fs(13)}; font-weight: 700; text-align: left; text-transform: uppercase; line-height: 1.25; }
                td { border-bottom: 1px dashed #666; padding: 4px 2px; font-size: ${fs(13)}; font-weight: 700; word-break: break-word; line-height: 1.35; }
                .text-end { text-align: right; }
                .text-center { text-align: center; }
                .alert { display: none; }
                i, svg, button, input { display: none !important; }
            </style>
            ${clone.innerHTML}
        `;

        if (window.electronAPI?.printReceipt && cashierPrinters.length) {
            for (const cashierPrinter of cashierPrinters) {
                const connType = cashierPrinter.connection_type;
                const isNetwork = connType === "network" || (connType !== "usb" && connType !== "com" && !!cashierPrinter.ip);
                const hasUsbName = !!(cashierPrinter.usb_name && cashierPrinter.usb_name.trim() && cashierPrinter.usb_name !== 'RASTER');
                const printerSettings = {
                    paper_size: cashierPrinter.paper_size || '80',
                    cut_mode: cashierPrinter.cut_mode || 'full',
                    sound_notify: cashierPrinter.sound_notify || 0,
                    cash_drawer: cashierPrinter.cash_drawer || 0,
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
                };
                let payload;
                if (isNetwork && cashierPrinter.ip && !hasUsbName) {
                    payload = { html, printerName: "", printerIp: String(cashierPrinter.ip), printerPort: Number(cashierPrinter.port) || 9100, printerSettings };
                } else {
                    const targetPrinter = hasUsbName ? cashierPrinter.usb_name : (cashierPrinter.local_name || cashierPrinter.name);
                    payload = { html, printerName: String(targetPrinter || ""), printerSettings };
                }
                await window.electronAPI.printReceipt(payload);
            }
        } else {
            window.print();
        }
    };

    const handleCreateReport = async () => {
        if (!profileId) return;

        setLoading(true);
        setReportResults(null);
        setReportSummary(null);
        try {
            const baseParams = { startDate, startTime, endDate, endTime, terminal, showTransactions };

            const requests = [
                axios.get(`/reports/${profileId}/data`, { params: { ...baseParams, reportType: 'simple' } })
            ];
            if (reportType !== "simple") {
                requests.push(
                    axios.get(`/reports/${profileId}/data`, { params: { ...baseParams, reportType } })
                );
            }

            const [summaryRes, detailRes] = await Promise.all(requests);

            const rawSummary =
                summaryRes.data?.status === "success" && summaryRes.data.data != null
                    ? summaryRes.data.data
                    : null;
            setReportSummary(rawSummary != null ? rawSummary : { ...DEFAULT_REPORT_SUMMARY });
            if (summaryRes.data?.status !== "success") {
                toast.warning("Ümumi satış xülasəsi alınmadı — sıfırlar göstərilir.");
            }

            if (reportType !== "simple") {
                if (detailRes?.data?.status === "success") {
                    const detailData = detailRes.data.data;
                    setReportResults({
                        type: reportType,
                        data: detailData != null ? detailData : []
                    });
                } else {
                    toast.error("Detallı hesabat yüklənmədi.");
                    setReportResults({ type: reportType, data: [] });
                }
            } else {
                setReportResults({
                    type: "simple",
                    data: rawSummary != null ? rawSummary : { ...DEFAULT_REPORT_SUMMARY }
                });
            }
            if (isMobile) setActiveMobileTab("result");
        } catch (error) {
            console.error("Error generating report:", error);
            toast.error(error.response?.data?.message || error.message || "Hesabat yaradıla bilmədi");
            setReportSummary({ ...DEFAULT_REPORT_SUMMARY });
            setReportResults(null);
        } finally {
            setLoading(false);
        }
    };

    const renderResults = () => {
        if (loading) return (
            <div className="report-loading-container">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="mt-3">Məlumatlar hazırlanır...</p>
            </div>
        );

        if (!reportResults || !reportSummary) return (
            <div className="report-placeholder">
                <i className="bi bi-file-earmark-text mb-3"></i>
                <p className="mb-0 fs-5">
                    Məlumatları görmək üçün "Hesabat yarat"<br />düyməsini seçin
                </p>
            </div>
        );

        const { type, data } = reportResults;
        const terminalLabel = terminals.find((t) => String(t.id) === String(terminal))?.name || "Hamısı";
        const activeReportLabel = reportTypes.find((t) => t.id === type)?.name || type;

        const formatDate = (dateStr) => {
            if (!dateStr) return "";
            const [year, month, day] = dateStr.split("-");
            return `${day}.${month}.${year}`;
        };

        const ReportHeader = () => (
            <div className="report-data-header mb-4">
                <div className="report-data-header-row report-data-header-row--top">
                    <div className="report-data-info">
                        <p className="report-data-line">
                            <span className="report-data-label">Bu tarixdən</span>
                            <span className="report-data-value">{formatDate(startDate)} {startTime}</span>
                        </p>
                        <p className="report-data-line">
                            <span className="report-data-label">Bu tarixə qədər</span>
                            <span className="report-data-value">{formatDate(endDate)} {endTime}</span>
                        </p>
                    </div>
                    <div className="report-data-time" title="Hesabatın çıxarılma vaxtı">
                        <i className="bi bi-clock-fill" aria-hidden="true"></i>
                        <span>
                            Çıxarılma: {new Date().toLocaleDateString("az-AZ")}{" "}
                            {new Date().toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                    </div>
                </div>
                <div className="report-data-header-row report-data-header-row--meta">
                    <span className="report-meta-chip">
                        <span className="report-meta-chip-label">Terminal</span>
                        <span className="report-meta-chip-value">{terminalLabel}</span>
                    </span>
                    <span className="report-meta-chip">
                        <span className="report-meta-chip-label">Növ</span>
                        <span className="report-meta-chip-value">{activeReportLabel}</span>
                    </span>
                </div>
            </div>
        );

        const SalesSummary = () => (
            <div className="report-section mb-5">
                <div className="section-title">Satış hesabatı</div>
                <div className="receipt-row report-row-with-hint" title={REPORT_HINTS.sumTotal}><span>Cəm</span><div className="dots"></div><span className="value">{(reportSummary.total_amount || 0).toFixed(2)}</span></div>
                <div className="receipt-row report-row-with-hint" title={REPORT_HINTS.tax}><span>Vergi</span><div className="dots"></div><span className="value">{(reportSummary.total_tax || 0).toFixed(2)}</span></div>
                <div className="receipt-row report-row-with-hint" title={REPORT_HINTS.gift}><span>İkram</span><div className="dots"></div><span className="value">{(reportSummary.total_gift || 0).toFixed(2)}</span></div>
                <div className="receipt-row report-row-with-hint" title={REPORT_HINTS.service}><span>Xidmət</span><div className="dots"></div><span className="value">{(reportSummary.total_service || 0).toFixed(2)}</span></div>
                <div className="receipt-row report-row-with-hint" title={REPORT_HINTS.discount}><span>Endirim</span><div className="dots"></div><span className="value">{(reportSummary.total_discount || 0).toFixed(2)}</span></div>
                <div className="receipt-row report-row-with-hint" title={REPORT_HINTS.delivery}><span>Çatdırılma haqqı</span><div className="dots"></div><span className="value">0.00</span></div>
                <div className="receipt-row report-row-with-hint" title={REPORT_HINTS.refund}><span>Geri qaytarılma</span><div className="dots"></div><span className="value">{(reportSummary.total_refund || 0).toFixed(2)}</span></div>
                <div className="receipt-row report-row-with-hint" title={REPORT_HINTS.deleted}><span>Silinmələr</span><div className="dots"></div><span className="value">{(reportSummary.total_deleted || 0).toFixed(2)}</span></div>
                {(reportSummary.total_paid > 0 || reportSummary.total_unpaid > 0) && (
                    <>
                        <div className="receipt-row report-row-with-hint" style={{borderTop: '1px dashed #ccc', marginTop: 4, paddingTop: 4}} title={REPORT_HINTS.paidClose}>
                            <span>Ödənişli bağlamalar</span><div className="dots"></div><span className="value">{(reportSummary.total_paid || 0).toFixed(2)}</span>
                        </div>
                        <div className="receipt-row report-row-with-hint" title={REPORT_HINTS.unpaidClose}>
                            <span>Ödənişsiz bağlamalar</span><div className="dots"></div><span className="value">{(reportSummary.total_unpaid || 0).toFixed(2)}</span>
                        </div>
                    </>
                )}
                <div className="receipt-row total-line report-row-with-hint" title={REPORT_HINTS.net}><span>Yekun:</span><span className="value">{(reportSummary.net_total || 0).toFixed(2)}</span></div>

                <div className="section-title mt-4">Digər detallar</div>
                <div className="receipt-row report-row-with-hint" title={REPORT_HINTS.openCount}><span>Açıq çeklərin sayı</span><div className="dots"></div><span className="value">{reportSummary.open_orders_count || 0}</span></div>
                <div className="receipt-row report-row-with-hint" title={REPORT_HINTS.openSum}><span>Açıq çeklərin cəmi</span><div className="dots"></div><span className="value">{(reportSummary.open_orders_total || 0).toFixed(2)} ₼</span></div>
                <div className="receipt-row report-row-with-hint" title={REPORT_HINTS.guests}><span>Qonaq sayı</span><div className="dots"></div><span className="value">{reportSummary.guest_count || 0}</span></div>

                {Object.keys(reportSummary.payments || {}).length > 0 && (
                    <>
                        <div className="section-title mt-4">Ödəniş üsulları</div>
                        {Object.entries(reportSummary.payments).map(([method, amount]) => (
                            <div className="receipt-row report-row-with-hint" key={method} title={`${REPORT_HINTS.paymentMethod} (${method})`}>
                                <span>{method}</span><div className="dots"></div><span className="value">{Number(amount).toFixed(2)}</span>
                            </div>
                        ))}
                    </>
                )}

                {Object.keys(reportSummary.unpaid_payments || {}).length > 0 && (
                    <>
                        <div className="section-title mt-4">Ödənişsiz bağlamalar</div>
                        {Object.entries(reportSummary.unpaid_payments).map(([method, amount]) => (
                            <div className="receipt-row report-row-with-hint" key={method} title={`${REPORT_HINTS.unpaidTag} (${method})`}>
                                <span>{method}</span><div className="dots"></div><span className="value">{Number(amount).toFixed(2)}</span>
                            </div>
                        ))}
                    </>
                )}

                {Object.keys(reportSummary.tags || {}).length > 0 && (
                    <>
                        <div className="section-title mt-4">Etiketlər</div>
                        {Object.entries(reportSummary.tags).map(([tag, details]) => (
                            <div className="receipt-row report-row-with-hint" key={tag} title={`${REPORT_HINTS.tagRow} (${tag})`}>
                                <span>{tag} ({details.count})</span><div className="dots"></div><span className="value">{details.total.toFixed(2)}</span>
                            </div>
                        ))}
                    </>
                )}
            </div>
        );

        return (
            <div className="report-view premium-receipt">
                <ReportHeader />
                <SalesSummary />
                {type !== "simple" && (
                    <div className="report-details-section">
                        <div className="section-title mb-4">
                            {reportTypes.find(t => t.id === type)?.name}
                        </div>
                        {renderSpecificData(type, data)}
                    </div>
                )}
            </div>
        );
    };

    const renderSpecificData = (type, data) => {
        if (type === "inventory") {
            return (
                <div className="report-empty-detail" role="status">
                    <p className="mb-0">
                        Ehtiyat hesabatı üçün məlumat mənbəsi hazırlanır.
                    </p>
                </div>
            );
        }

        const isDetailEmpty =
            data == null ||
            (Array.isArray(data) && data.length === 0) ||
            (typeof data === "object" &&
                !Array.isArray(data) &&
                Array.isArray(data.rows) &&
                data.rows.length === 0);
        if (isDetailEmpty) {
            return (
                <div className="report-empty-detail" role="status">
                    <p className="mb-0">
                        Bu tarix aralığında və seçilmiş filtrə uyğun detallı sətir yoxdur.
                    </p>
                </div>
            );
        }

        switch (type) {
            case "products":
                return (
                    <Table responsive className="custom-report-table">
                        <thead>
                            <tr>
                                <th>Məhsul</th>
                                <th className="text-center">Sayı</th>
                                <th className="text-center">İkram</th>
                                <th className="text-end">Məbləğ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <tr key={i}>
                                    <td>{item.name}</td>
                                    <td className="text-center">{item.quantity}</td>
                                    <td className="text-center">{item.quantity_gift || 0}</td>
                                    <td className="text-end">{Number(item.total || 0).toFixed(2)} ₼</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                );
            case "hall":
                return (
                    <Table responsive className="custom-report-table">
                        <thead>
                            <tr><th>Zal</th><th className="text-center">Sayı</th><th className="text-end">Məbləğ</th></tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <tr key={i}><td>{item.name}</td><td className="text-center">{item.checks_count}</td><td className="text-end">{item.total?.toFixed(2)} ₼</td></tr>
                            ))}
                        </tbody>
                    </Table>
                );
            case "tables":
                const tablesRows = Array.isArray(data) ? data : (data?.rows || []);
                const tablesTotalTimer = data?.totalTimer ?? 0;
                return (
                    <>
                        <Table responsive className="custom-report-table">
                            <thead>
                                <tr>
                                    <th>Masa</th>
                                    <th className="text-center">Sayı</th>
                                    <th className="text-end">Məbləğ</th>
                                    <th className="text-end">Timer</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tablesRows.map((item, i) => (
                                    <tr key={i}>
                                        <td>{item.name}</td>
                                        <td className="text-center">{item.checks_count}</td>
                                        <td className="text-end">{Number(item.total || 0).toFixed(2)} ₼</td>
                                        <td className="text-end">{(item.timer_total || 0) > 0 ? `${Number(item.timer_total).toFixed(2)} ₼` : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                        {tablesTotalTimer > 0 && (
                            <div className="receipt-row total-line mt-3">
                                <span>Timer cəmi</span>
                                <span className="value">{Number(tablesTotalTimer).toFixed(2)} ₼</span>
                            </div>
                        )}
                    </>
                );
            case "employee":
                return (
                    <Table responsive className="custom-report-table">
                        <thead>
                            <tr><th>Əməkdaş</th><th className="text-center">Sayı</th><th className="text-end">Məbləğ</th></tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <tr key={i}><td>{item.name}</td><td className="text-center">{item.checks_count}</td><td className="text-end">{item.total?.toFixed(2)} ₼</td></tr>
                            ))}
                        </tbody>
                    </Table>
                );
            case "category": {
                const allIncluded =
                    Array.isArray(data) &&
                    data.length > 0 &&
                    data.every((_, idx) => categoryPrintInclude[idx] !== false);
                return (
                    <Table responsive className="custom-report-table report-category-table">
                        <thead>
                            <tr>
                                <th className="text-center report-category-print-col" style={{ width: 34 }}>
                                    <Form.Check
                                        className="report-category-print-check"
                                        type="checkbox"
                                        checked={allIncluded}
                                        onChange={(e) => {
                                            const v = e.target.checked;
                                            const next = {};
                                            data.forEach((_, idx) => {
                                                next[idx] = v;
                                            });
                                            setCategoryPrintInclude(next);
                                        }}
                                        title="Hamısı"
                                        aria-label="Bütün kateqoriyaları çap üçün seç"
                                    />
                                </th>
                                <th>Kateqoriya / Məhsul</th>
                                <th className="text-center">Sayı</th>
                                <th className="text-end">Məbləğ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <Fragment key={i}>
                                    <tr
                                        className={`report-category-total-row ${
                                            categoryPrintInclude[i] === false ? "report-print-exclude" : ""
                                        }`}
                                    >
                                        <td className="text-center align-middle report-category-print-col">
                                            <Form.Check
                                                className="report-category-print-check"
                                                type="checkbox"
                                                checked={categoryPrintInclude[i] !== false}
                                                onChange={() => {
                                                    setCategoryPrintInclude((prev) => {
                                                        const cur = prev[i] !== false;
                                                        return { ...prev, [i]: !cur };
                                                    });
                                                }}
                                                aria-label={`Çap: ${item.name}`}
                                            />
                                        </td>
                                        <td>
                                            <strong>{item.name}</strong>
                                        </td>
                                        <td className="text-center">
                                            <strong>{Number(item.quantity || 0).toFixed(2)}</strong>
                                        </td>
                                        <td className="text-end">
                                            <strong>{Number(item.total || 0).toFixed(2)} ₼</strong>
                                        </td>
                                    </tr>
                                    {item.products && item.products.length > 0
                                        ? item.products.map((p, pi) => (
                                              <tr
                                                  key={`${i}-p-${pi}`}
                                                  className={`report-category-product-row ${
                                                      categoryPrintInclude[i] === false ? "report-print-exclude" : ""
                                                  }`}
                                              >
                                                  <td className="report-category-print-col"></td>
                                                  <td className="report-category-product-name">↳ {p.name}</td>
                                                  <td className="text-center">{Number(p.quantity || 0).toFixed(2)}</td>
                                                  <td className="text-end">{Number(p.total || 0).toFixed(2)} ₼</td>
                                              </tr>
                                          ))
                                        : null}
                                </Fragment>
                            ))}
                        </tbody>
                    </Table>
                );
            }
            case "checks":
                return (
                    <Table responsive className="custom-report-table list-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Masa</th>
                                <th>Ofisant</th>
                                {showTransactions && <th>Etiket</th>}
                                <th className="text-end">Məbləğ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <tr key={i}>
                                    <td>#{item.id}</td>
                                    <td>{item.table?.name || "-"}</td>
                                    <td>{item.waiter?.name || "-"}</td>
                                    {showTransactions && <td>{item.tags || "-"}</td>}
                                    <td className="text-end">{item.total?.toFixed(2)} ₼</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                );
            case "refunds":
                return (
                    <Table responsive className="custom-report-table list-table">
                        <thead>
                            <tr><th>ID</th><th>Ofisant</th><th className="text-end">Məbləğ</th></tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <tr key={i} className="table-danger">
                                    <td>#{item.id}</td>
                                    <td>{item.waiter?.name || "-"}</td>
                                    <td className="text-end">{item.total?.toFixed(2)} ₼</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                );
            case "gifted_products":
                return (
                    <Table responsive className="custom-report-table">
                        <thead>
                            <tr><th>Məhsul</th><th className="text-center">Sayı</th></tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <tr key={i}><td>{item.product_name}</td><td className="text-center">{item.quantity}</td></tr>
                            ))}
                        </tbody>
                    </Table>
                );
            case "sale_method":
                return (
                    <Table responsive className="custom-report-table">
                        <thead>
                            <tr><th>Üsul</th><th className="text-center">Sayı</th><th className="text-end">Məbləğ</th></tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <tr key={i}>
                                    <td>{item.name}</td>
                                    <td className="text-center">{item.count}</td>
                                    <td className="text-end">{item.total?.toFixed(2)} ₼</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                );
            case "department":
                return (
                    <Table responsive className="custom-report-table">
                        <thead>
                            <tr><th>Şöbə</th><th className="text-center">Sayı</th><th className="text-end">Məbləğ</th></tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <tr key={i}><td>{item.name}</td><td className="text-center">{item.checks_count}</td><td className="text-end">{item.total?.toFixed(2)} ₼</td></tr>
                            ))}
                        </tbody>
                    </Table>
                );
            case "financial":
                return (
                    <Table responsive className="custom-report-table">
                        <thead>
                            <tr><th>Ödəniş üsulu</th><th className="text-center">Sayı</th><th className="text-end">Məbləğ</th></tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <tr key={i}><td>{item.name}</td><td className="text-center">{item.count}</td><td className="text-end">{item.total?.toFixed(2)} ₼</td></tr>
                            ))}
                        </tbody>
                    </Table>
                );
            case "customers":
                return (
                    <Table responsive className="custom-report-table">
                        <thead>
                            <tr><th>Müştəri</th><th className="text-center">Sifariş sayı</th><th className="text-end">Məbləğ</th></tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => {
                                const matchedCustomer = customers.find(c => c.id === item.customer_id);
                                const displayName = matchedCustomer ? (matchedCustomer.name || matchedCustomer.phone_number) : 'Bilinməyən müştəri';
                                return (
                                    <tr key={i}>
                                        <td>{displayName}</td>
                                        <td className="text-center">{item.checks_count}</td>
                                        <td className="text-end">{item.total?.toFixed(2)} ₼</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </Table>
                );
            default:
                return (
                    <div className="alert alert-info">Seçilmiş hesabat üçün detallı məlumat tapılmadı.</div>
                );
        }
    };

    return (
        <Modal
            show={show}
            onHide={onClose}
            size="xl"
            centered
            className="report-modal"
            dialogClassName="report-modal-dialog"
            backdrop="static"
            aria-labelledby="report-modal-title"
        >
            <div className="report-modal-header">
                <h2 className="report-modal-title" id="report-modal-title">Hesabat</h2>
                <div className="report-header-actions">
                    {reportResults && !loading && (
                        <button type="button" className="report-print-btn" onClick={handlePrint} title="Çap et">
                            <i className="bi bi-printer-fill" aria-hidden="true"></i>
                            <span>Çap et</span>
                        </button>
                    )}
                    <button type="button" className="report-modal-close-btn" onClick={onClose} aria-label="Bağla">
                        <i className="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                </div>
            </div>

            {isMobile && (
                <div className="report-mobile-tabs">
                    <div
                        className={`report-mobile-tab ${activeMobileTab === "filters" ? "active" : ""}`}
                        onClick={() => setActiveMobileTab("filters")}
                    >
                        Ayarlar
                    </div>
                    <div
                        className={`report-mobile-tab ${activeMobileTab === "result" ? "active" : ""}`}
                        onClick={() => setActiveMobileTab("result")}
                    >
                        Nəticə {reportResults && !loading && <span className="tab-dot"></span>}
                    </div>
                </div>
            )}

            <Modal.Body className="report-modal-body">
                <Row className="h-100 g-0 w-100" style={{ overflow: 'hidden', flexWrap: 'nowrap' }}>
                    {/* Left Sidebar - Filters */}
                    {(!isMobile || activeMobileTab === "filters") && (
                        <Col md={5} lg={4} className="report-sidebar">
                            <div className="report-sidebar-scroll">
                            <div className="mobile-section-wrapper">
                                <div className="mobile-group-title">Vaxt aralığı</div>
                                <Form.Group className="mb-3">
                                    <Form.Label>Bu tarixdən</Form.Label>
                                    <div className="date-time-row">
                                        <Form.Control
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                        />
                                        <Form.Select
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                        >
                                            {Array.from({ length: 48 }, (_, i) => {
                                                const hour = Math.floor(i / 2).toString().padStart(2, '0');
                                                const minute = (i % 2 === 0 ? '00' : '30');
                                                const time = `${hour}:${minute}`;
                                                return <option key={time} value={time}>{time}</option>;
                                            })}
                                        </Form.Select>
                                    </div>
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Bu tarixə qədər</Form.Label>
                                    <div className="date-time-row">
                                        <Form.Control
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                        />
                                        <Form.Select
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                        >
                                            {Array.from({ length: 48 }, (_, i) => {
                                                const hour = Math.floor(i / 2).toString().padStart(2, '0');
                                                const minute = (i % 2 === 0 ? '00' : '30');
                                                const time = `${hour}:${minute}`;
                                                return <option key={time} value={time}>{time}</option>;
                                            })}
                                        </Form.Select>
                                    </div>
                                </Form.Group>

                                <div className="mobile-group-title mt-4">Növ və Filtr</div>
                                <Form.Group className="mb-3">
                                    <Form.Label>Terminallar</Form.Label>
                                    <Form.Select
                                        value={terminal}
                                        onChange={(e) => setTerminal(e.target.value)}
                                    >
                                        {terminals.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Hesabat növü</Form.Label>
                                    <Form.Select
                                        value={reportType}
                                        onChange={(e) => setReportType(e.target.value)}
                                    >
                                        {reportTypes.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>

                                <div className="switch-group">
                                    <Form.Group className="mb-2">
                                        <Form.Check
                                            type="switch"
                                            id="transactions-switch"
                                            label="Əməliyyatlarla"
                                            checked={showTransactions}
                                            onChange={(e) => setShowTransactions(e.target.checked)}
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-4">
                                        <Form.Check
                                            type="switch"
                                            id="accounts-switch"
                                            label="Hesablar"
                                            checked={showAccounts}
                                            onChange={(e) => setShowAccounts(e.target.checked)}
                                        />
                                    </Form.Group>
                                </div>
                            </div>
                            </div>

                            <div className="report-sidebar-footer">
                                <button
                                    className="report-create-btn"
                                    onClick={handleCreateReport}
                                    disabled={loading}
                                >
                                    <i className="bi bi-file-earmark-bar-graph-fill me-2"></i>
                                    {loading ? "Yüklənir..." : "Hesabat yarat"}
                                </button>
                            </div>
                        </Col>
                    )}

                    {/* Right Content - Results */}
                    {(!isMobile || activeMobileTab === "result") && (
                        <Col
                            md={7}
                            lg={8}
                            className={`report-content ${!reportResults || loading ? 'd-flex align-items-center justify-content-center text-center' : 'p-4'}`}
                            style={{ overflowY: 'auto' }}
                        >
                            {renderResults()}
                        </Col>
                    )}
                </Row>
            </Modal.Body>
        </Modal>
    );
};

export default ReportModal;



