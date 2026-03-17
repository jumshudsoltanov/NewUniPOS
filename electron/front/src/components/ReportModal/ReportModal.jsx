import React, { useState, useEffect } from "react";
import { Modal, Row, Col, Form, Table } from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import { fetchCustomersFromAdmin } from "../../redux/Slices/CustomersSlice";
import axios from "../../utils/apiConfig";
import "./ReportModal.css";

const ReportModal = ({ show, onClose }) => {
    const profile = useSelector((state) => state.LoginSlice?.loginedProfileData?.data?.profile);
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

    const [cashierPrinter, setCashierPrinter] = useState(null);

    useEffect(() => {
        if (show && profileId) {
            fetchTerminals();
            fetchCashierPrinter();
            dispatch(fetchCustomersFromAdmin({ limit: 500 }));
        }
    }, [show, profileId]);

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
                const cashier = response.data.data.find(p => p.is_cashier === 1);
                if (cashier) setCashierPrinter(cashier);
            }
        } catch (e) {}
    };

    const handlePrint = async () => {
        const reportEl = document.querySelector('.report-view');
        if (!reportEl) return;

        const html = `
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Courier New', 'Courier', monospace; color: #000 !important; }
                .report-view { width: 100%; max-width: 80mm; padding: 0 5mm; }
                .report-data-header { border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 20px; text-align: left; }
                .report-data-info p { font-size: 15px; margin-bottom: 6px; font-weight: 900; }
                .report-data-info p span { font-weight: bold; margin-right: 5px; }
                .report-data-time { margin-top: 10px; }
                .report-data-time span { font-size: 14px; font-weight: 900; }
                .section-title { font-weight: 900; font-size: 18px; border-bottom: 2px solid #000; padding-bottom: 6px; margin: 25px 0 15px; text-transform: uppercase; text-align: center; }
                .receipt-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #666; align-items: center; }
                .receipt-row > span:first-child { font-size: 16px; font-weight: 900; }
                .receipt-row .dots { display: none; }
                .receipt-row .value { font-size: 17px; font-weight: 900; }
                .total-line { border-top: 2px solid #000; border-bottom: 3px double #000; margin-top: 15px; padding: 12px 0; }
                .total-line > span:first-child { font-size: 20px !important; font-weight: 900 !important; text-transform: uppercase; }
                .total-line .value { font-size: 22px !important; font-weight: 900 !important; }
                .report-details-section { margin-top: 25px; padding-top: 15px; border-top: 2px dashed #000; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 15px; }
                th { border-bottom: 2px solid #000; padding: 8px 3px; font-size: 15px; font-weight: 900; text-align: left; text-transform: uppercase; }
                td { border-bottom: 1px dashed #666; padding: 8px 3px; font-size: 15px; font-weight: 900; word-break: break-word; }
                .text-end { text-align: right; }
                .text-center { text-align: center; }
                .alert { display: none; }
                i, svg, button { display: none !important; }
            </style>
            ${reportEl.innerHTML}
        `;

        if (window.electronAPI?.printReceipt && cashierPrinter) {
            const targetPrinter = cashierPrinter.usb_name || cashierPrinter.local_name || cashierPrinter.name;
            await window.electronAPI.printReceipt({ html, printerName: targetPrinter });
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
            const summaryRes = await axios.get(`/reports/${profileId}/data`, {
                params: { startDate, startTime, endDate, endTime, terminal, reportType: 'simple', showTransactions }
            });

            if (summaryRes.data.status === "success") {
                setReportSummary(summaryRes.data.data);
            }

            if (reportType !== "simple") {
                const response = await axios.get(`/reports/${profileId}/data`, {
                    params: { startDate, startTime, endDate, endTime, terminal, reportType, showTransactions }
                });

                if (response.data.status === "success") {
                    setReportResults({ type: reportType, data: response.data.data });
                }
            } else {
                setReportResults({ type: "simple", data: summaryRes.data.data });
            }
            if (isMobile) setActiveMobileTab("result");
        } catch (error) {
            console.error("Error generating report:", error);
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

        const formatDate = (dateStr) => {
            if (!dateStr) return "";
            const [year, month, day] = dateStr.split("-");
            return `${day}.${month}.${year}`;
        };

        const ReportHeader = () => (
            <div className="report-data-header mb-4">
                <div className="report-data-info">
                    <p><span>Bu tarixdən:</span> {formatDate(startDate)} {startTime}</p>
                    <p><span>Bu tarixə qədər:</span> {formatDate(endDate)} {endTime}</p>
                </div>
                <div className="report-data-time">
                    <i className="bi bi-clock-fill"></i>
                    <span>Çıxarılma vaxtı: {new Date().toLocaleDateString('az-AZ')} {new Date().toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>
        );

        const SalesSummary = () => (
            <div className="report-section mb-5">
                <div className="section-title">Satış hesabatı</div>
                <div className="receipt-row"><span>Cəm</span><div className="dots"></div><span className="value">{(reportSummary.total_amount || 0).toFixed(2)}</span></div>
                <div className="receipt-row"><span>Vergi</span><div className="dots"></div><span className="value">{(reportSummary.total_tax || 0).toFixed(2)}</span></div>
                <div className="receipt-row"><span>İkram</span><div className="dots"></div><span className="value">{(reportSummary.total_gift || 0).toFixed(2)}</span></div>
                <div className="receipt-row"><span>Xidmət</span><div className="dots"></div><span className="value">{(reportSummary.total_service || 0).toFixed(2)}</span></div>
                <div className="receipt-row"><span>Endirim</span><div className="dots"></div><span className="value">{(reportSummary.total_discount || 0).toFixed(2)}</span></div>
                <div className="receipt-row"><span>Çatdırılma haqqı</span><div className="dots"></div><span className="value">0.00</span></div>
                <div className="receipt-row"><span>Geri qaytarılma</span><div className="dots"></div><span className="value">{(reportSummary.total_refund || 0).toFixed(2)}</span></div>
                <div className="receipt-row"><span>Silinmələr</span><div className="dots"></div><span className="value">{(reportSummary.total_deleted || 0).toFixed(2)}</span></div>
                {(reportSummary.total_paid > 0 || reportSummary.total_unpaid > 0) && (
                    <>
                        <div className="receipt-row" style={{borderTop: '1px dashed #ccc', marginTop: 4, paddingTop: 4}}>
                            <span>Ödənişli bağlamalar</span><div className="dots"></div><span className="value">{(reportSummary.total_paid || 0).toFixed(2)}</span>
                        </div>
                        <div className="receipt-row">
                            <span>Ödənişsiz bağlamalar</span><div className="dots"></div><span className="value">{(reportSummary.total_unpaid || 0).toFixed(2)}</span>
                        </div>
                    </>
                )}
                <div className="receipt-row total-line"><span>Yekun:</span><span className="value">{(reportSummary.net_total || 0).toFixed(2)}</span></div>

                <div className="section-title mt-4">Digər detallar</div>
                <div className="receipt-row"><span>Açıq çeklərin sayı</span><div className="dots"></div><span className="value">{reportSummary.open_orders_count || 0}</span></div>
                <div className="receipt-row"><span>Açıq çeklərin cəmi</span><div className="dots"></div><span className="value">{(reportSummary.open_orders_total || 0).toFixed(2)} ₼</span></div>
                <div className="receipt-row"><span>Qonaq sayı</span><div className="dots"></div><span className="value">{reportSummary.guest_count || 0}</span></div>

                {Object.keys(reportSummary.payments || {}).length > 0 && (
                    <>
                        <div className="section-title mt-4">Ödəniş üsulları</div>
                        {Object.entries(reportSummary.payments).map(([method, amount]) => (
                            <div className="receipt-row" key={method}>
                                <span>{method}</span><div className="dots"></div><span className="value">{Number(amount).toFixed(2)}</span>
                            </div>
                        ))}
                    </>
                )}

                {Object.keys(reportSummary.unpaid_payments || {}).length > 0 && (
                    <>
                        <div className="section-title mt-4">Ödənişsiz bağlamalar</div>
                        {Object.entries(reportSummary.unpaid_payments).map(([method, amount]) => (
                            <div className="receipt-row" key={method}>
                                <span>{method}</span><div className="dots"></div><span className="value">{Number(amount).toFixed(2)}</span>
                            </div>
                        ))}
                    </>
                )}

                {Object.keys(reportSummary.tags || {}).length > 0 && (
                    <>
                        <div className="section-title mt-4">Etiketlər</div>
                        {Object.entries(reportSummary.tags).map(([tag, details]) => (
                            <div className="receipt-row" key={tag}>
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
                                <tr key={i}><td>{item.name}</td><td className="text-center">{item.checks_count}</td><td className="text-end">{item.total?.toFixed(2)} AZN</td></tr>
                            ))}
                        </tbody>
                    </Table>
                );
            case "tables":
                return (
                    <Table responsive className="custom-report-table">
                        <thead>
                            <tr><th>Masa</th><th className="text-center">Sayı</th><th className="text-end">Məbləğ</th></tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <tr key={i}><td>{item.name}</td><td className="text-center">{item.checks_count}</td><td className="text-end">{item.total?.toFixed(2)} AZN</td></tr>
                            ))}
                        </tbody>
                    </Table>
                );
            case "employee":
                return (
                    <Table responsive className="custom-report-table">
                        <thead>
                            <tr><th>Əməkdaş</th><th className="text-center">Sayı</th><th className="text-end">Məbləğ</th></tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <tr key={i}><td>{item.name}</td><td className="text-center">{item.checks_count}</td><td className="text-end">{item.total?.toFixed(2)} AZN</td></tr>
                            ))}
                        </tbody>
                    </Table>
                );
            case "category":
                return (
                    <Table responsive className="custom-report-table">
                        <thead>
                            <tr><th>Kateqoriya</th><th className="text-center">Sayı</th><th className="text-end">Məbləğ</th></tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <tr key={i}><td>{item.name}</td><td className="text-center">{item.quantity}</td><td className="text-end">{item.total?.toFixed(2)} AZN</td></tr>
                            ))}
                        </tbody>
                    </Table>
                );
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
                                    <td className="text-end">{item.total?.toFixed(2)} AZN</td>
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
                                    <td className="text-end">{item.total?.toFixed(2)} AZN</td>
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
                                    <td className="text-end">{item.total?.toFixed(2)} AZN</td>
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
                                <tr key={i}><td>{item.name}</td><td className="text-center">{item.checks_count}</td><td className="text-end">{item.total?.toFixed(2)} AZN</td></tr>
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
                                <tr key={i}><td>{item.name}</td><td className="text-center">{item.count}</td><td className="text-end">{item.total?.toFixed(2)} AZN</td></tr>
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
                                        <td className="text-end">{item.total?.toFixed(2)} AZN</td>
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
        >
            <div className="report-modal-header">
                <span className="report-modal-title">Hesabat</span>
                <div className="report-header-actions">
                    {reportResults && !loading && (
                        <button className="report-print-btn" onClick={handlePrint} title="Çap et">
                            <i className="bi bi-printer-fill"></i>
                            <span>Çap et</span>
                        </button>
                    )}
                    <button className="report-modal-close-btn" onClick={onClose}>
                        <i className="bi bi-x-lg"></i>
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



