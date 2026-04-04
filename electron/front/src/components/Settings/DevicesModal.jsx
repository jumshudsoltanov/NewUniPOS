import React, { useState, useEffect, useCallback } from "react";
import { Modal } from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import { setLoginData } from "../../redux/Slices/LoginSlice";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import apiConfig, { localApi, TAX_HTTP_TIMEOUT_MS } from "../../utils/apiConfig";
import axios from "axios";
import { addNotification } from "../../utils/notificationService";
import { cashierPrinterPrefStorageKey, clearPrintersCache, savePrintersToStorage } from "../../utils/printerHelpers.jsx";
import "./DevicesModal.css";


const PrinterDetail = ({ printer, printerTab, setPrinterTab, updatePrinterField, systemPrinters, networkScanResults, networkScanning, onBack, onSave, onTestPrint, onScan, profileLogo }) => {
    const ct = printer.connection_type || 'network';
    const isNetwork = ct !== 'usb' && ct !== 'com';
    const [pingStatus, setPingStatus] = React.useState(null); // null | 'checking' | 'online' | 'offline'

    const handlePing = async () => {
        if (!printer.ip) return;
        setPingStatus('checking');
        try {
            const res = await window.electronAPI?.pingPrinter({ ip: printer.ip, port: printer.port || 9100 });
            setPingStatus(res?.online ? 'online' : 'offline');
        } catch { setPingStatus('offline'); }
    };
    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={onBack} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                        <i className="bi bi-chevron-left"></i>
                    </button>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>
                            {ct === 'usb' ? 'USB / System' : ct === 'com' ? 'COM Port' : 'Network'}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>
                            {ct === 'com' ? (printer.usb_name || '—') : (printer.ip || printer.usb_name || printer.local_name || printer.name)}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button className="btn-test" onClick={() => {
                        if (isNetwork && printer.ip) onTestPrint(null, printer.ip, printer.port || 9100);
                        else onTestPrint(printer.usb_name || printer.local_name || printer.name);
                    }}>Test çapı</button>
                    <button className="btn-save-printer" onClick={onSave}>Yadda saxla</button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '20px', gap: '4px' }}>
                {["connection", "settings"].map(t => (
                    <button key={t} onClick={() => setPrinterTab(t)} style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: printerTab === t ? 600 : 400, color: printerTab === t ? '#3b82f6' : '#64748b', borderBottom: printerTab === t ? '2px solid #3b82f6' : '2px solid transparent', marginBottom: '-2px' }}>
                        {t === "connection" ? "Əlaqə" : "Tənzimləmələr"}
                    </button>
                ))}
            </div>

            {printerTab === "connection" ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="connection-toggle">
                        <button className={`conn-btn ${isNetwork ? 'active' : ''}`} onClick={() => updatePrinterField('connection_type', 'network')}>Network (IP)</button>
                        <button className={`conn-btn ${ct === 'usb' ? 'active' : ''}`} onClick={() => updatePrinterField('connection_type', 'usb')}>USB / System</button>
                        <button className={`conn-btn ${ct === 'com' ? 'active' : ''}`} onClick={() => updatePrinterField('connection_type', 'com')}>COM Port</button>
                    </div>

                    <div className="printer-form-group">
                        <label>Görünən adı</label>
                        <input className="printer-input" value={printer.local_name || ""} onChange={e => updatePrinterField('local_name', e.target.value)} />
                    </div>

                    {ct === 'usb' ? (
                        <div className="printer-form-group">
                            <label>Sistem Printeri</label>
                            <select className="printer-select" value={printer.usb_name || ""} onChange={e => updatePrinterField('usb_name', e.target.value)}>
                                <option value="">Seçilməyib</option>
                                {systemPrinters.map(sp => <option key={sp.name} value={sp.name}>{sp.name}</option>)}
                            </select>
                        </div>
                    ) : ct === 'com' ? (
                        <div className="printer-form-group">
                            <label>COM Port (məs. COM3, COM4)</label>
                            <input className="printer-input" placeholder="COM3" value={printer.usb_name || ""} onChange={e => updatePrinterField('usb_name', e.target.value.toUpperCase())} />
                            <small style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px', display: 'block' }}>Virtual COM port vasitəsilə qoşulmuş printer üçün</small>
                        </div>
                    ) : (
                        <>
                            <div className="ip-port-row">
                                <div className="printer-form-group">
                                    <label>IP Address</label>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input className="printer-input" placeholder="192.168.1.100" value={printer.ip || ""} onChange={e => { updatePrinterField('ip', e.target.value); setPingStatus(null); }} />
                                        <button className={`ping-btn ${pingStatus || ''}`} onClick={handlePing} disabled={!printer.ip || pingStatus === 'checking'} title="Bağlantını yoxla">
                                            {pingStatus === 'checking' && <i className="bi bi-arrow-repeat spin"></i>}
                                            {pingStatus === 'online' && <i className="bi bi-check-circle-fill"></i>}
                                            {pingStatus === 'offline' && <i className="bi bi-x-circle-fill"></i>}
                                            {!pingStatus && <i className="bi bi-activity"></i>}
                                        </button>
                                    </div>
                                </div>
                                <div className="printer-form-group">
                                    <label>Port</label>
                                    <input className="printer-input" placeholder="9100" value={printer.port || ""} onChange={e => updatePrinterField('port', e.target.value)} />
                                </div>
                            </div>

                            <div className="network-scan-section">
                                <div className="network-scan-header">
                                    <span className="network-scan-label">Şəbəkədə tap</span>
                                    <button className={`network-scan-btn ${networkScanning ? 'scanning' : ''}`} onClick={onScan} disabled={networkScanning}>
                                        {networkScanning ? <><i className="bi bi-arrow-repeat spin"></i> Axtarılır...</> : <><i className="bi bi-wifi"></i> Axtar</>}
                                    </button>
                                </div>
                                {networkScanResults.length > 0 && (
                                    <div className="network-scan-results">
                                        {networkScanResults.map(r => (
                                            <div key={r.ip} className={`network-scan-item ${printer.ip === r.ip ? 'selected' : ''}`} onClick={() => { updatePrinterField('ip', r.ip); updatePrinterField('port', r.port); }}>
                                                <i className="bi bi-printer-fill"></i>
                                                <span className="scan-ip">{r.ip}</span>
                                                <span className="scan-port">:{r.port}</span>
                                                {printer.ip === r.ip && <i className="bi bi-check-circle-fill scan-check"></i>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Çap növü: Raster (default) vs Windows Driver */}
                            <div style={{ padding: '12px 14px', background: '#f8faff', border: '1px solid #e0e9ff', borderRadius: 10 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>Çap növü</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {/* Raster seçimi */}
                                    {(() => {
                                        const isRaster = printer.usb_name === '' || printer.usb_name === null || printer.usb_name === undefined || printer.usb_name === 'RASTER'; return (
                                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, border: isRaster ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: isRaster ? '#eff6ff' : '#fff' }}>
                                                <input type="radio" name={`ptype_${printer.id}`} checked={isRaster} onChange={() => updatePrinterField('usb_name', 'RASTER')} style={{ marginTop: 2, accentColor: '#3b82f6' }} />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>Tam dizayn çapı (Raster) <span style={{ fontSize: 11, background: '#dcfce7', color: '#16a34a', padding: '1px 7px', borderRadius: 20, marginLeft: 4 }}>Tövsiyə</span></div>
                                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>HTML çek dizaynı şəkil kimi çap olunur. Windows driver lazım deyil, birbaşa IP-yə göndərilir.</div>
                                                </div>
                                            </label>);
                                    })()}
                                    {/* Windows Driver seçimi */}
                                    {(() => {
                                        const isWin = printer.usb_name && printer.usb_name !== 'RASTER'; return (
                                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, border: isWin ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: isWin ? '#eff6ff' : '#fff' }}>
                                                <input type="radio" name={`ptype_${printer.id}`} checked={!!isWin} onChange={() => { const autoName = printer.ip ? `UNIPOS_${String(printer.ip).replace(/\./g, '_')}` : (systemPrinters[0]?.name || 'UNIPOS_PRINTER'); updatePrinterField('usb_name', autoName); }} style={{ marginTop: 2, accentColor: '#3b82f6' }} />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>Windows Driver vasitəsilə</div>
                                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Bu printerin Windows-da qurulu olması lazımdır. Aşağıdan adını seçin.</div>
                                                </div>
                                            </label>);
                                    })()}
                                </div>
                            </div>

                            {/* Windows Driver seçilibsə — sistem printer adı + Qur düyməsi */}
                            {(printer.usb_name && printer.usb_name.trim() && printer.usb_name !== 'RASTER') ? (
                                <div className="printer-form-group">
                                    <label>Windows Sistem Printer Adı</label>
                                    <select className="printer-select" value={printer.usb_name || ""} onChange={e => updatePrinterField('usb_name', e.target.value)}>
                                        <option value="">— Printer seçin —</option>
                                        {systemPrinters.map(sp => <option key={sp.name} value={sp.name}>{sp.name}</option>)}
                                    </select>
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            ) : (
                <div className="printer-settings-tab">

                    {/* ── Printer type — read-only, admin serverdən gəlir ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: '#f8faff', border: '1px solid #e0e9ff', borderRadius: '10px', marginBottom: '4px' }}>
                        <div style={{ width: 38, height: 38, background: '#eff6ff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F85F4', fontSize: 17, flexShrink: 0 }}>
                            <i className={`bi ${Number(printer.is_cashier) === 1 ? 'bi-receipt' : 'bi-egg-fried'}`}></i>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                                {Number(printer.is_cashier) === 1 ? 'Kassa Printeri' : 'Mətbəx Printeri'}
                            </span>
                            <span style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                                {Number(printer.is_cashier) === 1
                                    ? 'Müştəri çekləri və hesabatlar bu printerə gedir'
                                    : 'Mətbəx sifarişləri admin paneldə məhsul/kateqoriyaya təyin olunur'}
                            </span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.5px', background: Number(printer.is_cashier) === 1 ? '#dbeafe' : '#fef3c7', color: Number(printer.is_cashier) === 1 ? '#1d4ed8' : '#d97706' }}>
                            {Number(printer.is_cashier) === 1 ? 'Kassa' : 'Mətbəx'}
                        </span>
                    </div>

                    {/* ── Toggles ── */}
                    <div className="settings-section-title" style={{ marginTop: '20px' }}>Çap parametrləri</div>
                    {[
                        { label: 'Səsli bildiriş', field: 'sound_notify', icon: 'bi-volume-up', desc: 'Yeni çap gəldikdə zəng səsi çıxarsın' },
                        { label: 'Pul yeşiyi', field: 'cash_drawer', icon: 'bi-cash-stack', desc: 'Çapdan sonra pul yeşiyini avto aç' },
                        { label: 'Pul yeşiyi (çapsız)', field: 'open_drawer_without_print', icon: 'bi-box-arrow-up', desc: 'Çap olmadan manual açıq trigger göndər' },
                        { label: 'Sürətli çap', field: 'fast_print', icon: 'bi-lightning', desc: 'Görüntü keyfiyyətini azaldıb sürəti artır' },
                        { label: 'Loqo çapı', field: 'print_logo', icon: 'bi-image', desc: profileLogo ? 'Çekin başında profil loqosu çap olunacaq' : 'Loqo admin paneldən profilə yüklənməlidir' },
                    ].map(item => (
                        <div key={item.field} className="settings-toggle-row">
                            <div className="settings-toggle-icon"><i className={`bi ${item.icon}`}></i></div>
                            <div className="settings-toggle-text">
                                <span className="settings-toggle-label">{item.label}</span>
                                <span className="settings-toggle-desc">{item.desc}</span>
                            </div>
                            <div className={`premium-switch ${printer[item.field] ? 'active' : ''}`} onClick={() => updatePrinterField(item.field, printer[item.field] ? 0 : 1)}>
                                <div className="switch-handle"></div>
                            </div>
                        </div>
                    ))}

                    {/* Logo preview — print_logo aktiv və logo varsa göstər */}
                    {printer.print_logo ? (
                        <div className="logo-preview-card">
                            {profileLogo ? (
                                <>
                                    <img
                                        src={profileLogo.startsWith('http') || profileLogo.startsWith('data:') ? profileLogo : `http://46.224.8.157:35627/${profileLogo}`}
                                        alt="Profil loqosu"
                                        className="logo-preview-img"
                                    />
                                    <span className="logo-preview-label">Bu loqo çekin üstündə çap olunacaq</span>
                                </>
                            ) : (
                                <div className="logo-preview-empty">
                                    <i className="bi bi-exclamation-triangle"></i>
                                    <span>Admin paneldən profil loqosu yükləyin</span>
                                </div>
                            )}
                        </div>
                    ) : null}

                    {/* ── Copies + Darkness ── */}
                    <div className="settings-inputs-grid" style={{ marginTop: '16px' }}>
                        <div className="settings-input-card">
                            <div className="settings-input-icon"><i className="bi bi-files"></i></div>
                            <div className="settings-input-body">
                                <label>Nüsxə sayı</label>
                                <input className="printer-input" type="number" min="1" max="10" value={printer.copies ?? 1} onChange={e => updatePrinterField('copies', Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="settings-input-card">
                            <div className="settings-input-icon"><i className="bi bi-circle-half"></i></div>
                            <div className="settings-input-body">
                                <label>Çap sıxlığı (1–10)</label>
                                <input className="printer-input" type="number" min="1" max="10" value={printer.darkness ?? 5} onChange={e => updatePrinterField('darkness', Number(e.target.value))} />
                            </div>
                        </div>
                    </div>

                    {/* ── Paper ── */}
                    <div className="settings-section-title" style={{ marginTop: '20px' }}>Kağız</div>
                    <div className="settings-chip-row">
                        <span className="settings-chip-label">Ölçü</span>
                        <div className="settings-chip-group">
                            {['58', '80'].map(s => (
                                <button key={s} className={`settings-chip ${(printer.paper_size || '80') === s ? 'active' : ''}`} onClick={() => updatePrinterField('paper_size', s)}>{s}mm</button>
                            ))}
                        </div>
                    </div>
                    <div className="settings-inputs-grid" style={{ marginTop: '10px' }}>
                        <div className="settings-input-card">
                            <div className="settings-input-icon"><i className="bi bi-rulers"></i></div>
                            <div className="settings-input-body">
                                <label>Simvol eni (override)</label>
                                <input className="printer-input" type="number" min="24" max="80" value={printer.paper_width ?? 48} onChange={e => updatePrinterField('paper_width', Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="settings-input-card">
                            <div className="settings-input-icon"><i className="bi bi-arrow-bar-down"></i></div>
                            <div className="settings-input-body">
                                <label>Boş sətir (kəsimdən sonra)</label>
                                <input className="printer-input" type="number" min="0" max="20" value={printer.trailing_space ?? 0} onChange={e => updatePrinterField('trailing_space', Number(e.target.value))} />
                            </div>
                        </div>
                    </div>

                    {/* ── Cut mode ── */}
                    <div className="settings-section-title" style={{ marginTop: '20px' }}>Kəsim növü</div>
                    <div className="settings-chip-group">
                        {[
                            { val: 'full', label: 'Tam kəsim' },
                            { val: 'partial', label: 'Qismən kəsim' },
                            { val: 'none', label: 'Kəsim yox' },
                        ].map(o => (
                            <button key={o.val} className={`settings-chip ${(printer.cut_mode || 'full') === o.val ? 'active' : ''}`} onClick={() => updatePrinterField('cut_mode', o.val)}>{o.label}</button>
                        ))}
                    </div>

                    {/* ── Encoding ── */}
                    <div className="settings-section-title" style={{ marginTop: '20px' }}>Kodlaşdırma</div>
                    <div className="settings-chip-group">
                        {[
                            { val: 'utf8', label: 'UTF-8' },
                            { val: 'cp1251', label: 'CP1251 (Kiril)' },
                            { val: 'cp866', label: 'CP866 (DOS)' },
                            { val: 'ascii', label: 'ASCII' },
                        ].map(o => (
                            <button key={o.val} className={`settings-chip ${(printer.encoding || 'utf8') === o.val ? 'active' : ''}`} onClick={() => updatePrinterField('encoding', o.val)}>{o.label}</button>
                        ))}
                    </div>

                    {/* ── Font ── */}
                    <div className="settings-section-title" style={{ marginTop: '20px' }}>Şrift</div>
                    <div className="settings-font-row">
                        {['Arial', 'Courier New', 'Tahoma', 'Verdana', 'Consolas'].map(f => (
                            <button key={f} className={`font-chip ${(printer.font_family || 'Arial') === f ? 'active' : ''}`} onClick={() => updatePrinterField('font_family', f)} style={{ fontFamily: f }}>{f}</button>
                        ))}
                    </div>

                    {/* ── Header / Footer text ── */}
                    <div className="settings-section-title" style={{ marginTop: '20px' }}>Çek başlığı</div>
                    <div className="settings-toggle-row" style={{ marginBottom: 8 }}>
                        <div className="settings-toggle-icon"><i className="bi bi-type-bold"></i></div>
                        <div className="settings-toggle-text">
                            <span className="settings-toggle-label">Qalın şrift (bold)</span>
                            <span className="settings-toggle-desc">Başlıq mətni bold çap olunsun</span>
                        </div>
                        <div className={`premium-switch ${printer.bold_header ? 'active' : ''}`} onClick={() => updatePrinterField('bold_header', printer.bold_header ? 0 : 1)}>
                            <div className="switch-handle"></div>
                        </div>
                    </div>
                    <div className="settings-toggle-row" style={{ marginBottom: 12 }}>
                        <div className="settings-toggle-icon"><i className="bi bi-fonts"></i></div>
                        <div className="settings-toggle-text">
                            <span className="settings-toggle-label">Böyük şrift (double-height)</span>
                            <span className="settings-toggle-desc">Başlıq ESC/POS double-height rejimində</span>
                        </div>
                        <div className={`premium-switch ${printer.double_height_header ? 'active' : ''}`} onClick={() => updatePrinterField('double_height_header', printer.double_height_header ? 0 : 1)}>
                            <div className="switch-handle"></div>
                        </div>
                    </div>
                    <div className="printer-form-group">
                        <label>Başlıq mətni (çekin üstündə)</label>
                        <textarea
                            className="printer-input"
                            rows={2}
                            placeholder={"Şirkət adı, ünvan və s.\nİkinci sətir"}
                            value={printer.receipt_header || ""}
                            onChange={e => updatePrinterField('receipt_header', e.target.value)}
                            style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
                        />
                    </div>
                    <div className="printer-form-group" style={{ marginTop: 10 }}>
                        <label>Altlıq mətni (çekin altında)</label>
                        <textarea
                            className="printer-input"
                            rows={2}
                            placeholder={"Təşəkkürlər! Yenidən gözləyirik."}
                            value={printer.receipt_footer || ""}
                            onChange={e => updatePrinterField('receipt_footer', e.target.value)}
                            style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
                        />
                    </div>

                    {/* ── Other ── */}
                    <div className="settings-section-title" style={{ marginTop: '20px' }}>Digər</div>
                    <div className="settings-toggle-row">
                        <div className="settings-toggle-icon"><i className="bi bi-arrow-down-up"></i></div>
                        <div className="settings-toggle-text">
                            <span className="settings-toggle-label">Çevrilmiş çap (180°)</span>
                            <span className="settings-toggle-desc">Çeki baş-aşağı çap et</span>
                        </div>
                        <div className={`premium-switch ${printer.rotate_180 ? 'active' : ''}`} onClick={() => updatePrinterField('rotate_180', printer.rotate_180 ? 0 : 1)}>
                            <div className="switch-handle"></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

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
    const [networkScanResults, setNetworkScanResults] = useState([]);
    const [networkScanning, setNetworkScanning] = useState(false);
    const [masterModes, setMasterModes] = useState({
        cashier: false,
        product: false
    });
    const [customerReceiptAutoPrint, setCustomerReceiptAutoPrint] = useState(false);
    const [salesShiftRequired, setSalesShiftRequired] = useState(false);
    const [posKeyboardEnabled, setPosKeyboardEnabled] = useState(() => {
        try { return localStorage.getItem("pos_keyboard_enabled") === "1"; } catch { return false; }
    });
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
    const [printerTab, setPrinterTab] = useState("connection");
    const [printerStatuses, setPrinterStatuses] = useState({}); // { [printer.id]: 'online'|'offline'|'checking' }
    const [taxDailyInfo, setTaxDailyInfo] = useState({});

    // Periodic Report States
    const [reportStart, setReportStart] = useState({ date: '', time: '06:00' });
    const [reportEnd, setReportEnd] = useState({ date: '', time: '06:00' });

    // Local Naming
    const [taxLocalNames, setTaxLocalNames] = useState({});
    const [staticMasterIp, setStaticMasterIp] = useState("");
    const [staticIpSaving, setStaticIpSaving] = useState(false);
    const [staticIpScanning, setStaticIpScanning] = useState(false);
    /** Bir neçə kassa printeri — hansına müştəri çeki çap olunacaq (terminal/instance üzrə) */
    const [cashierPrintPref, setCashierPrintPref] = useState("");

    useEffect(() => {
        if (window.electronAPI?.getStaticMasterIp) {
            window.electronAPI.getStaticMasterIp().then(ip => setStaticMasterIp(ip || "")).catch(() => { });
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

    const handleCashierPrintPrefChange = (e) => {
        const v = e.target.value;
        setCashierPrintPref(v);
        try {
            const key = cashierPrinterPrefStorageKey();
            if (v === "") {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, v);
            }
            toast.success("Kassa çap seçimi yadda saxlanıldı");
        } catch {
            toast.error("Yadda saxlanmadı");
        }
    };

    useEffect(() => {
        if (show && profileId) {
            fetchData();
        }
    }, [show, profileId]);

    useEffect(() => {
        if (!show) return;
        try {
            setCashierPrintPref(localStorage.getItem(cashierPrinterPrefStorageKey()) || "");
        } catch {
            setCashierPrintPref("");
        }
    }, [show, printers]);

    const pingAllPrinters = useCallback(async (printerList) => {
        if (!window.electronAPI?.pingPrinter) return;
        const networkOnes = printerList.filter(p => (p.connection_type === 'network' || !p.connection_type) && p.ip);
        if (!networkOnes.length) return;
        // Mark all as checking
        const checking = {};
        networkOnes.forEach(p => { checking[p.id] = 'checking'; });
        setPrinterStatuses(prev => ({ ...prev, ...checking }));
        // Ping in parallel
        await Promise.all(networkOnes.map(async (p) => {
            try {
                const res = await window.electronAPI.pingPrinter({ ip: p.ip, port: p.port || 9100 });
                setPrinterStatuses(prev => ({ ...prev, [p.id]: res?.online ? 'online' : 'offline' }));
            } catch {
                setPrinterStatuses(prev => ({ ...prev, [p.id]: 'offline' }));
            }
        }));
    }, []);

    const fetchData = async () => {
        try {
            const prRes = await apiConfig.get(`/pos/printers/${profileId}`);

            const rawPrinters = prRes.data.data || [];
            const normalizedPrinters = rawPrinters.map(p => {
                const ct = p.connection_type || 'network';
                const isNet = ct !== 'usb' && ct !== 'com';
                const autoName = isNet && p.ip ? `UNIPOS_${String(p.ip).replace(/\./g, '_')}` : null;
                const usbName = p.usb_name && p.usb_name.trim() ? p.usb_name : (autoName || '');
                return { ...p, connection_type: ct, usb_name: usbName };
            });
            setPrinters(normalizedPrinters);
            setPrinterStatuses({});
            // Ping after short delay so UI renders first
            setTimeout(() => pingAllPrinters(normalizedPrinters), 300);

            const authStr = localStorage.getItem("authResult");
            const authProfile = authStr ? (JSON.parse(authStr)?.data?.profile || {}) : {};
            const storedProfile = JSON.parse(localStorage.getItem("profile") || "{}");
            const merged = { ...authProfile, ...storedProfile };
            setMasterModes({
                cashier: merged.is_master_cashier_printing === 1,
                product: merged.is_master_product_printing === 1
            });
            setCustomerReceiptAutoPrint(merged.is_customer_receipt_auto_print === 1);
            setSalesShiftRequired(merged.queue_sales_module === 1);

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

    const updatePrinterField = useCallback((field, value) => {
        setPrinters(prev => prev.map((p, i) => i === selectedPrinterIndex ? { ...p, [field]: value } : p));
    }, [selectedPrinterIndex]);

    const handleNetworkScan = async () => {
        setNetworkScanning(true);
        setNetworkScanResults([]);
        try {
            const baseIp = localIp ? localIp.split('.').slice(0, 3).join('.') : '192.168.1';
            const results = await window.electronAPI?.scanNetworkPrinters?.({ baseIp, port: 9100 }) || [];
            setNetworkScanResults(results);
            if (results.length === 0) toast.info("Şəbəkədə printer tapılmadı");
            else toast.success(`${results.length} printer tapıldı`);
        } catch (e) {
            toast.error("Scan xətası: " + e.message);
        }
        setNetworkScanning(false);
    };

    const handleUpdatePrinter = async (printer) => {
        try {
            await apiConfig.put(`/printers/${printer.id}`, printer);
            // Cache-i təmizlə ki növbəti çapdа yeni parametrlər götürülsün
            clearPrintersCache();
            // Redux store-dakı printers siyahısını da yenilə
            try {
                const authStr = localStorage.getItem("authResult");
                if (authStr) {
                    const auth = JSON.parse(authStr);
                    if (auth?.data?.printers) {
                        auth.data.printers = auth.data.printers.map(p => Number(p.id) === Number(printer.id) ? { ...p, ...printer } : p);
                        localStorage.setItem("authResult", JSON.stringify(auth));
                        dispatch(setLoginData(auth));
                        // Printer məlumatlarını localStorage cache-ə yaz (şəbəkə kəsildikdə istifadə üçün)
                        savePrintersToStorage(auth.data.profile?.id, auth.data.printers);
                    }
                }
            } catch (e) { /* non-critical */ }
            toast.success(`${printer.local_name || printer.name} yadda saxlandı`);
        } catch (error) {
            toast.error("Xəta baş verdi: " + (error?.response?.data?.message || error.message));
        }
    };

    const handleTestPrint = async (printerName, printerIp, printerPort) => {
        try {
            if (window.electronAPI?.printReceipt) {
                const testHtml = `
                    <div style="text-align: center; font-family: sans-serif; padding: 10px;">
                        <h2 style="margin: 0;">UniPOS</h2>
                        <h4 style="margin: 5px 0;">TEST ÇAPI</h4>
                        <p style="margin: 5px 0;">-------------------------</p>
                        <p style="margin: 2px 0;">Printer: ${printerIp || printerName}</p>
                        <p style="margin: 2px 0;">Tarix: ${new Date().toLocaleString()}</p>
                        <p style="margin: 5px 0;">-------------------------</p>
                        <p style="margin: 5px 0; font-size: 12px;">Sistem uğurla qoşuldu</p>
                    </div>
                `;
                await window.electronAPI.printReceipt({ html: testHtml, printerName: printerIp ? "" : printerName, printerIp: printerIp || "", printerPort: printerPort || 9100 });
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

    const handleToggleSalesShiftRequired = async () => {
        const nextStatus = !salesShiftRequired;
        if (!profileId) { toast.error("Profil tapılmadı."); return; }
        setSalesShiftRequired(nextStatus);
        const saveLocal = () => {
            const storedProfile = JSON.parse(localStorage.getItem("profile") || "{}");
            storedProfile.queue_sales_module = nextStatus ? 1 : 0;
            localStorage.setItem("profile", JSON.stringify(storedProfile));
            try {
                const authStr = localStorage.getItem("authResult");
                if (authStr) {
                    const auth = JSON.parse(authStr);
                    if (auth?.data?.profile) {
                        auth.data.profile = { ...auth.data.profile, queue_sales_module: nextStatus ? 1 : 0 };
                        localStorage.setItem("authResult", JSON.stringify(auth));
                        dispatch(setLoginData(auth));
                    }
                }
            } catch (e) { console.warn(e); }
        };
        try {
            await localApi.patch("/profiles/sales-shift-required", { profileId, isActive: nextStatus });
            saveLocal();
            toast.success(nextStatus ? "Növbə tələbi AKTİV" : "Növbə tələbi DEAKTİV");
        } catch (error) {
            setSalesShiftRequired(!nextStatus);
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

        // Always persist to localStorage so slave auto-start works
        const storedProfile = JSON.parse(localStorage.getItem("profile") || "{}");
        storedProfile.is_customer_display_active = nextActive ? 1 : 0;
        storedProfile.customer_display_screen_id = nextScreenId;
        localStorage.setItem("profile", JSON.stringify(storedProfile));

        try {
            await localApi.patch("/profiles/customer-display", {
                profileId,
                isActive: nextActive,
                screenId: nextScreenId
            });
            toast.success("Müştəri ekranı tənzimləmələri yadda saxlanıldı");
        } catch (error) {
            // On slave, local DB may not have this endpoint — localStorage save is enough
            console.warn("Customer Display API sync skipped (slave or offline):", error?.response?.status);
            toast.success("Müştəri ekranı tənzimləmələri yadda saxlanıldı (lokal)");
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

        // Always persist to localStorage so slave auto-start works
        const storedProfile2 = JSON.parse(localStorage.getItem("profile") || "{}");
        storedProfile2.is_kitchen_display_active = nextActive ? 1 : 0;
        storedProfile2.kitchen_display_screen_id = nextScreenId;
        localStorage.setItem("profile", JSON.stringify(storedProfile2));

        try {
            await localApi.patch("/profiles/kitchen-display", {
                profileId,
                isActive: nextActive,
                screenId: nextScreenId
            });
            toast.success("Mətbəx ekranı tənzimləmələri yadda saxlanıldı");
        } catch (error) {
            // On slave, local DB may not have this endpoint — localStorage save is enough
            console.warn("Kitchen Display API sync skipped (slave or offline):", error?.response?.status);
            toast.success("Mətbəx ekranı tənzimləmələri yadda saxlanıldı (lokal)");
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
                            className={`devices-mobile-tab ${activeTab === "printSettings" ? "active" : ""}`}
                            onClick={() => setActiveTab("printSettings")}
                        >
                            Çap Tənzimləmələri
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
                                className={`devices-menu-item ${activeTab === "printSettings" ? "active" : ""}`}
                                onClick={() => setActiveTab("printSettings")}
                            >
                                <i className="bi bi-sliders"></i>
                                <span>Çap Tənzimləmələri</span>
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
                        </div>
                    </div>
                )}

                <div className="devices-content">
                    <div className="devices-main-scroll">
                        {activeTab === "printers" ? (
                            <div className="display-settings">
                                {selectedPrinterIndex === null ? (
                                    <>
                                        <div style={{ marginBottom: '16px' }}>
                                            <h4 style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>Printerlər</h4>
                                            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>Cihaza klikləyərək tənzimləmələri edin</p>
                                        </div>
                                        <div className="printers-grid">
                                            {printers.map((printer, index) => {
                                                const connType = printer.connection_type;
                                                const isNet = connType === 'network' || (!connType && printer.ip);
                                                const status = isNet ? (printerStatuses[printer.id] || null) : null;
                                                return (
                                                    <div
                                                        key={printer.id || index}
                                                        className="printer-edit-card"
                                                        style={{ cursor: 'pointer', border: '1px solid #e2e8f0', boxShadow: 'none' }}
                                                        onClick={() => { setSelectedPrinterIndex(index); setPrinterTab("connection"); }}
                                                    >
                                                        <div className="printer-card-header">
                                                            <div className="printer-card-icon" style={{ background: '#eff6ff', color: '#3b82f6', position: 'relative' }}>
                                                                <i className="bi bi-printer"></i>
                                                                {status && (
                                                                    <span className={`printer-status-dot printer-status-dot--${status}`}></span>
                                                                )}
                                                            </div>
                                                            <div className="printer-card-title">
                                                                <h5>{printer.local_name || printer.name}</h5>
                                                                <span>
                                                                    {printer.is_cashier === 1 ? "Kassa Printeri" : "Mətbəx Printeri"}
                                                                    {printer.connection_type === 'usb' && printer.usb_name ? ` • USB: ${printer.usb_name}` : ''}
                                                                    {printer.connection_type === 'com' && printer.usb_name ? ` • COM: ${printer.usb_name}` : ''}
                                                                    {isNet && printer.ip ? ` • ${printer.ip}` : ''}
                                                                </span>
                                                            </div>
                                                            {isNet && (
                                                                <span className={`printer-status-badge printer-status-badge--${status || 'checking'}`}>
                                                                    {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : '...'}
                                                                </span>
                                                            )}
                                                            <i className="bi bi-chevron-right" style={{ marginLeft: isNet ? '8px' : 'auto', color: '#94a3b8', fontSize: '18px' }}></i>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : selectedPrinterIndex !== null && printers[selectedPrinterIndex] ? (
                                    <PrinterDetail
                                        printer={printers[selectedPrinterIndex]}
                                        printerTab={printerTab}
                                        setPrinterTab={setPrinterTab}
                                        updatePrinterField={updatePrinterField}
                                        systemPrinters={systemPrinters}
                                        networkScanResults={networkScanResults}
                                        networkScanning={networkScanning}
                                        onBack={() => setSelectedPrinterIndex(null)}
                                        onSave={() => handleUpdatePrinter(printers[selectedPrinterIndex])}
                                        onTestPrint={handleTestPrint}
                                        onScan={handleNetworkScan}
                                        profileLogo={loginedProfileData?.data?.profile?.logo || null}
                                    />
                                ) : null}
                            </div>
                        ) : activeTab === "printSettings" ? (
                            <div className="display-settings">
                                <div style={{ marginBottom: '16px' }}>
                                    <h4 style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>Çap Tənzimləmələri</h4>
                                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>Mərkəzi çap, avto çap və növbə tənzimləmələri</p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div className="settings-toggle-row">
                                        <div className="settings-toggle-icon"><i className="bi bi-printer"></i></div>
                                        <div className="settings-toggle-text">
                                            <span className="settings-toggle-label">Mərkəzi Kassa Çapı</span>
                                            <span className="settings-toggle-desc">Mərkəzi printer Master-dadır. Slave mərkəzi açıq olduqda Master-a göndərir, Master özündə çap edir.</span>
                                        </div>
                                        <div
                                            className={`premium-switch ${masterModes.cashier ? "active" : ""}`}
                                            onClick={() => handleToggleMasterPrinting('cashier')}
                                        >
                                            <div className="switch-handle"></div>
                                        </div>
                                    </div>
                                    <div className="settings-toggle-row">
                                        <div className="settings-toggle-icon"><i className="bi bi-egg-fried"></i></div>
                                        <div className="settings-toggle-text">
                                            <span className="settings-toggle-label">Mərkəzi Mətbəx Çapı</span>
                                            <span className="settings-toggle-desc">Mərkəzi printer Master-dadır. Slave mərkəzi açıq olduqda Master-a göndərir, Master özündə çap edir.</span>
                                        </div>
                                        <div
                                            className={`premium-switch ${masterModes.product ? "active" : ""}`}
                                            onClick={() => handleToggleMasterPrinting('product')}
                                        >
                                            <div className="switch-handle"></div>
                                        </div>
                                    </div>
                                    <div className="settings-toggle-row">
                                        <div className="settings-toggle-icon"><i className="bi bi-receipt"></i></div>
                                        <div className="settings-toggle-text">
                                            <span className="settings-toggle-label">Müştəri çeki avto çap</span>
                                            <span className="settings-toggle-desc">CheckOver səhifəsində "Çeki çap et" toggle avtomatik açıq olsun.</span>
                                        </div>
                                        <div
                                            className={`premium-switch ${customerReceiptAutoPrint ? "active" : ""}`}
                                            onClick={handleToggleCustomerReceiptAutoPrint}
                                        >
                                            <div className="switch-handle"></div>
                                        </div>
                                    </div>
                                    <div className="settings-toggle-row">
                                        <div className="settings-toggle-icon"><i className="bi bi-clock-history"></i></div>
                                        <div className="settings-toggle-text">
                                            <span className="settings-toggle-label">Növbəli açılış tələb et</span>
                                            <span className="settings-toggle-desc">Növbə açılmadan sifariş yaratmaq mümkün olmasın.</span>
                                        </div>
                                        <div
                                            className={`premium-switch ${salesShiftRequired ? "active" : ""}`}
                                            onClick={handleToggleSalesShiftRequired}
                                        >
                                            <div className="switch-handle"></div>
                                        </div>
                                    </div>
                                    <div className="settings-toggle-row">
                                        <div className="settings-toggle-icon"><i className="bi bi-keyboard"></i></div>
                                        <div className="settings-toggle-text">
                                            <span className="settings-toggle-label">POS Klaviatura</span>
                                            <span className="settings-toggle-desc">Axtarış açılanda ekran klaviaturası avtomatik açılsın (Azərbaycan hərfləri).</span>
                                        </div>
                                        <div
                                            className={`premium-switch ${posKeyboardEnabled ? "active" : ""}`}
                                            onClick={() => {
                                                const next = !posKeyboardEnabled;
                                                setPosKeyboardEnabled(next);
                                                localStorage.setItem("pos_keyboard_enabled", next ? "1" : "0");
                                                toast.success(next ? "POS Klaviatura AKTİV" : "POS Klaviatura DEAKTİV");
                                            }}
                                        >
                                            <div className="switch-handle"></div>
                                        </div>
                                    </div>
                                </div>

                                {printers.filter((p) => Number(p.is_cashier) === 1).length >= 2 && (
                                    <div className="cashier-print-select-card" style={{ marginTop: '24px' }}>
                                        <h4 className="cashier-print-select-title">Bu terminal üçün kassa çapı</h4>
                                        <p className="cashier-print-select-desc">Hansı kassa printerlərinə müştəri çeki getməli olduğunu seçin.</p>
                                        <label className="cashier-print-select-label">Seçim</label>
                                        <select
                                            className="form-select form-select-sm cashier-print-select"
                                            value={cashierPrintPref}
                                            onChange={handleCashierPrintPrefChange}
                                        >
                                            <option value="">Avtomatik — yalnız ilk kassa printeri</option>
                                            <option value="all">Bütün kassa printerlərinə çap</option>
                                            {printers
                                                .filter((p) => Number(p.is_cashier) === 1)
                                                .map((p) => (
                                                    <option key={p.id} value={String(p.id)}>
                                                        {p.local_name || p.name}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
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
