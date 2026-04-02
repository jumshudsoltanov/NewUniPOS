import { Col, Row, Container } from "react-bootstrap";
import "./Pin.css";
import "../BlockPage/BlockPage.css";
import RightBoxContainerImg2 from "../../assets/images/PinContainerImagesDefault.jpg";
import DefaultLogo from "../../assets/images/unipos_logo.png";
import SupportModal from "../SupportModal/SupportModal";
import SettingsMenu from "../SettingsMenu/SettingsMenu";
import PinAdvancedSettingsModal from "../PinAdvancedSettingsModal/PinAdvancedSettingsModal";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { resolveWaiter } from "../../redux/Slices/WaitersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { isPaymentExpired, isPosBlocked } from "../../utils/dateHelpers";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { menuWithCategories, menuWithGeneralCategories } from "../../redux/Slices/MenuSlice";
import { toast } from "sonner";
import RefreshLoader from "../RefreshLoader/RefreshLoader";
import BrandsModal from "../BrandsModal/BrandsModal";
import apiConfig from "../../utils/apiConfig";
import { getSocket } from "../../utils/apiConfig";
import { isPacksOnlyWaiter } from "../../utils/waiterPermissions";

const PIN_LENGTH = 4;

const PinDot = React.memo(({ filled, isError }) => (
  <div
    className={`pin-dot ${filled ? "filled" : ""} ${isError ? "error" : ""}`}
  >
    {filled ? (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 16 16"
        fill="none"
      >
        <circle cx="8" cy="8" r="6" fill={isError ? "#ff4757" : "#053796"} />
      </svg>
    ) : (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 16 16"
        fill="none"
      >
        <circle
          cx="8"
          cy="8"
          r="5.5"
          stroke={isError ? "#ff4757" : "#053796"}
          strokeWidth="1"
          fill="none"
        />
      </svg>
    )}
  </div>
));

const NumberButton = React.memo(({ value, onClick, children, variant = "default" }) => (
  <button
    className={`pin-btn pin-btn-${variant}`}
    onClick={() => onClick(value)}
    type="button"
  >
    {children || value}
  </button>
));

const BackspaceIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M9.57 5.93L3.5 12L9.57 18.07"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeMiterlimit="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M20.5 12H3.67"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeMiterlimit="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ClearIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M18 6L6 18M6 6L18 18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ImageSection = React.memo(({ backgroundImg }) => {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(RightBoxContainerImg2);



  useEffect(() => {
    const setBackground = () => {
      const validImage = (img) => {
        if (!img) return false;
        const strImg = String(img).trim().toLowerCase();
        if (strImg === "null" || strImg === "undefined" || strImg === "data:directory;base64,") return false;
        return true;
      };

      if (validImage(backgroundImg)) {
        if (backgroundImg.startsWith("data:") || backgroundImg.startsWith("http")) {
          setCurrentSrc(backgroundImg);
        } else {
          setCurrentSrc(`http://46.224.8.157:35627/${backgroundImg}`);
        }
        return;
      }

      try {
        const authLogin = JSON.parse(localStorage.getItem("authlogin") || "{}");
        const cachedBg = authLogin?.background_img || authLogin?.bg || authLogin?.data?.profile?.background_img;
        if (validImage(cachedBg)) {
          if (cachedBg.startsWith("data:") || cachedBg.startsWith("http")) {
            setCurrentSrc(cachedBg);
          } else {
            setCurrentSrc(`http://46.224.8.157:35627/${cachedBg}`);
          }
          return;
        }
      } catch (error) {
        console.error("Error parsing authlogin:", error);
      }

      setCurrentSrc(RightBoxContainerImg2);
    };

    setBackground();
  }, [backgroundImg]);

  return (
    <Col
      md={6}
      lg={7}
      xl={8}
      className="d-none d-md-block p-0 h-100"
      style={{ background: "#f8f9fa" }}
    >
      <div
        className="RightBoxContainer"
        style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.5s ease" }}
      >
        <div className="pin-brand-badge">
          <img src={DefaultLogo} alt="UniPOS Tech" />
          <span>UniPOS Tech</span>
        </div>
        <img
          src={currentSrc}
          alt="Background"
          onLoad={() => setLoaded(true)}
          onError={() => setCurrentSrc(RightBoxContainerImg2)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    </Col>
  );
});

const Pin = () => {
  const [pin, setPin] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pinSyncCounts, setPinSyncCounts] = useState(null);
  const [isBrandsModalOpen, setIsBrandsModalOpen] = useState(false);
  const [appVersion, setAppVersion] = useState(null);
  const [isPinAdvancedSettingsOpen, setIsPinAdvancedSettingsOpen] = useState(false);

  const keyboardBufferRef = useRef("");
  const keyboardPinTimerRef = useRef(null);
  const logoSecretTapCountRef = useRef(0);
  const logoSecretTapTimerRef = useRef(null);

  const clearKeyboardCapture = useCallback(() => {
    if (keyboardPinTimerRef.current) {
      clearTimeout(keyboardPinTimerRef.current);
      keyboardPinTimerRef.current = null;
    }
    keyboardBufferRef.current = "";
  }, []);

  useEffect(() => {
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then(setAppVersion).catch(() => {});
    }
  }, []);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);

  const {
    pendingCount: syncCount,
    lastSyncedDelta: syncedCount,
    showSyncedBadge,
    isOnline,
    hasInternet
  } = useSelector((state) => state.SyncSlice);

  let fallbackProfileData = null;
  try {
    const authResultStr = localStorage.getItem("authResult");
    if (authResultStr) fallbackProfileData = JSON.parse(authResultStr);
  } catch (err) {
    console.error("Error parsing authResult:", err);
  }

  const activeProfileData = loginedProfileData || fallbackProfileData;
  const terminalInfo = activeProfileData?.data?.terminal || {};
  const profileInfo = activeProfileData?.data?.profile || {};

  // Blok yoxlaması App.jsx-dən arxa planda idarə olunur — Pin-də əlavə yoxlama lazım deyil
  // Yalnız ilkin mount-da lokal keşdən yoxla (tez, şəbəkə gözləmədən)
  useEffect(() => {
    if (!profileInfo) return;
    if (isPosBlocked(profileInfo?.is_pos_block) || (profileInfo?.next_payment_date && isPaymentExpired(profileInfo.next_payment_date))) {
      navigate("/blocked", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validImg = (img) => {
    if (!img) return false;
    const strImg = String(img).trim().toLowerCase();
    if (strImg === "null" || strImg === "undefined" || strImg === "data:directory;base64,") return false;
    return true;
  };

  let logoSrc = DefaultLogo;
  if (validImg(terminalInfo.logoPrint)) {
    logoSrc = terminalInfo.logoPrint.startsWith("http") || terminalInfo.logoPrint.startsWith("data:")
      ? terminalInfo.logoPrint
      : `http://46.224.8.157:35627/${terminalInfo.logoPrint}`;
  } else if (validImg(profileInfo.logo)) {
    logoSrc = profileInfo.logo.startsWith("http") || profileInfo.logo.startsWith("data:")
      ? profileInfo.logo
      : `http://46.224.8.157:35627/${profileInfo.logo}`;
  }

  const handleRefresh = async () => {
    if (!activeProfileData?.data?.profile?.id) {
      toast.error("Profil məlumatı yoxdur, səhifə yenilənə bilmədi.");
      return;
    }

    setIsRefreshing(true);
    setPinSyncCounts(null);
    try {
      const profileId = activeProfileData.data.profile.id;
      // Əvvəl serverdən DB-yə yaz — sonra GET; əks halda Promise.all yarışında köhnə məlumat gəlirdi (2 dəfə basmaq lazım idi)
      const syncRes = await apiConfig.post(`/sync/refresh/${profileId}`);
      await apiConfig.post(`/sync/force-now`).catch(() => ({}));

      if (syncRes?.data?.counts) {
        setPinSyncCounts(syncRes.data.counts);
      }

      await Promise.all([
        dispatch(getTableGroups(profileId)).unwrap(),
        dispatch(getActiveOrders({ profileId })).unwrap(),
        dispatch(menuWithCategories(profileId)).unwrap(),
        dispatch(menuWithGeneralCategories(profileId)).unwrap(),
      ]);

      if (syncRes?.data?.counts) {
        await new Promise(resolve => setTimeout(resolve, 1800));
      } else {
        toast.success("Məlumatlar uğurla yeniləndi!");
      }

      const socket = getSocket();
      if (socket?.connected) {
        socket.emit("pin_refresh", { profileId });
      }
    } catch (error) {
      console.error("Yeniləmə xətası:", error);
      toast.error("Yeniləmə zamanı xəta baş verdi.");
    } finally {
      setIsRefreshing(false);
      setPinSyncCounts(null);
    }
  };

  const handleBrandList = () => {
    setIsBrandsModalOpen(true);
  };

  const handleDownloadData = () => {
    handleRefresh();
  };

  const handleExit = () => {
    localStorage.removeItem("profile");
    localStorage.removeItem("authResult");
    navigate("/");
  };

  const handleLogoSecretTap = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (logoSecretTapTimerRef.current) {
      clearTimeout(logoSecretTapTimerRef.current);
      logoSecretTapTimerRef.current = null;
    }
    logoSecretTapCountRef.current += 1;
    if (logoSecretTapCountRef.current >= 5) {
      logoSecretTapCountRef.current = 0;
      setIsPinAdvancedSettingsOpen(true);
      return;
    }
    logoSecretTapTimerRef.current = setTimeout(() => {
      logoSecretTapCountRef.current = 0;
      logoSecretTapTimerRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (logoSecretTapTimerRef.current) clearTimeout(logoSecretTapTimerRef.current);
    };
  }, []);

  const handleQuitApp = () => {
    if (window.electronAPI?.quitApp) {
      window.electronAPI.quitApp();
    } else {
      window.close();
    }
  };

  useEffect(() => {
    const profileId = loginedProfileData?.data?.profile?.id;
    if (profileId) {
      dispatch(menuWithCategories(profileId));
      dispatch(menuWithGeneralCategories(profileId));
      dispatch(getTableGroups(profileId));
      dispatch(getActiveOrders({ profileId }));
    }
  }, [loginedProfileData?.data?.profile?.id, dispatch]);

  const completeWaiterLogin = useCallback(
    async (waiterResult) => {
      if (waiterResult.message === "success") {
        const profileId = activeProfileData?.data?.profile?.id;
        const isPacksOnly = isPacksOnlyWaiter(waiterResult.data);
        if (profileId) {
          dispatch(getTableGroups(profileId));
          dispatch(getActiveOrders({ profileId }));
        }
        navigate(isPacksOnly ? "/checks" : "/tables");
      } else {
        setIsError(true);
        setTimeout(() => {
          setIsError(false);
          setPin("");
        }, 500);
      }
    },
    [activeProfileData, dispatch, navigate],
  );

  const handlePinSubmit = useCallback(
    async (submittedPin) => {
      try {
        const profileId = activeProfileData?.data?.profile?.id;
        if (!profileId) {
          toast.error("Profil məlumatı yoxdur.");
          return;
        }
        const waiterResult = await dispatch(
          resolveWaiter({ profileId, pin: submittedPin }),
        ).unwrap();
        await completeWaiterLogin(waiterResult);
      } catch (error) {
        setIsError(true);
        setTimeout(() => {
          setIsError(false);
          setPin("");
        }, 500);
      }
    },
    [activeProfileData, dispatch, completeWaiterLogin],
  );

  const handleCardLogin = useCallback(
    async (cardId) => {
      try {
        const profileId = activeProfileData?.data?.profile?.id;
        if (!profileId) {
          toast.error("Profil məlumatı yoxdur.");
          return;
        }
        const waiterResult = await dispatch(
          resolveWaiter({ profileId, cardId }),
        ).unwrap();
        await completeWaiterLogin(waiterResult);
      } catch (error) {
        setIsError(true);
        setTimeout(() => {
          setIsError(false);
          setPin("");
        }, 500);
      }
    },
    [activeProfileData, dispatch, completeWaiterLogin],
  );

  const handleNumberClick = useCallback(
    (num) => {
      clearKeyboardCapture();
      setPin((prev) => {
        if (prev.length < PIN_LENGTH) {
          const next = prev + num;
          setIsError(false);
          if (next.length === PIN_LENGTH) {
            queueMicrotask(() => handlePinSubmit(next));
          }
          return next;
        }
        return prev;
      });
    },
    [clearKeyboardCapture, handlePinSubmit],
  );

  const handleBackspace = useCallback(() => {
    clearKeyboardCapture();
    setPin((prev) => {
      if (prev.length > 0) {
        setIsError(false);
        return prev.slice(0, -1);
      }
      return prev;
    });
  }, [clearKeyboardCapture]);

  const handleClear = useCallback(() => {
    clearKeyboardCapture();
    setPin("");
    setIsError(false);
  }, [clearKeyboardCapture]);

  useEffect(() => {
    const digitFromEvent = (e) => {
      if (e.key >= "0" && e.key <= "9") return e.key;
      if (e.code && /^Digit[0-9]$/.test(e.code)) return e.code.slice(5);
      if (e.code && /^Numpad[0-9]$/.test(e.code)) return e.code.slice(6);
      return null;
    };

    const clearPinTimerOnly = () => {
      if (keyboardPinTimerRef.current) {
        clearTimeout(keyboardPinTimerRef.current);
        keyboardPinTimerRef.current = null;
      }
    };

    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.target?.closest?.(".modal")) return;

      const digit = digitFromEvent(e);
      if (digit) {
        e.preventDefault();
        clearPinTimerOnly();
        keyboardBufferRef.current += digit;
        const buf = keyboardBufferRef.current;
        if (buf.length <= PIN_LENGTH) {
          setPin(buf);
          setIsError(false);
        } else {
          setPin("");
        }
        if (buf.length === PIN_LENGTH) {
          keyboardPinTimerRef.current = setTimeout(() => {
            if (keyboardBufferRef.current.length === PIN_LENGTH) {
              const p = keyboardBufferRef.current;
              keyboardBufferRef.current = "";
              setPin("");
              handlePinSubmit(p);
            }
            keyboardPinTimerRef.current = null;
          }, 220);
        }
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        clearPinTimerOnly();
        keyboardBufferRef.current = keyboardBufferRef.current.slice(0, -1);
        const buf = keyboardBufferRef.current;
        setPin(buf.length <= PIN_LENGTH ? buf : "");
        setIsError(false);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        clearPinTimerOnly();
        const raw = keyboardBufferRef.current.trim();
        keyboardBufferRef.current = "";
        setPin("");
        if (!raw) return;
        if (raw.length === PIN_LENGTH && /^\d+$/.test(raw)) {
          handlePinSubmit(raw);
        } else {
          handleCardLogin(raw);
        }
        return;
      }

      if (e.key === "Escape") {
        clearPinTimerOnly();
        keyboardBufferRef.current = "";
        setPin("");
        setIsError(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearPinTimerOnly();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handlePinSubmit, handleCardLogin]);

  const cloudBg = terminalInfo.background || terminalInfo.bg ||
    profileInfo.background_img || profileInfo.bg || profileInfo.background;

  return (
    <>
      <Container fluid className="p-0 vh-100 overflow-hidden">
        <Row className="g-0 h-100">
          <ImageSection
            backgroundImg={cloudBg}
          />

          <Col xs={12} md={6} lg={5} xl={4} className="p-0 h-100">
            <div className="LeftBoxContainer">
              <div className="infoHeader">
                <button
                  className="supportBtn"
                  onClick={() => setIsSupportModalOpen(true)}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 12C4 7.58 7.58 4 12 4C16.42 4 20 7.58 20 12"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M4 12V16C4 17.1 4.9 18 6 18H7V12H4Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M20 12V16C20 17.1 19.1 18 18 18H17V12H20Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="support-text">Texniki dəstək</span>
                </button>

                <div className="statusIcons">
                  <button
                    className="burgerMenuBtn"
                    onClick={() => setIsSettingsMenuOpen(true)}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3 7H21"
                        stroke="#747474"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M3 12H21"
                        stroke="#747474"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M3 17H21"
                        stroke="#747474"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  <div className="wifi-badge-container">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2 8.3601C8.06 3.6801 15.94 3.6801 22 8.3601"
                        stroke={!isOnline || !hasInternet ? "#FFA500" : (syncCount > 0 ? "#F59E0B" : "#00FF6A")}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M4.91 11.8401C9.21 8.5201 14.8 8.5201 19.1 11.8401"
                        stroke={!isOnline || !hasInternet ? "#FFA500" : (syncCount > 0 ? "#F59E0B" : "#00FF6A")}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M6.79 15.4902C9.94 13.0502 14.05 13.0502 17.2 15.4902"
                        stroke={!isOnline || !hasInternet ? "#FFA500" : (syncCount > 0 ? "#F59E0B" : "#00FF6A")}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9.4 19.1501C10.98 17.9301 13.03 17.9301 14.61 19.1501"
                        stroke={!isOnline || !hasInternet ? "#FFA500" : (syncCount > 0 ? "#F59E0B" : "#00FF6A")}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {showSyncedBadge && syncedCount > 0 && <span className="sync-badge-done">{syncedCount}</span>}
                    {syncCount > 0 && <span className="sync-badge-pending">{syncCount}</span>}
                  </div>
                </div>
              </div>

              <div className="logoContainer">
                <button
                  type="button"
                  className="pin-logo-secret-tap"
                  onClick={handleLogoSecretTap}
                  title=""
                  aria-label="Logo"
                >
                  <img
                    src={logoSrc}
                    alt="logo"
                    onError={(e) => {
                      if (e.target.src !== DefaultLogo) {
                        e.target.src = DefaultLogo;
                      }
                    }}
                    style={{ maxHeight: "150px", maxWidth: "250px", objectFit: "contain", pointerEvents: "none" }}
                    draggable={false}
                  />
                </button>
              </div>

              {/* Payment Warning Banner */}
              {(() => {
                const npd = activeProfileData?.data?.profile?.next_payment_date;
                if (!npd) return null;
                const now = new Date(); now.setHours(0, 0, 0, 0);
                const payDate = new Date(npd); payDate.setHours(0, 0, 0, 0);
                const daysLeft = Math.ceil((payDate - now) / (1000 * 60 * 60 * 24));
                if (daysLeft > 3 || daysLeft < 0) return null;
                return (
                  <div className="payment-warning-banner">
                    <div className="warning-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>
                    </div>
                    <span className="warning-text">
                      Abunəliyinizin bitmə tarixi yaxınlaşır! <strong>{daysLeft === 0 ? "Bu gün" : `${daysLeft} gün`}</strong> qalıb.
                    </span>
                  </div>
                );
              })()}

              <div className="pinContainer">
                <div className="pinHeader">
                  <span className="pinText">PIN Kodu daxil edin</span>
                </div>

                <div className="pinDots">
                  {Array.from({ length: PIN_LENGTH }).map((_, index) => (
                    <PinDot
                      key={index}
                      filled={index < pin.length}
                      isError={isError}
                    />
                  ))}
                </div>

                <div className="pinKeypad">
                  <div className="pinKeypadRow">
                    <NumberButton value={1} onClick={handleNumberClick}>1</NumberButton>
                    <NumberButton value={2} onClick={handleNumberClick}>2</NumberButton>
                    <NumberButton value={3} onClick={handleNumberClick}>3</NumberButton>
                  </div>
                  <div className="pinKeypadRow">
                    <NumberButton value={4} onClick={handleNumberClick}>4</NumberButton>
                    <NumberButton value={5} onClick={handleNumberClick}>5</NumberButton>
                    <NumberButton value={6} onClick={handleNumberClick}>6</NumberButton>
                  </div>
                  <div className="pinKeypadRow">
                    <NumberButton value={7} onClick={handleNumberClick}>7</NumberButton>
                    <NumberButton value={8} onClick={handleNumberClick}>8</NumberButton>
                    <NumberButton value={9} onClick={handleNumberClick}>9</NumberButton>
                  </div>
                  <div className="pinKeypadRow">
                    <NumberButton
                      value="clear"
                      onClick={handleClear}
                      variant="danger"
                    >
                      <ClearIcon />
                    </NumberButton>
                    <NumberButton value={0} onClick={handleNumberClick}>0</NumberButton>
                    <NumberButton
                      value="backspace"
                      onClick={handleBackspace}
                      variant="secondary"
                    >
                      <BackspaceIcon />
                    </NumberButton>
                  </div>
                </div>
              </div>

              <div className="terminalInfo">
                <span className="terminalId">{appVersion ? `T${appVersion}` : (terminalInfo?.name || "...")}</span>
                <span className="terminalDivider">•</span>
                <span className="terminalName">
                  Terminal: <strong>{terminalInfo?.terminal_id || "Terminal 1"}</strong>
                </span>
                <span className="terminalDivider">•</span>
                <span className="terminalBranch">
                  Filial: <strong>{profileInfo?.username || "Main"}</strong>
                </span>
              </div>
            </div>
          </Col>
        </Row>
      </Container>

      <SupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />

      <SettingsMenu
        isOpen={isSettingsMenuOpen}
        onClose={() => setIsSettingsMenuOpen(false)}
        onRefresh={handleRefresh}
        onBrandList={handleBrandList}
        onDownloadData={handleDownloadData}
        onQuitApp={handleQuitApp}
      />

      <PinAdvancedSettingsModal
        show={isPinAdvancedSettingsOpen}
        onClose={() => setIsPinAdvancedSettingsOpen(false)}
        onExitTerminal={handleExit}
      />

      <RefreshLoader isOpen={isRefreshing} syncCounts={pinSyncCounts} />

      <BrandsModal
        show={isBrandsModalOpen}
        onHide={() => setIsBrandsModalOpen(false)}
      />
    </>
  );
};

export default Pin;
