import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./App.css";
import Pin from "./components/Pin/Pin";
import Header from "./components/Header/Header";
import CustomerModal from "./components/Customers-Modal/CustomersModal";
import { useDispatch, useSelector, useStore } from "react-redux";
import { useEffect, useRef, useState } from "react";
import { authPos, setLoginData } from "./redux/Slices/LoginSlice";
import { savePrintersToStorage, resolveAndPrintKitchenReceiptLocally } from "./utils/printerHelpers.jsx";
import { fetchCustomersFromAdmin, fetchCustomerGroupsFromAdmin } from "./redux/Slices/CustomersSlice";
import { updateSyncStatus, resetSyncedBadge, updateConnectivity, updateSocketStatus } from "./redux/Slices/SyncSlice";
import { getTableGroups } from "./redux/Slices/TablesSlice";
import { getActiveOrders } from "./redux/Slices/BooksSlice";
import { menuWithCategories, menuWithGeneralCategories, updateProductModifierGroups } from "./redux/Slices/MenuSlice";
import { tickTimer as tickBooks } from "./redux/Slices/BooksSlice";
import { tickTablesThunk as tickTables } from "./redux/Slices/TablesSlice";
import { setTimerMenuData } from "./utils/orderHourlyPrice";
import { setMenuDataForLineTotals } from "./utils/orderItemLineTotal";
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Login from "./components/Login/Login";
import Layout from "./components/Layout/Layout";
import PinBackground from "./assets/images/PinContainerImagesDefault.jpg";
import uniposLogo from "./assets/images/unipos_logo.png";
import Toastify from "./components/Toastify/Toastify";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./components/Toastify/Toastify.css";
import { lazy, Suspense } from "react";
import NetworkOverlay from "./components/NetworkOverlay/NetworkOverlay";
import BlockPage from "./components/BlockPage/BlockPage";

// Ağır ekranlar (yüzlərlə/minlərlə sətir) — startup zamanı hamısını bir yerdə
// parse etmək zəif komplarda açılışı yavaşladırdığı üçün lazy chunk-lara
// bölünür; Check üçün preloadCheck() artıq bu chunk-ı arxa planda əvvəlcədən
// yükləyir (masaya klikləyəndə gecikmə hiss olunmasın deyə)
const Tables = lazy(() => import("./components/Tables/Tables"));
const Checks = lazy(() => import("./components/Checks/Checks"));
const Check = lazy(() => import("./components/Check/Check"));
const CheckOver = lazy(() => import("./components/CheckOver/CheckOver"));
const Settings = lazy(() => import("./components/Settings/Settings"));
const Rooms = lazy(() => import("./components/Rooms/Rooms"));
const CustomerDisplay = lazy(() => import('./components/CustomerDisplay/CustomerDisplay'));
const KitchenDisplay = lazy(() => import('./components/Kitchen/KitchenDisplay'));
const RefreshSyncWindow = lazy(() => import('./components/RefreshLoader/RefreshSyncWindow'));
import { initNetwork, getSocket, onSocketStatusChange } from "./utils/apiConfig";
import { preloadCheck } from "./utils/preloadCheck";
import { isPaymentExpired, isPosBlocked } from "./utils/dateHelpers";
import { mergeBlockedLoginPayload } from "./utils/authResultMerge";
import { addNotification } from "./utils/notificationService";
import { toast } from "react-toastify";
import { usePosIdleToPin } from "./hooks/usePosIdleToPin";
import { hasAnyLiveTimer } from "./utils/liveOrderTimerData";
import { startCheckReminderTicker } from "./utils/checkReminders";
import SplitTableSelect from "./components/SlpitOrderModa/SplitTableSelect";
import {
  configureQrOrderManager,
  startQrOrders,
} from "./utils/qrOrderManager";
import { disconnectQrSocket } from "./utils/qrSocket";
import { installGlobalClickSound } from "./utils/clickSound";

function AppContent() {
  const dispatch = useDispatch();
  const store = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isDisplayRoute = location.pathname.startsWith('/customer') ||
    location.pathname.startsWith('/kitchen') ||
    location.pathname.startsWith('/kds') ||
    location.pathname.startsWith('/refresh-sync');

  const authResultRedux = useSelector((state) => state.LoginSlice.loginedProfileData);

  /* İki ayrı POS instansı üçün kassa printer seçimi: main proses `--unipos-instance=...` */
  useEffect(() => {
    (async () => {
      try {
        if (window.electronAPI?.getUniposInstance) {
          const label = await window.electronAPI.getUniposInstance();
          sessionStorage.setItem("unipos_instance_label", label && String(label).trim() ? String(label).trim() : "default");
        } else {
          sessionStorage.setItem("unipos_instance_label", "default");
        }
      } catch {
        sessionStorage.setItem("unipos_instance_label", "default");
      }
    })();
  }, []);

  /* Vakum/Touch skrol tənzimləməsi */
  useEffect(() => {
    const applyTouchScroll = (enabled) => {
      if (enabled) document.body.classList.add("touch-scroll-active");
      else document.body.classList.remove("touch-scroll-active");
    };

    // İlkin yükləmə
    const isEnabled = localStorage.getItem("pos_touch_scroll") === "true";
    applyTouchScroll(isEnabled);

    // Dinamik dəyişiklikləri dinləyirik
    const handleChanged = (e) => applyTouchScroll(e.detail.enabled);
    window.addEventListener("touchScrollSettingsChanged", handleChanged);
    
    return () => window.removeEventListener("touchScrollSettingsChanged", handleChanged);
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onModifierGroupsUpdated) return;
    window.electronAPI.onModifierGroupsUpdated(({ productId, modifier_groups }) => {
      dispatch(updateProductModifierGroups({ productId, modifier_groups }));
    });
  }, []);
  
  const menuData = useSelector((state) => state.OrderSlice?.menu || state.MenuSlice?.data);

  useEffect(() => {
    setTimerMenuData(menuData);
    setMenuDataForLineTotals(menuData);
  }, [menuData]);

  // Refs - re-render olmadan state saxlamaq üçün
  const initStarted = useRef(false);
  const [showInitialLoading, setShowInitialLoading] = useState(!isDisplayRoute);

  usePosIdleToPin({ disabled: isDisplayRoute || showInitialLoading });

  /* Düymə səsi — sənədə bir dinləyici qoşulur, komponentlərə toxunulmur.
     Müştəri/mətbəx ekranlarında lazım deyil. Bax: utils/clickSound.js */
  useEffect(() => {
    if (isDisplayRoute) return;
    return installGlobalClickSound();
  }, [isDisplayRoute]);

  /* ───────────────── QR SİFARİŞLƏRİ ─────────────────
     Socket buluda qoşulur, gələn sifariş profilin rejiminə görə ya birbaşa
     masaya yazılır (direct), ya da bildirişlər bölməsinə düşür (manual).
     Bax: QR_ORDER_POS_PLAN.md */
  const { menuDataWithCategories } = useSelector((state) => state.MenuSlice);
  const booksForQr = useSelector((state) => state.BooksSlice?.books);
  const loginedWaiterForQr = useSelector((state) => state.WaitersSlice?.loginedWaiter);
  const [qrTablePicker, setQrTablePicker] = useState(null); // { resolve } | null

  // Redux dəyərlərini ref-də saxlayırıq ki, socket işləyicisi həmişə ƏN SON
  // vəziyyəti görsün və effekt hər dəyişiklikdə yenidən qoşulmasın
  const qrStateRef = useRef({});
  qrStateRef.current = {
    profile: authResultRedux?.data?.profile,
    books: booksForQr,
    loginedWaiter: loginedWaiterForQr,
    menu: menuData,
    menuWithCategories: menuDataWithCategories,
  };

  useEffect(() => {
    if (isDisplayRoute || showInitialLoading) return;
    const profile = authResultRedux?.data?.profile;
    if (!profile?.id) return;

    // Hər iki rejim sönülüdürsə heç nə qurulmur: nə kontekst, nə socket.
    // Buluda boş-boşuna qoşulmağın mənası yoxdur — gələn sifariş onsuz da
    // rədd edilərdi, qoşulma isə hər 2-30 saniyədə yenidən cəhd edir.
    const qrEnabled =
      Number(profile.is_qr_order_direct) === 1 ||
      Number(profile.is_qr_order_manual) === 1;
    if (!qrEnabled) return;

    configureQrOrderManager({
      getProfile: () => qrStateRef.current.profile || {},
      getActiveOrders: () => {
        const b = qrStateRef.current.books;
        return Array.isArray(b) ? b : b?.data || [];
      },
      // `manual` rejimdə çek təsdiqləyən ofisiantın adına yazılır
      getLoginedWaiter: () => {
        const w = qrStateRef.current.loginedWaiter;
        const d = w?.data || w;
        return d?.id ? { id: Number(d.id), name: d.name || "" } : null;
      },
      getMenuCatalog: () => qrStateRef.current.menu || [],
      getMenuWithCategories: () => qrStateRef.current.menuWithCategories || null,
      requestTable: (order) =>
        new Promise((resolve) => setQrTablePicker({ order, resolve })),
      onOrdersChanged: () => {
        const pid = qrStateRef.current.profile?.id;
        if (!pid) return;
        dispatch(getTableGroups(pid));
        dispatch(getActiveOrders({ profileId: pid, silentRefresh: true }));
      },
    });

    startQrOrders();
    return () => disconnectQrSocket();
    // Rejim bayraqları da asılılıqdadır: tənzimləmələrdən QR qəbulu açılanda
    // socket proqramı yenidən başlatmadan qoşulsun (və söndürüləndə kəsilsin)
  }, [
    isDisplayRoute,
    showInitialLoading,
    authResultRedux?.data?.profile?.id,
    authResultRedux?.data?.profile?.is_qr_order_direct,
    authResultRedux?.data?.profile?.is_qr_order_manual,
    dispatch,
  ]);

  // Arxa planda blok yoxlaması — POS-u yormadan periodik olaraq serverdən yoxlayır
  // Yalnız is_pos_block dəyişəndə və ya abunəlik bitəndə /blocked-ə yönləndirir
  useEffect(() => {
    if (showInitialLoading) return;
    if (isDisplayRoute) return;

    // Lokal (keşdən) blok yoxlaması — anında, şəbəkə gözləmədən
    const checkLocalBlock = () => {
      const path = (location.pathname || "").replace(/^#/, "");
      if (path === "/blocked") return;
      const authResult = authResultRedux?.data ? authResultRedux : (() => {
        try { return JSON.parse(localStorage.getItem("authResult")); } catch { return null; }
      })();
      const profile = authResult?.data?.profile;
      if (!profile) return;
      if (isPosBlocked(profile?.is_pos_block) || (profile?.next_payment_date && isPaymentExpired(profile.next_payment_date))) {
        navigate("/blocked", { replace: true });
      }
    };

    // Arxa planda serverdən blok yoxlaması — POS-u yormadan sessiz yoxlayır
    const backgroundBlockCheck = async () => {
      const path = (location.pathname || "").replace(/^#/, "");
      if (path === "/blocked") return;
      try {
        let storageData = JSON.parse(localStorage.getItem("profile"));
        if (!storageData) return;
        const data = await dispatch(authPos(storageData)).unwrap();
        localStorage.setItem("authResult", JSON.stringify(data));
        const profile = data?.data?.profile;
        if (profile && (isPosBlocked(profile?.is_pos_block) || (profile?.next_payment_date && isPaymentExpired(profile.next_payment_date)))) {
          navigate("/blocked", { replace: true });
        }
      } catch (err) {
        // Server xətası — POS-u bloklama, sadəcə lokal keşdən yoxla
        if (err?.data?.isBlocked) {
          let prevSnapshot = null;
          try {
            prevSnapshot = JSON.parse(localStorage.getItem("authResult"));
          } catch { /* nəzərə alınmır */ }
          const merged = mergeBlockedLoginPayload(err.data, prevSnapshot);
          localStorage.setItem("authResult", JSON.stringify(merged));
          dispatch(setLoginData(merged));
          navigate("/blocked", { replace: true });
        }
      }
    };

    // İlkin lokal yoxlama
    checkLocalBlock();

    // Hər 5 dəqiqədən bir arxa planda serverdən yoxla (300000ms = 5 dəq)
    const blockCheckInterval = setInterval(backgroundBlockCheck, 5 * 60 * 1000);

    return () => clearInterval(blockCheckInterval);
  }, [showInitialLoading, dispatch, navigate, location.pathname, authResultRedux]);

  useEffect(() => {
    if (isDisplayRoute) return;
    if (window.electronAPI && window.electronAPI.onBackendLog) {
      window.electronAPI.onBackendLog(() => {});
    }

    // Connectivity and Sync Polling
    // Bir dəfəlik uğursuz internet yoxlaması (keçici gecikmə) dərhal ikonu
    // "offline" göstərməsin deyə — yalnız 2 ardıcıl uğursuzluqdan sonra
    // offline elan edilir; uğur isə həmişə dərhal əks olunur (sürətli bərpa)
    const offlineStrikesRef = { current: 0 };
    const handleConnectivity = () => {
      const isOnline = navigator.onLine;
      // If browser says offline, skip the async check — instant response
      if (!isOnline) {
        offlineStrikesRef.current = 0;
        dispatch(updateConnectivity({ isOnline: false, hasInternet: false }));
        return;
      }
      if (window.electronAPI && window.electronAPI.checkInternet) {
        window.electronAPI.checkInternet().then(hasInternet => {
          if (hasInternet) {
            offlineStrikesRef.current = 0;
            dispatch(updateConnectivity({ isOnline, hasInternet: true }));
          } else {
            offlineStrikesRef.current += 1;
            if (offlineStrikesRef.current >= 2) {
              dispatch(updateConnectivity({ isOnline, hasInternet: false }));
            }
          }
        }).catch(() => {
          offlineStrikesRef.current += 1;
          if (offlineStrikesRef.current >= 2) {
            dispatch(updateConnectivity({ isOnline, hasInternet: false }));
          }
        });
      } else {
        dispatch(updateConnectivity({ isOnline, hasInternet: true }));
      }
    };

    const fetchSyncCount = () => {
      if (window.electronAPI && window.electronAPI.getSyncStatus) {
        window.electronAPI.getSyncStatus().then(st => {
          dispatch(updateSyncStatus({
            pendingCount: st.pendingCount || 0,
            syncedCount: st.syncedCount || 0
          }));
        }).catch(console.error);
      }
    };

    const checkSocket = () => {
      const socket = getSocket();
      dispatch(updateSocketStatus(socket?.connected || false));
    };

    // Real-time socket status via events (instant, no polling delay)
    onSocketStatusChange((connected) => {
      dispatch(updateSocketStatus(connected));
    });

    window.addEventListener("online", handleConnectivity);
    window.addEventListener("offline", handleConnectivity);

    handleConnectivity();
    fetchSyncCount();
    checkSocket();

    const connInt = setInterval(handleConnectivity, 10000);
    const syncInt = setInterval(fetchSyncCount, 8000);
    const socketInt = setInterval(checkSocket, 5000);
    // PERFORMANS: əvvəl bu iki action şərtsiz olaraq hər saniyə dispatch olunurdu.
    // Redux-da hər dispatch mount olunmuş BÜTÜN komponentlərin bütün selektorlarını
    // yenidən işlədir, yəni saatlıq hesablaşma işlənməyən obyektdə belə POS boş
    // yerə saniyədə iki tam yenidən qiymətləndirmə dövrü keçirirdi.
    // İndi yalnız real işləyən taymer olduqda dispatch edilir; yoxdursa yoxlama
    // keşlənmiş olduğu üçün praktiki olaraq sıfır xərclidir.
    const timerInt = setInterval(() => {
      if (!hasAnyLiveTimer(store.getState())) return;
      dispatch(tickBooks());
      dispatch(tickTables());
    }, 1000);
    // Çek xatırlatmaları (başlıqdakı saat → dəqiqə) — vaxtı bitəni bildirişə salır
    const stopReminderTicker = startCheckReminderTicker();
 
    return () => {
      window.removeEventListener("online", handleConnectivity);
      window.removeEventListener("offline", handleConnectivity);
      clearInterval(connInt);
      clearInterval(syncInt);
      clearInterval(socketInt);
      clearInterval(timerInt);
      stopReminderTicker();
    };
  }, [dispatch, store]);

  // Mərkəzi printer Master-dadır: Master print_delegated dinləyib özündə çap edir (Slave göndərir)
  const isMasterTerminal = authResultRedux?.data?.terminal?.is_master === 1 || authResultRedux?.data?.profile?.is_master === 1;

  const _isSocketConnected = useSelector((state) => state.SyncSlice.isSocketConnected);

  useEffect(() => {
    if (isDisplayRoute) return;
    const socket = getSocket();
    const shouldListenToDelegatedPrints = isMasterTerminal;

    if (!socket) return;

    if (shouldListenToDelegatedPrints && window.electronAPI?.printReceipt) {
      console.warn("[MASTER] Mərkəzi çap dinləyicisi aktiv (Slave-dən gələn çap)");

      const handleDelegatedPrint = async (data) => {
        if (data.isRawDelegation) {
          console.warn("🖨️ Mərkəzi mətbəx çapı Master tərəfindən həll edilir:", data.printerName);
          try {
            await resolveAndPrintKitchenReceiptLocally(data.html, data.printerName, data.rawPrinters, data.orderData, true, data.printerId);
          } catch (e) {
            console.error("Master resolving delegated kitchen print failed:", e);
            setTimeout(() => toast.error("Slave-dən gələn mətbəx çapı uğursuz oldu"), 0);
          }
          return;
        }

        console.warn("🖨️ Mərkəzi çap qəbul edildi:", data.printerName);
        try {
          const result = await window.electronAPI.printReceipt(data);
          if (!result?.success) {
            console.error("Delegated print failed:", result?.error);
            setTimeout(() => toast.error(`Çap xətası: ${result?.error || "Naməlum"}`), 0);
          }
        } catch (e) {
          console.error("Delegated print execution failed:", e);
          setTimeout(() => toast.error("Slave-dən gələn çap uğursuz oldu"), 0);
        }
      };

      socket.off("print_delegated");
      socket.on("print_delegated", handleDelegatedPrint);

      socket.on("kitchen_item_ready", (data) => {
        console.warn("🍳 Kitchen Item Ready:", data);
        setTimeout(() => {
          addNotification(
            `${data.tableName} - ${data.productName} HAZIRDIR!`,
            "Məhsul mətbəxdə tamamlandı və servis üçün hazırdır.",
            { type: "success", category: "order", orderId: data.orderId, displayId: `#${data.orderId}` }
          );
          toast.success(`${data.tableName}: ${data.productName} hazırdır!`, {
            icon: '🍳',
            autoClose: 5000
          });
        }, 0);
      });

      return () => {
        socket.off("print_delegated", handleDelegatedPrint);
        socket.off("kitchen_item_ready");
      };
    }
  // isSocketConnected burada dependency deyil — socket.off()+socket.on() cütlüyü
  // artıq listener duplikatını önləyir. isSocketConnected-in buraya daxil edilməsi
  // hər socket reconnect-ında effect-i yenidən işlədib ikinci listener əlavə edirdi.
  }, [isMasterTerminal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pin yeniləmə: digər terminal (Master/Slave) yeniləyəndə bu terminal da məlumatı yeniləsin
  useEffect(() => {
    if (isDisplayRoute) return;
    const socket = getSocket();
    if (!socket) return;
    const authResult = authResultRedux?.data ? authResultRedux : (() => {
      try { return JSON.parse(localStorage.getItem("authResult")); } catch { return null; }
    })();
    const myProfileId = authResult?.data?.profile?.id;
    /**
     * Açılışdan dərhal sonra gələn `pin_refresh` atılır.
     *
     * Backend öz sinxronizasiyasını bitirəndə bu hadisəni yayımlayır. Pin
     * səhifəsi həmin dörd sorğunu (masalar, açıq çeklər, menyu, ümumi menyu —
     * cəmi 141 KB) onsuz da göndərir; ikisi üst-üstə düşəndə eyni dəst İKİ
     * DƏFƏ çəkilir, hər dəfə JSON analizi və React yenidən render-i ilə.
     *
     * Pəncərə QƏSDƏN QISADIR. Yalnız yarış halını tutur: `pin_refresh` ilk
     * yükləmə ilə eyni anda gələndə. Uzun pəncərə (əvvəl 8 saniyə idi) real
     * yeniləməni udardı — backend sinxronizasiyanı tez bitirsə, gecə admin
     * paneldə dəyişən qiymətlər səhər POS-da görünməzdi. Ölçmə: ilk yükləmə
     * ~0.3 s, sinxronizasiyanın `pin_refresh`-i ~9 s, yəni normalda toqquşma
     * onsuz da olmur.
     */
    const BASLANGIC_SUSDURMA_MS = 3000;
    const acilisVaxti = Date.now();
    const handlePinRefresh = (data) => {
      const profileId = data?.profileId;
      if (!profileId || profileId !== myProfileId) return;
      if (Date.now() - acilisVaxti < BASLANGIC_SUSDURMA_MS) {
        console.warn("[BOOT] pin_refresh atıldı — məlumat indicə yükləndi");
        return;
      }
      dispatch(getTableGroups(profileId));
      dispatch(getActiveOrders({ profileId }));
      dispatch(menuWithCategories(profileId));
      dispatch(menuWithGeneralCategories(profileId));
    };
    socket.on("pin_refresh", handlePinRefresh);
    return () => socket.off("pin_refresh", handlePinRefresh);
  }, [dispatch, authResultRedux]);

  // Handle Synced Badge Timeout
  const showSyncedBadge = useSelector((state) => state.SyncSlice.showSyncedBadge);
  useEffect(() => {
    if (showSyncedBadge) {
      const timer = setTimeout(() => {
        dispatch(resetSyncedBadge());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSyncedBadge, dispatch]);

  useEffect(() => {
    if (isDisplayRoute) { setShowInitialLoading(false); return; }
    // Əgər artıq init başlayıbsa, bir daha başlama
    if (initStarted.current) return;
    initStarted.current = true;

    const img = new Image();
    img.src = PinBackground;

    const initApp = async () => {
      try {
        const storageData = JSON.parse(localStorage.getItem("profile"));
        const authResult = JSON.parse(localStorage.getItem("authResult"));
        const currentPath = window.location.hash.replace("#", "") || "/";

        const terminalData = authResult?.data?.terminal || {};
        const profileData = authResult?.data?.profile || {};
        const isMaster = terminalData.is_master === 1 || profileData.is_master === 1;
        const isMasterSlaveActive = terminalData.is_master_slave_active === 1 || profileData.is_master_slave_active === 1;

        // Master-slave 0 olanda heç vaxt skan etmə — birbaşa lokal (tez açılış)
        if (isMasterSlaveActive && !isMaster) {
          // Slave rejimi: statik IP varsa birbaşa qoşul, yoxsa skan
          let directIp = null;
          if (window.electronAPI?.getStaticMasterIp) {
            try {
              directIp = await window.electronAPI.getStaticMasterIp();
            } catch { /* nəzərə alınmır */ }
          }
          await initNetwork(false, false, directIp || undefined);
        } else {
          // Master və ya standalone (master-slave sönülü) — lokal, skan yox
          await initNetwork(true, false);
        }

        if (window.electronAPI && window.electronAPI.reEvaluateRole) {
          window.electronAPI.reEvaluateRole().catch(console.error);
        }

        if (storageData) {
          if (authResult) {
            dispatch(setLoginData(authResult));
          }

          // ── Lokal keşdən blok yoxla (anında, şəbəkə gözləmədən) ──
          const cachedProfile = authResult?.data?.profile;
          if (cachedProfile && (isPosBlocked(cachedProfile?.is_pos_block) || (cachedProfile?.next_payment_date && isPaymentExpired(cachedProfile.next_payment_date)))) {
            navigate("/blocked");
            // Arxa planda yenə authPos çağır — bəlkə blok götürülüb
            dispatch(authPos(storageData)).unwrap().then(data => {
              localStorage.setItem("authResult", JSON.stringify(data));
              const p = data?.data?.profile;
              if (p && !isPosBlocked(p?.is_pos_block) && !(p?.next_payment_date && isPaymentExpired(p.next_payment_date))) {
                // Blok götürülüb — BlockPage "Yenilə" düyməsi ilə çıxa bilər
              }
            }).catch(() => {});
            return; // POS-u yükləmə, /blocked göstər
          }

          // ── Bloklanmayıb — dərhal /pin-ə yönləndir, authPos arxa planda işləsin ──
          const cleanPath = currentPath.split("?")[0];
          if (cleanPath === "/" || cleanPath === "/login" || cleanPath === "") {
            navigate("/pin");
          }

          /**
           * Arxa planda müştəri datasını yüklə.
           *
           * `requestAnimationFrame` İŞLƏMİR: proqram açılarkən pəncərə çox vaxt
           * hələ gizlidir, brauzer isə gizli pəncərədə kadrları dayandırır və
           * callback heç vaxt çağırılmır — müştəri siyahısı boş qalırdı.
           * (Eyni səbəbdən açılış ekranında da rAF-dan imtina olunub, aşağıya bax.)
           */
          // PERFORMANS: müştəri siyahısı Pin ekranında lazım deyil — PİN yazılarkən
          // əsas thread-i tutmasın deyə bir neçə saniyə gecikdirilir.
          setTimeout(() => {
            dispatch(fetchCustomersFromAdmin());
            dispatch(fetchCustomerGroupsFromAdmin());
          }, 2500);

          // ── authPos arxa planda (non-blocking) — POS-u gözlətmir ──
          (async () => {
            try {
              const data = await dispatch(authPos(storageData)).unwrap();
              localStorage.setItem("authResult", JSON.stringify(data));
              // Printer məlumatlarını localStorage-a yaz (şəbəkə kəsildikdə istifadə üçün)
              if (data?.data?.printers?.length && data?.data?.profile?.id) {
                let mergedPrinters = data.data.printers;
                try {
                  const cachedRaw = localStorage.getItem("unipos_printers_cache");
                  if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    if (String(cached.profileId) === String(data.data.profile.id) && Array.isArray(cached.printers)) {
                      // Yalnız lokal parametrləri mənimsə — ad (name, local_name) həmişə serverdən gəlsin.
                      // Əks halda printer adı admin paneldə dəyişəndə köhnə keş adı ilə uyğunluq
                      // tapılmır və mətbəx çapı yanlış (təsadüfi) printerə düşür.
                      const LOCAL_ONLY_FIELDS = [
                        'usb_name', 'encoding', 'cut_mode', 'paper_size', 'font_family',
                        'trailing_space', 'copies', 'darkness', 'receipt_header', 'receipt_footer',
                        'bold_header', 'double_height_header', 'sound_notify', 'cash_drawer',
                        'fast_print', 'print_logo', 'rotate_180', 'connection_type', 'com_port',
                        'baud_rate', 'open_drawer_without_print',
                      ];
                      mergedPrinters = mergedPrinters.map(serverPrinter => {
                        const localMatch = cached.printers.find(lp => Number(lp.id) === Number(serverPrinter.id));
                        if (!localMatch) return serverPrinter;
                        const localOverrides = {};
                        LOCAL_ONLY_FIELDS.forEach(f => {
                          if (localMatch[f] !== undefined) localOverrides[f] = localMatch[f];
                        });
                        return { ...serverPrinter, ...localOverrides, connection_status: serverPrinter.connection_status };
                      });
                    }
                  }
                } catch { /* nəzərə alınmır */ }
                savePrintersToStorage(data.data.profile.id, mergedPrinters);
              }

              // authPos LoginModel-i yenilədi — backend rolunu yenidən yoxlasın (Master/Slave)
              if (window.electronAPI?.reEvaluateRole) {
                window.electronAPI.reEvaluateRole().catch(console.error);
              }

              // Re-init network only if role changed vs what we started with
              const freshTerminal = data?.data?.terminal || {};
              const freshProfile = data?.data?.profile || {};
              const freshIsMaster = freshTerminal.is_master === 1 || freshProfile.is_master === 1;
              const freshIsActive = freshTerminal.is_master_slave_active === 1 || freshProfile.is_master_slave_active === 1;
              const currentSocket = getSocket();
              const alreadyConnectedLocally = currentSocket?.io?.uri?.includes("localhost") || currentSocket?.io?.uri?.includes("127.0.0.1");
              const configChanged = freshIsActive !== isMasterSlaveActive || freshIsMaster !== isMaster;
              if (configChanged) {
                if (freshIsActive && !freshIsMaster) {
                  window.electronAPI?.getStaticMasterIp?.().then(ip => {
                    initNetwork(false, false, ip || undefined);
                  }).catch(() => initNetwork(false, false));
                } else if (freshIsMaster && !alreadyConnectedLocally) {
                  initNetwork(true, false);
                }
              }

              // Arxa planda blok yoxla — əgər server bloklanmış deyirsə, yönləndir
              const profile = data?.data?.profile;
              if (isPosBlocked(profile?.is_pos_block) || (profile?.next_payment_date && isPaymentExpired(profile.next_payment_date))) {
                navigate("/blocked", { replace: true });
              }
            } catch (err) {
              console.error("[AUTH] Background auth check failed:", err);
              if (err?.data?.isBlocked) {
                let prevSnapshot = null;
                try {
                  prevSnapshot = JSON.parse(localStorage.getItem("authResult"));
                } catch { /* nəzərə alınmır */ }
                const merged = mergeBlockedLoginPayload(err.data, prevSnapshot);
                localStorage.setItem("authResult", JSON.stringify(merged));
                dispatch(setLoginData(merged));
                navigate("/blocked", { replace: true });
              }
              // Şəbəkə xətası — POS-u bloklama, istifadəçi davam etsin
            }
          })();
        } else {
          if (currentPath !== "/" && currentPath !== "") navigate("/");
        }
      } catch (globalErr) {
        console.error("Critical boot error:", globalErr);
      } finally {
        /**
         * Açılış ekranı init bitən kimi götürülür.
         *
         * Burada 1500 ms-lik SABİT gözləmə var idi. Backend 1.4 saniyəyə hazır
         * olurdu, init ondan da tez bitirdi, amma POS daha 1.5 saniyə boş
         * spinner göstərirdi — ölçdüm, ilk pikselin 3.4 saniyəyə düşməsinin
         * əsas səbəbi məhz bu idi (CPU profili 14 saniyənin 12.4-nün BOŞ
         * keçdiyini göstərdi, yəni gözləmə hesablamadan deyil, taymerdən idi).
         *
         * DİQQƏT — burada `requestAnimationFrame` İŞLƏTMƏK OLMAZ. Pəncərə
         * gizli və ya arxa planda olanda (Windows-da proqram açılarkən tez-tez
         * belə olur) brauzer kadrları dayandırır və rAF HEÇ VAXT çağırılmır —
         * POS "Sistem yüklənir..." ekranında əbədi ilişib qalır. Yoxlayarkən
         * məhz bu baş verdi. `setTimeout` pəncərə görünməsə də işləyir.
         *
         * 0 ms gecikmə yalnız bir mikro-tsikl üçündür: `navigate()` ilə eyni
         * anda spinnerin götürülməsi bir anlıq yanlış ekran göstərə bilərdi.
         */
        setTimeout(() => setShowInitialLoading(false), 0);
      }
    };

    initApp();
  }, [dispatch, navigate]);

  // Splash bağlanıb əsas pəncərə göstərilsin
  useEffect(() => {
    if (isDisplayRoute) return;
    if (showInitialLoading) return;
    window.electronAPI?.notifyAppReadyToShow?.();
  }, [showInitialLoading, isDisplayRoute]);

  // Preload Check komponenti — Pin/Tables/Checks açılanda arxa planda yüklə (yeni sifariş tez açılsın)
  useEffect(() => {
    if (showInitialLoading) return;
    if (isDisplayRoute) return;
    // 246 KB-lıq Check chunk-ının kompilyasiyası PİN yazılan anda deyil, boş vaxtda getsin
    let idleId = null;
    const t = setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(preloadCheck, { timeout: 8000 });
      } else {
        preloadCheck();
      }
    }, 3000);
    return () => {
      clearTimeout(t);
      if (idleId != null && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
    };
  }, [showInitialLoading]);

  if (showInitialLoading) {
    return (
      <>
        <div className="loading-overlay-transparent">
          <div className="cool-spinner-container">
            <div className="cool-spinner-logo-wrapper">
              <div className="cool-spinner-ring"></div>
              <img 
                src={uniposLogo} 
                alt="UniPOS" 
                className="cool-spinner-logo"
                onError={(e) => { if (e.target.src !== window.location.origin + "/favicon.png") e.target.src = "/favicon.png"; }}
              />
            </div>
            <p className="cool-loading-text">Sistem yüklənir...</p>
          </div>
        </div>
      </>
    );
  }

  // Removed TablesOrRooms from here to prevent re-mounting

  return (
    <>
      <Toastify />
      <ToastContainer position="bottom-right" autoClose={2000} hideProgressBar={false} newestOnTop closeOnClick theme="light" style={{ zIndex: 99998 }} />
      <NetworkOverlay />
      {/* QR sifarişi üçün masa seçimi (manual rejim) */}
      <SplitTableSelect
        show={!!qrTablePicker}
        onClose={() => {
          qrTablePicker?.resolve?.(null);
          setQrTablePicker(null);
        }}
        onSelect={(table) => {
          qrTablePicker?.resolve?.(table);
          setQrTablePicker(null);
        }}
      />
      <Suspense fallback={<div className="d-flex justify-content-center align-items-center min-vh-100"><div className="spinner-border text-primary" /></div>}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/pin" element={<Pin />} />
          <Route path="/blocked" element={<BlockPage />} />
          <Route path="/customer" element={<CustomerDisplay />} />
          <Route path="/refresh-sync" element={<RefreshSyncWindow />} />
          <Route path="/kitchen-display" element={<KitchenDisplay />} />
          <Route path="/kds" element={<KitchenDisplay />} />
          <Route path="/kitchen" element={<KitchenDisplay />} />

          <Route element={<Layout />}>
            <Route path="/tables" element={Number(authResultRedux?.data?.profile?.is_hotel_mode) === 1 ? <Rooms /> : <Tables />} />
            <Route path="/tables/:id" element={Number(authResultRedux?.data?.profile?.is_hotel_mode) === 1 ? <Rooms /> : <Tables />} />
            <Route path="/checks" element={<Checks />} />
          </Route>

          <Route path="/check/:id" element={<Check />} />
          <Route path="/closecheck/:id" element={<CheckOver />} />
          <Route path="/room-folio/:roomId" element={<Navigate to="/tables" replace />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

export default App;

