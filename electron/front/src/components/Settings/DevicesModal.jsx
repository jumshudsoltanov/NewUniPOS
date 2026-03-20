import React, { useState, useEffect } from "react";
import { Modal } from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import { setLoginData } from "../../redux/Slices/LoginSlice";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import apiConfig, { localApi, TAX_HTTP_TIMEOUT_MS } from "../../utils/apiConfig";
import axios from "axios";
import { addNotification } from "../../utils/notificationService";
import "./DevicesModal.css";

const DevicesModal = ({ show, onHide }) => {
    const dispatch = useDispatch();
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);
    const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
    const profileId = loginedProfileData?.data?.profile?.id;
    const taxes = loginedProfileData?.data?.taxes || [];
    const canSeeTax = Number(loginedWaiter?.data?.can_see_tax) === 1;

    const [activeTab, setActiveTab] = useState("printers");
    const isMobile = window.innerWidth < 992;
    const isMaster = loginedProfileData?.data?.terminal?.is_master === 1 || loginedProfileData?.data?.profile?.is_master === 1;
    const isSlave = !isMaster && (loginedProfileData?.data?.terminal?.is_master_slave_active === 1 || loginedProfileData?.data?.profile?.is_master_slave_active === 1);
    const [localIp, setLocalIp] = useState("");
    const [printers, setPrinters] = useState([]);
    const [systemPrinters, setSystemPrinters] = useState([]);
    const [masterModes, setMasterModes] = useState({
        cashier: false,
        product: false
    });
    const [customerReceiptAutoPrint, setCustomerReceiptAutoPrint] = useState(false);
    const [screens, setScreens] = useState([]);
    const [customerDisplay, setCustomerDisplay] = useState({
        active: false,
        screenId: ""
    });
    const [kitchenDisplay, setKitchenDisplay] = useState({
        active: false,
        screenId: ""
    });
    const [shiftStates, setShiftStates] = useState({});
    const [taxLoading, setTaxLoading] = useState({});
    const [selectedTaxIndex, setSelectedTaxIndex] = useState(null);
    const [selectedPrinterIndex, setSelectedPrinterIndex] = useState(null);
    const [taxDailyInfo, setTaxDailyInfo] = useState({});

    // Periodic Report States
    const [reportStart, setReportStart] = useState({ date: '', time: '06:00' });
    const [reportEnd, setReportEnd] = useState({ date: '', time: '06:00' });

    // Local Naming
    const [taxLocalNames, setTaxLocalNames] = useState({});
    const [staticMasterIp, setStaticMasterIp] = useState("");
    const [staticIpSaving, setStaticIpSaving] = useState(false);
    const [staticIpScanning, setStaticIpScanning] = useState(false);

    useEffect(() => {
        if (window.electronAPI?.getStaticMasterIp) {
            window.electronAPI.getStaticMasterIp().then(ip => setStaticMasterIp(ip || "")).catch(() => {});
        }
    }, [show]);

    useEffect(() => {
        const stored = localStorage.getItem("tax_local_names");
        if (stored) {
            try { setTaxLocalNames(JSON.parse(stored)); } catch (e) { }
        }
    }, []);

    const handleTaxNameChange = (taxKey, newName) => {
        const updated = { ...taxLocalNames, [taxKey]: newName };
        setTaxLocalNames(updated);
        localStorage.setItem("tax_local_names", JSON.stringify(updated));
    };

    useEffect(() => {
        if (show && profileId) {
            fetchData();
        }
    }, [show, profileId]);

    const fetchData = async () => {
        try {
            const prRes = await apiConfig.get(`/pos/printers/${profileId}`);

            const rawPrinters = prRes.data.data || [];
            const normalizedPrinters = rawPrinters.map(p => ({
                ...p,
                connection_type: p.connection_type || 'network'
            }));
            setPrinters(normalizedPrinters);

            const authStr = localStorage.getItem("authResult");
            const authProfile = authStr ? (JSON.parse(authStr)?.data?.profile || {}) : {};
            const storedProfile = JSON.parse(localStorage.getItem("profile") || "{}");
            const merged = { ...authProfile, ...storedProfile };
            setMasterModes({
                cashier: merged.is_master_cashier_printing === 1,
                product: merged.is_master_product_printing === 1
            });
            setCustomerReceiptAutoPrint(merged.is_customer_receipt_auto_print === 1);

            try {
                if (window.electronAPI?.getSystemPrinters) {
                    const sysPrinters = await window.electronAPI.getSystemPrinters();
                    setSystemPrinters(sysPrinters || []);
                }
                if (window.electronAPI?.getScreens) {
                    const scr = await window.electronAPI.getScreens();
                    setScreens(scr || []);
                }
            } catch (printerErr) {
                console.warn("System devices not available:", printerErr.message);
                setSystemPrinters([]);
            }

            const profile = JSON.parse(localStorage.getItem("profile") || "{}");
            setCustomerDisplay({
                active: profile.is_customer_display_active === 1,
                screenId: profile.customer_display_screen_id || ""
            });
            setKitchenDisplay({
                active: profile.is_kitchen_display_active === 1,
                screenId: profile.kitchen_display_screen_id || ""
            });

            if (window.electronAPI?.getLocalIp) {
                const ip = await window.electronAPI.getLocalIp();
                setLocalIp(ip);
            }
        } catch (error) {
            console.error("Fetch Data Error:", error);
        }
    };

    const handleUpdatePrinter = async (printer) => {
        try {
            await apiConfig.put(`/printers/${printer.id}`, printer);
            toast.success(`${printer.name} yeniləndi`);
            fetchData();
        } catch (error) {
            toast.error("Xəta baş verdi");
        }
    };

    const handleTestPrint = async (printerName) => {
        try {
            if (window.electronAPI?.printReceipt) {
                const testHtml = `
                    <div style="text-align: center; font-family: sans-serif; padding: 10px;">
                        <h2 style="margin: 0;">UniPOS</h2>
                        <h4 style="margin: 5px 0;">TEST ÇAPI</h4>
                        <p style="margin: 5px 0;">-------------------------</p>
                        <p style="margin: 2px 0;">Printer: ${printerName}</p>
                        <p style="margin: 2px 0;">Tarix: ${new Date().toLocaleString()}</p>
                        <p style="margin: 5px 0;">-------------------------</p>
                        <p style="margin: 5px 0; font-size: 12px;">Sistem uğurla qoşuldu</p>
                    </div>
                `;
                await window.electronAPI.printReceipt({ html: testHtml, printerName });
                toast.success("Test çapı göndərildi");
            }
        } catch (error) {
            toast.error("Çap xətası: " + error.message);
        }
    };

    const persistMasterPrintingToStorage = (field, value) => {
        const storedProfile = JSON.parse(localStorage.getItem("profile") || "{}");
        storedProfile[field] = value;
        localStorage.setItem("profile", JSON.stringify(storedProfile));
        try {
            const authStr = localStorage.getItem("authResult");
            if (authStr) {
                const auth = JSON.parse(authStr);
                if (auth?.data?.profile) {
                    auth.data.profile = { ...auth.data.profile, [field]: value };
                    localStorage.setItem("authResult", JSON.stringify(auth));
                    dispatch(setLoginData(auth));
                }
            }
        } catch (e) { console.warn("authResult update:", e); }
    };

    const handleToggleCustomerReceiptAutoPrint = async () => {
        const nextStatus = !customerReceiptAutoPrint;
        if (!profileId) {
            toast.error("Profil tapılmadı. Əvvəlcə giriş edin.");
            return;
        }
        setCustomerReceiptAutoPrint(nextStatus);
        const saveToLocalStorage = () => {
            const storedProfile = JSON.parse(localStorage.getItem("profile") || "{}");
            storedProfile.is_customer_receipt_auto_print = nextStatus ? 1 : 0;
            localStorage.setItem("profile", JSON.stringify(storedProfile));
            try {
                const authStr = localStorage.getItem("authResult");
                if (authStr) {
                    const auth = JSON.parse(authStr);
                    if (auth?.data?.profile) {
                        auth.data.profile = { ...auth.data.profile, is_customer_receipt_auto_print: nextStatus ? 1 : 0 };
                        localStorage.setItem("authResult", JSON.stringify(auth));
                        dispatch(setLoginData(auth));
                    }
                }
            } catch (e) { console.warn("authResult update:", e); }
        };
        if (isSlave) {
            saveToLocalStorage();
            toast.success(nextStatus ? "Müştəri çeki avto çap AKTİV (lokal)" : "Müştəri çeki avto çap DEAKTİV (lokal)");
            return;
        }
        try {
            await localApi.patch("/profiles/customer-receipt-auto", {
                profileId,
                isActive: nextStatus
            });
            saveToLocalStorage();
            toast.success(nextStatus ? "Müştəri çeki avto çap AKTİV" : "Müştəri çeki avto çap DEAKTİV");
        } catch (error) {
            setCustomerReceiptAutoPrint(!nextStatus);
            console.error("Customer receipt auto print toggle error:", error);
            toast.error("Xəta: " + (error?.response?.data?.message || error.message));
        }
    };

    const handleToggleMasterPrinting = async (type) => {
        const nextStatus = !masterModes[type];
        if (!profileId) {
            toast.error("Profil tapılmadı. Əvvəlcə giriş edin.");
            return;
        }
        const field = type === 'cashier' ? 'is_master_cashier_printing' : 'is_master_product_printing';
        const value = nextStatus ? 1 : 0;
        try {
            await apiConfig.patch("/profiles/master-printing", {
                profileId,
                status: nextStatus,
                type: type
            });
            setMasterModes(prev => ({ ...prev, [type]: nextStatus }));
            persistMasterPrintingToStorage(field, value);
            toast.success(nextStatus ? "Mərkəzi çap AKTİV" : "Mərkəzi çap DEAKTİV");
        } catch (error) {
            if (isSlave) {
                setMasterModes(prev => ({ ...prev, [type]: nextStatus }));
                persistMasterPrintingToStorage(field, value);
                toast.success(nextStatus ? "Mərkəzi çap AKTİV (lokal)" : "Mərkəzi çap DEAKTİV (lokal)");
            } else {
                console.error("Toggle Error:", error?.response?.data || error.message);
                toast.error("Xəta: " + (error?.response?.data?.message || error.message));
            }
        }
    };

    const handleUpdateCustomerDisplay = async (active = null, screenId = null) => {
        const nextActive = active !== null ? active : customerDisplay.active;
        const nextScreenId = screenId !== null ? screenId : customerDisplay.screenId;

        // Update local state and UI immediately
        setCustomerDisplay({ active: nextActive, screenId: nextScreenId });
        if (window.electronAPI?.toggleCustomerDisplay) {
            window.electronAPI.toggleCustomerDisplay({ active: nextActive, screenId: nextScreenId });
        }

        try {
            await localApi.patch("/profiles/customer-display", {
                profileId,
                isActive: nextActive,
                screenId: nextScreenId
            });

            // Update local storage for persistence
            const storedProfile = JSON.parse(localStorage.getItem("profile") || "{}");
            storedProfile.is_customer_display_active = nextActive ? 1 : 0;
            storedProfile.customer_display_screen_id = nextScreenId;
            localStorage.setItem("profile", JSON.stringify(storedProfile));

            toast.success("Müştəri ekranı tənzimləmələri yadda saxlanıldı");
        } catch (error) {
            console.error("Customer Display Sync Error:", error);
            toast.error("Sinxronizasiya xətası: " + error.message);
        }
    };

    const handleUpdateKitchenDisplay = async (active = null, screenId = null) => {
        const nextActive = active !== null ? active : kitchenDisplay.active;
        const nextScreenId = screenId !== null ? screenId : kitchenDisplay.screenId;

        // Update local state and UI immediately
        setKitchenDisplay({ active: nextActive, screenId: nextScreenId });
        if (window.electronAPI?.toggleKitchenDisplay) {
            window.electronAPI.toggleKitchenDisplay({ active: nextActive, screenId: nextScreenId });
        }

        try {
            await localApi.patch("/profiles/kitchen-display", {
                profileId,
                isActive: nextActive,
                screenId: nextScreenId
            });

            // Update local storage for persistence
            const storedProfile = JSON.parse(localStorage.getItem("profile") || "{}");
            storedProfile.is_kitchen_display_active = nextActive ? 1 : 0;
            storedProfile.kitchen_display_screen_id = nextScreenId;
            localStorage.setItem("profile", JSON.stringify(storedProfile));

            toast.success("Mətbəx ekranı tənzimləmələri yadda saxlanıldı");
        } catch (error) {
            console.error("KDS Sync Error:", error);
            toast.error("Sinxronizasiya xətası (KDS marşrutu tapılmadı, amma ekran açıldı)");
        }
    };

    const setTaxDeviceLoading = (index, loading) => {
        setTaxLoading(prev => ({ ...prev, [index]: loading }));
    };

    const handleTaxLogin = async (tax, index) => {
        setTaxDeviceLoading(index, true);
        try {
            const result = await localApi.post('/tax/login', { taxConfig: tax }, { timeout: TAX_HTTP_TIMEOUT_MS });
            if (result.data?.access_token || result.data?.data?.access_token) {
                toast.success(`${tax.tax_cash_type} — Login uğurlu`);
                handleShiftStatus(tax, index);
            } else {
                toast.error('Login u\u011Fursuz: ' + (result.data?.message || ''));
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            toast.error('Login x\u0259tas\u0131: ' + msg);
            addNotification('E-Kassa Login', msg, { category: 'system', type: 'error' });
        } finally {
            setTaxDeviceLoading(index, false);
        }
    };

    const handleShiftStatus = async (tax, index) => {
        setTaxDeviceLoading(index, true);
        try {
            const result = await localApi.post('/tax/shift-status', { taxConfig: tax }, { timeout: TAX_HTTP_TIMEOUT_MS });
            setShiftStates(prev => ({ ...prev, [index]: result.data }));
            const isOpen = result.data?.shiftStatus === true;
            toast.info(`N\u00F6vb\u0259: ${isOpen ? 'A\u00e7\u0131qd\u0131r' : 'Ba\u011Fl\u0131d\u0131r'}`);
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            toast.error('Status x\u0259tas\u0131: ' + msg);
            addNotification('E-Kassa Status', msg, { category: 'system', type: 'error' });
        } finally {
            setTaxDeviceLoading(index, false);
        }
    };

    const handleOpenShift = async (tax, index) => {
        setTaxDeviceLoading(index, true);
        try {
            await localApi.post('/tax/open-shift', { taxConfig: tax }, { timeout: TAX_HTTP_TIMEOUT_MS });
            toast.success('N\u00F6vb\u0259 a\u00E7\u0131ld\u0131');
            handleShiftStatus(tax, index);
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            toast.error('N\u00F6vb\u0259 a\u00E7ma x\u0259tas\u0131: ' + msg);
            addNotification('E-Kassa N\u00F6vb\u0259 A\u00E7', msg, { category: 'system', type: 'error' });
        } finally {
            setTaxDeviceLoading(index, false);
        }
    };

    const handleCloseShift = async (tax, index) => {
        setTaxDeviceLoading(index, true);
        try {
            const result = await localApi.post('/tax/close-shift', { taxConfig: tax }, { timeout: TAX_HTTP_TIMEOUT_MS });
            toast.success('N\u00F6vb\u0259 ba\u011Fland\u0131 (Z-Report)');
            setShiftStates(prev => ({ ...prev, [index]: { shiftStatus: false } }));
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            toast.error('N\u00F6vb\u0259 ba\u011Flama x\u0259tas\u0131: ' + msg);
            addNotification('E-Kassa Ba\u011Fla Z', msg, { category: 'system', type: 'error' });
        } finally {
            setTaxDeviceLoading(index, false);
        }
    };

    const handleXReport = async (tax, index) => {
        setTaxDeviceLoading(index, true);
        try {
            await localApi.post('/tax/x-report', { taxConfig: tax }, { timeout: TAX_HTTP_TIMEOUT_MS });
            toast.success('X-Report \u00E7ap edildi');
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            toast.error('X-Report x\u0259tas\u0131: ' + msg);
            addNotification('E-Kassa X-Report', msg, { category: 'system', type: 'error' });
        } finally {
            setTaxDeviceLoading(index, false);
        }
    };

    const handlePeriodicReport = async (tax, index) => {
        setTaxDeviceLoading(index, true);
        try {
            const bDate = reportStart.date ? `${reportStart.date}T${reportStart.time}:00` : "";
            const eDate = reportEnd.date ? `${reportEnd.date}T${reportEnd.time}:00` : "";

            const result = await localApi.post('/tax/periodic-report', {
                taxConfig: tax,
                beginDate: bDate,
                endDate: eDate
            }, { timeout: TAX_HTTP_TIMEOUT_MS });
            const errCode = Number(result.data?.error_code || 0);
            if (errCode !== 0) {
                toast.error('Hesabat x\u0259tas\u0131: ' + (result.data?.error_message || `code ${errCode}`));
            } else {
                toast.success('D\u00f6vri hesabat s\u0259n\u0259di \u00e7ap edildi');
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            toast.error('Hesabat \u00e7ap x\u0259tas\u0131: ' + msg);
            addNotification('Fiskal Hesabat', msg, { category: 'system', type: 'error' });
        } finally {
            setTaxDeviceLoading(index, false);
        }
    };

    const handleOperationHistory = async (tax, index) => {
        setTaxDeviceLoading(index, true);
        try {
            const bDate = reportStart.date ? `${reportStart.date}T${reportStart.time}:00` : "";
            const eDate = reportEnd.date ? `${reportEnd.date}T${reportEnd.time}:00` : "";

            const result = await localApi.post('/tax/operation-history', {
                taxConfig: tax,
                beginDate: bDate,
                endDate: eDate
            }, { timeout: TAX_HTTP_TIMEOUT_MS });
            const errCode = Number(result.data?.error_code || 0);
            if (errCode !== 0) {
                toast.error('Tarix\u00e7\u0259 x\u0259tas\u0131: ' + (result.data?.error_message || `code ${errCode}`));
            } else {
                toast.success('\u018fm\u0259liyyat tarix\u00e7\u0259si \u00e7ap edildi');
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            toast.error('Tarix\u00e7\u0259 \u00e7ap x\u0259tas\u0131: ' + msg);
            addNotification('Fiskal Tarix\u00e7\u0259', msg, { category: 'system', type: 'error' });
        } finally {
            setTaxDeviceLoading(index, false);
        }
    };

    const handleReprintAfterError = async (tax, index) => {
        setTaxDeviceLoading(index, true);
        try {
            await localApi.post('/tax/reprint-error', { taxConfig: tax }, { timeout: TAX_HTTP_TIMEOUT_MS });
            toast.success('Yenid\u0259n \u00E7ap sor\u011Fusu g\u00F6nd\u0259rildi');
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            toast.error('\u00C7ap x\u0259tas\u0131: ' + msg);
            addNotification('E-Kassa Yenid\u0259n \u00C7ap', msg, { category: 'system', type: 'error' });
        } finally {
            setTaxDeviceLoading(index, false);
        }
    };

    const handleTaxInfo = async (tax, index) => {
        setTaxDeviceLoading(index, true);
        try {
            const result = await localApi.post('/tax/info', { taxConfig: tax }, { timeout: TAX_HTTP_TIMEOUT_MS });
            if (result.data?.data) {
                const d = result.data.data;
                toast.success(`${d.company_name || tax.tax_cash_type} \u2014 S/N: ${d.cashbox_factory_number || '?'}, Son s\u0259n\u0259d: #${d.last_doc_number || '?'}`);
            } else {
                toast.info('Cihaz m\u0259lumat\u0131 al\u0131nd\u0131');
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            toast.error('M\u0259lumat x\u0259tas\u0131: ' + msg);
            addNotification('E-Kassa M\u0259lumat', msg, { category: 'system', type: 'error' });
        } finally {
            setTaxDeviceLoading(index, false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} centered size="xl" className="devices-modal">
            <Modal.Header closeButton>
                <Modal.Title>Cihazlar və Printerlər</Modal.Title>
            </Modal.Header>

            {
                isMobile && (
                    <div className="devices-mobile-tabs">
                        <div
                            className={`devices-mobile-tab ${activeTab === "printers" ? "active" : ""}`}
                            onClick={() => setActiveTab("printers")}
                        >
                            Printerlər
                        </div>
                        <div
                            className={`devices-mobile-tab ${activeTab === "display" ? "active" : ""}`}
                            onClick={() => setActiveTab("display")}
                        >
                            Müştəri Ekranı
                        </div>
                        <div
                            className={`devices-mobile-tab ${activeTab === "scales" ? "active" : ""}`}
                            onClick={() => setActiveTab("scales")}
                        >
                            Tərəzilər
                        </div>
                        <div
                            className={`devices-mobile-tab ${activeTab === "scanners" ? "active" : ""}`}
                            onClick={() => setActiveTab("scanners")}
                        >
                            Skanerlər
                        </div>
                        {taxes.length > 0 && canSeeTax && (
                            <div
                                className={`devices-mobile-tab ${activeTab === "taxes" ? "active" : ""}`}
                                onClick={() => setActiveTab("taxes")}
                            >
                                E-kassalar
                            </div>
                        )}
                        {isMaster && (
                            <div
                                className={`devices-mobile-tab ${activeTab === "mobile" ? "active" : ""}`}
                                onClick={() => setActiveTab("mobile")}
                            >
                                Mobil Qoşulma
                            </div>
                        )}
                        {isSlave && (
                            <div
                                className={`devices-mobile-tab ${activeTab === "network" ? "active" : ""}`}
                                onClick={() => setActiveTab("network")}
                            >
                                Master IP
                            </div>
                        )}
                    </div>
                )
            }

            <Modal.Body>
                {!isMobile && (
                    <div className="devices-sidebar">
                        <div className="devices-sidebar-menu">
                            <div
                                className={`devices-menu-item ${activeTab === "printers" ? "active" : ""}`}
                                onClick={() => { setActiveTab("printers"); setSelectedPrinterIndex(null); }}
                            >
                                <i className="bi bi-printer"></i>
                                <span>Printerlər</span>
                            </div>
                            <div
                                className={`devices-menu-item ${activeTab === "display" ? "active" : ""}`}
                                onClick={() => setActiveTab("display")}
                            >
                                <i className="bi bi-display"></i>
                                <span>Müştəri Ekranı</span>
                            </div>
                            <div
                                className={`devices-menu-item ${activeTab === "kitchen" ? "active" : ""}`}
                                onClick={() => setActiveTab("kitchen")}
                                style={{ display: 'none' }}
                            >
                                <i className="bi bi-egg-fried"></i>
                                <span>Mətbəx Ekranı</span>
                            </div>
                            <div
                                className={`devices-menu-item ${activeTab === "scales" ? "active" : ""}`}
                                onClick={() => setActiveTab("scales")}
                            >
                                <i className="bi bi-rulers"></i>
                                <span>Tərəzilər</span>
                            </div>
                            <div
                                className={`devices-menu-item ${activeTab === "scanners" ? "active" : ""}`}
                                onClick={() => setActiveTab("scanners")}
                            >
                                <i className="bi bi-qr-code-scan"></i>
                                <span>Skanerlər</span>
                            </div>

                            {taxes.length > 0 && canSeeTax && (
                                <div
                                    className={`devices-menu-item ${activeTab === "taxes" ? "active" : ""}`}
                                    onClick={() => setActiveTab("taxes")}
                                >
                                    <i className="bi bi-receipt"></i>
                                    <span>E-kassalar</span>
                                </div>
                            )}

                            {isMaster && (
                                <div
                                    className={`devices-menu-item ${activeTab === "mobile" ? "active" : ""}`}
                                    onClick={() => setActiveTab("mobile")}
                                >
                                    <i className="bi bi-phone"></i>
                                    <span>Mobil Qoşulma</span>
                                </div>
                            )}
                            {isSlave && (
                                <div
                                    className={`devices-menu-item ${activeTab === "network" ? "active" : ""}`}
                                    onClick={() => setActiveTab("network")}
                                >
                                    <i className="bi bi-hdd-network"></i>
                                    <span>Statik Master IP</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="devices-content">
                    <div className="devices-main-scroll">
                        {activeTab === "printers" ? (
                            <div className="display-settings">
                                {selectedPrinterIndex === null ? (
                                    <>
                                        <div className="master-modes-grid">
                                            <div className="master-printing-card">
                                                <div className="master-printing-info">
                                                    <h4>Mərkəzi Kassa Çapı</h4>
                                                    <p>Mərkəzi printer Master-dadır. Slave mərkəzi açıq olduqda Master-a göndərir, Master özündə çap edir.</p>
                                                </div>
                                                <div
                                                    className={`premium-switch ${masterModes.cashier ? "active" : ""}`}
                                                    onClick={() => handleToggleMasterPrinting('cashier')}
                                                >
                                                    <div className="switch-handle"></div>
                                                </div>
                                            </div>
                                            <div className="master-printing-card">
                                                <div className="master-printing-info">
                                                    <h4>Mərkəzi Mətbəx Çapı</h4>
                                                    <p>Mərkəzi printer Master-dadır. Slave mərkəzi açıq olduqda Master-a göndərir, Master özündə çap edir.</p>
                                                </div>
                                                <div
                                                    className={`premium-switch ${masterModes.product ? "active" : ""}`}
                                                    onClick={() => handleToggleMasterPrinting('product')}
                                                >
                                                    <div className="switch-handle"></div>
                                                </div>
                                            </div>
                                            <div className="master-printing-card">
                                                <div className="master-printing-info">
                                                    <h4>Müştəri çeki avto çap</h4>
                                                    <p>CheckOver səhifəsində "Çeki çap et" toggle avtomatik açıq olsun.</p>
                                                </div>
                                                <div
                                                    className={`premium-switch ${customerReceiptAutoPrint ? "active" : ""}`}
                                                    onClick={handleToggleCustomerReceiptAutoPrint}
                                                >
                                                    <div className="switch-handle"></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: '16px', marginTop: '24px' }}>
                                            <h4 style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>Printerlər</h4>
                                            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>Cihaza klikləyərək tənzimləmələri edin</p>
                                        </div>
                                        <div className="printers-grid">
                                            {printers.map((printer, index) => (
                                                <div
                                                    key={printer.id || index}
                                                    className="printer-edit-card"
                                                    style={{ cursor: 'pointer', border: '1px solid #e2e8f0', boxShadow: 'none' }}
                                                    onClick={() => setSelectedPrinterIndex(index)}
                                                >
                                                    <div className="printer-card-header">
                                                        <div className="printer-card-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                                                            <i className="bi bi-printer"></i>
                                                        </div>
                                                        <div className="printer-card-title">
                                                            <h5>{printer.local_name || printer.name}</h5>
                                                            <span>
                                                                {printer.is_cashier === 1 ? "Kassa Printeri" : "Mətbəx Printeri"}
                                                                {printer.connection_type === 'usb' && printer.usb_name ? ` • USB: ${printer.usb_name}` : ''}
                                                            </span>
                                                        </div>
                                                        <i className="bi bi-chevron-right" style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '18px' }}></i>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    (() => {
                                        const printer = printers[selectedPrinterIndex];
                                        return (
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '6px', background: '#fff' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                        <button
                                                            onClick={() => setSelectedPrinterIndex(null)}
                                                            style={{
                                                                background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px',
                                                                width: '36px', height: '36px', display: 'flex', alignItems: 'center',
                                                                justifyContent: 'center', cursor: 'pointer', color: '#64748b'
                                                            }}
                                                        >
                                                            <i className="bi bi-chevron-left" style={{ fontSize: '14px' }}></i>
                                                        </button>
                                                        <div>
                                                            <h3 style={{ margin: 0, color: '#1e293b', fontWeight: 700, fontSize: '16px' }}>{printer.local_name || printer.name}</h3>
                                                            <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                                                                {printer.is_cashier === 1 ? "Kassa Printeri" : "Mətbəx Printeri"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '24px', borderRadius: '6px' }}>
                                                    <div className="connection-toggle">
                                                        <button
                                                            className={`conn-btn ${printer.connection_type !== 'usb' ? 'active' : ''}`}
                                                            onClick={() => {
                                                                const newArr = printers.map(p => p.id === printer.id ? { ...p, connection_type: 'network' } : p);
                                                                setPrinters(newArr);
                                                            }}
                                                        >
                                                            Network (IP)
                                                        </button>
                                                        <button
                                                            className={`conn-btn ${printer.connection_type === 'usb' ? 'active' : ''}`}
                                                            onClick={() => {
                                                                const newArr = printers.map(p => p.id === printer.id ? { ...p, connection_type: 'usb' } : p);
                                                                setPrinters(newArr);
                                                            }}
                                                        >
                                                            USB / System
                                                        </button>
                                                    </div>

                                                    <div className="printer-form-group">
                                                        <label>Görünən adı</label>
                                                        <input
                                                            className="printer-input"
                                                            value={printer.local_name || ""}
                                                            onChange={(e) => {
                                                                const newArr = printers.map(p => p.id === printer.id ? { ...p, local_name: e.target.value } : p);
                                                                setPrinters(newArr);
                                                            }}
                                                        />
                                                    </div>

                                                    {printer.connection_type === 'usb' ? (
                                                        <div className="printer-form-group">
                                                            <label>Sistem Printeri Seçin</label>
                                                            <select
                                                                className="printer-select"
                                                                value={printer.usb_name || ""}
                                                                onChange={(e) => {
                                                                    const newArr = printers.map(p => p.id === printer.id ? { ...p, usb_name: e.target.value } : p);
                                                                    setPrinters(newArr);
                                                                }}
                                                            >
                                                                <option value="">Seçilməyib</option>
                                                                {systemPrinters.map(sp => (
                                                                    <option key={sp.name} value={sp.name}>{sp.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                                <div className="printer-form-group" style={{ flex: 2 }}>
                                                                    <label>IP Address</label>
                                                                    <input
                                                                        className="printer-input"
                                                                        placeholder="192.168.1.100"
                                                                        value={printer.ip || ""}
                                                                        onChange={(e) => {
                                                                            const newArr = printers.map(p => p.id === printer.id ? { ...p, ip: e.target.value } : p);
                                                                            setPrinters(newArr);
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div className="printer-form-group" style={{ flex: 1 }}>
                                                                    <label>Port</label>
                                                                    <input
                                                                        className="printer-input"
                                                                        placeholder="9100"
                                                                        value={printer.port || ""}
                                                                        onChange={(e) => {
                                                                            const newArr = printers.map(p => p.id === printer.id ? { ...p, port: e.target.value } : p);
                                                                            setPrinters(newArr);
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="printer-form-group">
                                                                <label>Sistem printeri (Windows-da qeydiyyatlı ad)</label>
                                                                <select
                                                                    className="printer-select"
                                                                    value={printer.usb_name || ""}
                                                                    onChange={(e) => {
                                                                        const newArr = printers.map(p => p.id === printer.id ? { ...p, usb_name: e.target.value } : p);
                                                                        setPrinters(newArr);
                                                                    }}
                                                                >
                                                                    <option value="">Seçilməyib</option>
                                                                    {systemPrinters.map(sp => (
                                                                        <option key={sp.name} value={sp.name}>{sp.name}</option>
                                                                    ))}
                                                                </select>
                                                                <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>IP printeri Windows-a əlavə edib buradan seçin</small>
                                                            </div>
                                                        </>
                                                    )}

                                                    <div className="printer-actions" style={{ marginTop: '24px' }}>
                                                        <button className="btn-test" onClick={() => handleTestPrint(printer.usb_name || printer.local_name || printer.name)}>Test çapı göndər</button>
                                                        <button className="btn-save-printer" onClick={() => handleUpdatePrinter(printer)}>Yadda saxla</button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()
                                )}
                            </div>
                        ) : activeTab === "display" ? (
                            <div className="display-settings">
                                <div className="display-config-card">
                                    <div className="display-config-header">
                                        <div className="display-config-info">
                                            <h4>İkinci Monitor (Dual-Monitor)</h4>
                                            <p>Cihaza bağlı olan ikinci ekranda müştəri menyusunu aktivləşdirin.</p>
                                        </div>
                                        <div
                                            className={`premium-switch ${customerDisplay.active ? "active" : ""}`}
                                            onClick={() => handleUpdateCustomerDisplay(!customerDisplay.active)}
                                        >
                                            <div className="switch-handle"></div>
                                        </div>
                                    </div>

                                    <div className="display-config-body">
                                        <div className="printer-form-group">
                                            <label>Monitor Seçimi</label>
                                            <select
                                                className="printer-select"
                                                value={customerDisplay.screenId}
                                                onChange={(e) => handleUpdateCustomerDisplay(null, e.target.value)}
                                            >
                                                <option value="">Seçilməyib</option>
                                                {screens.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.label} {s.isPrimary ? "(Əsas)" : ""} - {s.bounds.width}x{s.bounds.height}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="display-preview-info">
                                            <i className="bi bi-info-circle"></i>
                                            <span>Əgər cihazınızda ikinci ekran qoşuludursa, onu siyahıdan seçin və yuxarıdakı açarı aktiv edin.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === "kitchen" ? (
                            <div className="display-settings">
                                <div className="display-config-card">
                                    <div className="display-config-header">
                                        <div className="display-config-info">
                                            <h4>Mətbəx Ekranı (KDS)</h4>
                                            <p>Sifarişlərin mətbəxdə izlənməsi üçün rəqəmsal ekranı aktivləşdirin.</p>
                                        </div>
                                        <div
                                            className={`premium-switch ${kitchenDisplay.active ? "active" : ""}`}
                                            onClick={() => handleUpdateKitchenDisplay(!kitchenDisplay.active)}
                                        >
                                            <div className="switch-handle"></div>
                                        </div>
                                    </div>

                                    <div className="display-config-body">
                                        <div className="printer-form-group">
                                            <label>Monitor Seçimi</label>
                                            <select
                                                className="printer-select"
                                                value={kitchenDisplay.screenId}
                                                onChange={(e) => handleUpdateKitchenDisplay(null, e.target.value)}
                                            >
                                                <option value="">Seçilməyib</option>
                                                {screens.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.label} {s.isPrimary ? "(Əsas)" : ""} - {s.bounds.width}x{s.bounds.height}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="display-preview-info">
                                            <i className="bi bi-info-circle"></i>
                                            <span>Mətbəx ekranı açıldıqda bütün aktiv sifarişlər orada rəqəmsal kartlar şəklində görünəcək.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === "taxes" && taxes.length > 0 && canSeeTax ? (
                            <div className="display-settings">
                                {selectedTaxIndex === null ? (
                                    <>
                                        <div style={{ marginBottom: '16px' }}>
                                            <h4 style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>E-kassa Cihazları</h4>
                                            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>Cihaza klikləyərək ətraflı məlumatı görün</p>
                                        </div>
                                        <div className="printers-grid">
                                            {taxes.map((tax, index) => {
                                                const taxKey = tax.id || `${tax.ip_addr}:${tax.port_addr}`;
                                                return (
                                                    <div
                                                        key={tax.id || index}
                                                        className="printer-edit-card"
                                                        style={{ cursor: 'pointer', border: '1px solid #e2e8f0', boxShadow: 'none' }}
                                                        onClick={() => { setSelectedTaxIndex(index); handleTaxLogin(tax, index); }}
                                                    >
                                                        <div className="printer-card-header">
                                                            <div className="printer-card-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                                                                <i className="bi bi-receipt"></i>
                                                            </div>
                                                            <div className="printer-card-title">
                                                                <h5>{taxLocalNames[taxKey] || tax.tax_cash_type || 'E-kassa'}</h5>
                                                                <span>{tax.ip_addr}:{tax.port_addr}</span>
                                                            </div>
                                                            <i className="bi bi-chevron-right" style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '18px' }}></i>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    (() => {
                                        const tax = taxes[selectedTaxIndex];
                                        const idx = selectedTaxIndex;
                                        const shift = shiftStates[idx];

                                        const handleNotImplemented = () => {
                                            toast.info("Bu funskiya tezlikl\u0259 \u0259lav\u0259 edil\u0259c\u0259k");
                                        };

                                        return (
                                            <div>
                                                {/* Top Header */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '12px', background: '#fff' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                        <button
                                                            onClick={() => setSelectedTaxIndex(null)}
                                                            style={{
                                                                background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                                                                width: '36px', height: '36px', display: 'flex', alignItems: 'center',
                                                                justifyContent: 'center', cursor: 'pointer', color: '#64748b'
                                                            }}
                                                        >
                                                            <i className="bi bi-chevron-left" style={{ fontSize: '14px' }}></i>
                                                        </button>
                                                        <div>
                                                            <input
                                                                type="text"
                                                                value={taxLocalNames[tax.id || `${tax.ip_addr}:${tax.port_addr}`] || ''}
                                                                onChange={(e) => handleTaxNameChange(tax.id || `${tax.ip_addr}:${tax.port_addr}`, e.target.value)}
                                                                placeholder={tax.tax_cash_type || 'OMNITECH'}
                                                                style={{ margin: 0, color: '#1e293b', fontWeight: 700, fontSize: '16px', textTransform: 'uppercase', border: 'none', background: 'transparent', outline: 'none', width: '250px' }}
                                                            />
                                                            <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                                                                IP:{tax.ip_addr}:{tax.port_addr}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleTaxLogin(tax, idx)}
                                                        disabled={taxLoading[idx]}
                                                        style={{
                                                            background: '#fff', border: '1px solid #93c5fd', color: '#3b82f6',
                                                            padding: '8px 20px', borderRadius: '8px', fontWeight: 600,
                                                            fontSize: '14px', cursor: 'pointer', outline: 'none'
                                                        }}
                                                    >
                                                        {taxLoading[idx] ? 'Gözlə...' : 'Yoxla'}
                                                    </button>
                                                </div>

                                                {/* 2-Column Layout */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                                                    {/* Left Column */}
                                                    <div>
                                                        <div style={{ marginBottom: '20px' }}>
                                                            <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, display: 'block', marginBottom: '8px' }}>Bu tarixdən</label>
                                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                                <div style={{ flex: 1.5, position: 'relative' }}>
                                                                    <input type="date" value={reportStart.date} onChange={e => setReportStart({ ...reportStart, date: e.target.value })} style={{ width: '100%', height: '42px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', fontSize: '14px', color: '#334155' }} />
                                                                </div>
                                                                <div style={{ flex: 1, position: 'relative' }}>
                                                                    <input type="time" value={reportStart.time} onChange={e => setReportStart({ ...reportStart, time: e.target.value })} style={{ width: '100%', height: '42px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', fontSize: '14px', color: '#334155' }} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ marginBottom: '24px' }}>
                                                            <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, display: 'block', marginBottom: '8px' }}>Bu tarixə qədər</label>
                                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                                <div style={{ flex: 1.5, position: 'relative' }}>
                                                                    <input type="date" value={reportEnd.date} onChange={e => setReportEnd({ ...reportEnd, date: e.target.value })} style={{ width: '100%', height: '42px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', fontSize: '14px', color: '#334155' }} />
                                                                </div>
                                                                <div style={{ flex: 1, position: 'relative' }}>
                                                                    <input type="time" value={reportEnd.time} onChange={e => setReportEnd({ ...reportEnd, time: e.target.value })} style={{ width: '100%', height: '42px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', fontSize: '14px', color: '#334155' }} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '12px' }}>
                                                            <button onClick={() => handleOperationHistory(tax, idx)} disabled={taxLoading[idx]} style={{ flex: 2, background: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                                                                Əməliyyat tarixçəsi
                                                            </button>
                                                            <button onClick={() => handlePeriodicReport(tax, idx)} disabled={taxLoading[idx]} style={{ flex: 1, background: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                                                                Hesabat
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Right Column */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                        <button
                                                            onClick={() => handleShiftStatus(tax, idx)}
                                                            disabled={taxLoading[idx]}
                                                            style={{ width: '100%', background: '#3b82f6', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                                                        >
                                                            Növbənin statusunu yoxla
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenShift(tax, idx)}
                                                            disabled={taxLoading[idx]}
                                                            style={{ width: '100%', background: '#3b82f6', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                                                        >
                                                            Növbəni aç
                                                        </button>
                                                        <div style={{ height: '8px' }}></div>
                                                        <button
                                                            onClick={() => handleCloseShift(tax, idx)}
                                                            disabled={taxLoading[idx]}
                                                            style={{ width: '100%', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '14px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                                                        >
                                                            Növbəni bağla
                                                        </button>
                                                        <button
                                                            onClick={() => handleReprintAfterError(tax, idx)}
                                                            disabled={taxLoading[idx]}
                                                            style={{ width: '100%', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '14px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                                                        >
                                                            Yenidən çap
                                                        </button>
                                                        <button
                                                            onClick={() => handleXReport(tax, idx)}
                                                            disabled={taxLoading[idx]}
                                                            style={{ width: '100%', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '14px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                                                        >
                                                            X-Hesabat
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()
                                )}
                            </div>
                        ) : activeTab === "network" && isSlave ? (
                            <div className="display-settings">
                                <div className="master-ip-card">
                                    <div className="master-ip-card__header">
                                        <span className="master-ip-card__icon"><i className="bi bi-hdd-network-fill" /></span>
                                        <div>
                                            <h4 className="master-ip-card__title">Master IP ünvanı</h4>
                                            <p className="master-ip-card__desc">Master kompüterin IP-ni daxil edin. Avtomatik tapılmazsa buradan əllə qeyd edin.</p>
                                        </div>
                                    </div>
                                    <div className="master-ip-card__body">
                                        <div className="master-ip-card__row">
                                            <input
                                                type="text"
                                                className="master-ip-card__input"
                                                placeholder="192.168.1.10"
                                                value={staticMasterIp}
                                                onChange={(e) => setStaticMasterIp(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                className="master-ip-card__btn master-ip-card__btn--outline"
                                                disabled={staticIpScanning}
                                                onClick={async () => {
                                                    if (!window.electronAPI?.scanMaster) return;
                                                    setStaticIpScanning(true);
                                                    try {
                                                        const found = await window.electronAPI.scanMaster();
                                                        if (found) {
                                                            setStaticMasterIp(found);
                                                            toast.success("Master tapıldı: " + found);
                                                        } else {
                                                            toast.error("Master tapılmadı");
                                                        }
                                                    } catch (e) {
                                                        toast.error("Axtarış xətası");
                                                    } finally {
                                                        setStaticIpScanning(false);
                                                    }
                                                }}
                                            >
                                                {staticIpScanning ? <span className="master-ip-card__spinner" /> : <i className="bi bi-search" />}
                                                {staticIpScanning ? "Axtarılır..." : "Axtar"}
                                            </button>
                                            <button
                                                className="master-ip-card__btn"
                                                disabled={staticIpSaving}
                                                onClick={async () => {
                                                    setStaticIpSaving(true);
                                                    try {
                                                        const ok = await window.electronAPI?.setStaticMasterIp?.(staticMasterIp.trim() || null);
                                                        if (ok !== false) {
                                                            toast.success(staticMasterIp.trim() ? "Master IP yadda saxlanıldı" : "Statik IP silindi");
                                                        } else {
                                                            toast.error("Yadda saxlanılmadı");
                                                        }
                                                    } catch (e) {
                                                        toast.error("Xəta: " + (e?.message || "Naməlum"));
                                                    } finally {
                                                        setStaticIpSaving(false);
                                                    }
                                                }}
                                            >
                                                {staticIpSaving ? <span className="master-ip-card__spinner" /> : "Yadda saxla"}
                                            </button>
                                            {staticMasterIp && (
                                                <button
                                                    type="button"
                                                    className="master-ip-card__btn master-ip-card__btn--ghost"
                                                    onClick={() => setStaticMasterIp("")}
                                                >
                                                    Təmizlə
                                                </button>
                                            )}
                                        </div>
                                        <div className="master-ip-card__hint">
                                            <i className="bi bi-info-circle" />
                                            <span>Sizin IP: <strong>{localIp || "—"}</strong>. Statik IP təyin etsəniz, Slave əvvəlcə bu ünvana qoşulacaq.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === "mobile" && isMaster ? (
                            <div className="mobile-qr-section">
                                <div className="qr-container-card">
                                    <div className="qr-header">
                                        <h3>Mobil Terminal Qoşulması</h3>
                                        <p>Android tətbiqdə bu QR kodu skan edərək Master bazasına qoşula bilərsiniz.</p>
                                    </div>

                                    <div className="qr-display-box">
                                        {localIp && localIp !== "Unknown" ? (
                                            <div className="qr-wrapper">
                                                <QRCode
                                                    value={localIp}
                                                    size={window.innerHeight < 700 ? 140 : 180}
                                                    level="H"
                                                    style={{ height: "auto", maxWidth: "100%", margin: "0 auto" }}
                                                />
                                                <div className="ip-badge">
                                                    IP: {localIp}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="qr-error">
                                                <i className="bi bi-exclamation-triangle"></i>
                                                <p>IP ünvanı müəyyən edilə bilmədi. Şəbəkə bağlantısını yoxlayın.</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="qr-steps">
                                        <div className="step-item">
                                            <span className="step-num">1</span>
                                            <p>Mobil tətbiqi açın</p>
                                        </div>
                                        <div className="step-item">
                                            <span className="step-num">2</span>
                                            <p>Qr Skaner düyməsinə klikləyin</p>
                                        </div>
                                        <div className="step-item">
                                            <span className="step-num">3</span>
                                            <p>Kodu ekranın önünə tutun</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', marginTop: '100px', color: '#64748b' }}>
                                <i className="bi bi-gear" style={{ fontSize: '48px' }}></i>
                                <p style={{ marginTop: '16px' }}>Bu bölmə üzərində iş gedir...</p>
                            </div>
                        )}
                    </div>
                </div>
            </Modal.Body>
        </Modal >
    );
};

export default DevicesModal;
