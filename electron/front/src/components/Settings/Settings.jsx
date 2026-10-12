import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import {
  menuWithCategories,
  menuWithGeneralCategories,
} from "../../redux/Slices/MenuSlice";
import { authPos, setLoginData } from "../../redux/Slices/LoginSlice";
import { toast } from "sonner";
import apiConfig from "../../utils/apiConfig";
import { isPaymentExpired, isPosBlocked } from "../../utils/dateHelpers";
import { mergeBlockedLoginPayload } from "../../utils/authResultMerge";
import {
  isClickSoundEnabled,
  setClickSoundEnabled,
  playClickSound,
} from "../../utils/clickSound";
import ReturnCheckModal from "../ReturnCheckModal/ReturnCheckModal";
import SupportModal from "../SupportModal/SupportModal";
import ReportModal from "../ReportModal/ReportModal";
import SalesShiftModal from "./SalesShiftModal";
import CustomersSourceModal from "../Customers-Modal/CustomersSourceModal";
import DevicesModal from "./DevicesModal";
import RefreshLoader from "../RefreshLoader/RefreshLoader";
import "./Settings.css";
import { checkIsSlaveTerminal } from "../../utils/masterSlaveHelpers";
import { useTranslation } from "../../hooks/useTranslation";
import { t as _t } from "../../utils/translations";

const Settings = () => {
  const { t, lang, changeLanguage, languageOptions } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSalesShiftModal, setShowSalesShiftModal] = useState(false);
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);
  const [_showMasterSlaveSettings, _setShowMasterSlaveSettings] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncCounts, setSyncCounts] = useState(null);
  const [refreshIsOnline, setRefreshIsOnline] = useState(true);
  const hasRefreshWindowApi = typeof window !== "undefined" && !!window.electronAPI?.openRefreshWindow;
  const [anyDeskId, setAnyDeskId] = useState(null);
  const [showClock, setShowClock] = useState(() => {
    return localStorage.getItem("showHeaderClock") === "true";
  });
  // Düymə klik səsi — default açıqdır (bax: utils/clickSound.js)
  const [clickSoundOn, setClickSoundOn] = useState(
    () => isClickSoundEnabled(),
  );
  const [appVersion, setAppVersion] = useState(null);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI
        .getAppVersion()
        .then((v) => setAppVersion(v))
        .catch(() => {});
    }
    if (window.electronAPI?.getIsDev) {
      window.electronAPI
        .getIsDev()
        .then((v) => setIsDev(v))
        .catch(() => {});
    }
  }, []);

  // Fetch AnyDesk ID on mount
  useEffect(() => {
    if (window.electronAPI?.getAnyDeskId) {
      window.electronAPI
        .getAnyDeskId()
        .then((id) => {
          if (id) setAnyDeskId(id);
        })
        .catch(() => {});
    }
  }, []);

  // Toggle clock visibility in header
  const handleClockToggle = () => {
    const newValue = !showClock;
    setShowClock(newValue);
    localStorage.setItem("showHeaderClock", newValue.toString());
    // Dispatch custom event for Header to listen
    window.dispatchEvent(new CustomEvent("clockToggle", { detail: newValue }));
  };

  // Düymə səsini aç / bağla
  const handleSoundToggle = () => {
    const next = !clickSoundOn;
    setClickSoundOn(next);
    setClickSoundEnabled(next);
    // Açılan kimi eşidilsin ki, istifadəçi nəticəni dərhal bilsin
    if (next) playClickSound();
  };

  // Toggle fullscreen via Electron API
  const handleFullscreenToggle = async () => {
    if (window.electronAPI?.toggleFullscreen) {
      await window.electronAPI.toggleFullscreen();
    } else {
      // Fallback for browser
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  };

  // Open AnyDesk via Electron API
  const handleOpenAnyDesk = async () => {
    if (window.electronAPI?.openAnyDesk) {
      await window.electronAPI.openAnyDesk();
    } else {
      alert("AnyDesk yalnız Electron tətbiqində açıla bilər");
    }
  };

  const handleSoftRefresh = async () => {
    if (!loginedProfileData?.data?.profile?.id) {
      toast.error(t("no_profile_data"));
      return;
    }
    if (isRefreshing) return;

    setIsRefreshing(true);
    setSyncCounts(null);
    setRefreshIsOnline(true);

    const profileIdForCache = loginedProfileData.data.profile.id;
    const prevCountsKey = `unipos_sync_prev_counts_${profileIdForCache}`;
    let prevCounts = {};
    try {
      prevCounts = JSON.parse(localStorage.getItem(prevCountsKey)) || {};
    } catch {
      prevCounts = {};
    }

    if (hasRefreshWindowApi) {
      window.electronAPI.openRefreshWindow();
      window.electronAPI.sendRefreshSyncEvent({
        type: "start",
        isOnline: navigator.onLine,
      });
    }

    const toastId = toast.loading(t("data_updating"));
    try {
      const profileId = loginedProfileData.data.profile.id;
      const syncRes = await apiConfig.post(`/sync/refresh/${profileId}`);
      const isOnline = syncRes?.data?.isOnline !== false;
      setRefreshIsOnline(isOnline);
      if (syncRes?.data?.counts) setSyncCounts(syncRes.data.counts);

      if (hasRefreshWindowApi) {
        const newCounts = syncRes?.data?.counts;
        if (newCounts) {
          const deltas = {};
          Object.keys(newCounts).forEach((key) => {
            const diff = (newCounts[key] || 0) - (prevCounts[key] || 0);
            if (diff > 0) deltas[key] = diff;
          });
          window.electronAPI.sendRefreshSyncEvent({
            type: "done",
            counts: newCounts,
            deltas,
            isOnline,
          });
          try {
            localStorage.setItem(prevCountsKey, JSON.stringify(newCounts));
          } catch { /* nəzərə alınmır */ }
        } else {
          window.electronAPI.sendRefreshSyncEvent({
            type: "done",
            counts: {},
            deltas: {},
            isOnline,
          });
        }
      }

      await Promise.all([
        dispatch(getTableGroups(profileId)).unwrap(),
        dispatch(getActiveOrders({ profileId })).unwrap(),
        dispatch(menuWithCategories(profileId)).unwrap(),
        dispatch(menuWithGeneralCategories(profileId)).unwrap(),
      ]);

      if (!isOnline) {
        toast.warning(t("no_internet_local"), {
          id: toastId,
        });
        return;
      }

      const storageData = JSON.parse(localStorage.getItem("profile"));
      if (storageData) {
        const data = await dispatch(authPos(storageData)).unwrap();
        localStorage.setItem("authResult", JSON.stringify(data));
        const profile = data?.data?.profile;

        if (isPosBlocked(profile?.is_pos_block)) {
          toast.dismiss(toastId);
          navigate("/blocked");
          return;
        }

        if (profile?.next_payment_date) {
          if (isPaymentExpired(profile.next_payment_date)) {
            toast.dismiss(toastId);
            navigate("/blocked");
            return;
          }
        }
      }

      toast.success(t("data_updated"), { id: toastId });
    } catch (error) {
      console.error("Yeniləmə xətası:", error);

      if (hasRefreshWindowApi) {
        window.electronAPI.sendRefreshSyncEvent({
          type: "done",
          counts: {},
          deltas: {},
          isOnline: navigator.onLine,
        });
      }

      if (error?.data?.isBlocked) {
        toast.dismiss(toastId);
        let prevSnapshot = null;
        try {
          prevSnapshot = JSON.parse(localStorage.getItem("authResult"));
        } catch { /* nəzərə alınmır */ }
        const merged = mergeBlockedLoginPayload(error.data, prevSnapshot);
        localStorage.setItem("authResult", JSON.stringify(merged));
        dispatch(setLoginData(merged));
        navigate("/blocked");
        return;
      }

      // İnternet olmadıqda lokal məlumatları yüklə
      try {
        setRefreshIsOnline(false);
        const profileId = loginedProfileData.data.profile.id;
        await Promise.all([
          dispatch(getTableGroups(profileId)).unwrap(),
          dispatch(getActiveOrders({ profileId })).unwrap(),
        ]);
        toast.warning(t("no_internet_local"), {
          id: toastId,
        });
      } catch {
        toast.error(t("data_update_error"), { id: toastId });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const topMenuItems = [
    {
      id: "refund",
      label: t("refund"),
      icon: <i className="bi bi-arrow-counterclockwise"></i>,
      permission: Number(loginedWaiter?.data?.can_return_receipt) === 1,
      onClick: () => setShowReturnModal(true),
    },
    {
      id: "report",
      label: t("create_report"),
      icon: <i className="bi bi-file-earmark-text"></i>,
      permission: Number(loginedWaiter?.data?.can_create_report) === 1,
      onClick: () => setShowReportModal(true),
    },
    {
      id: "sales-shift",
      label: t("sales_shift"),
      icon: <i className="bi bi-clock-history"></i>,
      permission:
        Number(loginedProfileData?.data?.profile?.queue_sales_module) === 1 &&
        Number(loginedWaiter?.data?.can_see_sale_type_queue) === 1,
      onClick: () => setShowSalesShiftModal(true),
    },
    {
      id: "operation",
      label: t("add_operation"),
      icon: <i className="bi bi-plus-square"></i>,
      highlight: true,
    },
    {
      id: "customers",
      label: t("customers"),
      icon: <i className="bi bi-people"></i>,
      highlight: true,
      permission: Number(loginedWaiter?.data?.can_view_customers) === 1,
      onClick: () => setShowCustomersModal(true),
    },
    {
      id: "archive",
      label: t("check_archive"),
      icon: <i className="bi bi-archive"></i>,
      permission:
        Number(loginedWaiter?.data?.can_view_archived_checks) === 1 ||
        Number(loginedWaiter?.data?.can_edit_all_checks) === 1,
      onClick: () => navigate("/checks"),
    },
    {
      id: "devices",
      label: t("devices"),
      icon: <i className="bi bi-laptop"></i>,
      highlight: true,
      onClick: () => setShowDevicesModal(true),
      permission:
        Number(loginedWaiter?.data?.can_access_settings) === 1 &&
        Number(loginedWaiter?.data?.can_see_device) === 1,
    },
    {
      id: "masterip",
      label: t("master_ip"),
      icon: <i className="bi bi-wifi"></i>,
      highlight: true,
      onClick: () =>
        window.dispatchEvent(new CustomEvent("openMasterSlaveSettings")),
      permission: Number(loginedWaiter?.data?.can_access_settings) === 1,
      /** Master terminalda kart göstərilmir — yalnız slave + aktiv master-slave */
      slaveOnly: true,
    },
  ];

  const isMobile = window.innerWidth < 992;

  const bottomMenuItems = [
    {
      id: "language",
      label: (languageOptions.find(l => l.code === lang) || {}).label || lang,
      icon: <i className="bi bi-globe"></i>,
      highlight: true,
      onClick: () => {
        const codes = languageOptions.map(l => l.code);
        const next = codes[(codes.indexOf(lang) + 1) % codes.length];
        changeLanguage(next);
      },
    },
    {
      id: "refresh",
      label: t("refresh"),
      icon: <i className="bi bi-arrow-repeat"></i>,
      onClick: handleSoftRefresh,
    },
    {
      id: "sound",
      label: clickSoundOn ? t("sesi_bagla") : t("sesi_ac"),
      icon: (
        <i className={`bi ${clickSoundOn ? "bi-volume-up" : "bi-volume-mute"}`}></i>
      ),
      onClick: handleSoundToggle,
    },
    {
      id: "clock",
      label: showClock ? t("saati_gizlet") : t("saati_goster"),
      icon: <i className="bi bi-clock"></i>,
      onClick: handleClockToggle,
    },
    {
      id: "fullscreen",
      label: t("window_mode"),
      icon: <i className="bi bi-arrows-fullscreen"></i>,
      onClick: handleFullscreenToggle,
      hiddenOnMobile: true,
    },
    {
      id: "support",
      label: t("support"),
      icon: <i className="bi bi-question-circle"></i>,
      onClick: () => setShowSupportModal(true),
    },
    {
      id: "anydesk",
      label: t("anydesk"),
      icon: <i className="bi bi-display"></i>,
      onClick: handleOpenAnyDesk,
      hiddenOnMobile: true,
    },
  ];

  return (
    <>
      <div className="settings-page">
        {/* Header */}
        <div className="settings-page-header">
          <button className="settings-back-btn" onClick={() => navigate(-1)}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="settings-page-title">{t("settings")}</h1>
          {Number(loginedProfileData?.data?.profile?.is_hotel_mode) === 1 && (
            <span style={{
              background: '#F59E0B',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 'bold',
              padding: '2px 8px',
              borderRadius: '4px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginLeft: '8px'
            }}>{t("hotel")}</span>
          )}
          {appVersion && (
            <span className="settings-version-badge">v{appVersion}</span>
          )}
        </div>

        {/* Content */}
        <div className="settings-page-content">
          {/* Top Menu Grid */}
          <div className="settings-grid settings-grid-top">
            {topMenuItems
              .filter(
                (item) =>
                  item.permission !== false &&
                  (!item.hideOnMobile || !isMobile) &&
                  (!item.slaveOnly || checkIsSlaveTerminal()),
              )
              .map((item) => (
                <button
                  key={item.id}
                  className="settings-card"
                  onClick={item.onClick}
                >
                  <span
                    className={`settings-card-icon ${item.highlight ? "highlight" : ""}`}
                  >
                    {item.icon}
                  </span>
                  <span className="settings-card-label">{item.label}</span>
                </button>
              ))}
          </div>

          {/* Bottom Menu Row */}
          <div className="settings-grid settings-grid-bottom">
            {bottomMenuItems
              .filter((item) => (item.id !== "language" || isDev))
              .filter((item) => !item.hiddenOnMobile || !isMobile)
              .map((item) => (
                <button
                  key={item.id}
                  className="settings-card"
                  onClick={item.onClick}
                >
                  <span className="settings-card-icon">{item.icon}</span>
                  <span className="settings-card-label">
                    {item.label}
                    {item.id === "anydesk" && anyDeskId && (
                      <span className="anydesk-id-badge">{anyDeskId}</span>
                    )}
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Return Check Modal */}
      <ReturnCheckModal
        show={showReturnModal}
        onClose={() => setShowReturnModal(false)}
      />

      {/* Support Modal */}
      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      {/* Report Modal */}
      <ReportModal
        show={showReportModal}
        onClose={() => setShowReportModal(false)}
      />

      <SalesShiftModal
        show={showSalesShiftModal}
        onHide={() => setShowSalesShiftModal(false)}
      />

      {/* Customers Source Modal */}
      <CustomersSourceModal
        show={showCustomersModal}
        onHide={() => setShowCustomersModal(false)}
      />

      <DevicesModal
        show={showDevicesModal}
        onHide={() => setShowDevicesModal(false)}
      />

      {/* Refreshing Overlay — yalnız ayrıca yenilənmə pəncərəsi mövcud olmayanda (fallback) */}
      <RefreshLoader
        isOpen={isRefreshing && !hasRefreshWindowApi}
        syncCounts={syncCounts}
        isOnline={refreshIsOnline}
      />
    </>
  );
};

export default Settings;
