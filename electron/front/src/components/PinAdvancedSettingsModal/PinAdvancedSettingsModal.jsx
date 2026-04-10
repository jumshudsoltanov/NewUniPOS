import React, { useState, useEffect, useCallback, useRef } from "react";
import { Modal } from "react-bootstrap";
import { toast } from "sonner";
import "../DiscountModal/DiscountModal.css";
import "../SettingsMenu/SettingsMenu.css";
import "./PinAdvancedSettingsModal.css";
import apiConfig from "../../utils/apiConfig";
import CustomerReceipt from "../Receipt/CustomerReceipt";
import KitchenReceipt from "../Receipt/KitchenReceipt";

const SECRET_PASSWORD = "2507";

const ALL_ACTIONS = [
  { key: "prefix:Yeni sifariş yaradıldı", label: "Yeni çek açıldı" },
  { key: "Çek bağlandı", label: "Çek bağlandı" },
  { key: "Ödəniş edildi", label: "Ödəniş edildi" },
  { key: "Ödənişsiz bağlandı", label: "Ödənişsiz bağlandı" },
  { key: "Qəbz kilidləndi", label: "Çek kilidləndi" },
  { key: "Qəbz açıldı", label: "Çek kilidi açıldı" },
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

  // view: "main" | "whatsapp" | "dbReset" | "updates" | "categoryView" | "receiptDesign"
  const [view, setView] = useState("main");

  // Receipt Design settings
  const [receiptType, setReceiptType] = useState("customer"); // "customer" | "kitchen"
  const [receiptSettings, setReceiptSettings] = useState(() => {
     try {
       const saved = JSON.parse(localStorage.getItem("pos_receipt_settings"));
       return saved || {
         customer: { fontSizeOffset: 0, paperWidth: 80 },
         kitchen: { fontSizeOffset: 0, paperWidth: 80 }
       };
     } catch(e) {
       return { customer: { fontSizeOffset: 0, paperWidth: 80 }, kitchen: { fontSizeOffset: 0, paperWidth: 80 }};
     }
  });

  const previewRef = useRef(null);
  const [previewHeightPx, setPreviewHeightPx] = useState(0);

  useEffect(() => {
    if (view === "receiptDesign" && previewRef.current) {
      const observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
           setPreviewHeightPx(entry.contentRect.height);
        }
      });
      observer.observe(previewRef.current);
      return () => observer.disconnect();
    }
  }, [view, receiptType, receiptSettings]);

  // Category view settings
  const [cardsPerRow, setCardsPerRow] = useState(
    () => parseInt(localStorage.getItem("pos_cards_per_row") || "5", 10)
  );
  const [cardFontSize, setCardFontSize] = useState(
    () => parseFloat(localStorage.getItem("pos_card_font_size") || "0.8")
  );
  const [productViewMode, setProductViewMode] = useState(
    () => localStorage.getItem("pos_product_view_mode") || "card"
  );

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
      setDenyActions([]);
      setDenyPrefixes([]);
    } else {
      // Reload category view settings when modal opens
      setCardsPerRow(parseInt(localStorage.getItem("pos_cards_per_row") || "5", 10));
      setCardFontSize(parseFloat(localStorage.getItem("pos_card_font_size") || "0.8"));
      setProductViewMode(localStorage.getItem("pos_product_view_mode") || "card");
      try {
        const savedReceipt = JSON.parse(localStorage.getItem("pos_receipt_settings"));
        if (savedReceipt) setReceiptSettings(savedReceipt);
      } catch(e) {}
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
      } else {
        toast.error("WhatsApp ayarları yüklənə bilmədi: " + (data?.message || "Naməlum xəta"));
      }
    } catch (err) {
      console.error("[WhatsApp Load]", err);
      toast.error("WhatsApp ayarları yüklənə bilmədi: " + (err?.response?.data?.message || err?.message || "Naməlum xəta"));
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
    } catch (err) {
      console.error("[WhatsApp Save]", err);
      toast.error("WhatsApp ayarları saxlanıla bilmədi: " + (err?.response?.data?.message || err?.message || "Naməlum xəta"));
    }
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

  const handleSaveCategoryView = () => {
    localStorage.setItem("pos_cards_per_row", String(cardsPerRow));
    localStorage.setItem("pos_card_font_size", String(cardFontSize));
    localStorage.setItem("pos_product_view_mode", productViewMode);
    window.dispatchEvent(new CustomEvent("categoryViewSettingsChanged", {
      detail: { cardsPerRow, cardFontSize, productViewMode }
    }));
    toast.success("Görünüş ayarları saxlanıldı");
    setView("main");
  };

  const handleSaveReceiptDesign = () => {
     localStorage.setItem("pos_receipt_settings", JSON.stringify(receiptSettings));
     toast.success("Çek dizayn ayarları saxlanıldı");
     setView("main");
  };

  const updateReceiptSetting = (type, key, val) => {
      setReceiptSettings(prev => ({
          ...prev,
          [type]: {
              ...prev[type],
              [key]: val
          }
      }));
  };

  const mockCustomerProps = {
      profileData: { data: { profile: { restaurant_name: "Nümunə Restoran", address: "Bakı ş., Nümunə küç.", phone: "0123456789" }, terminal: { qr_on_check: 0 } } },
      checkData: { id: "1024", customerName: "Əli Əliyev", startDate: new Date().toISOString(), endDate: new Date().toISOString(), waiter_name: "Zaur", guest_count: 2, sale_type_name: "Restoranda" },
      hallName: "Zal 1",
      tableName: "Masa 5",
      orderedItems: [
          { name: "Mərci Şorbası", quantity: 2, price: 4, modifiers: [] },
          { name: "Lülə Kabab", quantity: 1, price: 10, modifiers: [] },
          { name: "Kola 0.3", quantity: 2, price: 2, modifiers: [] }
      ]
  };

  const mockKitchenProps = {
      checkData: { id: "1024", customerName: "Əli Əliyev" },
      waiter: "Zaur",
      hallName: "Zal 1",
      table: "Masa 5",
      typeName: "Restoranda",
      orderedItems: [
          { name: "Mərci Şorbası", quantity: 2 },
          { name: "Lülə Kabab", quantity: 1 }
      ]
  };

  const headerTitle =
    view === "whatsapp" ? "WhatsApp mesajları" :
    view === "dbReset" ? "Databaseni sıfırla" :
    view === "updates" ? "Yeniləmələr" :
    view === "categoryView" ? "Kateqoriya görünüşü" :
    view === "receiptDesign" ? "Çek dizaynı" : "Ayarlar";

  return (
    <Modal
      show={show}
      onHide={handleModalHide}
      centered
      animation={false}
      dialogClassName={`custom-modal-width${view === "whatsapp" ? " pin-advanced-wa-wide" : ""}${view === "updates" ? " pin-advanced-updates-wide" : ""}${view === "categoryView" ? " pin-advanced-catview-wide" : ""}${view === "receiptDesign" ? " pin-advanced-receipt-wide" : ""}`}
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
              ) : view === "categoryView" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              ) : view === "receiptDesign" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
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
                      <div key={item.key} className={`wa-settings-row ${enabled ? "wa-on" : "wa-off"}`} onClick={() => toggleAction(item.key)} style={{ cursor: "pointer" }}>
                        <span className="wa-settings-label" style={{ pointerEvents: "none" }}>{item.label}</span>
                        <div className={`wa-toggle ${enabled ? "wa-toggle-on" : ""}`} style={{ pointerEvents: "none" }}><div className="wa-toggle-thumb" /></div>
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

        ) : view === "categoryView" ? (
          <div className="discount-body pin-adv-catview-body">
            <p className="pin-adv-catview-hint">Kateqoriya və məhsul kartlarının görünüş ayarları</p>

            <div className="pin-adv-catview-section">
              <span className="pin-adv-catview-label">Sırada neçə kart görsənsin</span>
              <div className="pin-adv-cards-row-btns">
                {[3, 4, 5, 6, 7].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`pin-adv-cards-row-btn ${cardsPerRow === n ? "active" : ""}`}
                    onClick={() => setCardsPerRow(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="pin-adv-catview-section">
              <span className="pin-adv-catview-label">Kart mətn ölçüsü</span>
              <div className="pin-adv-font-slider-row">
                <span className="pin-adv-font-preview-small">A</span>
                <input
                  type="range"
                  min="0.55"
                  max="1.2"
                  step="0.05"
                  value={cardFontSize}
                  onChange={e => setCardFontSize(parseFloat(e.target.value))}
                  className="pin-adv-font-slider"
                />
                <span className="pin-adv-font-preview-big">A</span>
              </div>
              <div className="pin-adv-font-size-display">
                <span className="pin-adv-font-size-val" style={{ fontSize: `${cardFontSize}rem`, lineHeight: 1.3 }}>
                  Nümunə mətn
                </span>
                <span className="pin-adv-font-size-num">{cardFontSize.toFixed(2)}rem</span>
              </div>
            </div>

            <div className="pin-adv-catview-section">
              <span className="pin-adv-catview-label">Məhsul görünüşü</span>
              <div className="pin-adv-viewmode-btns">
                <button
                  type="button"
                  className={`pin-adv-viewmode-btn ${productViewMode === "card" ? "active" : ""}`}
                  onClick={() => setProductViewMode("card")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                  <span>Kart</span>
                </button>
                <button
                  type="button"
                  className={`pin-adv-viewmode-btn ${productViewMode === "list" ? "active" : ""}`}
                  onClick={() => setProductViewMode("list")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  <span>Siyahı</span>
                </button>
              </div>
            </div>

            <div className="wa-settings-actions" style={{ marginTop: "8px" }}>
              <button type="button" className="delete-all-btn wa-settings-cancel" onClick={() => setView("main")}>Geri</button>
              <button type="button" className="apply-btn wa-settings-save" onClick={handleSaveCategoryView}>Yadda saxla</button>
            </div>
          </div>

        ) : view === "receiptDesign" ? (
           <div className="discount-body pin-adv-receiptdesign-body" style={{ display: 'flex', gap: '20px', flexDirection: 'row', height: '68vh', minHeight: '500px' }}>
              <div className="receipt-settings-panel" style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingRight: '5px' }}>
                  <div className="pin-invisible-scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                      <div className="pin-adv-viewmode-btns" style={{ marginBottom: "15px" }}>
                      <button
                         type="button"
                         className={`pin-adv-viewmode-btn ${receiptType === "customer" ? "active" : ""}`}
                         onClick={() => setReceiptType("customer")}
                         style={{ flex: 1, justifyContent: "center" }}
                      >
                          Müştəri Çeki
                      </button>
                      <button
                         type="button"
                         className={`pin-adv-viewmode-btn ${receiptType === "kitchen" ? "active" : ""}`}
                         onClick={() => setReceiptType("kitchen")}
                         style={{ flex: 1, justifyContent: "center" }}
                      >
                          Mətbəx Çeki
                      </button>
                  </div>
                  
                  <div className="pin-adv-catview-section" style={{ padding: '10px', background: '#f5f7fa', borderRadius: '8px', marginBottom: '15px' }}>
                      <span className="pin-adv-catview-label" style={{ marginBottom: '8px' }}>Kağızın Eni</span>
                      <div className="pin-adv-viewmode-btns" style={{ marginBottom: "15px", height: '36px' }}>
                          <button
                             type="button"
                             className={`pin-adv-viewmode-btn ${(receiptSettings[receiptType]?.paperWidth || 80) === 80 ? "active" : ""}`}
                             onClick={() => updateReceiptSetting(receiptType, "paperWidth", 80)}
                             style={{ flex: 1, height: '100%', fontSize: '13px' }}
                          >
                              80mm
                          </button>
                          <button
                             type="button"
                             className={`pin-adv-viewmode-btn ${(receiptSettings[receiptType]?.paperWidth || 80) === 58 ? "active" : ""}`}
                             onClick={() => updateReceiptSetting(receiptType, "paperWidth", 58)}
                             style={{ flex: 1, height: '100%', fontSize: '13px' }}
                          >
                              58mm
                          </button>
                      </div>

                      <span className="pin-adv-catview-label" style={{ marginBottom: '8px' }}>Şrift Ölçüsü Tənzimləyici ({receiptSettings[receiptType]?.fontSizeOffset || 0})</span>
                      <input
                          type="range"
                          min="-5"
                          max="5"
                          step="1"
                          value={receiptSettings[receiptType]?.fontSizeOffset || 0}
                          onChange={e => updateReceiptSetting(receiptType, "fontSizeOffset", parseInt(e.target.value))}
                          className="pin-adv-font-slider"
                          style={{ marginBottom: '15px' }}
                      />

                      <span className="pin-adv-catview-label" style={{ marginBottom: '8px', display: 'block' }}>Şrift Ailəsi</span>
                      <select
                          value={receiptSettings[receiptType]?.fontFamily || "'Consolas', 'Courier New', 'Lucida Console', monospace"}
                          onChange={e => updateReceiptSetting(receiptType, "fontFamily", e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb', marginBottom: '15px', fontSize: '13px' }}
                      >
                          <option value="'Consolas', 'Courier New', 'Lucida Console', monospace">Monospace (Klassik Çek)</option>
                          <option value="'Arial', 'Helvetica', sans-serif">Sans-serif (Müasir)</option>
                          <option value="'Times New Roman', 'Georgia', serif">Serif (Rəsmi)</option>
                          <option value="'Roboto', sans-serif">Roboto</option>
                      </select>

                      <span className="pin-adv-catview-label" style={{ marginBottom: '8px', display: 'block' }}>Alt Yazı (Footer)</span>
                      <input
                          type="text"
                          value={receiptSettings[receiptType]?.footerText ?? ""}
                          placeholder={receiptType === "customer" ? "Təşəkkür edirik!" : "Mətbəxə uğurlar!"}
                          onChange={e => updateReceiptSetting(receiptType, "footerText", e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                      />
                  </div>

                  <div className="pin-adv-catview-label" style={{ marginTop: '10px', marginBottom: '10px' }}>Məlumatların Görünüşü</div>
                  
                  {receiptType === "customer" ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                         {[
                            { key: 'showLogo', label: 'Loqo' },
                            { key: 'showAddress', label: 'Ünvan' },
                            { key: 'showPhone', label: 'Əlaqə nömrəsi' },
                            { key: 'showCheckNumber', label: 'Çek Nömrəsi' },
                            { key: 'showCustomer', label: 'Müştəri Adı' },
                            { key: 'showHallTable', label: 'Zal/Masa' },
                            { key: 'showDates', label: 'Açılma/Bağlanma Tarixi' },
                            { key: 'showPrintDate', label: 'Çap Tarixi' },
                            { key: 'showWaiter', label: 'Ofisiant' },
                            { key: 'showGuestCount', label: 'Qonaq Sayı' },
                            { key: 'showSaleType', label: 'Satış Tipi' },
                            { key: 'showQrCode', label: 'QR Kod' },
                         ].map(opt => (
                            <div key={opt.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               <span style={{ fontSize: '14px', fontWeight: '500', color: '#444' }}>{opt.label}</span>
                               <div className={`wa-toggle ${(receiptSettings.customer[opt.key] ?? true) ? 'wa-toggle-on' : ''}`} onClick={() => updateReceiptSetting('customer', opt.key, !(receiptSettings.customer[opt.key] ?? true))} style={{ cursor: 'pointer', pointerEvents: 'auto' }}>
                                  <div className="wa-toggle-thumb" />
                               </div>
                            </div>
                         ))}
                      </div>
                  ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                         {[
                            { key: 'showWaiter', label: 'Ofisiant' },
                            { key: 'showCheckNumber', label: 'Çek Nömrəsi' },
                            { key: 'showHallTable', label: 'Zal/Masa' },
                            { key: 'showSaleType', label: 'Satış Tipi' },
                            { key: 'showCustomer', label: 'Müştəri Adı' },
                            { key: 'showHeaderDate', label: 'Çap Tarixi' },
                         ].map(opt => (
                             <div key={opt.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               <span style={{ fontSize: '14px', fontWeight: '500', color: '#444' }}>{opt.label}</span>
                               <div className={`wa-toggle ${(receiptSettings.kitchen[opt.key] ?? true) ? 'wa-toggle-on' : ''}`} onClick={() => updateReceiptSetting('kitchen', opt.key, !(receiptSettings.kitchen[opt.key] ?? true))} style={{ cursor: 'pointer', pointerEvents: 'auto' }}>
                                  <div className="wa-toggle-thumb" />
                               </div>
                            </div>
                         ))}
                      </div>
                  )}
                  </div>

                  <div className="wa-settings-actions" style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid #e5e7eb", flexShrink: 0 }}>
                     <button type="button" className="delete-all-btn wa-settings-cancel" onClick={() => setView("main")}>Geri</button>
                     <button type="button" className="apply-btn wa-settings-save" onClick={handleSaveReceiptDesign}>Yadda saxla</button>
                  </div>
              </div>

              <div className="receipt-preview-panel pin-invisible-scroll" style={{ flex: 1, border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#e9ecef', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
                 <div style={{ padding: '8px 12px', background: '#053796', color: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: '600', marginBottom: '15px' }}>
                     Cari Çek Ölçüsü: {(receiptSettings[receiptType]?.paperWidth || 80) === 80 ? '80mm' : '58mm'} ⨉ Təxmini {previewHeightPx ? (((previewHeightPx / ((receiptSettings[receiptType]?.paperWidth || 80) === 80 ? 310 : 210)) * (receiptSettings[receiptType]?.paperWidth || 80)) / 10).toFixed(1) : 0} cm
                 </div>
                 <div ref={previewRef} style={{ width: (receiptSettings[receiptType]?.paperWidth || 80) === 80 ? '310px' : '220px', minHeight: 'min-content', backgroundColor: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', padding: '20px 10px', transition: 'width 0.3s ease, margin 0.3s ease', borderRadius: '4px', marginBottom: '20px' }}>
                    {receiptType === "customer" ? (
                       <CustomerReceipt {...mockCustomerProps} previewSettings={receiptSettings.customer} />
                    ) : (
                       <KitchenReceipt {...mockKitchenProps} previewSettings={receiptSettings.kitchen} />
                    )}
                 </div>
              </div>
           </div>

        ) : (
          /* ── Əsas menyu ── */
          <div className="discount-body pin-advanced-settings-body">
            <div className="settings-menu-items pin-advanced-settings-items pin-invisible-scroll" style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '0' }}>

              <button type="button" className="settings-menu-item" onClick={() => setView("categoryView")}>
                <span className="settings-menu-item-icon" style={{ color: "#053796" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">Kateqoriya görünüşü</span>
              </button>

              <button type="button" className="settings-menu-item" onClick={() => { setView("updates"); loadUpdateSettings(); }}>
                <span className="settings-menu-item-icon" style={{ color: "#053796" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">Yeniləmələr</span>
              </button>

              <button type="button" className="settings-menu-item" onClick={() => setView("receiptDesign")}>
                <span className="settings-menu-item-icon" style={{ color: "#053796" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">Çek dizaynı</span>
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
