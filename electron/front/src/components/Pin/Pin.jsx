import { Col, Row, Container } from "react-bootstrap";
import "./Pin.css";
import "../BlockPage/BlockPage.css";
import RightBoxContainerImg2 from "../../assets/images/PinContainerImagesDefault.jpg";
import DefaultLogo from "../../assets/images/unipos_logo.png";
import SupportModal from "../SupportModal/SupportModal";
import SettingsMenu from "../SettingsMenu/SettingsMenu";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { getWaiter } from "../../redux/Slices/WaitersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { menuWithCategories, menuWithGeneralCategories } from "../../redux/Slices/MenuSlice";
import { toast } from "sonner";
import RefreshLoader from "../RefreshLoader/RefreshLoader";
import BrandsModal from "../BrandsModal/BrandsModal";

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
  const [isBrandsModalOpen, setIsBrandsModalOpen] = useState(false);
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
    const toastId = toast.loading("Məlumatlar yenilənir...");
    try {
      await Promise.all([
        dispatch(getTableGroups(activeProfileData.data.profile.id)).unwrap(),
        dispatch(getActiveOrders({ profileId: activeProfileData.data.profile.id })).unwrap(),
        dispatch(menuWithCategories(activeProfileData.data.profile.id)).unwrap(),
        dispatch(menuWithGeneralCategories(activeProfileData.data.profile.id)).unwrap(),
        new Promise(resolve => setTimeout(resolve, 5000))
      ]);
      toast.success("Məlumatlar uğurla yeniləndi!", { id: toastId });
    } catch (error) {
      console.error("Yeniləmə xətası:", error);
      toast.error("Yeniləmə zamanı xəta baş verdi.", { id: toastId });
    } finally {
      setIsRefreshing(false);
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
    window.location.href = "/#/";
  };

  const handleQuitApp = () => {
    if (window.electronAPI?.quitApp) {
      window.electronAPI.quitApp();
    } else {
      window.close();
    }
  };

  const handlePinSubmit = async (submittedPin) => {
    try {
      const waiterResult = await dispatch(getWaiter(submittedPin)).unwrap();

      if (waiterResult.message === "success") {
        // Immediate navigation to eliminate perceived lag
        navigate("/tables");

        // Prefetch data in the background without blocking the UI transition
        if (loginedProfileData?.data?.profile?.id) {
          const profileId = loginedProfileData.data.profile.id;
          dispatch(getTableGroups(profileId));
          dispatch(menuWithCategories(profileId));
          dispatch(menuWithGeneralCategories(profileId));
        }
      } else {
        setIsError(true);
        setTimeout(() => {
          setIsError(false);
          setPin("");
        }, 500);
      }
    } catch (error) {
      setIsError(true);
      setTimeout(() => {
        setIsError(false);
        setPin("");
      }, 500);
    }
  };

  const handleNumberClick = useCallback(
    (num) => {
      setPin((prev) => {
        if (prev.length < PIN_LENGTH) {
          const next = prev + num;
          setIsError(false);
          if (next.length === PIN_LENGTH) {
            handlePinSubmit(next);
          }
          return next;
        }
        return prev;
      });
    },
    [dispatch, navigate, loginedProfileData],
  );

  const handleBackspace = useCallback(() => {
    setPin((prev) => {
      if (prev.length > 0) {
        setIsError(false);
        return prev.slice(0, -1);
      }
      return prev;
    });
  }, []);

  const handleClear = useCallback(() => {
    setPin("");
    setIsError(false);
  }, []);

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
                <img
                  src={logoSrc}
                  alt="logo"
                  onError={(e) => {
                    if (e.target.src !== DefaultLogo) {
                      e.target.src = DefaultLogo;
                    }
                  }}
                  style={{ maxHeight: "150px", maxWidth: "250px", objectFit: "contain" }}
                />
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
                <span className="terminalId">{terminalInfo?.name || "P3257"}</span>
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
        terminalId={terminalInfo?.name || "P3257"}
        terminalName={terminalInfo?.terminal_id || "Terminal 1"}
        branchName={profileInfo?.username || "Main"}
      />

      <SettingsMenu
        isOpen={isSettingsMenuOpen}
        onClose={() => setIsSettingsMenuOpen(false)}
        onRefresh={handleRefresh}
        onBrandList={handleBrandList}
        onDownloadData={handleDownloadData}
        onExit={handleExit}
        onQuitApp={handleQuitApp}
      />

      <RefreshLoader isOpen={isRefreshing} />

      <BrandsModal
        show={isBrandsModalOpen}
        onHide={() => setIsBrandsModalOpen(false)}
      />
    </>
  );
};

export default Pin;
