import React, { useState, useEffect } from "react";
import { Modal } from "react-bootstrap";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import apiConfig from "../../utils/apiConfig";
import "./DevicesModal.css";

const DevicesModal = ({ show, onHide }) => {
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);
    const profileId = loginedProfileData?.data?.profile?.id;

    const [activeTab, setActiveTab] = useState("printers");
    const [printers, setPrinters] = useState([]);
    const [systemPrinters, setSystemPrinters] = useState([]);
    const [masterModes, setMasterModes] = useState({
        cashier: false,
        product: false
    });

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

            const storedProfile = JSON.parse(localStorage.getItem("profile") || "{}");
            setMasterModes({
                cashier: storedProfile.is_master_cashier_printing === 1,
                product: storedProfile.is_master_product_printing === 1
            });

            try {
                if (window.electronAPI?.getSystemPrinters) {
                    const sysPrinters = await window.electronAPI.getSystemPrinters();
                    setSystemPrinters(sysPrinters || []);
                }
            } catch (printerErr) {
                console.warn("System printers not available:", printerErr.message);
                setSystemPrinters([]);
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

    const handleToggleMasterPrinting = async (type) => {
        const nextStatus = !masterModes[type];
        if (!profileId) {
            toast.error("Profil tapılmadı. Əvvəlcə giriş edin.");
            return;
        }
        try {
            const res = await apiConfig.patch("/profiles/master-printing", {
                profileId,
                status: nextStatus,
                type: type
            });
            console.log("Toggle response:", res.data);
            setMasterModes(prev => ({ ...prev, [type]: nextStatus }));
            const storedProfile = JSON.parse(localStorage.getItem("profile") || "{}");
            const field = type === 'cashier' ? 'is_master_cashier_printing' : 'is_master_product_printing';
            storedProfile[field] = nextStatus ? 1 : 0;
            localStorage.setItem("profile", JSON.stringify(storedProfile));
            toast.success(nextStatus ? "Mərkəzi çap AKTİV" : "Mərkəzi çap DEAKTİV");
        } catch (error) {
            console.error("Toggle Error:", error?.response?.data || error.message);
            toast.error("Xəta: " + (error?.response?.data?.message || error.message));
        }
    };

    return (
        <Modal show={show} onHide={onHide} centered size="xl" className="devices-modal">
            <Modal.Header closeButton>
                <Modal.Title>Cihazlar və Printerlər</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="devices-sidebar">
                    <div className="devices-sidebar-menu">
                        <div
                            className={`devices-menu-item ${activeTab === "printers" ? "active" : ""}`}
                            onClick={() => setActiveTab("printers")}
                        >
                            <i className="bi bi-printer"></i>
                            <span>Printerlər</span>
                        </div>
                        <div className="devices-menu-item">
                            <i className="bi bi-display"></i>
                            <span>Müştəri Ekranı</span>
                        </div>
                        <div className="devices-menu-item">
                            <i className="bi bi-rulers"></i>
                            <span>Tərəzilər</span>
                        </div>
                        <div className="devices-menu-item">
                            <i className="bi bi-qr-code-scan"></i>
                            <span>Skanerlər</span>
                        </div>
                    </div>

                </div>

                <div className="devices-content">
                    <div className="devices-main-scroll">
                        {activeTab === "printers" ? (
                            <>
                                <div className="master-modes-grid">
                                    <div className="master-printing-card">
                                        <div className="master-printing-info">
                                            <h4>Mərkəzi Kassa Çapı</h4>
                                            <p>Kassa çekləri Masterə yönləndirilsin?</p>
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
                                            <p>Məhsul çekləri Masterə yönləndirilsin?</p>
                                        </div>
                                        <div
                                            className={`premium-switch ${masterModes.product ? "active" : ""}`}
                                            onClick={() => handleToggleMasterPrinting('product')}
                                        >
                                            <div className="switch-handle"></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="printers-grid">
                                    {printers.map((printer) => (
                                        <div key={printer.id} className="printer-edit-card">
                                            <div className="printer-card-header">
                                                <div className="printer-card-icon">
                                                    <i className="bi bi-printer"></i>
                                                </div>
                                                <div className="printer-card-title">
                                                    <h5>{printer.local_name || printer.name}</h5>
                                                    <span>
                                                        {printer.is_cashier === 1 ? "Kassa Printeri" : "Mətbəx Printeri"}
                                                        {printer.connection_type === 'usb' && printer.usb_name ? ` • USB: ${printer.usb_name}` : ''}
                                                    </span>
                                                </div>
                                            </div>

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
                                            )}

                                            <div className="printer-actions">
                                                <button className="btn-test" onClick={() => handleTestPrint(printer.usb_name || printer.local_name || printer.name)}>Test</button>
                                                <button className="btn-save-printer" onClick={() => handleUpdatePrinter(printer)}>Yadda saxla</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', marginTop: '100px', color: '#64748b' }}>
                                <i className="bi bi-gear" style={{ fontSize: '48px' }}></i>
                                <p style={{ marginTop: '16px' }}>Bu bölmə üzərində iş gedir...</p>
                            </div>
                        )}
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default DevicesModal;
