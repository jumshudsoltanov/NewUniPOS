import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./App.css";
import Pin from "./components/Pin/Pin";
import Header from "./components/Header/Header";
import Tables from "./components/Tables/Tables";
import CustomerModal from "./components/Customers-Modal/CustomersModal";
import Check from "./components/Check/Check";
import Checks from "./components/Checks/Checks";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useRef, useState } from "react";
import { authPos, setLoginData } from "./redux/Slices/LoginSlice";
import { fetchCustomersFromAdmin, fetchCustomerGroupsFromAdmin } from "./redux/Slices/CustomersSlice";
import { updateSyncStatus, resetSyncedBadge, updateConnectivity, updateSocketStatus } from "./redux/Slices/SyncSlice";
import { tickTimer as tickBooks } from "./redux/Slices/BooksSlice";
import { tickTimer as tickTables } from "./redux/Slices/TablesSlice";
import { HashRouter, Routes, Route, useNavigate } from "react-router-dom";
import Login from "./components/Login/Login";
import Layout from "./components/Layout/Layout";
import PinBackground from "./assets/images/PinContainerImagesDefault.jpg";
import Toastify from "./components/Toastify/Toastify";
import "react-toastify/dist/ReactToastify.css";
import NetworkOverlay from "./components/NetworkOverlay/NetworkOverlay";
import CustomerDisplay from './components/CustomerDisplay/CustomerDisplay';
import KitchenDisplay from './components/Kitchen/KitchenDisplay';
import CheckOver from "./components/CheckOver/CheckOver";
import Settings from "./components/Settings/Settings";
import BlockPage from "./components/BlockPage/BlockPage";
import { initNetwork, getSocket } from "./utils/apiConfig";
import { addNotification } from "./utils/notificationService";
import { toast } from "react-toastify";
import UpdateNotification from "./components/UpdateNotification/UpdateNotification";

function AppContent() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Refs - re-render olmadan state saxlamaq üçün
  const initStarted = useRef(false);
  const [showInitialLoading, setShowInitialLoading] = useState(true);

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onBackendLog) {
      window.electronAPI.onBackendLog((...args) => {
        console.log("%cBackend Log:", "background: #222; color: #bada55; padding: 2px;", ...args);
      });
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

    window.addEventListener("online", handleConnectivity);
    window.addEventListener("offline", handleConnectivity);

    handleConnectivity();
    fetchSyncCount();
    checkSocket();

    const connInt = setInterval(handleConnectivity, 5000);
    const syncInt = setInterval(fetchSyncCount, 5000);
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

  // Master terminal listener for delegated prints
  const authResultRedux = useSelector((state) => state.LoginSlice.loginedProfileData);
  const isMasterTerminal = authResultRedux?.data?.terminal?.is_master === 1 || authResultRedux?.data?.profile?.is_master === 1;

  const isSocketConnected = useSelector((state) => state.SyncSlice.isSocketConnected);

  useEffect(() => {
    const socket = getSocket();
    
    const isLocalhostMaster = socket?.io?.uri?.includes("localhost") || socket?.io?.uri?.includes("127.0.0.1");
    const shouldListenToDelegatedPrints = isMasterTerminal || isLocalhostMaster;

    if (!socket) return;

    if (shouldListenToDelegatedPrints) {
      console.warn("[MASTER] Attaching delegated print listener...");

      const handleDelegatedPrint = async (data) => {
        console.warn("🖨️ Delegated print received for:", data.printerName);
        if (window.electronAPI?.printReceipt) {
          try {
            await window.electronAPI.printReceipt(data);
          } catch (e) {
            console.error("Delegated print execution failed:", e);
          }
        }
      };

      socket.off("print_delegated");
      socket.on("print_delegated", handleDelegatedPrint);

      socket.on("kitchen_item_ready", (data) => {
        console.warn("🍳 Kitchen Item Ready:", data);
        addNotification(
          `${data.tableName} - ${data.productName} HAZIRDIR!`,
          "Məhsul mətbəxdə tamamlandı və servis üçün hazırdır.",
          { type: "success", category: "order", orderId: data.orderId, displayId: `#${data.orderId}` }
        );
        toast.success(`${data.tableName}: ${data.productName} hazırdır!`, {
          icon: '🍳',
          autoClose: 5000
        });
      });

      return () => {
        socket.off("print_delegated", handleDelegatedPrint);
        socket.off("kitchen_item_ready");
      };
    }
  }, [isMasterTerminal, authResultRedux, isSocketConnected]);

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

        if (!storageData || (isMasterSlaveActive && !isMaster)) {
          await initNetwork(false, !isMasterSlaveActive);
        } else {
          // Always enable socket for local master — needed for customer display broadcasts
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

            dispatch(fetchCustomersFromAdmin());
            dispatch(fetchCustomerGroupsFromAdmin());

            const profile = data?.data?.profile;
            if (Number(profile?.is_pos_block) === 1) {
              navigate("/blocked");
              return;
            }

            const npd = profile?.next_payment_date;
            if (npd) {
              const now = new Date(); now.setHours(0, 0, 0, 0);
              const payDate = new Date(npd); payDate.setHours(0, 0, 0, 0);
              if (payDate < now) {
                navigate("/blocked");
                return;
              }
            }

            const cleanPath = currentPath.split("?")[0];
            console.log(`[AUTH] Path check: Clean='${cleanPath}', Raw='${currentPath}'`);

            if (cleanPath === "/" || cleanPath === "/login" || cleanPath === "") {
              console.log("[AUTH] Auto-login SUCCESS. Redirecting to /pin...");
              navigate("/pin");
            }
          } catch (err) {
            console.error("[AUTH] InitApp/Auto-login failed:", err);
            
            if (err?.data?.isBlocked) {
                localStorage.setItem("authResult", JSON.stringify(err.data));
                navigate("/blocked");
                return;
            }

            // Even if init fails, try to show the Login page instead of a white screen
            if (currentPath === "/" || currentPath === "/login") {
              console.log("[AUTH] Init failed, forcing navigation to login UI");
            }
            if (authResult) {
              dispatch(fetchCustomersFromAdmin());
              dispatch(fetchCustomerGroupsFromAdmin());
              if (currentPath === "/") navigate("/pin");
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
      <NetworkOverlay />
      <UpdateNotification />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/pin" element={<Pin />} />
        <Route path="/blocked" element={<BlockPage />} />
        <Route path="/customer" element={<CustomerDisplay />} />
        <Route path="/kitchen-display" element={<KitchenDisplay />} />
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

