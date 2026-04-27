import React, { useState, useEffect, useCallback, useRef } from "react";
import { Modal } from "react-bootstrap";
import { toast } from "sonner";
import "../DiscountModal/DiscountModal.css";
import "../SettingsMenu/SettingsMenu.css";
import "./PinAdvancedSettingsModal.css";
import apiConfig from "../../utils/apiConfig";
import CustomerReceipt from "../Receipt/CustomerReceipt";
import KitchenReceipt from "../Receipt/KitchenReceipt";
import { DEFAULT_OPERATION_NAMES } from "../Operations/OperationsModal";

const DEFAULT_SECRET_PASSWORD = "2507";

const DEFAULT_POS_RECEIPT_SETTINGS = {
  customer: { fontSizeOffset: 0, paperWidth: 80 },
  kitchen: { fontSizeOffset: 0, paperWidth: 80 },
};

function normalizePosReceiptSettings(raw) {
  const cIn = raw?.customer && typeof raw.customer === "object" ? raw.customer : {};
  const kIn = raw?.kitchen && typeof raw.kitchen === "object" ? raw.kitchen : {};
  return {
    customer: { ...DEFAULT_POS_RECEIPT_SETTINGS.customer, ...cIn },
    kitchen: { ...DEFAULT_POS_RECEIPT_SETTINGS.kitchen, ...kIn },
  };
}

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

const PinAdvancedSettingsModal = ({ show, onClose, onExitTerminal, profileId }) => {
  // Şifrə
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [secretPassword, setSecretPassword] = useState(DEFAULT_SECRET_PASSWORD);

  // view: "main" | "whatsapp" | "dbReset" | "updates" | "categoryView" | "receiptDesign" | "systemUsers" | "changePin"
  const [view, setView] = useState("main");

  // System Users
  const [systemUsers, setSystemUsers] = useState([]);
  const [suLoading, setSuLoading] = useState(false);
  const [suNewName, setSuNewName] = useState("");
  const [suNewPin, setSuNewPin] = useState("");
  const [suSaving, setSuSaving] = useState(false);
  const [suEditingId, setSuEditingId] = useState(null);
  const [suEditName, setSuEditName] = useState("");
  const [suEditPin, setSuEditPin] = useState("");

  // Change settings PIN
  const [cpNewPin, setCpNewPin] = useState("");
  const [cpConfirmPin, setCpConfirmPin] = useState("");
  const [cpSaving, setCpSaving] = useState(false);

  // Operation names
  const [operationNames, setOperationNames] = useState(() => {
    try { return { ...DEFAULT_OPERATION_NAMES, ...JSON.parse(localStorage.getItem("pos_operation_names") || "{}") }; }
    catch { return { ...DEFAULT_OPERATION_NAMES }; }
  });

  // Receipt Design settings
  const [receiptType, setReceiptType] = useState("customer"); // "customer" | "kitchen"
  const [receiptSettings, setReceiptSettings] = useState(() => {
     try {
       const saved = JSON.parse(localStorage.getItem("pos_receipt_settings"));
       return normalizePosReceiptSettings(saved || {});
     } catch(e) {
       return normalizePosReceiptSettings({});
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
  const [hideImages, setHideImages] = useState(
    () => localStorage.getItem("pos_hide_images") === "true"
  );

  const [resettingDb, setResettingDb] = useState(false);

  const [syncTroubleshootLoading, setSyncTroubleshootLoading] = useState(false);
  const [stuckOrders, setStuckOrders] = useState([]);
  const [remoteCheckId, setRemoteCheckId] = useState("");
  const [forcingRemote, setForcingRemote] = useState(false);
  const [autoFixGhostsLoading, setAutoFixGhostsLoading] = useState(false);

  const loadStuckOrders = async () => {
     setSyncTroubleshootLoading(true);
     try {
       const { data } = await apiConfig.get("/sync/pending-details");
       setStuckOrders(data?.orders || []);
     } catch (err) {
       toast.error("Gecikən/xətalı çeklər yüklənə bilmədi");
     } finally {
       setSyncTroubleshootLoading(false);
     }
  };

  const handleForceRemoteDelete = async () => {
      if (!remoteCheckId.trim()) return toast.warning("ID və ya UUID daxil edin");
      setForcingRemote(true);
      try {
         const { data } = await apiConfig.post("/sync/force-delete-remote", { remoteId: remoteCheckId.trim() });
         if (data?.success) {
            toast.success(data.message || "Bağlanma əmri göndərildi");
            setRemoteCheckId("");
         } else {
            toast.error(data?.message || "Xəta baş verdi");
         }
      } catch (err) {
         toast.error(err?.response?.data?.message || err?.message || "Xəta baş verdi");
      } finally {
         setForcingRemote(false);
      }
  };

  const handleAutoFixGhosts = async () => {
       setAutoFixGhostsLoading(true);
       try {
           const { data } = await apiConfig.post("/sync/auto-diagnose-ghosts");
           if (data?.success) {
               let msg = `Təmizləndi: ${data.fixedGhosts || 0} ghost çek ləğv edildi.`;
               if (data.stuckPushed) msg += ` ${data.stuckPushed} ədəd silinmiş çek serverə qaytarıldı.`;
               toast.success(msg);
               loadStuckOrders();
           } else {
               toast.error(data?.message || "Xəta baş verdi");
           }
       } catch (err) {
           toast.error(err?.response?.data?.message || err?.message || "Serverlə əlaqə yaradıla bilmədi.");
       } finally {
           setAutoFixGhostsLoading(false);
       }
  };

  const handleRetrySync = async (uuid) => {
       try {
           const { data } = await apiConfig.post(`/sync/force-sync-order/${uuid}`);
           if (data.success) {
               toast.success("Çek yenidən göndərildi");
               loadStuckOrders();
           } else {
               toast.error(data.message || "Xəta baş verdi");
           }
       } catch (e) {
           toast.error("Şəbəkə xətası");
       }
   };

  const handleForceRetryAll = async () => {
       setSyncTroubleshootLoading(true);
       try {
           await apiConfig.post("/sync/force-now");
           toast.success("Məcburi sinxronizasiya başladıldı");
           setTimeout(loadStuckOrders, 2000); // 2s saniyəlik gözləmə
       } catch (err) {
           toast.error("Xəta baş verdi");
           setSyncTroubleshootLoading(false);
       }
  };

  // WhatsApp
  const [waLoading, setWaLoading] = useState(false);
  const [waSaving, setWaSaving] = useState(false);
  const [denyActions, setDenyActions] = useState([]);
  const [denyPrefixes, setDenyPrefixes] = useState([]);
  const [blockEmptyCheckDelete, setBlockEmptyCheckDelete] = useState(false);

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
      setSystemUsers([]);
      setSuNewName(""); setSuNewPin("");
      setSuEditingId(null); setSuEditName(""); setSuEditPin("");
      setCpNewPin(""); setCpConfirmPin("");
    } else {
      try {
        const saved = JSON.parse(localStorage.getItem("pos_operation_names") || "{}");
        setOperationNames({ ...DEFAULT_OPERATION_NAMES, ...saved });
      } catch {}
      // Reload category view settings when modal opens
      setCardsPerRow(parseInt(localStorage.getItem("pos_cards_per_row") || "5", 10));
      setCardFontSize(parseFloat(localStorage.getItem("pos_card_font_size") || "0.8"));
      setProductViewMode(localStorage.getItem("pos_product_view_mode") || "card");
      setHideImages(localStorage.getItem("pos_hide_images") === "true");
      try {
        const savedReceipt = JSON.parse(localStorage.getItem("pos_receipt_settings"));
        if (savedReceipt) setReceiptSettings(normalizePosReceiptSettings(savedReceipt));
      } catch(e) {}
      // Load current settings PIN
      apiConfig.get("/admin/settings-pin").then(({ data }) => {
        if (data?.ok && data.pin) setSecretPassword(data.pin);
      }).catch(() => {});
    }
  }, [show]);

  useEffect(() => {
    if (view === "syncCheck") {
      loadStuckOrders();
    }
  }, [view]);

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
    if (passwordInput.length >= secretPassword.length) return;
    const next = passwordInput + digit;
    setPasswordInput(next);
    setPasswordError(false);
    if (next.length === secretPassword.length) {
      if (next === secretPassword) {
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
        setBlockEmptyCheckDelete(data.blockEmptyCheckDelete === true);
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
      const { data } = await apiConfig.post("/admin/whatsapp-settings", { denyActions, denyPrefixes, blockEmptyCheckDelete });
      if (data?.ok) { toast.success("WhatsApp ayarları saxlanıldı"); setView("main"); }
      else toast.error(data?.message || "Saxlama xətası");
    } catch (err) {
      console.error("[WhatsApp Save]", err);
      toast.error("WhatsApp ayarları saxlanıla bilmədi: " + (err?.response?.data?.message || err?.message || "Naməlum xəta"));
    }
    finally { setWaSaving(false); }
  };

  const loadSystemUsers = useCallback(async () => {
    if (!profileId) return;
    setSuLoading(true);
    try {
      const { data } = await apiConfig.get(`/admin/system-users?profile_id=${profileId}`);
      if (data?.ok) setSystemUsers(data.data || []);
      else toast.error(data?.message || "İstifadəçilər yüklənmədi");
    } catch (err) {
      toast.error("İstifadəçilər yüklənmədi: " + (err?.message || "Xəta"));
    } finally {
      setSuLoading(false);
    }
  }, [profileId]);

  const handleCreateUser = async () => {
    if (!suNewName.trim()) return toast.error("Ad daxil edin");
    if (!/^\d{4,6}$/.test(suNewPin)) return toast.error("PIN 4-6 rəqəmli olmalıdır");
    setSuSaving(true);
    try {
      const { data } = await apiConfig.post("/admin/system-users", {
        profile_id: profileId, name: suNewName.trim(), pin: suNewPin,
      });
      if (data?.ok) {
        toast.success("İstifadəçi yaradıldı");
        setSuNewName(""); setSuNewPin("");
        await loadSystemUsers();
      } else toast.error(data?.message || "Xəta");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Xəta");
    } finally { setSuSaving(false); }
  };

  const handleUpdateUser = async (id) => {
    if (!suEditName.trim()) return toast.error("Ad daxil edin");
    if (suEditPin && !/^\d{4,6}$/.test(suEditPin)) return toast.error("PIN 4-6 rəqəmli olmalıdır");
    setSuSaving(true);
    try {
      const body = { name: suEditName.trim() };
      if (suEditPin) body.pin = suEditPin;
      const { data } = await apiConfig.put(`/admin/system-users/${id}`, body);
      if (data?.ok) {
        toast.success("Yadda saxlanıldı");
        setSuEditingId(null); setSuEditName(""); setSuEditPin("");
        await loadSystemUsers();
      } else toast.error(data?.message || "Xəta");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Xəta");
    } finally { setSuSaving(false); }
  };

  const handleDeleteUser = async (id) => {
    setSuSaving(true);
    try {
      const { data } = await apiConfig.delete(`/admin/system-users/${id}`);
      if (data?.ok) { toast.success("Silindi"); await loadSystemUsers(); }
      else toast.error(data?.message || "Xəta");
    } catch (err) {
      toast.error("Silmə xətası");
    } finally { setSuSaving(false); }
  };

  const handleSaveSettingsPin = async () => {
    if (!/^\d{4,6}$/.test(cpNewPin)) return toast.error("Yeni PIN 4-6 rəqəmli olmalıdır");
    if (cpNewPin !== cpConfirmPin) return toast.error("PIN-lər uyğun gəlmir");
    setCpSaving(true);
    try {
      const { data } = await apiConfig.post("/admin/settings-pin", { pin: cpNewPin });
      if (data?.ok) {
        setSecretPassword(cpNewPin);
        toast.success("Şifrə dəyişdirildi");
        setCpNewPin(""); setCpConfirmPin("");
        setView("main");
      } else toast.error(data?.message || "Xəta");
    } catch (err) {
      toast.error("Şifrə dəyişdirilə bilmədi");
    } finally { setCpSaving(false); }
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
    localStorage.setItem("pos_hide_images", String(hideImages));
    window.dispatchEvent(new CustomEvent("categoryViewSettingsChanged", {
      detail: { cardsPerRow, cardFontSize, productViewMode, hideImages }
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
    view === "receiptDesign" ? "Çek dizaynı" :
    view === "systemUsers" ? "Sistem istifadəçiləri" :
    view === "operationNames" ? "Əməliyyat adları" : 
    view === "syncCheck" ? "Sinroxnizasiya Diaqnostikası" : "Ayarlar";

  return (
    <Modal
      show={show}
      onHide={handleModalHide}
      centered
      animation={false}
      dialogClassName={`custom-modal-width${view === "whatsapp" ? " pin-advanced-wa-wide" : ""}${view === "updates" ? " pin-advanced-updates-wide" : ""}${view === "categoryView" ? " pin-advanced-catview-wide" : ""}${view === "receiptDesign" ? " pin-advanced-receipt-wide" : ""}${view === "systemUsers" ? " pin-advanced-sysusers-wide" : ""}${view === "operationNames" ? " pin-advanced-opnames-wide" : ""}${view === "syncCheck" ? " pin-advanced-wa-wide" : ""}`}
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
              ) : view === "systemUsers" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              ) : view === "changePin" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  <circle cx="12" cy="16" r="1" fill="#053796" />
                </svg>
              ) : view === "operationNames" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
                </svg>
              ) : view === "syncCheck" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e01b24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9-9a9 9 0 0 0-9 9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
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
              {Array.from({ length: secretPassword.length }).map((_, i) => (
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
                  <div
                    className={`wa-settings-row ${blockEmptyCheckDelete ? "wa-on" : "wa-off"}`}
                    onClick={() => setBlockEmptyCheckDelete(v => !v)}
                    style={{ cursor: "pointer", borderBottom: "2px solid #e5e7eb", marginBottom: 4 }}
                  >
                    <span className="wa-settings-label" style={{ pointerEvents: "none" }}>
                      Boş çek silinəndə bildiriş blokla
                    </span>
                    <div className={`wa-toggle ${blockEmptyCheckDelete ? "wa-toggle-on" : ""}`} style={{ pointerEvents: "none" }}>
                      <div className="wa-toggle-thumb" />
                    </div>
                  </div>
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

            <div className="pin-adv-catview-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="pin-adv-catview-label" style={{ marginBottom: 2 }}>Şəkilləri gizlət</span>
                  <div style={{ fontSize: "12px", color: "#888", marginTop: 2 }}>Kateqoriya və məhsul şəkilləri görünməsin</div>
                </div>
                <div
                  className={`wa-toggle ${hideImages ? "wa-toggle-on" : ""}`}
                  onClick={() => setHideImages(v => !v)}
                  style={{ cursor: "pointer", flexShrink: 0 }}
                >
                  <div className="wa-toggle-thumb" />
                </div>
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
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '13px', marginBottom: '15px' }}
                      />

                      <span className="pin-adv-catview-label" style={{ marginBottom: '8px', display: 'block' }}>Kənar Boşluqlar (px)</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {[
                              { key: 'paddingTop', label: 'Üstdən ↑' },
                              { key: 'paddingBottom', label: 'Altdan ↓' },
                              { key: 'paddingLeft', label: 'Soldan ←' },
                              { key: 'paddingRight', label: 'Sağdan →' },
                          ].map(({ key, label }) => (
                              <div key={key}>
                                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>{label}</div>
                                  <input
                                      type="number"
                                      min="0"
                                      max="60"
                                      value={receiptSettings[receiptType]?.[key] ?? 0}
                                      onChange={e => updateReceiptSetting(receiptType, key, parseInt(e.target.value) || 0)}
                                      style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '13px', textAlign: 'center' }}
                                  />
                              </div>
                          ))}
                      </div>
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
                 <div
                   ref={previewRef}
                   className="pin-adv-receipt-preview-sandbox"
                   style={{
                     width: (receiptSettings[receiptType]?.paperWidth || 80) === 80 ? "310px" : "220px",
                     minHeight: "min-content",
                     backgroundColor: "#fff",
                     boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                     padding: "20px 10px",
                     transition: "width 0.3s ease, margin 0.3s ease",
                     borderRadius: "4px",
                     marginBottom: "20px",
                     fontSize: "initial",
                     lineHeight: "normal",
                   }}
                 >
                    {receiptType === "customer" ? (
                       <CustomerReceipt
                         key={`cr-${receiptSettings.customer?.fontSizeOffset ?? 0}-${receiptSettings.customer?.paperWidth ?? 80}-${receiptSettings.customer?.fontFamily ?? ""}`}
                         {...mockCustomerProps}
                         menuCatalog={[]}
                         previewSettings={receiptSettings.customer}
                       />
                    ) : (
                       <KitchenReceipt
                         key={`kr-${receiptSettings.kitchen?.fontSizeOffset ?? 0}-${receiptSettings.kitchen?.paperWidth ?? 80}-${receiptSettings.kitchen?.fontFamily ?? ""}`}
                         {...mockKitchenProps}
                         previewSettings={receiptSettings.kitchen}
                       />
                    )}
                 </div>
              </div>
           </div>

        ) : view === "systemUsers" ? (
          <div className="discount-body pin-adv-sysusers-body">
            {suLoading ? (
              <div className="wa-settings-loading">Yüklənir...</div>
            ) : (
              <>
                {/* Mövcud istifadəçilər */}
                <div className="su-list pin-invisible-scroll" style={{ maxHeight: "260px", overflowY: "auto", marginBottom: "16px" }}>
                  {systemUsers.length === 0 && (
                    <div style={{ textAlign: "center", color: "#aaa", padding: "20px 0", fontSize: "14px" }}>Hələ istifadəçi yoxdur</div>
                  )}
                  {systemUsers.map(u => (
                    <div key={u.id} className="su-row" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                      {suEditingId === u.id ? (
                        <>
                          <input
                            value={suEditName}
                            onChange={e => setSuEditName(e.target.value)}
                            placeholder="Ad"
                            style={{ flex: 1, padding: "6px 8px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px" }}
                          />
                          <input
                            value={suEditPin}
                            onChange={e => setSuEditPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="Yeni PIN"
                            style={{ width: "90px", padding: "6px 8px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", textAlign: "center" }}
                          />
                          <button type="button" onClick={() => handleUpdateUser(u.id)} disabled={suSaving}
                            style={{ padding: "6px 10px", borderRadius: "6px", border: "none", background: "#053796", color: "#fff", fontSize: "12px", cursor: "pointer" }}>
                            ✓
                          </button>
                          <button type="button" onClick={() => { setSuEditingId(null); setSuEditName(""); setSuEditPin(""); }}
                            style={{ padding: "6px 10px", borderRadius: "6px", border: "none", background: "#e5e7eb", color: "#333", fontSize: "12px", cursor: "pointer" }}>
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: "600", fontSize: "14px", color: "#1e293b" }}>{u.name}</div>
                            <div style={{ fontSize: "12px", color: "#94a3b8" }}>PIN: {"•".repeat(u.pin?.length || 4)}</div>
                          </div>
                          <button type="button" onClick={() => { setSuEditingId(u.id); setSuEditName(u.name); setSuEditPin(""); }}
                            style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#f1f5f9", color: "#053796", fontSize: "12px", cursor: "pointer" }}>
                            Düzəlt
                          </button>
                          <button type="button" onClick={() => handleDeleteUser(u.id)} disabled={suSaving}
                            style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#fee2e2", color: "#dc2626", fontSize: "12px", cursor: "pointer" }}>
                            Sil
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Yeni istifadəçi əlavə et */}
                <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "10px" }}>Yeni sistem istifadəçisi</div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <input
                      value={suNewName}
                      onChange={e => setSuNewName(e.target.value)}
                      placeholder="Ad (məs: Admin)"
                      style={{ flex: 1, padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px" }}
                    />
                    <input
                      value={suNewPin}
                      onChange={e => setSuNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="PIN (4-6 rəq.)"
                      style={{ width: "110px", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px", textAlign: "center" }}
                    />
                  </div>
                  <button type="button" onClick={handleCreateUser} disabled={suSaving || !suNewName.trim() || suNewPin.length < 4}
                    className="apply-btn"
                    style={{ width: "100%" }}>
                    {suSaving ? "Yaradılır..." : "Əlavə et"}
                  </button>
                </div>

                <div className="wa-settings-actions" style={{ marginTop: "12px" }}>
                  <button type="button" className="delete-all-btn wa-settings-cancel" onClick={() => setView("main")}>Geri</button>
                </div>
              </>
            )}
          </div>

        ) : view === "changePin" ? (
          <div className="discount-body pin-adv-changepin-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "20px 16px" }}>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0, textAlign: "center" }}>
              {cpNewPin.length < 4 ? "Yeni şifrəni daxil edin" : "Şifrəni təkrar daxil edin"}
            </p>

            <div className={`pin-adv-password-dots${cpNewPin.length >= 4 && cpConfirmPin.length === cpNewPin.length && cpConfirmPin !== cpNewPin ? " pin-adv-password-error" : ""}`} style={{ marginBottom: "4px" }}>
              {Array.from({ length: Math.max((cpNewPin.length < 4 ? cpNewPin : cpConfirmPin).length || 4, 4) }).map((_, i) => (
                <span key={i} className={`pin-adv-dot ${i < (cpNewPin.length < 4 ? cpNewPin : cpConfirmPin).length ? "filled" : ""}`} />
              ))}
            </div>

            {cpNewPin.length >= 4 && cpConfirmPin.length === cpNewPin.length && cpConfirmPin !== cpNewPin && (
              <div style={{ color: "#dc2626", fontSize: "12px", marginTop: "-8px" }}>Şifrələr uyğun gəlmir</div>
            )}

            <div className="pin-adv-numpad">
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`pin-adv-numpad-btn${k === "" ? " invisible" : ""}${k === "⌫" ? " backspace" : ""}`}
                  onClick={() => {
                    if (k === "⌫") {
                      if (cpNewPin.length < 4) setCpNewPin(p => p.slice(0, -1));
                      else setCpConfirmPin(p => p.slice(0, -1));
                    } else if (k !== "") {
                      if (cpNewPin.length < 4) { if (cpNewPin.length < 6) setCpNewPin(p => p + k); }
                      else { if (cpConfirmPin.length < 6) setCpConfirmPin(p => p + k); }
                    }
                  }}
                  disabled={k === "" || cpSaving}
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="wa-settings-actions" style={{ width: "100%", marginTop: "4px" }}>
              <button type="button" className="delete-all-btn wa-settings-cancel"
                onClick={() => { if (cpNewPin.length >= 4) { setCpNewPin(""); setCpConfirmPin(""); } else { setView("main"); } }}
                disabled={cpSaving}>
                {cpNewPin.length >= 4 ? "Geri" : "İmtina"}
              </button>
              <button type="button" className="apply-btn wa-settings-save"
                onClick={handleSaveSettingsPin}
                disabled={cpSaving || cpNewPin.length < 4 || cpConfirmPin.length < 4 || cpNewPin !== cpConfirmPin}>
                {cpSaving ? "Saxlanılır..." : "Şifrəni dəyiş"}
              </button>
            </div>
          </div>

        ) : view === "operationNames" ? (
          <div className="discount-body pin-adv-opnames-body">
            <div className="pin-adv-opnames-hint">Əməliyyat düymələrinin adlarını özünüzə uyğun dəyişdirin</div>
            <div className="pin-adv-opnames-grid pin-invisible-scroll">
              {Object.entries(DEFAULT_OPERATION_NAMES).map(([key, defaultLabel]) => {
                const isChanged = operationNames[key] && operationNames[key] !== defaultLabel;
                return (
                  <div key={key} className={`pin-adv-opname-card${isChanged ? " changed" : ""}`}>
                    <div className="pin-adv-opname-default">{defaultLabel}</div>
                    <div className="pin-adv-opname-input-wrap">
                      <input
                        value={operationNames[key] ?? defaultLabel}
                        onChange={e => setOperationNames(prev => ({ ...prev, [key]: e.target.value }))}
                        className="pin-adv-opname-input"
                        placeholder={defaultLabel}
                      />
                      {isChanged && (
                        <button type="button" className="pin-adv-opname-reset-btn" title="Sıfırla"
                          onClick={() => setOperationNames(prev => ({ ...prev, [key]: defaultLabel }))}>
                          ↺
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="wa-settings-actions" style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #f0f0f0" }}>
              <button type="button" className="delete-all-btn wa-settings-cancel"
                onClick={() => { setOperationNames({ ...DEFAULT_OPERATION_NAMES }); localStorage.removeItem("pos_operation_names"); toast.success("Sıfırlandı"); }}>
                Hamısını sıfırla
              </button>
              <button type="button" className="delete-all-btn wa-settings-cancel" onClick={() => setView("main")}>Geri</button>
              <button type="button" className="apply-btn wa-settings-save"
                onClick={() => { localStorage.setItem("pos_operation_names", JSON.stringify(operationNames)); toast.success("Əməliyyat adları saxlanıldı"); setView("main"); }}>
                Yadda saxla
              </button>
            </div>
          </div>

        ) : view === "syncCheck" ? (
          <div className="discount-body pin-advanced-sync-body pin-invisible-scroll" style={{ maxHeight: "70vh", overflowY: "auto", padding: "10px" }}>
            <p className="wa-settings-hint" style={{ marginBottom: "20px", fontSize: "14px", color: "#555" }}>
               Sisteminizi admin panellə sinxronizasiya anomaliyalarından (həm gecikən, həm də boş qalan çeklərdən) tam avtomatik təmizləyin.
            </p>
            
            {/* Auto Fix Card */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
               <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                   <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#ebf4ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#053796" }}>
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                         <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                       </svg>
                   </div>
                   <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0, color: "#1e293b" }}>Tam Avtomatik Həllər</h3>
               </div>
               <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "20px", lineHeight: 1.5 }}>
                 Bu funksiya POS sisteminizlə server arasında fərqləri hər iki tərəfli (Push/Pull) yoxlayır. Əgər serverdə sizdə olmayan "ghost" çeklər varsa, və ya burada gecikib getməyən çeklər varsa, hər ikisini eyni anda tapıb təmizləyir.
               </p>
               <button 
                  type="button" 
                  style={{ width: "100%", padding: "14px", fontSize: "15px", fontWeight: "600", color: "#fff", background: "linear-gradient(135deg, #053796, #2563eb)", border: "none", borderRadius: "8px", cursor: "pointer", transition: "opacity 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", opacity: autoFixGhostsLoading ? 0.7 : 1 }} 
                  onClick={handleAutoFixGhosts} 
                  disabled={autoFixGhostsLoading}
               >
                  {autoFixGhostsLoading ? (
                     <span>Avtomatik analiz edilir və təmizlənir...</span>
                  ) : (
                     <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9-9a9 9 0 0 0-9 9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg>
                        Bütün sistem problemlərini avtomatik həll et
                     </>
                  )}
               </button>
            </div>

            {/* Local Stuck Orders Info */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                   <span style={{ fontSize: "15px", fontWeight: "600", color: "#334155" }}>
                       Lokalda olan gecikən/xətalı çeklər <span style={{ background: "#e2e8f0", padding: "2px 8px", borderRadius: "12px", fontSize: "12px" }}>{stuckOrders.length}</span>
                   </span>
                   <button type="button" style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", border: "1px solid #cbd5e1", color: "#475569", borderRadius: "6px", background: "white", fontSize: "13px", fontWeight: "500", cursor: "pointer" }} onClick={loadStuckOrders} disabled={syncTroubleshootLoading}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={syncTroubleshootLoading ? "spin-icon" : ""}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.44l5.58 5.58"/></svg> Yenilə
                   </button>
                </div>
                
                {syncTroubleshootLoading ? (
                  <div style={{fontSize: "13px", color:"#64748b"}}>Məlumatlar yoxlanılır...</div>
                ) : stuckOrders.length === 0 ? (
                  <div style={{fontSize: "14px", color:"#10b981", display: "flex", alignItems: "center", gap: "6px"}}>
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                     Yerli yaddaşda ləngiyən və ya xətalı çek yoxdur.
                  </div>
                ) : (
                  <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }} className="pin-invisible-scroll">
                     {stuckOrders.map(o => (
                        <div key={o.uuid} style={{ padding: "12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", background: "white", color: "#334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                    <strong>UUID: <span style={{ fontWeight: "normal", color: "#64748b" }}>{o.uuid.split("-")[0]}...</span></strong>
                                    <span style={{ color: o.is_deleted ? '#ef4444' : o.status === 1 ? '#053796' : '#10b981', fontWeight: "600" }}>{o.is_deleted ? "Silinib" : o.status === 1 ? "Açıqdır" : o.status === 2 ? "Ödənilib" : "Bağlanıb"}</span>
                                </div>
                                <div style={{ color: "#64748b", fontSize: "12px", marginBottom: "4px" }}>Masa: {o.table_name || 'Yoxdur'} | Say: {o.item_count} | {new Date(o.updated_at).toLocaleString("az-AZ")}</div>
                                <div style={{ fontSize: "12px", color: o.is_synced === 2 ? '#f59e0b' : '#ef4444' }}>{o.is_synced === 2 ? "• Gecikdiği üçün atlanıb (v2)" : "• Sinxronizasiya xətası"}</div>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => handleRetrySync(o.uuid)}
                                style={{ marginLeft: "10px", padding: "8px 12px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "#053796" }}
                             >
                                Yenidən göndər
                             </button>
                        </div>
                     ))}
                  </div>
                )}
            </div>

            {/* Manual Edit Accordeon */}
            <details style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
               <summary style={{ fontSize: "14px", fontWeight: "600", color: "#475569", cursor: "pointer", outline: "none", padding: "16px", background: "#f8fafc", userSelect: "none" }}>
                  🛠️ Əllə müdaxilə (Çətin hallar üçündür)
               </summary>
               <div style={{ padding: "20px", borderTop: "1px solid #e2e8f0" }}>
                 <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "15px", lineHeight: 1.5 }}>
                   Əgər avtomatik sistem nədənsə serveri təmizləyə bilməzsə (Server API xətası), Admin paneldən tapdığınız çek ID-sini (və ya UUID) məcburi bağlamaq/silmək üçün bura yazın.
                 </p>
                 <div style={{ display: "flex", gap: "10px" }}>
                     <input 
                        type="text" 
                        value={remoteCheckId}
                        onChange={e => setRemoteCheckId(e.target.value)}
                        placeholder="ID daxil edin (məs: 1682)"
                        style={{ padding: "12px", border: "1px solid #cbd5e1", borderRadius: "8px", flex: 1, outline: "none", fontSize: "14px" }}
                        disabled={forcingRemote}
                     />
                     <button type="button" style={{ padding: "12px 20px", background: "#334155", color: "white", fontWeight: "600", border: "none", borderRadius: "8px", cursor: "pointer", transition: "0.2s" }} onClick={handleForceRemoteDelete} disabled={forcingRemote || !remoteCheckId.trim()}>
                        {forcingRemote ? "Gözləyin..." : "Məcburi Bağla"}
                     </button>
                 </div>
               </div>
            </details>

            <div className="wa-settings-actions" style={{ marginTop: "24px" }}>
              <button 
                type="button" 
                style={{ width: "100%", padding: "14px", fontSize: "15px", fontWeight: "600", color: "#475569", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "8px", cursor: "pointer" }}
                onClick={() => setView("main")}
              >
                Geri qayıt
              </button>
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

              <button type="button" className="settings-menu-item" onClick={() => { setView("systemUsers"); loadSystemUsers(); }}>
                <span className="settings-menu-item-icon" style={{ color: "#053796" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">Sistem istifadəçiləri</span>
              </button>

              <button type="button" className="settings-menu-item" onClick={() => setView("changePin")}>
                <span className="settings-menu-item-icon" style={{ color: "#053796" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">Şifrəni dəyiş</span>
              </button>

              <button type="button" className="settings-menu-item" onClick={() => setView("operationNames")}>
                <span className="settings-menu-item-icon" style={{ color: "#053796" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">Əməliyyat adları</span>
              </button>

              <button type="button" className="settings-menu-item" onClick={() => setView("syncCheck")}>
                <span className="settings-menu-item-icon" style={{ color: "#e01b24" }}>
                   <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9-9a9 9 0 0 0-9 9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                   </svg>
                </span>
                <span className="settings-menu-item-label" style={{ color: "#e01b24", fontWeight: "600" }}>Sync Diaqnostika</span>
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
