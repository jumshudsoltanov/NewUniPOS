import React, { useState } from 'react';
import { Modal } from 'react-bootstrap';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const CustomXprinterInstallModal = ({ show, onHide, onInstallSuccess }) => {
    const { t } = useTranslation();
    const [model, setModel] = useState('XP-80C');
    const [connectionType, setConnectionType] = useState('USB');
    const [ipAddress, setIpAddress] = useState('192.168.1.100');
    const [comPort, setComPort] = useState('COM1');
    const [isInstalling, setIsInstalling] = useState(false);
    const [printerName, setPrinterName] = useState('Mətbəx Printeri');

    const models = ["XP-58", "XP-58C", "XP-76", "XP-76C", "XP-80", "XP-80C", "XP-90"];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsInstalling(true);

        const config = {
            model,
            connectionType,
            ipAddress: connectionType === 'Network' ? ipAddress : null,
            comPort: connectionType === 'COM' ? comPort : null,
            printerName: printerName.trim() || 'XPrinter'
        };

        try {
            const res = await window.electronAPI.customInstallXprinter(config);
            if (res.success) {
                toast.success(t("printer_ugurla_quruldu", "Printer uğurla quruldu!"));
                onHide();
                if (onInstallSuccess) onInstallSuccess();
            } else {
                toast.error(t("xeta_bas_verdi", "Xəta baş verdi: ") + res.error);
            }
        } catch (err) {
            toast.error(t("xeta_bas_verdi", "Xəta baş verdi: ") + err.message);
        } finally {
            setIsInstalling(false);
        }
    };

    return (
        <Modal show={show} onHide={() => !isInstalling && onHide()} centered size="md">
            <Modal.Header closeButton={!isInstalling} style={{ borderBottom: '1px solid #f1f5f9', padding: '20px 24px' }}>
                <Modal.Title style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>
                    XPrinter Quraşdır
                </Modal.Title>
            </Modal.Header>
            <form onSubmit={handleSubmit}>
                <Modal.Body style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Model & Connection Type in a row */}
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                                Printer Modeli
                            </label>
                            <select 
                                className="form-select" 
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                disabled={isInstalling}
                                style={{ height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%' }}
                            >
                                {models.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                                Bağlantı (Port)
                            </label>
                            <select 
                                className="form-select" 
                                value={connectionType}
                                onChange={(e) => setConnectionType(e.target.value)}
                                disabled={isInstalling}
                                style={{ height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%' }}
                            >
                                <option value="USB">USB Bağlantı</option>
                                <option value="Network">Şəbəkə (LAN/WiFi)</option>
                                <option value="COM">COM Port</option>
                            </select>
                        </div>
                    </div>

                    {/* Conditional Inputs */}
                    {connectionType === 'Network' && (
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                                IP Ünvan
                            </label>
                            <input 
                                type="text" 
                                className="form-control" 
                                value={ipAddress}
                                onChange={(e) => setIpAddress(e.target.value)}
                                disabled={isInstalling}
                                placeholder="192.168.1.100"
                                required
                                style={{ height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%' }}
                            />
                        </div>
                    )}

                    {connectionType === 'COM' && (
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                                COM Port Adı
                            </label>
                            <input 
                                type="text" 
                                className="form-control" 
                                value={comPort}
                                onChange={(e) => setComPort(e.target.value.toUpperCase())}
                                disabled={isInstalling}
                                placeholder="COM1"
                                required
                                style={{ height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%' }}
                            />
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                            Sistemdə Görünəcək Ad
                        </label>
                        <input 
                            type="text" 
                            className="form-control" 
                            value={printerName}
                            onChange={(e) => setPrinterName(e.target.value)}
                            disabled={isInstalling}
                            placeholder="Məsələn: Kassa Printeri"
                            required
                            style={{ height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%' }}
                        />
                    </div>
                    
                    {connectionType === 'USB' && (
                        <div style={{ padding: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '13px', lineHeight: 1.5, display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <i className="bi bi-info-circle-fill" style={{ marginTop: '2px' }}></i>
                            <div>USB bağlantısı seçildikdə printer ilk boş USB portuna quraşdırılacaq. Qurulum bitdikdən sonra USB kabeli taxaraq çap edə bilərsiniz.</div>
                        </div>
                    )}

                    <div style={{ padding: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', color: '#1e3a8a', fontSize: '13px', lineHeight: 1.5, display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <i className="bi bi-gear-fill" style={{ marginTop: '2px' }}></i>
                        <div>Quraşdırma bitdikdən dərhal sonra Səs (Beeper) və Kassa (Cash Drawer) ayarlarını etməyiniz üçün rəsmi ayarlar pəncərəsi avtomatik açılacaqdır.</div>
                    </div>
                </Modal.Body>

                <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f8fafc', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                    <button 
                        type="button" 
                        onClick={onHide} 
                        disabled={isInstalling}
                        style={{ height: '40px', padding: '0 20px', fontSize: '14px', background: 'white', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '8px', fontWeight: 500 }}
                    >
                        Ləğv et
                    </button>
                    <button 
                        type="submit" 
                        disabled={isInstalling}
                        style={{ height: '40px', padding: '0 24px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', background: '#4F85F4', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 500 }}
                    >
                        {isInstalling ? <i className="bi bi-arrow-repeat spin"></i> : <i className="bi bi-printer-fill"></i>}
                        {isInstalling ? 'Quraşdırılır...' : 'Quraşdır'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default CustomXprinterInstallModal;
