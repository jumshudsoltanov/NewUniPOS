import React, { useState, useEffect, useCallback } from "react";
import { Modal } from "react-bootstrap";
import { toast } from "sonner";
import "../DiscountModal/DiscountModal.css";
import "../SettingsMenu/SettingsMenu.css";
import "./PinAdvancedSettingsModal.css";
import apiConfig from "../../utils/apiConfig";

const SECRET_PASSWORD = "2507";

const ALL_ACTIONS = [
  { key: "prefix:Yeni sifariş yaradıldı", label: "Yeni çek açıldı" },
  { key: "Çek bağlandı", label: "Çek bağlandı" },
  { key: "Çek yenidən açıldı", label: "Çek yenidən açıldı" },
  { key: "Çek silindi", label: "Çek silindi" },
  { key: "Çeklər birləşdirildi", label: "Çeklər birləşdirildi" },
  { key: "Çek geri qaytarma", label: "Çek geri qaytarma" },
  { key: "Çek çap edildi", label: "Çek çap edildi" },
  { key: "Ön çap çıxarıldı", label: "Ön çap çıxarıldı" },
  { key: "Qəbz təmizləndi", label: "Qəbz təmizləndi" },
  { key: "Sifariş göndərildi", label: "Sifariş göndərildi" },
  { key: "prefix:Məhsul əlavə edildi", label: "Məhsul əlavə edildi" },
  { key: "Məhsul silindi", label: "Məhsul silindi" },
  { key: "Məhsullar silindi", label: "Məhsullar silindi" },
  { key: "Məhsul köçürüldü", label: "Məhsul köçürüldü" },
  { key: "Məhsul qəbul edildi", label: "Məhsul qəbul edildi" },
  { key: "Məhsula endirim", label: "Məhsula endirim" },
  { key: "Miqdar dəyişdirildi", label: "Miqdar dəyişdirildi" },
  { key: "Qiymət dəyişdirildi", label: "Qiymət dəyişdirildi" },
  { key: "Endirim dəyişildi", label: "Endirim dəyişildi" },
  { key: "Servis haqqı dəyişildi", label: "Servis haqqı dəyişildi" },
  { key: "Masa dəyişildi", label: "Masa dəyişildi" },
  { key: "Satış növü dəyişildi", label: "Satış növü dəyişildi" },
  { key: "Ofisiant dəyişildi", label: "Ofisiant dəyişildi" },
  { key: "Depozit dəyişildi", label: "Depozit dəyişildi" },
  { key: "Qonaq sayı dəyişdirildi", label: "Qonaq sayı dəyişdirildi" },
  { key: "Şərh yazıldı", label: "Şərh yazıldı" },
  { key: "Taymer başladıldı", label: "Taymer başladıldı" },
  { key: "Taymer dayandırıldı", label: "Taymer dayandırıldı" },
  { key: "Taymer sıfırlandı", label: "Taymer sıfırlandı" },
  { key: "prefix:Vergi ", label: "Vergi əməliyyatları" },
];

function isActionDenied(key, denyActions, denyPrefixes) {
  if (key.startsWith("prefix:")) {
    const prefix = key.slice(7);
    return denyPrefixes.includes(prefix);
  }
  return denyActions.includes(key);
}

const PinAdvancedSettingsModal = ({ show, onClose, onExitTerminal }) => {
  // Şifrə
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  // view: "main" | "whatsapp" | "dbReset" | "updates"
  const [view, setView] = useState("main");

  const [resettingDb, setResettingDb] = useState(false);

  // WhatsApp
  const [waLoading, setWaLoading] = useState(false);
  const [waSaving, setWaSaving] = useState(false);
  const [denyActions, setDenyActions] = useState([]);
  const [denyPrefixes, setDenyPrefixes] = useState([]);

  // Updates
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [manualUpdateEnabled, setManualUpdateEnabled] = useState(
    () => localStorage.getItem("manualUpdateEnabled") === "true"
  );
  const [updateCheckResult, setUpdateCheckResult] = useState(null);
  const [releases, setReleases] = useState([]);
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);

  useEffect(() => {
    if (!show) {
      setPasswordInput("");
      setPasswordError(false);
      setUnlocked(false);
      setView("main");
      setUpdateCheckResult(null);
      setReleases([]);
      setUpdateProgress(null);
      setUpdateReady(false);
    }
  }, [show]);

  // Update event listeners
  useEffect(() => {
    if (!unlocked || view !== "updates" || !window.electronAPI) return;
    const removeProgress = window.electronAPI.onUpdateDownloadProgress?.((pct) => {
      setUpdateProgress(pct);
    });
    const removeDownloaded = window.electronAPI.onUpdateDownloaded?.(() => {
      setUpdateProgress(100);
      setUpdateReady(true);
    });
    return () => {
      try { removeProgress?.(); } catch {}
      try { removeDownloaded?.(); } catch {}
    };
  }, [unlocked, view]);

  const loadUpdateSettings = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      const [enabled, ver] = await Promise.all([
        window.electronAPI.getAutoUpdateEnabled?.(),
        window.electronAPI.getAppVersion?.(),
      ]);
      setAutoUpdateEnabled(enabled !== false);
      setCurrentVersion(ver || null);
    } catch {}
  }, []);

  const handleToggleAutoUpdate = async (val) => {
    setAutoUpdateEnabled(val);
    if (window.electronAPI?.setAutoUpdateEnabled) {
      await window.electronAPI.setAutoUpdateEnabled(val);
    }
    toast.success(val ? "Avto-yeniləmə aktiv edildi" : "Avto-yeniləmə söndürüldü");
  };

  const handleToggleManualUpdate = (val) => {
    setManualUpdateEnabled(val);
    localStorage.setItem("manualUpdateEnabled", val ? "true" : "false");
    window.dispatchEvent(new CustomEvent("manualUpdateEnabledChanged", { detail: val }));
    toast.success(val ? "Manual yeniləmə aktiv edildi" : "Manual yeniləmə söndürüldü");
  };

  const handleCheckNow = async () => {
    setUpdateCheckResult("checking");
    if (window.electronAPI?.checkForUpdatesNow) {
      await window.electronAPI.checkForUpdatesNow();
    }
    setTimeout(() => setUpdateCheckResult("done"), 3000);
  };

  const handleLoadReleases = async () => {
    setReleasesLoading(true);
    setReleases([]);
    try {
      const res = await window.electronAPI?.getGithubReleases?.();
      if (res?.ok && Array.isArray(res.data)) {
        setReleases(res.data.slice(0, 8));
      } else {
        toast.error("GitHub releaslər yüklənə bilmədi");
      }
    } catch {
      toast.error("GitHub-a qoşula bilmədi");
    } finally {
      setReleasesLoading(false);
    }
  };

  const handleInstallNow = async () => {
    if (window.electronAPI?.installUpdate) {
      await window.electronAPI.installUpdate();
    }
  };

  // Password numpad
  const handlePasswordKey = (digit) => {
    if (passwordInput.length >= 4) return;
    const next = passwordInput + digit;
    setPasswordInput(next);
    setPasswordError(false);
    if (next.length === 4) {
      if (next === SECRET_PASSWORD) {
        setUnlocked(true);
        setPasswordInput("");
      } else {
        setPasswordError(true);
        setTimeout(() => { setPasswordInput(""); setPasswordError(false); }, 700);
      }
    }
  };

  const handlePasswordBackspace = () => {
    setPasswordInput((p) => p.slice(0, -1));
    setPasswordError(false);
  };

  // WhatsApp
  const loadWhatsappSettings = useCallback(async () => {
    setWaLoading(true);
    try {
      const { data } = await apiConfig.get("/admin/whatsapp-settings");
      if (data?.ok) {
        setDenyActions(data.denyActions || []);
        setDenyPrefixes(data.denyPrefixes || []);
      }
    } catch {
      toast.error("WhatsApp ayarları yüklənə bilmədi");
    } finally {
      setWaLoading(false);
    }
  }, []);

  const toggleAction = (actionKey) => {
    if (actionKey.startsWith("prefix:")) {
      const prefix = actionKey.slice(7);
      setDenyPrefixes((prev) => prev.includes(prefix) ? prev.filter((p) => p !== prefix) : [...prev, prefix]);
    } else {
      setDenyActions((prev) => prev.includes(actionKey) ? prev.filter((a) => a !== actionKey) : [...prev, actionKey]);
    }
  };

  const handleSaveWhatsapp = async () => {
    setWaSaving(true);
    try {
      const { data } = await apiConfig.post("/admin/whatsapp-settings", { denyActions, denyPrefixes });
      if (data?.ok) { toast.success("WhatsApp ayarları saxlanıldı"); setView("main"); }
      else toast.error(data?.message || "Saxlama xətası");
    } catch { toast.error("WhatsApp ayarları saxlanıla bilmədi"); }
    finally { setWaSaving(false); }
  };

  const handleOpenDevtools = async () => {
    if (!window.electronAPI?.openDevToolsDetached) {
      toast.error("Bu funksiya yalnız desktop tətbiqində mövcuddur.");
      return;
    }
    const res = await window.electronAPI.openDevToolsDetached();
    if (res?.ok) toast.success("Developer Tools açıldı.");
    else toast.error(res?.message || "DevTools açıla bilmədi.");
    onClose();
  };

  const executeResetDatabase = async () => {
    setResettingDb(true);
    try {
      const { data } = await apiConfig.post("/admin/reset-local-database");
      if (data?.ok) {
        toast.success(data.message || "Baza sıfırlandı.");
        try { localStorage.removeItem("profile"); localStorage.removeItem("authResult"); localStorage.removeItem("authlogin"); } catch {}
        setView("main"); onClose(); window.location.reload();
      } else { toast.error(data?.message || "Sıfırlama alınmadı."); }
    } catch { toast.error("Serverə qoşula bilmədi."); }
    finally { setResettingDb(false); }
  };

  const handleModalHide = () => {
    if (view !== "main") { setView("main"); return; }
    onClose();
  };

  const headerTitle =
    view === "whatsapp" ? "WhatsApp mesajları" :
    view === "dbReset" ? "Databaseni sıfırla" :
    view === "updates" ? "Yeniləmələr" : "Ayarlar";

  return (
    <Modal
      show={show}
      onHide={handleModalHide}
      centered
      animation={false}
      dialogClassName={`custom-modal-width${view === "whatsapp" ? " pin-advanced-wa-wide" : ""}${view === "updates" ? " pin-advanced-updates-wide" : ""}`}
      contentClassName="custom-modal-content"
    >
      <div className="discount-modal-container">
        <div className="discount-header">
          <div className="header-left">
            <div className="header-icon">
              {view === "whatsapp" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              ) : view === "updates" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              )}
            </div>
            <span className="header-title">{headerTitle}</span>
          </div>
          <button type="button" className="close-btn" onClick={handleModalHide}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Şifrə ekranı ── */}
        {!unlocked ? (
          <div className="discount-body pin-adv-password-body">
            <p className="pin-adv-password-hint">Şifrəni daxil edin</p>
            <div className={`pin-adv-password-dots ${passwordError ? "pin-adv-password-error" : ""}`}>
              {[0,1,2,3].map(i => (
                <span key={i} className={`pin-adv-dot ${i < passwordInput.length ? "filled" : ""}`} />
              ))}
            </div>
            <div className="pin-adv-numpad">
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`pin-adv-numpad-btn${k === "" ? " invisible" : ""}${k === "⌫" ? " backspace" : ""}`}
                  onClick={() => k === "⌫" ? handlePasswordBackspace() : k !== "" ? handlePasswordKey(k) : null}
                  disabled={k === ""}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

        ) : view === "whatsapp" ? (
          <div className="discount-body wa-settings-body">
            {waLoading ? (
              <div className="wa-settings-loading">Yüklənir...</div>
            ) : (
              <>
                <p className="wa-settings-hint">Aktiv olan əməliyyatlar WhatsApp-a göndəriləcək.</p>
                <div className="wa-settings-list">
                  {ALL_ACTIONS.map((item) => {
                    const enabled = !isActionDenied(item.key, denyActions, denyPrefixes);
                    return (
                      <div key={item.key} className={`wa-settings-row ${enabled ? "wa-on" : "wa-off"}`} onClick={() => toggleAction(item.key)}>
                        <span className="wa-settings-label">{item.label}</span>
                        <div className={`wa-toggle ${enabled ? "wa-toggle-on" : ""}`}><div className="wa-toggle-thumb" /></div>
                      </div>
                    );
                  })}
                </div>
                <div className="wa-settings-actions">
                  <button type="button" className="delete-all-btn wa-settings-cancel" onClick={() => setView("main")} disabled={waSaving}>Geri</button>
                  <button type="button" className="apply-btn wa-settings-save" onClick={handleSaveWhatsapp} disabled={waSaving}>{waSaving ? "Saxlanılır..." : "Yadda saxla"}</button>
                </div>
              </>
            )}
          </div>

        ) : view === "dbReset" ? (
          <div className="discount-body pin-advanced-reset-confirm-body">
            <p className="pin-advanced-reset-confirm-text">
              Bütün lokal verilənlər bazası silinəcək.<strong> Bu geri qaytarılmır.</strong> Davam edək?
            </p>
            <div className="action-row pin-advanced-reset-confirm-actions">
              <button type="button" className="delete-all-btn" onClick={() => setView("main")} disabled={resettingDb}>İmtina</button>
              <button type="button" className="apply-btn" onClick={executeResetDatabase} disabled={resettingDb}>{resettingDb ? "Sıfırlanır..." : "Bəli, sıfırla"}</button>
            </div>
          </div>

        ) : view === "updates" ? (
          <div className="discount-body pin-adv-updates-body">
            {currentVersion && (
              <p className="pin-adv-current-version">Cari versiya: <strong>v{currentVersion}</strong></p>
            )}

            {/* Avto-yeniləmə toggle */}
            <div className="pin-adv-update-row">
              <div className="pin-adv-update-row-label">
                <i className="bi bi-arrow-repeat" /> Avto-yeniləmə
              </div>
              <div className={`wa-toggle ${autoUpdateEnabled ? "wa-toggle-on" : ""}`} onClick={() => handleToggleAutoUpdate(!autoUpdateEnabled)} style={{ cursor: "pointer" }}>
                <div className="wa-toggle-thumb" />
              </div>
            </div>

            {/* Manual yeniləmə toggle — avto söndükdə görünsün */}
            {!autoUpdateEnabled && (
              <div className="pin-adv-update-row">
                <div className="pin-adv-update-row-label">
                  <i className="bi bi-download" /> Manual yeniləmə
                </div>
                <div className={`wa-toggle ${manualUpdateEnabled ? "wa-toggle-on" : ""}`} onClick={() => handleToggleManualUpdate(!manualUpdateEnabled)} style={{ cursor: "pointer" }}>
                  <div className="wa-toggle-thumb" />
                </div>
              </div>
            )}

            {/* Manuel yoxla */}
            <button type="button" className="pin-adv-update-btn" onClick={handleCheckNow} disabled={updateCheckResult === "checking"}>
              <i className="bi bi-search" /> {updateCheckResult === "checking" ? "Yoxlanılır..." : "İndi yenilənmə yoxla"}
            </button>

            {/* Yüklənmə progress */}
            {updateProgress !== null && !updateReady && (
              <div className="pin-adv-update-progress">
                <div className="pin-adv-update-progress-bar" style={{ width: `${updateProgress}%` }} />
                <span>{updateProgress}%</span>
              </div>
            )}

            {/* Hazır olduqda quraşdır */}
            {updateReady && (
              <button type="button" className="pin-adv-update-btn success" onClick={handleInstallNow}>
                <i className="bi bi-download" /> Yeniləməni quraşdır və yenidən başlat
              </button>
            )}

            {/* Manuel release seçimi */}
            <div className="pin-adv-releases-section">
              <button type="button" className="pin-adv-update-btn secondary" onClick={handleLoadReleases} disabled={releasesLoading}>
                <i className="bi bi-github" /> {releasesLoading ? "Yüklənir..." : "GitHub releaslərini göstər"}
              </button>

              {releases.length > 0 && (
                <div className="pin-adv-releases-list">
                  {releases.map((r) => {
                    const exeAsset = r.assets?.find(a => a.name.endsWith(".exe"));
                    return (
                      <div key={r.id} className="pin-adv-release-row">
                        <div className="pin-adv-release-info">
                          <span className="pin-adv-release-tag">{r.tag_name}</span>
                          <span className="pin-adv-release-name">{r.name || r.tag_name}</span>
                          <span className="pin-adv-release-date">{new Date(r.published_at).toLocaleDateString("az-AZ")}</span>
                        </div>
                        <a
                          href={exeAsset?.browser_download_url || r.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="pin-adv-release-download-btn"
                          title="GitHub-dan yüklə"
                        >
                          <i className="bi bi-download" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        ) : (
          /* ── Əsas menyu ── */
          <div className="discount-body pin-advanced-settings-body">
            <div className="settings-menu-items pin-advanced-settings-items">

              <button type="button" className="settings-menu-item" onClick={() => { setView("updates"); loadUpdateSettings(); }}>
                <span className="settings-menu-item-icon" style={{ color: "#053796" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">Yeniləmələr</span>
              </button>

              <button type="button" className="settings-menu-item" onClick={() => { setView("whatsapp"); loadWhatsappSettings(); }}>
                <span className="settings-menu-item-icon" style={{ color: "#25D366" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">WhatsApp mesajları</span>
              </button>

              <button type="button" className="settings-menu-item danger" onClick={() => { onClose(); onExitTerminal?.(); }}>
                <span className="settings-menu-item-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" />
                    <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">Terminaldan çıx</span>
              </button>

              <button type="button" className="settings-menu-item danger" onClick={() => setView("dbReset")} disabled={resettingDb}>
                <span className="settings-menu-item-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">{resettingDb ? "Sıfırlanır..." : "Databaseni sıfırla"}</span>
              </button>

              <button type="button" className="settings-menu-item" onClick={handleOpenDevtools}>
                <span className="settings-menu-item-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">Devtools açmaq</span>
              </button>

            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PinAdvancedSettingsModal;
