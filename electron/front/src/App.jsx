import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./App.css";
import Pin from "./components/Pin/Pin";
import Header from "./components/Header/Header";
import Tables from "./components/Tables/Tables";
import CustomerModal from "./components/Customers-Modal/CustomersModal";
import Checks from "./components/Checks/Checks";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useRef, useState } from "react";
import { authPos, setLoginData } from "./redux/Slices/LoginSlice";
import { fetchCustomersFromAdmin, fetchCustomerGroupsFromAdmin } from "./redux/Slices/CustomersSlice";
import { updateSyncStatus, resetSyncedBadge, updateConnectivity, updateSocketStatus } from "./redux/Slices/SyncSlice";
import { tickTimer as tickBooks } from "./redux/Slices/BooksSlice";
import { tickTimer as tickTables } from "./redux/Slices/TablesSlice";
import { HashRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Login from "./components/Login/Login";
import Layout from "./components/Layout/Layout";
import PinBackground from "./assets/images/PinContainerImagesDefault.jpg";
import Toastify from "./components/Toastify/Toastify";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { lazy, Suspense } from "react";
import NetworkOverlay from "./components/NetworkOverlay/NetworkOverlay";
import BlockPage from "./components/BlockPage/BlockPage";

import Check from "./components/Check/Check";
import CheckOver from "./components/CheckOver/CheckOver";

const CustomerDisplay = lazy(() => import('./components/CustomerDisplay/CustomerDisplay'));
const KitchenDisplay = lazy(() => import('./components/Kitchen/KitchenDisplay'));
import Settings from "./components/Settings/Settings";
import { initNetwork, getSocket, onSocketStatusChange } from "./utils/apiConfig";
import { preloadCheck } from "./utils/preloadCheck";
import { isPaymentExpired, isPosBlocked } from "./utils/dateHelpers";
import { addNotification } from "./utils/notificationService";
import { toast } from "react-toastify";
import UpdateNotification from "./components/UpdateNotification/UpdateNotification";

function AppContent() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const authResultRedux = useSelector((state) => state.LoginSlice.loginedProfileData);

  // Refs - re-render olmadan state saxlamaq üçün
  const initStarted = useRef(false);
  const [showInitialLoading, setShowInitialLoading] = useState(true);

  // Blok yoxlaması — bütün səhifələrdə (Check, Tables, modallar açıq olanda da) işləsin
  useEffect(() => {
    if (showInitialLoading) return;
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
  }, [location.pathname, authResultRedux, showInitialLoading, navigate]);

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onBackendLog) {
      window.electronAPI.onBackendLog(() => {});
    }

    // Connectivity and Sync Polling
    const handleConnectivity = () => {
      const isOnline = navigator.onLine;
      if (window.electronAPI && window.electronAPI.checkInternet) {
        window.electronAPI.checkInternet().then(hasInternet => {
          dispatch(updateConnectivity({ isOnline, hasInternet }));
        }).catch(() => {
          dispatch(updateConnectivity({ isOnline, hasInternet: false }));
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
    const timerInt = setInterval(() => {
      dispatch(tickBooks());
      dispatch(tickTables());
    }, 1000);
 
    return () => {
      window.removeEventListener("online", handleConnectivity);
      window.removeEventListener("offline", handleConnectivity);
      clearInterval(connInt);
      clearInterval(syncInt);
      clearInterval(socketInt);
      clearInterval(timerInt);
    };
  }, [dispatch]);

  // Mərkəzi printer Master-dadır: Master print_delegated dinləyib özündə çap edir (Slave göndərir)
  const isMasterTerminal = authResultRedux?.data?.terminal?.is_master === 1 || authResultRedux?.data?.profile?.is_master === 1;

  const isSocketConnected = useSelector((state) => state.SyncSlice.isSocketConnected);

  useEffect(() => {
    const socket = getSocket();
    const shouldListenToDelegatedPrints = isMasterTerminal;

    if (!socket) return;

    if (shouldListenToDelegatedPrints && window.electronAPI?.printReceipt) {
      console.warn("[MASTER] Mərkəzi çap dinləyicisi aktiv (Slave-dən gələn çap)");

      const handleDelegatedPrint = async (data) => {
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
  }, [isMasterTerminal, isSocketConnected]);

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
            } catch (e) {}
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

          try {
            const data = await dispatch(authPos(storageData)).unwrap();
            localStorage.setItem("authResult", JSON.stringify(data));

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
                  initNetwork(false, false, ip || undefined); // Slave → statik IP varsa birbaşa, yoxsa skan
                }).catch(() => initNetwork(false, false));
              } else if (freshIsMaster && !alreadyConnectedLocally) {
                initNetwork(true, false); // Master → local socket (only if not already local)
              }
            }

            requestAnimationFrame(() => {
              dispatch(fetchCustomersFromAdmin());
              dispatch(fetchCustomerGroupsFromAdmin());
            });

            const profile = data?.data?.profile;
            if (isPosBlocked(profile?.is_pos_block)) {
              navigate("/blocked");
              return;
            }

            const npd = profile?.next_payment_date;
            if (npd) {
              if (isPaymentExpired(npd)) {
                navigate("/blocked");
                return;
              }
            }

            const cleanPath = currentPath.split("?")[0];

            if (cleanPath === "/" || cleanPath === "/login" || cleanPath === "") {
              navigate("/pin");
            }
          } catch (err) {
            console.error("[AUTH] InitApp/Auto-login failed:", err);
            
            if (err?.data?.isBlocked) {
                localStorage.setItem("authResult", JSON.stringify(err.data));
                dispatch(setLoginData(err.data));
                navigate("/blocked");
                return;
            }

            // Stored authResult blokludursa, /blocked göstər — Pin/Login-ə getmə
            const storedProfile = authResult?.data?.profile;
            if (storedProfile && (isPosBlocked(storedProfile?.is_pos_block) || (storedProfile?.next_payment_date && isPaymentExpired(storedProfile.next_payment_date)))) {
              localStorage.setItem("authResult", JSON.stringify(authResult));
              dispatch(setLoginData(authResult));
              navigate("/blocked");
              return;
            }

            // Even if init fails, try to show the Login page instead of a white screen
            if (authResult) {
              dispatch(fetchCustomersFromAdmin());
              dispatch(fetchCustomerGroupsFromAdmin());
              if (currentPath === "/" || currentPath === "/login" || currentPath === "") navigate("/pin");
            } else {
              if (currentPath !== "/" && currentPath !== "") navigate("/");
            }
          }
        } else {
          if (currentPath !== "/" && currentPath !== "") navigate("/");
        }
      } catch (globalErr) {
        console.error("Critical boot error:", globalErr);
      } finally {
        setShowInitialLoading(false);
      }
    };

    initApp().then(() => setShowInitialLoading(false));
  }, [dispatch, navigate]);

  // Preload Check komponenti — Pin/Tables/Checks açılanda arxa planda yüklə (yeni sifariş tez açılsın)
  useEffect(() => {
    if (showInitialLoading) return;
    const t = setTimeout(preloadCheck, 800);
    return () => clearTimeout(t);
  }, [showInitialLoading]);

  if (showInitialLoading) {
    return (
      <>
        <UpdateNotification />
        <div
          className="loginLoadingState"
          style={{
            height: "100vh",
            background: "#F3F4F6",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="premium-loader">
            <div className="loader-ring"></div>
            <div className="loader-dot"></div>
          </div>
          <p className="loadingText">Sistem yüklənir...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Toastify />
      <ToastContainer position="bottom-right" autoClose={2000} hideProgressBar={false} newestOnTop closeOnClick theme="light" style={{ zIndex: 99998 }} />
      <NetworkOverlay />
      <UpdateNotification />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/pin" element={<Pin />} />
        <Route path="/blocked" element={<BlockPage />} />
        <Route path="/customer" element={<Suspense fallback={<div className="d-flex justify-content-center align-items-center min-vh-100"><div className="spinner-border text-primary" /></div>}><CustomerDisplay /></Suspense>} />
        <Route path="/kitchen-display" element={<Suspense fallback={<div className="d-flex justify-content-center align-items-center min-vh-100"><div className="spinner-border text-primary" /></div>}><KitchenDisplay /></Suspense>} />
        <Route path="/kds" element={<KitchenDisplay />} />
        <Route path="/kitchen" element={<KitchenDisplay />} />

        <Route element={<Layout />}>
          <Route path="/tables" element={<Tables />} />
          <Route path="/tables/:id" element={<Tables />} />
          <Route path="/checks" element={<Checks />} />
        </Route>

        <Route path="/check/:id" element={<Check />} />
        <Route path="/closecheck/:id" element={<CheckOver />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
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

