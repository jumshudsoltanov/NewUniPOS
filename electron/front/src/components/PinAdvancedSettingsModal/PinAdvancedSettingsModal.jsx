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
import { t } from "../../utils/translations";

const WHATSAPP_NUMBER = "994775012507";

const DEFAULT_POS_RECEIPT_SETTINGS = {
  customer: { fontSizeOffset: 0, paperWidth: 80 },
  kitchen: { fontSizeOffset: 0, paperWidth: 80 },
  salesshift: { fontSizeOffset: 0, paperWidth: 80 },
  report: { fontSizeOffset: 0, paperWidth: 80 },
};

function normalizePosReceiptSettings(raw) {
  const cIn = raw?.customer && typeof raw.customer === "object" ? raw.customer : {};
  const kIn = raw?.kitchen && typeof raw.kitchen === "object" ? raw.kitchen : {};
  const sIn = raw?.salesshift && typeof raw.salesshift === "object" ? raw.salesshift : {};
  const rIn = raw?.report && typeof raw.report === "object" ? raw.report : {};
  return {
    customer: { ...DEFAULT_POS_RECEIPT_SETTINGS.customer, ...cIn },
    kitchen: { ...DEFAULT_POS_RECEIPT_SETTINGS.kitchen, ...kIn },
    salesshift: { ...DEFAULT_POS_RECEIPT_SETTINGS.salesshift, ...sIn },
    report: { ...DEFAULT_POS_RECEIPT_SETTINGS.report, ...rIn },
  };
}

const ALL_ACTIONS = [
  { key: "prefix:Yeni sifariş yaradıldı", label: t("yeni_cek_acildi") },
  { key: "Çek bağlandı", label: t("cek_baglandi") },
  { key: "Ödəniş edildi", label: t("odenis_edildi") },
  { key: "Ödənişsiz bağlandı", label: t("odenissiz_baglandi") },
  { key: "Qəbz kilidləndi", label: t("cek_kilidlendi") },
  { key: "Qəbz açıldı", label: t("cek_kilidi_acildi") },
  { key: "Çek yenidən açıldı", label: t("cek_yeniden_acildi") },
  { key: "Çek silindi", label: t("check_deleted") },
  { key: "Çeklər birləşdirildi", label: t("cekler_birlesdirildi") },
  { key: "Çek geri qaytarma", label: t("cek_geri_qaytarma") },
  { key: "Çek çap edildi", label: t("cek_cap_edildi") },
  { key: "Ön çap çıxarıldı", label: t("on_cap_cixarildi") },
  { key: "Qəbz təmizləndi", label: t("qebz_temizlendi") },
  { key: "Sifariş göndərildi", label: t("sifaris_gonderildi") },
  { key: "prefix:Məhsul əlavə edildi", label: t("mehsul_elave_edildi") },
  { key: "Məhsul silindi", label: t("mehsul_silindi") },
  { key: "Məhsullar silindi", label: t("mehsullar_silindi") },
  { key: "Məhsul köçürüldü", label: t("mehsul_kocuruldu") },
  { key: "Məhsul qəbul edildi", label: t("mehsul_qebul_edildi") },
  { key: "Məhsula endirim", label: t("mehsula_endirim") },
  { key: "Miqdar dəyişdirildi", label: t("miqdar_deyisdirildi") },
  { key: "Qiymət dəyişdirildi", label: t("qiymet_deyisdirildi") },
  { key: "Endirim dəyişildi", label: t("endirim_deyisildi") },
  { key: "Servis haqqı dəyişildi", label: t("servis_haqqi_deyisildi") },
  { key: "Masa dəyişildi", label: t("masa_deyisildi") },
  { key: "Satış növü dəyişildi", label: t("satis_novu_deyisildi") },
  { key: "Ofisiant dəyişildi", label: t("ofisiant_deyisildi") },
  { key: "Depozit dəyişildi", label: t("depozit_deyisildi") },
  { key: "Qonaq sayı dəyişdirildi", label: t("qonaq_sayi_deyisdirildi") },
  { key: "Şərh yazıldı", label: t("serh_yazildi") },
  { key: "Taymer başladıldı", label: t("taymer_basladildi") },
  { key: "Taymer dayandırıldı", label: t("taymer_dayandirildi") },
  { key: "Taymer sıfırlandı", label: t("taymer_sifirlandi") },
  { key: "prefix:Vergi ", label: t("vergi_emeliyyatlari") },
];

function isActionDenied(key, denyActions, denyPrefixes) {
  if (key.startsWith("prefix:")) {
    const prefix = key.slice(7);
    return denyPrefixes.includes(prefix);
  }
  return denyActions.includes(key);
}

const PinAdvancedSettingsModal = ({ show, onClose, onExitTerminal, profileId }) => {
  // WhatsApp verification
  const [waState, setWaState] = useState("idle"); // "idle" | "sending" | "entering" | "verified" | "error"
  const [waCode, setWaCode] = useState("");
  const [waError, setWaError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  // view: "main" | "settings" | "whatsapp" | "dbReset" | "updates" | "categoryView" | "receiptDesign" | "systemUsers"
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
  const [touchScrollEnabled, setTouchScrollEnabled] = useState(
    () => localStorage.getItem("pos_touch_scroll") === "true"
  );

  const [barcodeScanEnabled, setBarcodeScanEnabled] = useState(
    () => localStorage.getItem("pos_barcode_scan_enabled") === "true"
  );

  const [autoPaymentEnabled, setAutoPaymentEnabled] = useState(
    () => localStorage.getItem("pos_auto_payment_enabled") === "true"
  );

  const [kitchenPrintBlockEnabled, setKitchenPrintBlockEnabled] = useState(
    () => localStorage.getItem("pos_kitchen_print_block") === "true"
  );

  const [swipeGesturesEnabled, setSwipeGesturesEnabled] = useState(
    () => localStorage.getItem("pos_swipe_gestures_enabled") === "true"
  );

  const [aiModuleEnabled, setAiModuleEnabled] = useState(
    () => localStorage.getItem("pos_ai_module_enabled") === "true"
  );

  const [emptyCheckAutoDelete, setEmptyCheckAutoDelete] = useState(
    () => localStorage.getItem("pos_empty_check_auto_delete") !== "false"
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
       toast.error(t("geciken/xetali_cekler_yuklene_bilmedi"));
     } finally {
       setSyncTroubleshootLoading(false);
     }
  };

  const handleForceRemoteDelete = async () => {
      if (!remoteCheckId.trim()) return toast.warning(t("id_ve_ya_uuid_daxil_edin"));
      setForcingRemote(true);
      try {
         const { data } = await apiConfig.post("/sync/force-delete-remote", { remoteId: remoteCheckId.trim() });
         if (data?.success) {
            toast.success(data.message || t("baglanma_emri_gonderildi"));
            setRemoteCheckId("");
         } else {
            toast.error(data?.message || t("error_occurred"));
         }
      } catch (err) {
         toast.error(err?.response?.data?.message || err?.message || t("error_occurred"));
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
               toast.error(data?.message || t("error_occurred"));
           }
       } catch (err) {
           toast.error(err?.response?.data?.message || err?.message || t("serverle_elaqe_yaradila_bilmedi"));
       } finally {
           setAutoFixGhostsLoading(false);
       }
  };

  const handleRetrySync = async (uuid) => {
       try {
           const { data } = await apiConfig.post(`/sync/force-sync-order/${uuid}`);
           if (data.success) {
               toast.success(t("cek_yeniden_gonderildi"));
               loadStuckOrders();
           } else {
               toast.error(data.message || t("error_occurred"));
           }
       } catch (e) {
           toast.error(t("sebeke_xetasi"));
       }
   };

  const handleForceRetryAll = async () => {
       setSyncTroubleshootLoading(true);
       try {
           await apiConfig.post("/sync/force-now");
           toast.success(t("mecburi_sinxronizasiya_basladildi"));
           setTimeout(loadStuckOrders, 2000); // 2s saniyəlik gözləmə
       } catch (err) {
           toast.error(t("error_occurred"));
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
      setWaState("idle");
      setWaCode("");
      setWaError(false);
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
      setTouchScrollEnabled(localStorage.getItem("pos_touch_scroll") === "true");
      setAutoPaymentEnabled(localStorage.getItem("pos_auto_payment_enabled") === "true");
      setEmptyCheckAutoDelete(localStorage.getItem("pos_empty_check_auto_delete") !== "false");
      try {
        const savedReceipt = JSON.parse(localStorage.getItem("pos_receipt_settings"));
        if (savedReceipt) setReceiptSettings(normalizePosReceiptSettings(savedReceipt));
      } catch(e) {}
      // Send WhatsApp verification code on open
      if (profileId) {
        setWaState("sending");
        apiConfig.post("/pin/send-code", { profileId })
          .then(() => setWaState("entering"))
          .catch(() => {
            setWaState("error");
            toast.error(t("whatsapp_tesdiq_kodu_gonderilmedi"));
          });
      } else {
        setWaState("error");
        toast.error(t("profil_tapilmadi"));
      }
    }
  }, [show, profileId]);

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
    toast.success(val ? t("avto_yenileme_aktiv_edildi") : t("avto_yenileme_sonduruldu"));
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
        toast.error(t("github_releasler_yuklene_bilmedi"));
      }
    } catch {
      toast.error(t("githuba_qosula_bilmedi"));
    } finally {
      setReleasesLoading(false);
    }
  };

  const handleInstallNow = async () => {
    if (window.electronAPI?.installUpdate) {
      await window.electronAPI.installUpdate();
    }
  };

  // ─── WhatsApp verification helpers ──────────────────────────────────────
  const sendWaCode = useCallback(() => {
    if (!profileId) return;
    setWaState("sending");
    setWaCode("");
    setWaError(false);
    apiConfig.post("/pin/send-code", { profileId })
      .then(() => setWaState("entering"))
      .catch(() => {
        setWaState("error");
        toast.error(t("kod_gonderilmedi_1"));
      });
  }, [profileId]);

  const handleWaKey = (digit) => {
    if (waCode.length >= 4) return;
    const next = waCode + digit;
    setWaCode(next);
    setWaError(false);
    if (next.length === 4) {
      // Verify code
      apiConfig.post("/pin/verify-code", { profileId, code: next })
        .then(({ data }) => {
          if (data?.success) {
            setWaState("verified");
            setWaCode("");
            setTimeout(() => setUnlocked(true), 400);
          }
        })
        .catch((err) => {
          setWaError(true);
          const msg = err.response?.data?.message;
          if (msg) toast.error(msg);
          setTimeout(() => { setWaCode(""); setWaError(false); }, 700);
        });
    }
  };

  const handleWaBackspace = () => {
    setWaCode((p) => p.slice(0, -1));
    setWaError(false);
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
        toast.error("WhatsApp ayarları yüklənə bilmədi: " + (data?.message || t("namelum_xeta")));
      }
    } catch (err) {
      console.error("[WhatsApp Load]", err);
      toast.error("WhatsApp ayarları yüklənə bilmədi: " + (err?.response?.data?.message || err?.message || t("namelum_xeta")));
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
      if (data?.ok) { toast.success(t("whatsapp_ayarlari_saxlanildi")); setView("main"); }
      else toast.error(data?.message || t("saxlama_xetasi"));
    } catch (err) {
      console.error("[WhatsApp Save]", err);
      toast.error("WhatsApp ayarları saxlanıla bilmədi: " + (err?.response?.data?.message || err?.message || t("namelum_xeta")));
    }
    finally { setWaSaving(false); }
  };

  const loadSystemUsers = useCallback(async () => {
    if (!profileId) return;
    setSuLoading(true);
    try {
      const { data } = await apiConfig.get(`/admin/system-users?profile_id=${profileId}`);
      if (data?.ok) setSystemUsers(data.data || []);
      else toast.error(data?.message || t("i̇stifadeciler_yuklenmedi"));
    } catch (err) {
      toast.error("İstifadəçilər yüklənmədi: " + (err?.message || t("xeta")));
    } finally {
      setSuLoading(false);
    }
  }, [profileId]);

  const handleCreateUser = async () => {
    if (!suNewName.trim()) return toast.error(t("ad_daxil_edin"));
    if (!/^\d{4,6}$/.test(suNewPin)) return toast.error(t("pin_46_reqemli_olmalidir"));
    setSuSaving(true);
    try {
      const { data } = await apiConfig.post("/admin/system-users", {
        profile_id: profileId, name: suNewName.trim(), pin: suNewPin,
      });
      if (data?.ok) {
        toast.success(t("i̇stifadeci_yaradildi"));
        setSuNewName(""); setSuNewPin("");
        await loadSystemUsers();
      } else toast.error(data?.message || t("xeta"));
    } catch (err) {
      toast.error(err?.response?.data?.message || t("xeta"));
    } finally { setSuSaving(false); }
  };

  const handleUpdateUser = async (id) => {
    if (!suEditName.trim()) return toast.error(t("ad_daxil_edin"));
    if (suEditPin && !/^\d{4,6}$/.test(suEditPin)) return toast.error(t("pin_46_reqemli_olmalidir"));
    setSuSaving(true);
    try {
      const body = { name: suEditName.trim() };
      if (suEditPin) body.pin = suEditPin;
      const { data } = await apiConfig.put(`/admin/system-users/${id}`, body);
      if (data?.ok) {
        toast.success(t("yadda_saxlanildi"));
        setSuEditingId(null); setSuEditName(""); setSuEditPin("");
        await loadSystemUsers();
      } else toast.error(data?.message || t("xeta"));
    } catch (err) {
      toast.error(err?.response?.data?.message || t("xeta"));
    } finally { setSuSaving(false); }
  };

  const handleDeleteUser = async (id) => {
    setSuSaving(true);
    try {
      const { data } = await apiConfig.delete(`/admin/system-users/${id}`);
      if (data?.ok) { toast.success("Silindi"); await loadSystemUsers(); }
      else toast.error(data?.message || t("xeta"));
    } catch (err) {
      toast.error(t("silme_xetasi"));
    } finally { setSuSaving(false); }
  };

  const handleOpenDevtools = async () => {
    if (!window.electronAPI?.openDevToolsDetached) {
      toast.error(t("bu_funksiya_yalniz_desktop_tetbiqinde_movcuddur"));
      return;
    }
    const res = await window.electronAPI.openDevToolsDetached();
    if (res?.ok) toast.success(t("developer_tools_acildi"));
    else toast.error(res?.message || t("devtools_acila_bilmedi"));
    onClose();
  };

  const executeResetDatabase = async () => {
    setResettingDb(true);
    try {
      const { data } = await apiConfig.post("/admin/reset-local-database");
      if (data?.ok) {
        toast.success(data.message || t("baza_sifirlandi"));
        try { localStorage.removeItem("profile"); localStorage.removeItem("authResult"); localStorage.removeItem("authlogin"); } catch {}
        setView("main"); onClose(); window.location.reload();
      } else { toast.error(data?.message || t("sifirlama_alinmadi")); }
    } catch { toast.error(t("servere_qosula_bilmedi")); }
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
    toast.success(t("gorunus_ayarlari_saxlanildi"));
    setView("main");
  };

  const handleSaveTouchScroll = () => {
    localStorage.setItem("pos_touch_scroll", String(touchScrollEnabled));
    window.dispatchEvent(new CustomEvent("touchScrollSettingsChanged", {
      detail: { enabled: touchScrollEnabled }
    }));
    // Qlobal class tətbiq edirik
    if (touchScrollEnabled) document.body.classList.add("touch-scroll-active");
    else document.body.classList.remove("touch-scroll-active");
    
    toast.success(t("skrol_ayarlari_saxlanildi"));
    setView("main");
  };

  const handleSaveReceiptDesign = () => {
     localStorage.setItem("pos_receipt_settings", JSON.stringify(receiptSettings));
     toast.success(t("cek_dizayn_ayarlari_saxlanildi"));
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
      checkData: { id: "1024", customerName: "Əli Əliyev", customerPhone: "+994 55 555 55 55", customerAddress: "Bakı ş., Nizami küç. 15", startDate: new Date().toISOString(), endDate: new Date().toISOString(), waiter_name: "Zaur", guest_count: 2, sale_type_name: t("dine_in") },
      hallName: "Zal 1",
      tableName: "Masa 5",
      orderedItems: [
          { name: "Mərci Şorbası", quantity: 2, price: 4, modifiers: [] },
          { name: "Lülə Kabab", quantity: 1, price: 10, modifiers: [] },
          { name: "Kola 0.3", quantity: 2, price: 2, modifiers: [] }
      ]
  };

  const mockKitchenProps = {
      checkData: { id: "1024", customerName: "Əli Əliyev", guest_count: 3 },
      waiter: "Zaur",
      hallName: "Zal 1",
      table: "Masa 5",
      typeName: t("dine_in"),
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
    view === "touchScroll" ? "Skrol ayarları" :
    view === "settings" ? "Tənzimləmələr" :
    view === "syncCheck" ? "Sinroxnizasiya Diaqnostikası" : "Ayarlar";

  return (
    <Modal
      show={show}
      onHide={handleModalHide}
      centered
      animation={false}
      dialogClassName={`custom-modal-width${view === "whatsapp" ? " pin-advanced-wa-wide" : ""}${view === "updates" ? " pin-advanced-updates-wide" : ""}${view === "categoryView" || view === "settings" ? " pin-advanced-catview-wide" : ""}${view === "receiptDesign" ? " pin-advanced-receipt-wide" : ""}${view === "systemUsers" ? " pin-advanced-sysusers-wide" : ""}${view === "operationNames" ? " pin-advanced-opnames-wide" : ""}${view === "syncCheck" ? " pin-advanced-wa-wide" : ""}`}
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
              ) : view === "touchScroll" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
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

        {/* ── WhatsApp verification ── */}
        {!unlocked ? (
          <div className="discount-body pin-adv-password-body">
            {waState === "sending" && (
              <>
                <div className="wa-modal-spinner"></div>
                <p className="pin-adv-password-hint">{t("whatsapp_tesdiq_kodu_gonderilir")}</p>
              </>
            )}

            {waState === "entering" && (
              <>
                <p className="pin-adv-password-hint">{t("whatsapp_tesdiq_kodunu_daxil_edin")}</p>
                <div className={`pin-adv-password-dots ${waError ? "pin-adv-password-error" : ""}`}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <span key={i} className={`pin-adv-dot ${i < waCode.length ? "filled" : ""}`} />
                  ))}
                </div>
                <div className="pin-adv-numpad">
                  {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`pin-adv-numpad-btn${k === "" ? " invisible" : ""}${k === "⌫" ? " backspace" : ""}`}
                      onClick={() => k === "⌫" ? handleWaBackspace() : k !== "" ? handleWaKey(k) : null}
                      disabled={k === ""}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <button type="button" className="wa-modal-resend" onClick={sendWaCode}>{t("kod_gelmedi")}</button>
              </>
            )}

            {waState === "verified" && (
              <p className="pin-adv-password-hint" style={{ color: "#16a34a" }}>{t("✓_kod_tesdiqlendi_daxil_olunur")}</p>
            )}

            {waState === "error" && (
              <>
                <p className="pin-adv-password-hint" style={{ color: "#dc2626" }}>{t("kod_gonderilmedi")}</p>
                <button type="button" className="apply-btn" onClick={sendWaCode}
                  style={{ width: "auto", padding: "10px 24px", fontSize: "14px" }}>{t("yeniden_cehd_edin")}</button>
              </>
            )}
          </div>

        ) : view === "whatsapp" ? (
          <div className="discount-body wa-settings-body">
            {waLoading ? (
              <div className="wa-settings-loading">{t("loading")}</div>
            ) : (
              <>
                <p className="wa-settings-hint">{t("aktiv_olan_emeliyyatlar_whatsappa_gonderilecek")}</p>
                <div className="wa-settings-list">
                  <div
                    className={`wa-settings-row ${blockEmptyCheckDelete ? "wa-on" : "wa-off"}`}
                    onClick={() => setBlockEmptyCheckDelete(v => !v)}
                    style={{ cursor: "pointer", borderBottom: "2px solid #e5e7eb", marginBottom: 4 }}
                  >
                    <span className="wa-settings-label" style={{ pointerEvents: "none" }}>{t("bos_cek_silinende_bildiris_blokla")}</span>
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
                  <button type="button" className="delete-all-btn wa-settings-cancel" onClick={() => setView("main")} disabled={waSaving}>{t("back")}</button>
                  <button type="button" className="apply-btn wa-settings-save" onClick={handleSaveWhatsapp} disabled={waSaving}>{waSaving ? "Saxlanılır..." : "Yadda saxla"}</button>
                </div>
              </>
            )}
          </div>

        ) : view === "dbReset" ? (
          <div className="discount-body pin-advanced-reset-confirm-body">
            <p className="pin-advanced-reset-confirm-text">{t("butun_lokal_verilenler_bazasi_silinecek")}<strong>{t("bu_geri_qaytarilmir")}</strong>{t("davam_edek")}</p>
            <div className="action-row pin-advanced-reset-confirm-actions">
              <button type="button" className="delete-all-btn" onClick={() => setView("main")} disabled={resettingDb}>{t("i̇mtina")}</button>
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
                <i className="bi bi-arrow-repeat" />{t("avtoyenileme")}</div>
              <div className={`wa-toggle ${autoUpdateEnabled ? "wa-toggle-on" : ""}`} onClick={() => handleToggleAutoUpdate(!autoUpdateEnabled)} style={{ cursor: "pointer" }}>
                <div className="wa-toggle-thumb" />
              </div>
            </div>

            {/* Manual yeniləmə toggle — avto söndükdə görünsün */}
            {!autoUpdateEnabled && (
              <div className="pin-adv-update-row">
                <div className="pin-adv-update-row-label">
                  <i className="bi bi-download" />{t("manual_yenileme")}</div>
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
                <i className="bi bi-download" />{t("yenilemeni_qurasdir_ve_yeniden_baslat")}</button>
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
                          title={t("githubdan_yukle")}
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
            <p className="pin-adv-catview-hint">{t("kateqoriya_ve_mehsul_kartlarinin_gorunus_ayarlari")}</p>

            <div className="pin-adv-catview-section">
              <span className="pin-adv-catview-label">{t("sirada_nece_kart_gorsensin")}</span>
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
              <span className="pin-adv-catview-label">{t("kart_metn_olcusu")}</span>
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
                <span className="pin-adv-font-size-val" style={{ fontSize: `${cardFontSize}rem`, lineHeight: 1.3 }}>{t("numune_metn")}</span>
                <span className="pin-adv-font-size-num">{cardFontSize.toFixed(2)}rem</span>
              </div>
            </div>

            <div className="pin-adv-catview-section">
              <span className="pin-adv-catview-label">{t("mehsul_gorunusu")}</span>
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
                  <span>{t("siyahi")}</span>
                </button>
              </div>
            </div>

            <div className="pin-adv-catview-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="pin-adv-catview-label" style={{ marginBottom: 2 }}>{t("sekilleri_gizlet")}</span>
                  <div style={{ fontSize: "12px", color: "#888", marginTop: 2 }}>{t("kateqoriya_ve_mehsul_sekilleri_gorunmesin")}</div>
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
              <button type="button" className="delete-all-btn wa-settings-cancel" onClick={() => setView("main")}>{t("back")}</button>
              <button type="button" className="apply-btn wa-settings-save" onClick={handleSaveCategoryView}>{t("save")}</button>
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
                         style={{ flex: 1, justifyContent: "center", padding: "4px 2px", fontSize: "12px" }}
                      >{t("musteri_ceki")}</button>
                      <button
                         type="button"
                         className={`pin-adv-viewmode-btn ${receiptType === "kitchen" ? "active" : ""}`}
                         onClick={() => setReceiptType("kitchen")}
                         style={{ flex: 1, justifyContent: "center", padding: "4px 2px", fontSize: "12px" }}
                      >{t("metbex_ceki")}</button>
                      <button
                         type="button"
                         className={`pin-adv-viewmode-btn ${receiptType === "salesshift" ? "active" : ""}`}
                         onClick={() => setReceiptType("salesshift")}
                         style={{ flex: 1, justifyContent: "center", padding: "4px 2px", fontSize: "12px" }}
                      >{t("novbe")}</button>
                      <button
                         type="button"
                         className={`pin-adv-viewmode-btn ${receiptType === "report" ? "active" : ""}`}
                         onClick={() => setReceiptType("report")}
                         style={{ flex: 1, justifyContent: "center", padding: "4px 2px", fontSize: "12px" }}
                      >{t("hesabatlar")}</button>
                  </div>
                  
                  <div className="pin-adv-catview-section" style={{ padding: '10px', background: '#f5f7fa', borderRadius: '8px', marginBottom: '15px' }}>
                      <span className="pin-adv-catview-label" style={{ marginBottom: '8px' }}>{t("kagizin_eni")}</span>
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

                      <span className="pin-adv-catview-label" style={{ marginBottom: '8px', display: 'block' }}>{t("srift_ailesi")}</span>
                      <select
                          value={receiptSettings[receiptType]?.fontFamily || "'Consolas', 'Courier New', 'Lucida Console', monospace"}
                          onChange={e => updateReceiptSetting(receiptType, "fontFamily", e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb', marginBottom: '15px', fontSize: '13px' }}
                      >
                          <option value="'Consolas', 'Courier New', 'Lucida Console', monospace">{t("monospace_klassik_cek")}</option>
                          <option value="'Arial', 'Helvetica', sans-serif">{t("sansserif_muasir")}</option>
                          <option value="'Times New Roman', 'Georgia', serif">{t("serif_resmi")}</option>
                          <option value="'Roboto', sans-serif">Roboto</option>
                      </select>

                      {(receiptType === "customer" || receiptType === "kitchen") && (
                          <>
                              <span className="pin-adv-catview-label" style={{ marginBottom: '8px', display: 'block' }}>{t("alt_yazi_footer")}</span>
                              <input
                                  type="text"
                                  value={receiptSettings[receiptType]?.footerText ?? ""}
                                  placeholder={receiptType === "customer" ? "Təşəkkür edirik!" : "Mətbəxə uğurlar!"}
                                  onChange={e => updateReceiptSetting(receiptType, "footerText", e.target.value)}
                                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '13px', marginBottom: '15px' }}
                              />

                              <span className="pin-adv-catview-label" style={{ marginBottom: '8px', display: 'block' }}>{t("kenar_bosluqlar_px")}</span>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                  {[
                                      { key: 'paddingTop', label: t("ustden_↑") },
                                      { key: 'paddingBottom', label: 'Altdan ↓' },
                                      { key: 'paddingLeft', label: 'Soldan ←' },
                                      { key: 'paddingRight', label: t("sagdan_→") },
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
                          </>
                      )}
                  </div>

                  {(receiptType === "customer" || receiptType === "kitchen") && (
                      <div className="pin-adv-catview-label" style={{ marginTop: '10px', marginBottom: '10px' }}>{t("melumatlarin_gorunusu")}</div>
                  )}
                  
                  {receiptType === "customer" ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                         {[
                            { key: 'showLogo', label: 'Loqo' },
                            { key: 'showAddress', label: t("unvan_1") },
                            { key: 'showPhone', label: t("elaqe_nomresi") },
                            { key: 'showCheckNumber', label: t("cek_nomresi") },
                            { key: 'showCustomer', label: t("musteri_adi") },
                            { key: 'showCustomerPhone', label: t("musteri_telefonu") },
                            { key: 'showCustomerAddress', label: t("musteri_unvani") },
                            { key: 'showHallTable', label: 'Zal/Masa' },
                            { key: 'showDates', label: t("acilma/baglanma_tarixi") },
                            { key: 'showPrintDate', label: t("cap_tarixi") },
                            { key: 'showWaiter', label: t("waiter") },
                            { key: 'showGuestCount', label: t("qonaq_sayi") },
                            { key: 'showSaleType', label: t("satis_tipi") },
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
                  ) : receiptType === "kitchen" ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                         {[
                            { key: 'showWaiter', label: t("waiter") },
                            { key: 'showCheckNumber', label: t("cek_nomresi") },
                            { key: 'showHallTable', label: 'Zal/Masa' },
                            { key: 'showSaleType', label: t("satis_tipi") },
                            { key: 'showCustomer', label: t("musteri_adi") },
                            { key: 'showGuestCount', label: t("qonaq_sayi") },
                            { key: 'showHeaderDate', label: t("cap_tarixi") },
                         ].map(opt => (
                             <div key={opt.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               <span style={{ fontSize: '14px', fontWeight: '500', color: '#444' }}>{opt.label}</span>
                               <div className={`wa-toggle ${(receiptSettings.kitchen[opt.key] ?? (opt.key === 'showGuestCount' ? false : true)) ? 'wa-toggle-on' : ''}`} onClick={() => updateReceiptSetting('kitchen', opt.key, !(receiptSettings.kitchen[opt.key] ?? (opt.key === 'showGuestCount' ? false : true)))} style={{ cursor: 'pointer', pointerEvents: 'auto' }}>
                                  <div className="wa-toggle-thumb" />
                               </div>
                            </div>
                         ))}
                      </div>
                  ) : null}
                  </div>

                  <div className="wa-settings-actions" style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid #e5e7eb", flexShrink: 0 }}>
                     <button type="button" className="delete-all-btn wa-settings-cancel" onClick={() => setView("main")}>{t("back")}</button>
                     <button type="button" className="apply-btn wa-settings-save" onClick={handleSaveReceiptDesign}>{t("save")}</button>
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
                    ) : receiptType === "kitchen" ? (
                       <KitchenReceipt
                         key={`kr-${receiptSettings.kitchen?.fontSizeOffset ?? 0}-${receiptSettings.kitchen?.paperWidth ?? 80}-${receiptSettings.kitchen?.fontFamily ?? ""}`}
                         {...mockKitchenProps}
                         previewSettings={receiptSettings.kitchen}
                       />
                    ) : (
                       <div style={{ fontFamily: receiptSettings[receiptType]?.fontFamily || "'Consolas', 'Courier New', 'Lucida Console', monospace", fontSize: `${12 + (receiptSettings[receiptType]?.fontSizeOffset || 0)}px`, textAlign: 'center', padding: '10px' }}>
                          <h3 style={{ fontSize: `${14 + (receiptSettings[receiptType]?.fontSizeOffset || 0)}px` }}>{receiptType === "salesshift" ? "SATIŞ NÖVBƏSİ HESABATI" : "HESABAT"}</h3>
                          <div style={{ borderTop: "1px dashed #000", margin: "10px 0" }}></div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Açılış:</span> <span>10:00</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Bağlanma:</span> <span>22:00</span></div>
                          <div style={{ borderTop: "1px dashed #000", margin: "10px 0" }}></div>
                          <div>...</div>
                       </div>
                    )}
                 </div>
              </div>
           </div>

        ) : view === "systemUsers" ? (
          <div className="discount-body pin-adv-sysusers-body">
            {suLoading ? (
              <div className="wa-settings-loading">{t("loading")}</div>
            ) : (
              <>
                {/* Mövcud istifadəçilər */}
                <div className="su-list pin-invisible-scroll" style={{ maxHeight: "260px", overflowY: "auto", marginBottom: "16px" }}>
                  {systemUsers.length === 0 && (
                    <div style={{ textAlign: "center", color: "#aaa", padding: "20px 0", fontSize: "14px" }}>{t("hele_istifadeci_yoxdur")}</div>
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
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "10px" }}>{t("yeni_sistem_istifadecisi")}</div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <input
                      value={suNewName}
                      onChange={e => setSuNewName(e.target.value)}
                      placeholder={t("ad_mes_admin")}
                      style={{ flex: 1, padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px" }}
                    />
                    <input
                      value={suNewPin}
                      onChange={e => setSuNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder={t("pin_46_req")}
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
                  <button type="button" className="delete-all-btn wa-settings-cancel" onClick={() => setView("main")}>{t("back")}</button>
                </div>
              </>
            )}
          </div>

        ) : view === "operationNames" ? (
          <div className="discount-body pin-adv-opnames-body">
            <div className="pin-adv-opnames-hint">{t("emeliyyat_duymelerinin_adlarini_ozunuze_uygun_deyisdirin")}</div>
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
                        <button type="button" className="pin-adv-opname-reset-btn" title={t("sifirla")}
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
                onClick={() => { setOperationNames({ ...DEFAULT_OPERATION_NAMES }); localStorage.removeItem("pos_operation_names"); toast.success(t("sifirlandi")); }}>{t("reset_all")}</button>
              <button type="button" className="delete-all-btn wa-settings-cancel" onClick={() => setView("main")}>{t("back")}</button>
              <button type="button" className="apply-btn wa-settings-save"
                onClick={() => { localStorage.setItem("pos_operation_names", JSON.stringify(operationNames)); toast.success(t("emeliyyat_adlari_saxlanildi")); setView("main"); }}>{t("save")}</button>
            </div>
          </div>

        ) : view === "syncCheck" ? (
          <div className="discount-body pin-advanced-sync-body pin-invisible-scroll" style={{ maxHeight: "70vh", overflowY: "auto", padding: "10px" }}>
            <p className="wa-settings-hint" style={{ marginBottom: "20px", fontSize: "14px", color: "#555" }}>{t("sisteminizi_admin_panelle_sinxronizasiya_anomaliyalarindan_hem_geciken_hem_de_bos_qalan_ceklerden_tam_avtomatik_temizleyin")}</p>
            
            {/* Auto Fix Card */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
               <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                   <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#ebf4ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#053796" }}>
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                         <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                       </svg>
                   </div>
                   <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0, color: "#1e293b" }}>{t("tam_avtomatik_heller")}</h3>
               </div>
               <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "20px", lineHeight: 1.5 }}>{t("bu_funksiya_pos_sisteminizle_server_arasinda_ferqleri_her_iki_terefli_push/pull_yoxlayir_eger_serverde_sizde_olmayan_ghost_cekler_varsa_ve_ya_burada_gecikib_getmeyen_cekler_varsa_her_ikisini_eyni_anda_tapib_temizleyir")}</p>
               <button 
                  type="button" 
                  style={{ width: "100%", padding: "14px", fontSize: "15px", fontWeight: "600", color: "#fff", background: "linear-gradient(135deg, #053796, #2563eb)", border: "none", borderRadius: "8px", cursor: "pointer", transition: "opacity 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", opacity: autoFixGhostsLoading ? 0.7 : 1 }} 
                  onClick={handleAutoFixGhosts} 
                  disabled={autoFixGhostsLoading}
               >
                  {autoFixGhostsLoading ? (
                     <span>{t("avtomatik_analiz_edilir_ve_temizlenir")}</span>
                  ) : (
                     <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9-9a9 9 0 0 0-9 9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg>{t("butun_sistem_problemlerini_avtomatik_hell_et")}</>
                  )}
               </button>
            </div>

            {/* Local Stuck Orders Info */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                   <span style={{ fontSize: "15px", fontWeight: "600", color: "#334155" }}>{t("lokalda_olan_geciken/xetali_cekler")}<span style={{ background: "#e2e8f0", padding: "2px 8px", borderRadius: "12px", fontSize: "12px" }}>{stuckOrders.length}</span>
                   </span>
                   <button type="button" style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", border: "1px solid #cbd5e1", color: "#475569", borderRadius: "6px", background: "white", fontSize: "13px", fontWeight: "500", cursor: "pointer" }} onClick={loadStuckOrders} disabled={syncTroubleshootLoading}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={syncTroubleshootLoading ? "spin-icon" : ""}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.44l5.58 5.58"/></svg>{t("refresh")}</button>
                </div>
                
                {syncTroubleshootLoading ? (
                  <div style={{fontSize: "13px", color:"#64748b"}}>{t("melumatlar_yoxlanilir")}</div>
                ) : stuckOrders.length === 0 ? (
                  <div style={{fontSize: "14px", color:"#10b981", display: "flex", alignItems: "center", gap: "6px"}}>
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>{t("yerli_yaddasda_lengiyen_ve_ya_xetali_cek_yoxdur")}</div>
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
               <summary style={{ fontSize: "14px", fontWeight: "600", color: "#475569", cursor: "pointer", outline: "none", padding: "16px", background: "#f8fafc", userSelect: "none" }}>{t("🛠️_elle_mudaxile_cetin_hallar_ucundur")}</summary>
               <div style={{ padding: "20px", borderTop: "1px solid #e2e8f0" }}>
                 <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "15px", lineHeight: 1.5 }}>
                   Əgər avtomatik sistem nədənsə serveri təmizləyə bilməzsə (Server API xətası), Admin paneldən tapdığınız çek ID-sini (və ya UUID) məcburi bağlamaq/silmək üçün bura yazın.
                 </p>
                 <div style={{ display: "flex", gap: "10px" }}>
                     <input 
                        type="text" 
                        value={remoteCheckId}
                        onChange={e => setRemoteCheckId(e.target.value)}
                        placeholder={t("id_daxil_edin_mes_1682")}
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

        ) : view === "settings" ? (
          <div className="discount-body pin-adv-catview-body">
            <p className="pin-adv-catview-hint">{t("barkod_skaner_ve_diger_tenzimlemeler")}</p>

            <div className="pin-adv-catview-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="pin-adv-catview-label" style={{ marginBottom: 2 }}>Barkod skan</span>
                  <div style={{ fontSize: "12px", color: "#888", marginTop: 2 }}>{t("barkod_skaner_ile_mehsul_axtarisini_aktiv_et")}</div>
                </div>
                <div
                  className={`wa-toggle ${barcodeScanEnabled ? "wa-toggle-on" : ""}`}
                  onClick={() => {
                    const newVal = !barcodeScanEnabled;
                    setBarcodeScanEnabled(newVal);
                    localStorage.setItem("pos_barcode_scan_enabled", newVal ? "true" : "false");
                  }}
                  style={{ cursor: "pointer", flexShrink: 0 }}
                >
                  <div className="wa-toggle-thumb" />
                </div>
              </div>
            </div>

            <div className="pin-adv-catview-section" style={{ marginTop: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="pin-adv-catview-label" style={{ marginBottom: 2 }}>{t("metbex_printerine_blok")}</span>
                  <div style={{ fontSize: "12px", color: "#888", marginTop: 2 }}>{t("sifaris_ekraninda_metbexe_capi_bloklamaq_ucun_duymeni_goster")}</div>
                </div>
                <div
                  className={`wa-toggle ${kitchenPrintBlockEnabled ? "wa-toggle-on" : ""}`}
                  onClick={() => {
                    const newVal = !kitchenPrintBlockEnabled;
                    setKitchenPrintBlockEnabled(newVal);
                    localStorage.setItem("pos_kitchen_print_block", newVal ? "true" : "false");
                    window.dispatchEvent(new CustomEvent("kitchenPrintBlockChanged", { detail: newVal }));
                  }}
                  style={{ cursor: "pointer", flexShrink: 0 }}
                >
                  <div className="wa-toggle-thumb" />
                </div>
              </div>
            </div>

            <div className="pin-adv-catview-section" style={{ marginTop: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="pin-adv-catview-label" style={{ marginBottom: 2 }}>{t("surusdurme_swipe_hereketleri")}</span>
                  <div style={{ fontSize: "12px", color: "#888", marginTop: 2 }}>{t("sifaris_ekraninda_mehsulu_saga/sola_surusdurub_silmek_ve_ya_sayini_artirmaq")}</div>
                </div>
                <div
                  className={`wa-toggle ${swipeGesturesEnabled ? "wa-toggle-on" : ""}`}
                  onClick={() => {
                    const newVal = !swipeGesturesEnabled;
                    setSwipeGesturesEnabled(newVal);
                    localStorage.setItem("pos_swipe_gestures_enabled", newVal ? "true" : "false");
                    window.dispatchEvent(new CustomEvent("swipeGesturesChanged", { detail: newVal }));
                  }}
                  style={{ cursor: "pointer", flexShrink: 0 }}
                >
                  <div className="wa-toggle-thumb" />
                </div>
              </div>
            </div>

            <div className="pin-adv-catview-section" style={{ marginTop: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="pin-adv-catview-label" style={{ marginBottom: 2 }}>AI Modulu</span>
                  <div style={{ fontSize: "12px", color: "#888", marginTop: 2 }}>{t("sifaris_ekraninda_sesli_aygun_modulunu_aktiv_et")}</div>
                </div>
                <div
                  className={`wa-toggle ${aiModuleEnabled ? "wa-toggle-on" : ""}`}
                  onClick={() => {
                    const newVal = !aiModuleEnabled;
                    setAiModuleEnabled(newVal);
                    localStorage.setItem("pos_ai_module_enabled", newVal ? "true" : "false");
                    window.dispatchEvent(new CustomEvent("aiModuleChanged", { detail: newVal }));
                  }}
                  style={{ cursor: "pointer", flexShrink: 0 }}
                >
                  <div className="wa-toggle-thumb" />
                </div>
              </div>
            </div>

            {/* Boş çek avtomatik silmə */}
            <div className="pin-adv-catview-section" style={{ marginTop: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="pin-adv-catview-label" style={{ marginBottom: 2 }}>{t("bos_cek_avtomatik_silme")}</span>
                  <div style={{ fontSize: "12px", color: "#888", marginTop: 2 }}>{t("son_mehsul_silnende_bos_cek_ucun_tesdiq_modalini_goster")}</div>
                </div>
                <div
                  className={`wa-toggle ${emptyCheckAutoDelete ? "wa-toggle-on" : ""}`}
                  onClick={() => {
                    const newVal = !emptyCheckAutoDelete;
                    setEmptyCheckAutoDelete(newVal);
                    localStorage.setItem("pos_empty_check_auto_delete", newVal ? "true" : "false");
                    window.dispatchEvent(new CustomEvent("emptyCheckAutoDeleteChanged", { detail: newVal }));
                  }}
                  style={{ cursor: "pointer", flexShrink: 0 }}
                >
                  <div className="wa-toggle-thumb" />
                </div>
              </div>
            </div>

            {/* POS Blok Ödəniş Üsulu */}
            <div className="pin-adv-catview-section" style={{ marginTop: "10px" }}>
              <span className="pin-adv-catview-label" style={{ marginBottom: 6, display: "block" }}>{t("pos_blok_zamani_odenis_usulu")}</span>
              <div style={{ fontSize: "12px", color: "#888", marginBottom: 12, lineHeight: 1.4 }}>{t("pos_bloklananda_abunelik_bitdikde_odenis_usulunun_nece_secileceyini_teyin_edin")}</div>

              <div style={{ display: "flex", gap: 12 }}>
                {/* SuperAdmin seçimi */}
                <div
                  onClick={() => {
                    setAutoPaymentEnabled(false);
                    localStorage.setItem("pos_auto_payment_enabled", "false");
                  }}
                  style={{
                    flex: 1,
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: !autoPaymentEnabled ? "#eef2ff" : "#fff",
                    border: "1.5px solid",
                    borderColor: !autoPaymentEnabled ? "#053796" : "#e5e7eb",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    border: "2px solid",
                    borderColor: !autoPaymentEnabled ? "#053796" : "#d1d5db",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {!autoPaymentEnabled && (
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#053796" }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: !autoPaymentEnabled ? "#053796" : "#374151" }}>
                      SuperAdmin
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{t("admin_panelden")}</div>
                  </div>
                </div>

                {/* Avtomatik seçimi */}
                <div
                  onClick={() => {
                    setAutoPaymentEnabled(true);
                    localStorage.setItem("pos_auto_payment_enabled", "true");
                  }}
                  style={{
                    flex: 1,
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: autoPaymentEnabled ? "#eef2ff" : "#fff",
                    border: "1.5px solid",
                    borderColor: autoPaymentEnabled ? "#053796" : "#e5e7eb",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    border: "2px solid",
                    borderColor: autoPaymentEnabled ? "#053796" : "#d1d5db",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {autoPaymentEnabled && (
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#053796" }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: autoPaymentEnabled ? "#053796" : "#374151" }}>
                      Avtomatik
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{t("sistem_secsin")}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="wa-settings-actions" style={{ marginTop: "12px" }}>
              <button type="button" className="delete-all-btn wa-settings-cancel" onClick={() => setView("main")}>{t("back")}</button>
            </div>
          </div>

        ) : view === "touchScroll" ? (
          <div className="discount-body pin-adv-catview-body">
            <p className="pin-adv-catview-hint">{t("vakum_ve_toxunuslu_ekranlar_ucun_skrol_tenzimlemeleri")}</p>

            <div className="pin-adv-catview-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="pin-adv-catview-label" style={{ marginBottom: 2 }}>{t("gorunen_skrolbarlar")}</span>
                  <div style={{ fontSize: "12px", color: "#888", marginTop: 2 }}>{t("skrol_barlarini_hemise_gorunen_ve_daha_enli_et_vakum_ekranlar_ucun")}</div>
                </div>
                <div
                  className={`wa-toggle ${touchScrollEnabled ? "wa-toggle-on" : ""}`}
                  onClick={() => setTouchScrollEnabled(v => !v)}
                  style={{ cursor: "pointer", flexShrink: 0 }}
                >
                  <div className="wa-toggle-thumb" />
                </div>
              </div>
            </div>

            <div className="wa-settings-actions" style={{ marginTop: "16px" }}>
              <button type="button" className="delete-all-btn wa-settings-cancel" onClick={() => setView("main")}>{t("back")}</button>
              <button type="button" className="apply-btn wa-settings-save" onClick={handleSaveTouchScroll}>{t("save")}</button>
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
                <span className="settings-menu-item-label">{t("kateqoriya_gorunusu")}</span>
              </button>

              <button type="button" className="settings-menu-item" onClick={() => { setView("updates"); loadUpdateSettings(); }}>
                <span className="settings-menu-item-icon" style={{ color: "#053796" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">{t("yenilemeler")}</span>
              </button>

              <button type="button" className="settings-menu-item" onClick={() => setView("receiptDesign")}>
                <span className="settings-menu-item-icon" style={{ color: "#053796" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">{t("cek_dizayni")}</span>
              </button>

              <button type="button" className="settings-menu-item" onClick={() => { setView("whatsapp"); loadWhatsappSettings(); }}>
                <span className="settings-menu-item-icon" style={{ color: "#25D366" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">{t("whatsapp_mesajlari")}</span>
              </button>

              <button type="button" className="settings-menu-item" onClick={() => { setView("systemUsers"); loadSystemUsers(); }}>
                <span className="settings-menu-item-icon" style={{ color: "#053796" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">{t("sistem_istifadecileri")}</span>
              </button>

              <button type="button" className="settings-menu-item" onClick={() => setView("operationNames")}>
                <span className="settings-menu-item-icon" style={{ color: "#053796" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">{t("emeliyyat_adlari")}</span>
              </button>

              <button type="button" className="settings-menu-item" onClick={() => setView("settings")}>
                <span className="settings-menu-item-icon" style={{ color: "#053796" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">{t("tenzimlemeler")}</span>
              </button>

              <button type="button" className="settings-menu-item" onClick={() => setView("touchScroll")}>
                <span className="settings-menu-item-icon" style={{ color: "#053796" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </span>
                <span className="settings-menu-item-label">{t("skrol_ayarlari")}</span>
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
                <span className="settings-menu-item-label">{t("terminaldan_cix")}</span>
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
                <span className="settings-menu-item-label">{t("devtools_acmaq")}</span>
              </button>

            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PinAdvancedSettingsModal;
