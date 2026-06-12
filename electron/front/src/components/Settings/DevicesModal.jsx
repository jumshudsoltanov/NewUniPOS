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
import { usePrinterDiagnostics } from "../../hooks/usePrinterDiagnostics";
import {
    getPrinterDiagnosticClass,
    getPrinterDiagnosticLabel,
    getPrinterKey,
} from "../../utils/printerDiagnostics";
import { t } from "../../utils/translations";
import "./DevicesModal.css";


const PrinterDetail = ({ printer, printerTab, setPrinterTab, updatePrinterField, systemPrinters, systemPrintersLoading, onRefreshSystemPrinters, comPorts, networkScanResults, networkScanning, onBack, onSave, onTestPrint, onScan, profileLogo }) => {
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
            <div className="printer-detail-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
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
                <div className="printer-detail-actions" style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button className="btn-test" onClick={() => {
                        if (isNetwork && printer.ip) onTestPrint(null, printer.ip, printer.port || 9100);
                        else onTestPrint(printer.usb_name || printer.local_name || printer.name);
                    }}>Test çapı</button>
                    <button className="btn-save-printer" onClick={onSave}>{t("save")}</button>
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
                        <label>{t("gorunen_adi")}</label>
                        <input className="printer-input" value={printer.local_name || ""} onChange={e => updatePrinterField('local_name', e.target.value)} />
                    </div>

                    {ct === 'usb' ? (
                        <div className="printer-form-group">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <label style={{ margin: 0 }}>Sistem Printeri</label>
                                <button
                                    onClick={onRefreshSystemPrinters}
                                    disabled={systemPrintersLoading}
                                    style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}
                                    title={t("sistem_printerlerini_yenile")}
                                >
                                    <i className={`bi bi-arrow-clockwise${systemPrintersLoading ? ' spin' : ''}`}></i>
                                    {systemPrintersLoading ? 'Yüklənir...' : 'Yenilə'}
                                </button>
                            </div>
                            <select className="printer-select" value={printer.usb_name || ""} onChange={e => updatePrinterField('usb_name', e.target.value)}>
                                <option value="">{t("secilmeyib_1")}</option>
                                {systemPrinters.map(sp => <option key={sp.name} value={sp.name}>{sp.name}</option>)}
                            </select>
                            {systemPrinters.length === 0 && !systemPrintersLoading && (
                                <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                    <i className="bi bi-exclamation-circle" style={{ marginRight: '4px' }}></i>{t("windowsda_printer_tapilmadi_printerin_quruldugunu_yoxlayin_windows_→_printerler")}</small>
                            )}
                        </div>
                    ) : ct === 'com' ? (
                        <>
                        <div className="printer-form-group">
                            <label>COM Port</label>
                            {comPorts && comPorts.length > 0 ? (
                                <>
                                    <select className="printer-select" value={printer.usb_name || ""} onChange={e => updatePrinterField('usb_name', e.target.value)}>
                                        <option value="">{t("port_secin")}</option>
                                        {comPorts.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                    {printer.usb_name && !/^COM\d+$/i.test(printer.usb_name) && (
                                        <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{t("⚠_yuxaridan_com_port_secin_mes_com3_halhazirda_yanlis_deyer_var")}</small>
                                    )}
                                    {(!printer.usb_name || /^COM\d+$/i.test(printer.usb_name)) && (
                                        <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block' }}>{t("yuxarida_avtomatik_tapilan_portlar")}</small>
                                    )}
                                </>
                            ) : (
                                <>
                                    <input className="printer-input" placeholder="COM3" value={printer.usb_name || ""} onChange={e => updatePrinterField('usb_name', e.target.value.toUpperCase())} />
                                    <small style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px', display: 'block' }}>{t("sistem_com_portu_tapilmadi_el_ile_daxil_edin_mes_com3")}</small>
                                </>
                            )}
                        </div>
                        <div className="printer-form-group">
                            <label>{t("baud_rate_suret")}</label>
                            <select className="printer-select" value={printer.baud_rate || "9600"} onChange={e => updatePrinterField('baud_rate', e.target.value)}>
                                <option value="9600">9600 (standart)</option>
                                <option value="19200">19200</option>
                                <option value="38400">38400</option>
                                <option value="57600">57600</option>
                                <option value="115200">{t("115200_suretli")}</option>
                            </select>
                            <small style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px', display: 'block' }}>{t("printer_baud_rate_ile_uygun_olmalidir_eger_yavas_ve_ya_qeribe_cap_edirse_115200_sinayin")}</small>
                        </div>
                        </>
                    ) : (
                        <>
                            <div className="ip-port-row">
                                <div className="printer-form-group">
                                    <label>IP Address</label>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input className="printer-input" placeholder="192.168.1.100" value={printer.ip || ""} onChange={e => { updatePrinterField('ip', e.target.value); setPingStatus(null); }} />
                                        <button className={`ping-btn ${pingStatus || ''}`} onClick={handlePing} disabled={!printer.ip || pingStatus === 'checking'} title={t("baglantini_yoxla")}>
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
                                    <span className="network-scan-label">{t("sebekede_tap")}</span>
                                    <button className={`network-scan-btn ${networkScanning ? 'scanning' : ''}`} onClick={onScan} disabled={networkScanning}>
                                        {networkScanning ? <><i className="bi bi-arrow-repeat spin"></i>{t("axtarilir")}</> : <><i className="bi bi-wifi"></i> Axtar</>}
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
                                <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>{t("cap_novu")}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {/* Raster seçimi */}
                                    {(() => {
                                        const isRaster = printer.usb_name === '' || printer.usb_name === null || printer.usb_name === undefined || printer.usb_name === 'RASTER'; return (
                                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, border: isRaster ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: isRaster ? '#eff6ff' : '#fff' }}>
                                                <input type="radio" name={`ptype_${printer.id}`} checked={isRaster} onChange={() => updatePrinterField('usb_name', 'RASTER')} style={{ marginTop: 2, accentColor: '#3b82f6' }} />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{t("tam_dizayn_capi_raster")}<span style={{ fontSize: 11, background: '#dcfce7', color: '#16a34a', padding: '1px 7px', borderRadius: 20, marginLeft: 4 }}>{t("tovsiye")}</span></div>
                                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{t("html_cek_dizayni_sekil_kimi_cap_olunur_windows_driver_lazim_deyil_birbasa_ipye_gonderilir")}</div>
                                                </div>
                                            </label>);
                                    })()}
                                    {/* Windows Driver seçimi */}
                                    {(() => {
                                        const isWin = printer.usb_name && printer.usb_name !== 'RASTER'; return (
                                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, border: isWin ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: isWin ? '#eff6ff' : '#fff' }}>
                                                <input type="radio" name={`ptype_${printer.id}`} checked={!!isWin} onChange={() => { const autoName = printer.ip ? `UNIPOS_${String(printer.ip).replace(/\./g, '_')}` : (systemPrinters[0]?.name || 'UNIPOS_PRINTER'); updatePrinterField('usb_name', autoName); }} style={{ marginTop: 2, accentColor: '#3b82f6' }} />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{t("windows_driver_vasitesile")}</div>
                                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{t("bu_printerin_windowsda_qurulu_olmasi_lazimdir_asagidan_adini_secin")}</div>
                                                </div>
                                            </label>);
                                    })()}
                                </div>
                            </div>

                            {/* Windows Driver seçilibsə — sistem printer adı + Qur düyməsi */}
                            {(printer.usb_name && printer.usb_name.trim() && printer.usb_name !== 'RASTER') ? (
                                <div className="printer-form-group">
                                    <label>{t("windows_sistem_printer_adi")}</label>
                                    <select className="printer-select" value={printer.usb_name || ""} onChange={e => updatePrinterField('usb_name', e.target.value)}>
                                        <option value="">{t("printer_secin")}</option>
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
                    <div className="settings-section-title" style={{ marginTop: '20px' }}>{t("cap_parametrleri")}</div>
                    {[
                        { label: t("sesli_bildiris"), field: 'sound_notify', icon: 'bi-volume-up', desc: 'Yeni çap gəldikdə zəng səsi çıxarsın' },
                        { label: t("pul_yesiyi"), field: 'cash_drawer', icon: 'bi-cash-stack', desc: 'Çapdan sonra pul yeşiyini avto aç' },
                        { label: t("pul_yesiyi_capsiz"), field: 'open_drawer_without_print', icon: 'bi-box-arrow-up', desc: 'Çap olmadan manual açıq trigger göndər' },
                        { label: t("suretli_cap"), field: 'fast_print', icon: 'bi-lightning', desc: 'Görüntü keyfiyyətini azaldıb sürəti artır' },
                        { label: t("loqo_capi"), field: 'print_logo', icon: 'bi-image', desc: profileLogo ? 'Çekin başında profil loqosu çap olunacaq' : 'Loqo admin paneldən profilə yüklənməlidir' },
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
                                    <span className="logo-preview-label">{t("bu_loqo_cekin_ustunde_cap_olunacaq")}</span>
                                </>
                            ) : (
                                <div className="logo-preview-empty">
                                    <i className="bi bi-exclamation-triangle"></i>
                                    <span>{t("admin_panelden_profil_loqosu_yukleyin")}</span>
                                </div>
                            )}
                        </div>
                    ) : null}

                    {/* ── Copies + Darkness ── */}
                    <div className="settings-inputs-grid" style={{ marginTop: '16px' }}>
                        <div className="settings-input-card">
                            <div className="settings-input-icon"><i className="bi bi-files"></i></div>
                            <div className="settings-input-body">
                                <label>{t("nusxe_sayi")}</label>
                                <input className="printer-input" type="number" min="1" max="10" value={printer.copies ?? 1} onChange={e => updatePrinterField('copies', Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="settings-input-card">
                            <div className="settings-input-icon"><i className="bi bi-circle-half"></i></div>
                            <div className="settings-input-body">
                                <label>{t("cap_sixligi_110")}</label>
                                <input className="printer-input" type="number" min="1" max="10" value={printer.darkness ?? 5} onChange={e => updatePrinterField('darkness', Number(e.target.value))} />
                            </div>
                        </div>
                    </div>

                    {/* ── Paper ── */}
                    <div className="settings-section-title" style={{ marginTop: '20px' }}>{t("kagiz")}</div>
                    <div className="settings-chip-row">
                        <span className="settings-chip-label">{t("olcu")}</span>
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
                                <label>{t("bos_setir_kesimden_sonra")}</label>
                                <input className="printer-input" type="number" min="0" max="20" value={printer.trailing_space ?? 0} onChange={e => updatePrinterField('trailing_space', Number(e.target.value))} />
                            </div>
                        </div>
                    </div>

                    {/* ── Cut mode ── */}
                    <div className="settings-section-title" style={{ marginTop: '20px' }}>{t("kesim_novu")}</div>
                    <div className="settings-chip-group">
                        {[
                            { val: 'full', label: t("tam_kesim") },
                            { val: 'partial', label: t("qismen_kesim") },
                            { val: 'none', label: t("kesim_yox") },
                        ].map(o => (
                            <button key={o.val} className={`settings-chip ${(printer.cut_mode || 'full') === o.val ? 'active' : ''}`} onClick={() => updatePrinterField('cut_mode', o.val)}>{o.label}</button>
                        ))}
                    </div>

                    {/* ── Encoding ── */}
                    <div className="settings-section-title" style={{ marginTop: '20px' }}>{t("kodlasdirma")}</div>
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
                    <div className="settings-section-title" style={{ marginTop: '20px' }}>{t("srift")}</div>
                    <div className="settings-font-row">
                        {['Arial', 'Courier New', 'Tahoma', 'Verdana', 'Consolas'].map(f => (
                            <button key={f} className={`font-chip ${(printer.font_family || 'Arial') === f ? 'active' : ''}`} onClick={() => updatePrinterField('font_family', f)} style={{ fontFamily: f }}>{f}</button>
                        ))}
                    </div>

                    {/* ── Header / Footer text ── */}
                    <div className="settings-section-title" style={{ marginTop: '20px' }}>{t("cek_basligi")}</div>
                    <div className="settings-toggle-row" style={{ marginBottom: 8 }}>
                        <div className="settings-toggle-icon"><i className="bi bi-type-bold"></i></div>
                        <div className="settings-toggle-text">
                            <span className="settings-toggle-label">{t("qalin_srift_bold")}</span>
                            <span className="settings-toggle-desc">{t("basliq_metni_bold_cap_olunsun")}</span>
                        </div>
                        <div className={`premium-switch ${printer.bold_header ? 'active' : ''}`} onClick={() => updatePrinterField('bold_header', printer.bold_header ? 0 : 1)}>
                            <div className="switch-handle"></div>
                        </div>
                    </div>
                    <div className="settings-toggle-row" style={{ marginBottom: 12 }}>
                        <div className="settings-toggle-icon"><i className="bi bi-fonts"></i></div>
                        <div className="settings-toggle-text">
                            <span className="settings-toggle-label">{t("boyuk_srift_doubleheight")}</span>
                            <span className="settings-toggle-desc">{t("basliq_esc/pos_doubleheight_rejiminde")}</span>
                        </div>
                        <div className={`premium-switch ${printer.double_height_header ? 'active' : ''}`} onClick={() => updatePrinterField('double_height_header', printer.double_height_header ? 0 : 1)}>
                            <div className="switch-handle"></div>
                        </div>
                    </div>
                    <div className="printer-form-group">
                        <label>{t("basliq_metni_cekin_ustunde")}</label>
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
                        <label>{t("altliq_metni_cekin_altinda")}</label>
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
                    <div className="settings-section-title" style={{ marginTop: '20px' }}>{t("diger")}</div>
                    <div className="settings-toggle-row">
                        <div className="settings-toggle-icon"><i className="bi bi-arrow-down-up"></i></div>
                        <div className="settings-toggle-text">
                            <span className="settings-toggle-label">{t("cevrilmis_cap_180°")}</span>
                            <span className="settings-toggle-desc">{t("ceki_basasagi_cap_et")}</span>
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
    const [systemPrintersLoading, setSystemPrintersLoading] = useState(false);
    const [comPorts, setComPorts] = useState([]);
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
    const [posAutoLockEnabled, setPosAutoLockEnabled] = useState(() => {
        try { return localStorage.getItem("pos_auto_lock_enabled") === "1"; } catch { return false; }
    });
    const [skipGuestCount, setSkipGuestCount] = useState(() => {
        try { return localStorage.getItem("unipos_skip_guest_count") === "1"; } catch { return false; }
    });
    const [posAutoLockSeconds, setPosAutoLockSeconds] = useState(() => {
        try {
            const s = localStorage.getItem("pos_auto_lock_seconds");
            return s && String(s).trim() !== "" ? String(parseInt(s, 10) || 120) : "120";
        } catch { return "120"; }
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
    const [taxDailyInfo, setTaxDailyInfo] = useState({});
    const {
        diagnostics: printerDiagnostics,
        isChecking: printerDiagnosticsChecking,
        refresh: refreshPrinterDiagnostics,
    } = usePrinterDiagnostics(printers, {
        enabled: show && activeTab === "printers",
        intervalMs: 30000,
        timeoutMs: 3500,
    });

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
            toast.success(t("kassa_cap_secimi_yadda_saxlanildi"));
        } catch {
            toast.error(t("yadda_saxlanmadi"));
        }
    };

    const persistPosAutoLock = (enabled, secondsStr) => {
        try {
            localStorage.setItem("pos_auto_lock_enabled", enabled ? "1" : "0");
            const n = parseInt(String(secondsStr || "0").trim(), 10);
            const sec = !Number.isNaN(n) && n >= 1 ? Math.min(Math.max(n, 5), 48 * 3600) : 120;
            localStorage.setItem("pos_auto_lock_seconds", String(sec));
            setPosAutoLockSeconds(String(sec));
            window.dispatchEvent(new Event("unipos_pos_auto_lock_update"));
        } catch (e) {
            console.warn("pos_auto_lock:", e);
        }
    };

    const handleTogglePosAutoLock = () => {
        const next = !posAutoLockEnabled;
        setPosAutoLockEnabled(next);
        persistPosAutoLock(next, posAutoLockSeconds);
        toast.success(next ? "Avto bloklama AKTİV" : "Avto bloklama DEAKTİV");
    };

    const handlePosAutoLockSecondsBlur = () => {
        if (!posAutoLockEnabled) return;
        persistPosAutoLock(true, posAutoLockSeconds);
    };

    const handleToggleSkipGuestCount = () => {
        const next = !skipGuestCount;
        setSkipGuestCount(next);
        try { localStorage.setItem("unipos_skip_guest_count", next ? "1" : "0"); } catch {}
        toast.success(next ? "Qonaq sayı sorğusu DEAKTİV (birbaşa 0)" : "Qonaq sayı sorğusu AKTİV");
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
                if (window.electronAPI?.listComPorts) {
                    const ports = await window.electronAPI.listComPorts();
                    setComPorts(ports || []);
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

    const handleRefreshSystemPrinters = async () => {
        setSystemPrintersLoading(true);
        try {
            if (window.electronAPI?.getSystemPrinters) {
                const sysPrinters = await window.electronAPI.getSystemPrinters();
                setSystemPrinters(sysPrinters || []);
            }
            if (window.electronAPI?.listComPorts) {
                const ports = await window.electronAPI.listComPorts();
                setComPorts(ports || []);
            }
        } catch (e) {
            console.warn("Refresh system printers failed:", e.message);
        } finally {
            setSystemPrintersLoading(false);
        }
    };

    const handleNetworkScan = async () => {
        setNetworkScanning(true);
        setNetworkScanResults([]);
        try {
            const baseIp = localIp ? localIp.split('.').slice(0, 3).join('.') : '192.168.1';
            const results = await window.electronAPI?.scanNetworkPrinters?.({ baseIp, port: 9100 }) || [];
            setNetworkScanResults(results);
            if (results.length === 0) toast.info(t("sebekede_printer_tapilmadi"));
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
                        <h4 style="margin: 5px 0;">{t("test_capi")}</h4>
                        <p style="margin: 5px 0;">-------------------------</p>
                        <p style="margin: 2px 0;">Printer: ${printerIp || printerName}</p>
                        <p style="margin: 2px 0;">Tarix: ${new Date().toLocaleString()}</p>
                        <p style="margin: 5px 0;">-------------------------</p>
                        <p style="margin: 5px 0; font-size: 12px;">{t("sistem_ugurla_qosuldu")}</p>
                    </div>
                `;
                await window.electronAPI.printReceipt({
                    html: testHtml,
                    printerName: printerIp ? "" : printerName,
                    printerIp: printerIp || "",
                    printerPort: printerPort || 9100,
                    printerSettings: { printer_label: printerName || "" },
                });
                toast.success(t("test_capi_gonderildi"));
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
            toast.error(t("profil_tapilmadi_evvelce_giris_edin"));
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
        if (!profileId) { toast.error(t("profil_tapilmadi_1")); return; }
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
            toast.error(t("profil_tapilmadi_evvelce_giris_edin"));
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
            toast.success(t("musteri_ekrani_tenzimlemeleri_yadda_saxlanildi"));
        } catch (error) {
            // On slave, local DB may not have this endpoint — localStorage save is enough
            console.warn("Customer Display API sync skipped (slave or offline):", error?.response?.status);
            toast.success(t("musteri_ekrani_tenzimlemeleri_yadda_saxlanildi_lokal"));
        }
    };

    const handleUpdateKitchenDisplay = async (active = null, screenId = null) => {
        return handleKitchenDisplayLocal(active, screenId);

        const nextActive = active !== null ? active : kitchenDisplay.active;
        const nextScreenId = screenId !== null ? screenId : kitchenDisplay.screenId;

        // Update local state and UI immediately
        setKitchenDisplay({ active: nextActive, screenId: nextScreenId });
        if (window.electronAPI?.toggleKitchenDisplay) {
            window.electronAPI
                .toggleKitchenDisplay({ active: nextActive, screenId: nextScreenId })
                .catch((error) => {
                    console.error("Kitchen Display window error:", error);
                    if (nextActive) handleOpenKitchenDisplayPreview();
                });
        } else if (nextActive) {
            handleOpenKitchenDisplayPreview();
        }

        // Always persist to localStorage so slave auto-start works
        const storedProfile2 = JSON.parse(localStorage.getItem("profile") || "{}");
        storedProfile2.is_kitchen_display_active = nextActive ? 1 : 0;
        storedProfile2.kitchen_display_screen_id = nextScreenId;
        localStorage.setItem("profile", JSON.stringify(storedProfile2));

        toast.success(nextActive ? "KDS ekranı açıldı" : "KDS ekranı bağlandı");
        const shouldSyncKitchenDisplayApi = Boolean(window.__UNIPOS_ENABLE_KDS_API_SYNC__);
        if (shouldSyncKitchenDisplayApi) {

        try {
            await localApi.patch("/profiles/kitchen-display", {
                profileId,
                isActive: nextActive,
                screenId: nextScreenId
            });
            toast.success(t("metbex_ekrani_tenzimlemeleri_yadda_saxlanildi"));
        } catch (error) {
            // On slave, local DB may not have this endpoint — localStorage save is enough
            console.warn("Kitchen Display API sync skipped (slave or offline):", error?.response?.status);
            toast.success(t("metbex_ekrani_tenzimlemeleri_yadda_saxlanildi_lokal"));
        }
        }
    };

    const handleOpenKitchenDisplayPreview = () => {
        const baseUrl = window.location.href.split("#")[0];
        const previewWindow = window.open(
            `${baseUrl}#/kitchen-display`,
            "unipos-kds-preview",
            "width=1280,height=720"
        );

        if (previewWindow) {
            previewWindow.focus();
        } else {
            toast.error(t("kds_penceresini_acmaq_mumkun_olmadi"));
        }
    };

    const handleKitchenDisplayLocal = async (active = null, screenId = null) => {
        const nextActive = active !== null ? active : kitchenDisplay.active;
        const nextScreenId = screenId !== null ? screenId : kitchenDisplay.screenId;

        setKitchenDisplay({ active: nextActive, screenId: nextScreenId });

        const storedProfile = JSON.parse(localStorage.getItem("profile") || "{}");
        storedProfile.is_kitchen_display_active = nextActive ? 1 : 0;
        storedProfile.kitchen_display_screen_id = nextScreenId;
        localStorage.setItem("profile", JSON.stringify(storedProfile));

        if (window.electronAPI?.toggleKitchenDisplay) {
            try {
                await window.electronAPI.toggleKitchenDisplay({ active: nextActive, screenId: nextScreenId });
                toast.success(nextActive ? "KDS ekranı açıldı" : "KDS ekranı bağlandı");
                return;
            } catch (error) {
                console.error("Kitchen Display window error:", error);
            }
        }

        if (nextActive) {
            handleOpenKitchenDisplayPreview();
            toast.success(t("kds_preview_acildi"));
        } else {
            toast.success(t("kds_ayari_lokal_yadda_saxlanildi"));
        }
    };

    const setTaxDeviceLoading = (index, loading) => {
        setTaxLoading(prev => ({ ...prev, [index]: loading }));
    };

    const handleTaxLogin = async (tax, index) => {
        setTaxDeviceLoading(index, true);
        try {
            const result = await localApi.post('/tax/login', { taxConfig: tax }, { timeout: TAX_HTTP_TIMEOUT_MS });
            const d = result.data;
            // DATAPAY: accessToken (camelCase); digər cihazlar: access_token (snake) və ya d.data
            const hasToken = !!(
                d && (
                    (d.accessToken != null && d.accessToken !== '') ||
                    (d.access_token != null && d.access_token !== '') ||
                    (d.data && (d.data.accessToken != null || d.data.access_token != null))
                )
            );
            if (hasToken) {
                toast.success(`${tax.tax_cash_type} — Login uğurlu`);
                handleShiftStatus(tax, index);
            } else {
                toast.error('Login u\u011Fursuz: ' + (d?.message || ''));
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
            toast.success(t("n_u00f6vb_u0259_a_u00e7_u0131ld_u0131"));
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
            toast.success(t("n_u00f6vb_u0259_ba_u011fland_u0131_zreport"));
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
            toast.success(t("xreport__u00e7ap_edildi"));
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            toast.error('X-Report x\u0259tas\u0131: ' + msg);
            addNotification('E-Kassa X-Report', msg, { category: 'system', type: 'error' });
        } finally {
            setTaxDeviceLoading(index, false);
        }
    };

    const handlePeriodicReport = async (tax, index) => {
        if (!reportStart.date || !reportEnd.date) {
            toast.warning(t("d_u00f6vri_hesabat__u00fc_u00e7_u00fcn__u201cbu_tarixd_u0259n_u201d_v_u0259__u201cbu_tarix_u0259_q_u0259d_u0259r_u201d_t_u0259r_u0259zi_se_u00e7in"));
            return;
        }
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
                toast.success(t("d_u00f6vri_hesabat_s_u0259n_u0259di__u00e7ap_edildi"));
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
        if (!reportStart.date || !reportEnd.date) {
            toast.warning(t("tarix_u00e7_u0259__u00fc_u00e7_u00fcn__u201cbu_tarixd_u0259n_u201d_v_u0259__u201cbu_tarix_u0259_q_u0259d_u0259r_u201d_t_u0259r_u0259zi_doldurun"));
            return;
        }
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
                toast.success(t("se_u00e7ilmi_u015f_tarix__u00fczr_u0259__u0259m_u0259liyyat_siyah_u0131s_u0131_cihaza_g_u00f6nd_u0259rildi_fiskal_cihaz__u00e7ap_ed_u0259_bil_u0259r"));
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
            toast.success(t("yenid_u0259n__u00e7ap_sor_u011fusu_g_u00f6nd_u0259rildi"));
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
                toast.info(t("cihaz_m_u0259lumat_u0131_al_u0131nd_u0131"));
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
                <Modal.Title>{t("cihazlar_ve_printerler")}</Modal.Title>
            </Modal.Header>

            {
                isMobile && (
                    <div className="devices-mobile-tabs">
                        <div
                            className={`devices-mobile-tab ${activeTab === "printers" ? "active" : ""}`}
                            onClick={() => setActiveTab("printers")}
                        >{t("printerler")}</div>
                        <div
                            className={`devices-mobile-tab ${activeTab === "printSettings" ? "active" : ""}`}
                            onClick={() => setActiveTab("printSettings")}
                        >{t("cap_tenzimlemeleri")}</div>
                        <div
                            className={`devices-mobile-tab ${activeTab === "display" ? "active" : ""}`}
                            onClick={() => setActiveTab("display")}
                        >{t("musteri_ekrani")}</div>
                        <div
                            className={`devices-mobile-tab ${activeTab === "kitchen" ? "active" : ""}`}
                            onClick={() => setActiveTab("kitchen")}
                        >
                            KDS Ekranı
                        </div>
                        <div
                            className={`devices-mobile-tab ${activeTab === "scales" ? "active" : ""}`}
                            onClick={() => setActiveTab("scales")}
                        >{t("tereziler")}</div>
                        <div
                            className={`devices-mobile-tab ${activeTab === "scanners" ? "active" : ""}`}
                            onClick={() => setActiveTab("scanners")}
                        >{t("skanerler")}</div>
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
                            >{t("mobil_qosulma")}</div>
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
                                <span>{t("printerler")}</span>
                            </div>
                            <div
                                className={`devices-menu-item ${activeTab === "printSettings" ? "active" : ""}`}
                                onClick={() => setActiveTab("printSettings")}
                            >
                                <i className="bi bi-sliders"></i>
                                <span>{t("cap_tenzimlemeleri")}</span>
                            </div>
                            <div
                                className={`devices-menu-item ${activeTab === "display" ? "active" : ""}`}
                                onClick={() => setActiveTab("display")}
                            >
                                <i className="bi bi-display"></i>
                                <span>{t("musteri_ekrani")}</span>
                            </div>
                            <div
                                className={`devices-menu-item ${activeTab === "kitchen" ? "active" : ""}`}
                                onClick={() => setActiveTab("kitchen")}
                            >
                                <i className="bi bi-egg-fried"></i>
                                <span>{t("metbex_ekrani")}</span>
                            </div>
                            <div
                                className={`devices-menu-item ${activeTab === "scales" ? "active" : ""}`}
                                onClick={() => setActiveTab("scales")}
                            >
                                <i className="bi bi-rulers"></i>
                                <span>{t("tereziler")}</span>
                            </div>
                            <div
                                className={`devices-menu-item ${activeTab === "scanners" ? "active" : ""}`}
                                onClick={() => setActiveTab("scanners")}
                            >
                                <i className="bi bi-qr-code-scan"></i>
                                <span>{t("skanerler")}</span>
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
                                    <span>{t("mobil_qosulma")}</span>
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
                                            <h4 style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>{t("printerler")}</h4>
                                            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>{t("cihaza_klikleyerek_tenzimlemeleri_edin")}</p>
                                        </div>
                                        <div className="printers-grid">
                                            {printers.map((printer, index) => {
                                                const connType = printer.connection_type;
                                                const isNet = connType === 'network' || (!connType && printer.ip);
                                                const diagnostic = printerDiagnostics[getPrinterKey(printer)];
                                                const statusClass = getPrinterDiagnosticClass(diagnostic);
                                                const statusLabel = getPrinterDiagnosticLabel(diagnostic);
                                                const queuedText = diagnostic?.queuedJobs > 0 ? ` • Növbə: ${diagnostic.queuedJobs}` : "";
                                                const showDiagnosticDetail = diagnostic && ["error", "warning"].includes(diagnostic.status);
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
                                                                <span className={`printer-status-dot printer-status-dot--${statusClass}`}></span>
                                                            </div>
                                                            <div className="printer-card-title">
                                                                <h5>{printer.local_name || printer.name}</h5>
                                                                <span>
                                                                    {printer.is_cashier === 1 ? "Kassa Printeri" : "Mətbəx Printeri"}
                                                                    {printer.connection_type === 'usb' && printer.usb_name ? ` • USB: ${printer.usb_name}` : ''}
                                                                    {printer.connection_type === 'com' && printer.usb_name ? ` • COM: ${printer.usb_name}` : ''}
                                                                    {isNet && printer.ip ? ` • ${printer.ip}` : ''}
                                                                </span>
                                                                {showDiagnosticDetail && (
                                                                    <small className="printer-diagnostic-detail">
                                                                        {[statusLabel, diagnostic?.detail, queuedText ? `Növbə: ${diagnostic.queuedJobs}` : ""].filter(Boolean).join(" • ")}
                                                                    </small>
                                                                )}
                                                            </div>
                                                            <span
                                                                className={`printer-status-badge printer-status-badge--${printerDiagnosticsChecking && !diagnostic ? 'checking' : statusClass}`}
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    refreshPrinterDiagnostics();
                                                                }}
                                                                title={t("statusu_yenile")}
                                                            >
                                                                {printerDiagnosticsChecking && !diagnostic ? '...' : statusLabel}
                                                            </span>
                                                            <i className="bi bi-chevron-right" style={{ marginLeft: '8px', color: '#94a3b8', fontSize: '18px' }}></i>
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
                                        systemPrintersLoading={systemPrintersLoading}
                                        onRefreshSystemPrinters={handleRefreshSystemPrinters}
                                        comPorts={comPorts}
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
                                    <h4 style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>{t("cap_tenzimlemeleri")}</h4>
                                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>{t("merkezi_cap_avto_cap_ve_novbe_tenzimlemeleri")}</p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div className="settings-toggle-row">
                                        <div className="settings-toggle-icon"><i className="bi bi-printer"></i></div>
                                        <div className="settings-toggle-text">
                                            <span className="settings-toggle-label">{t("merkezi_kassa_capi")}</span>
                                            <span className="settings-toggle-desc">{t("merkezi_printer_masterdadir_slave_merkezi_aciq_olduqda_mastera_gonderir_master_ozunde_cap_edir")}</span>
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
                                            <span className="settings-toggle-label">{t("merkezi_metbex_capi")}</span>
                                            <span className="settings-toggle-desc">{t("merkezi_printer_masterdadir_slave_merkezi_aciq_olduqda_mastera_gonderir_master_ozunde_cap_edir")}</span>
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
                                            <span className="settings-toggle-label">{t("musteri_ceki_avto_cap")}</span>
                                            <span className="settings-toggle-desc">{t("checkover_sehifesinde_ceki_cap_et_toggle_avtomatik_aciq_olsun")}</span>
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
                                            <span className="settings-toggle-label">{t("novbeli_acilis_teleb_et")}</span>
                                            <span className="settings-toggle-desc">{t("novbe_acilmadan_sifaris_yaratmaq_mumkun_olmasin")}</span>
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
                                            <span className="settings-toggle-desc">{t("axtaris_acilanda_ekran_klaviaturasi_avtomatik_acilsin_azerbaycan_herfleri")}</span>
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
                                    <div className="settings-toggle-row">
                                        <div className="settings-toggle-icon"><i className="bi bi-shield-lock"></i></div>
                                        <div className="settings-toggle-text">
                                            <span className="settings-toggle-label">Avto bloklama (PIN)</span>
                                            <span className="settings-toggle-desc">{t("muddet_erzinde_ekranda_emeliyyat_olmasa_avtomatik_pin_sehifesine_kecir_masa_check_tenzimlemeler")}</span>
                                        </div>
                                        <div
                                            className={`premium-switch ${posAutoLockEnabled ? "active" : ""}`}
                                            onClick={handleTogglePosAutoLock}
                                        >
                                            <div className="switch-handle"></div>
                                        </div>
                                    </div>
                                    {posAutoLockEnabled && (
                                        <div className="printer-form-group" style={{ marginTop: 4 }}>
                                            <label>{t("gozleme_saniye")}</label>
                                            <input
                                                type="number"
                                                className="printer-input"
                                                min={5}
                                                max={172800}
                                                step={1}
                                                value={posAutoLockSeconds}
                                                onChange={(e) => setPosAutoLockSeconds(e.target.value)}
                                                onBlur={handlePosAutoLockSecondsBlur}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.target.blur();
                                                    }
                                                }}
                                            />
                                            <span style={{ display: "block", marginTop: 6, fontSize: "12px", color: "#64748b" }}>{t("minimum_5_saniye_fealiyyetsizlikden_sonra_/pin_acilir")}</span>
                                        </div>
                                    )}
                                </div>

                                {printers.filter((p) => Number(p.is_cashier) === 1).length >= 2 && (
                                    <div className="cashier-print-select-card" style={{ marginTop: '24px' }}>
                                        <h4 className="cashier-print-select-title">{t("bu_terminal_ucun_kassa_capi")}</h4>
                                        <p className="cashier-print-select-desc">{t("hansi_kassa_printerlerine_musteri_ceki_getmeli_oldugunu_secin")}</p>
                                        <label className="cashier-print-select-label">{t("secim")}</label>
                                        <select
                                            className="form-select form-select-sm cashier-print-select"
                                            value={cashierPrintPref}
                                            onChange={handleCashierPrintPrefChange}
                                        >
                                            <option value="">{t("avtomatik_yalniz_ilk_kassa_printeri")}</option>
                                            <option value="all">{t("butun_kassa_printerlerine_cap")}</option>
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

                                <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                                    <h5 style={{ margin: '0 0 12px', color: '#1e293b', fontWeight: 600, fontSize: '14px' }}>{t("elave_1")}</h5>
                                    <div className="settings-toggle-row">
                                        <div className="settings-toggle-icon"><i className="bi bi-person-dash"></i></div>
                                        <div className="settings-toggle-text">
                                            <span className="settings-toggle-label">{t("qonaq_sayini_legv_et")}</span>
                                            <span className="settings-toggle-desc">{t("aktiv_olduqda_yeni_masa_yaradilarken_qonaq_sayi_sorusulmadan_birbasa_0_olaraq_acilir")}</span>
                                        </div>
                                        <div
                                            className={`premium-switch ${skipGuestCount ? "active" : ""}`}
                                            onClick={handleToggleSkipGuestCount}
                                        >
                                            <div className="switch-handle"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === "display" ? (
                            <div className="display-settings">
                                <div className="display-config-card">
                                    <div className="display-config-header">
                                        <div className="display-config-info">
                                            <h4>{t("i̇kinci_monitor_dualmonitor")}</h4>
                                            <p>{t("cihaza_bagli_olan_ikinci_ekranda_musteri_menyusunu_aktivlesdirin")}</p>
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
                                            <label>{t("monitor_secimi")}</label>
                                            <select
                                                className="printer-select"
                                                value={customerDisplay.screenId}
                                                onChange={(e) => handleUpdateCustomerDisplay(null, e.target.value)}
                                            >
                                                <option value="">{t("secilmeyib")}</option>
                                                {screens.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.label} {s.isPrimary ? "(Əsas)" : ""} - {s.bounds.width}x{s.bounds.height}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="display-preview-info">
                                            <i className="bi bi-info-circle"></i>
                                            <span>{t("eger_cihazinizda_ikinci_ekran_qosuludursa_onu_siyahidan_secin_ve_yuxaridaki_acari_aktiv_edin")}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === "kitchen" ? (
                            <div className="display-settings">
                                <div className="display-config-card">
                                    <div className="display-config-header">
                                        <div className="display-config-info">
                                            <h4>{t("metbex_ekrani_kds")}</h4>
                                            <p>{t("sifarislerin_metbexde_izlenmesi_ucun_reqemsal_ekrani_aktivlesdirin")}</p>
                                        </div>
                                        <div className="display-config-actions">
                                            <button
                                                type="button"
                                                className="display-preview-button"
                                                onClick={handleOpenKitchenDisplayPreview}
                                            >
                                                <i className="bi bi-box-arrow-up-right"></i>
                                                <span>{t("acib_bax")}</span>
                                            </button>
                                            <div
                                                className={`premium-switch ${kitchenDisplay.active ? "active" : ""}`}
                                                onClick={() => handleKitchenDisplayLocal(!kitchenDisplay.active)}
                                            >
                                                <div className="switch-handle"></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="display-config-body">
                                        <div className="printer-form-group">
                                            <label>{t("monitor_secimi")}</label>
                                            <select
                                                className="printer-select"
                                                value={kitchenDisplay.screenId}
                                                onChange={(e) => handleKitchenDisplayLocal(null, e.target.value)}
                                            >
                                                <option value="">{t("secilmeyib")}</option>
                                                {screens.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.label} {s.isPrimary ? "(Əsas)" : ""} - {s.bounds.width}x{s.bounds.height}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="display-preview-info">
                                            <i className="bi bi-info-circle"></i>
                                            <span>{t("metbex_ekrani_acildiqda_butun_aktiv_sifarisler_orada_reqemsal_kartlar_seklinde_gorunecek")}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === "taxes" && taxes.length > 0 && canSeeTax ? (
                            <div className="display-settings">
                                {selectedTaxIndex === null ? (
                                    <>
                                        <div style={{ marginBottom: '16px' }}>
                                            <h4 style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>{t("ekassa_cihazlari")}</h4>
                                            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>{t("cihaza_klikleyerek_etrafli_melumati_gorun")}</p>
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
                                            toast.info(t("bu_funskiya_tezlikl_u0259__u0259lav_u0259_edil_u0259c_u0259k"));
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
                                                            <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, display: 'block', marginBottom: '8px' }}>{t("bu_tarixden")}</label>
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
                                                            <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, display: 'block', marginBottom: '8px' }}>{t("bu_tarixe_qeder")}</label>
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
                                                            <button type="button" title={t("yuxaridaki_tarix_araliginda_fiskal_cihazdan_butun_emeliyyatlarin_siyahisi_datapay_dovri_hesabat_cap_ola_biler")} onClick={() => handleOperationHistory(tax, idx)} disabled={taxLoading[idx]} style={{ flex: 2, background: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                                                                Əməliyyat tarixçəsi
                                                            </button>
                                                            <button type="button" title={t("eyni_tarix_araliginda_d_u00f6vri_z_hesabat__u2014_cihazdan")} onClick={() => handlePeriodicReport(tax, idx)} disabled={taxLoading[idx]} style={{ flex: 1, background: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
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
                                                        >{t("novbeni_ac")}</button>
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
                                        <h3>{t("mobil_terminal_qosulmasi")}</h3>
                                        <p>{t("android_tetbiqde_bu_qr_kodu_skan_ederek_master_bazasina_qosula_bilersiniz")}</p>
                                    </div>

                                    <div className="qr-display-box">
                                        {localIp && localIp !== "Unknown" ? (
                                            <div className="qr-wrapper">
                                                <QRCode
                                                    value={`http://${localIp}:55667`}
                                                    size={window.innerHeight < 700 ? 140 : 180}
                                                    level="H"
                                                    style={{ height: "auto", maxWidth: "100%", margin: "0 auto" }}
                                                />
                                                <div className="ip-badge">
                                                    {localIp}:55667
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="qr-error">
                                                <i className="bi bi-exclamation-triangle"></i>
                                                <p>{t("ip_unvani_mueyyen_edile_bilmedi_sebeke_baglantisini_yoxlayin")}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="qr-steps">
                                        <div className="step-item">
                                            <span className="step-num">1</span>
                                            <p>{t("mobil_tetbiqi_acin")}</p>
                                        </div>
                                        <div className="step-item">
                                            <span className="step-num">2</span>
                                            <p>{t("qr_skaner_duymesine_klikleyin")}</p>
                                        </div>
                                        <div className="step-item">
                                            <span className="step-num">3</span>
                                            <p>{t("kodu_ekranin_onune_tutun")}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', marginTop: '100px', color: '#64748b' }}>
                                <i className="bi bi-gear" style={{ fontSize: '48px' }}></i>
                                <p style={{ marginTop: '16px' }}>{t("bu_bolme_uzerinde_is_gedir")}</p>
                            </div>
                        )}
                    </div>
                </div>
            </Modal.Body>
        </Modal >
    );
};

export default DevicesModal;
