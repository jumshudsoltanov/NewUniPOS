import { Col, Row, Container } from "react-bootstrap";
import "./Login.css";
import "../BlockPage/BlockPage.css";
import RightBoxContainerImg2 from "../../assets/images/PinContainerImagesDefault.jpg";
import DefaultLogo from "../../assets/images/unipos_logo.png";
import SupportModal from "../SupportModal/SupportModal";
import SettingsMenu from "../SettingsMenu/SettingsMenu";
import React, { useState, useCallback, useEffect, useRef } from "react";


import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { authPos } from "../../redux/Slices/LoginSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { menuWithCategories, menuWithGeneralCategories } from "../../redux/Slices/MenuSlice";
import { toast } from "sonner";
import RefreshLoader from "../RefreshLoader/RefreshLoader";
import BrandsModal from "../BrandsModal/BrandsModal";

const ImageSection = React.memo(({ backgroundImg }) => {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(RightBoxContainerImg2);

  useEffect(() => {
    const setBackground = () => {
      try {
        const authLogin = JSON.parse(localStorage.getItem("authlogin") || "{}");
        if (authLogin?.bg) {
          setCurrentSrc(authLogin.bg);
          return;
        }
      } catch (error) {
        console.error("Error parsing authlogin:", error);
      }

      if (backgroundImg) {
        if (backgroundImg.startsWith("data:") || backgroundImg.startsWith("http")) {
          setCurrentSrc(backgroundImg);
        } else {
          setCurrentSrc(`https://unipos.tech/${backgroundImg}`);
        }
      } else {
        setCurrentSrc(RightBoxContainerImg2);
      }
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

const Login = () => {
  const [isError, setIsError] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [brand, setBrand] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [password, setPassword] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBrandsModalOpen, setIsBrandsModalOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);

  let fallbackProfileData = null;
  try {
    const authResultStr = localStorage.getItem("authResult");
    if (authResultStr) fallbackProfileData = JSON.parse(authResultStr);
  } catch (err) {
    console.error("Error parsing authResult:", err);
  }

  const {
    pendingCount: syncCount,
    lastSyncedDelta: syncedCount,
    showSyncedBadge,
    isOnline,
    hasInternet
  } = useSelector((state) => state.SyncSlice);

  useEffect(() => {
    console.log("Login Mounted", loginedProfileData);
  }, []);

  const activeProfileData = loginedProfileData || fallbackProfileData;
  const terminalInfo = activeProfileData?.data?.terminal || {};
  const profileInfo = activeProfileData?.data?.profile || {};

  const handleRefresh = async () => {
    if (!loginedProfileData?.data?.profile?.id) {
      toast.error("Profil məlumatı yoxdur, səhifə yenilənə bilmədi.");
      return;
    }

    setIsRefreshing(true);
    const toastId = toast.loading("Məlumatlar yenilənir...");
    try {
      await Promise.all([
        dispatch(getTableGroups(loginedProfileData.data.profile.id)).unwrap(),
        dispatch(getActiveOrders({ profileId: loginedProfileData.data.profile.id })).unwrap(),
        dispatch(menuWithCategories(loginedProfileData.data.profile.id)).unwrap(),
        dispatch(menuWithGeneralCategories(loginedProfileData.data.profile.id)).unwrap(),
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

  const senToLoginBrand = async (e) => {
    if (e) e.preventDefault();
    const profileData = {
      username: brand ? brand.trim() : brand,
      terminalId: terminalId ? terminalId.trim() : terminalId,
      password: password ? String(password).trim() : password,
      login: true,
    };

    setIsRefreshing(true);
    try {
      const data = await dispatch(authPos(profileData)).unwrap();

      try {
        localStorage.setItem("profile", JSON.stringify(profileData));
        localStorage.setItem("authResult", JSON.stringify(data));

        const existingProfiles = JSON.parse(localStorage.getItem("authProfiles") || "[]");
        const filtered = existingProfiles.filter(p => !(p.profile.username === profileData.username && p.profile.terminalId === profileData.terminalId));
        filtered.push({ profile: profileData, authResult: data });
        localStorage.setItem("authProfiles", JSON.stringify(filtered));
      } catch (storageErr) {
        console.warn("Storage save failed (non-fatal):", storageErr);
      }

      if (data?.data?.profile?.id) {
        // Fire data preloading in background, don't await blocking the UI
        try {
          dispatch(getTableGroups(data.data.profile.id));
          dispatch(getActiveOrders({ profileId: data.data.profile.id }));
          dispatch(menuWithCategories(data.data.profile.id));
          dispatch(menuWithGeneralCategories(data.data.profile.id));
        } catch (preloadErr) {
          console.warn("Background pre-load triggered:", preloadErr);
        }
      }

      console.log("[AUTH] Login Thunk Success. Hiding loader and navigating...");
      setIsRefreshing(false);
      navigate("/pin");
    } catch (err) {
      console.error("Manual login failed:", err);
      setIsError(true);
      setIsRefreshing(false);
      toast.error(err?.data?.message || err?.message || "Login zamanı xəta baş verdi");
    }
  };



  return (
    <>
      <Container fluid className="p-0 vh-100 overflow-hidden">
        <Row className="g-0 h-100">

          {/* IMAGE SECTION */}
          <ImageSection
            backgroundImg={loginedProfileData?.data?.profile?.background_img}
          />

          {/* INFO SECTION */}
          <Col xs={12} md={6} lg={5} xl={4} className="p-0 h-100">
            <div className="LeftBoxContainer">
              {/* Header */}
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

              {/* Logo */}
              <div className="logoContainer">
                <img src={DefaultLogo} alt="logo" />
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

              {/* Login Container */}
              <div className="loginFormContainer">
                {step === 1 ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setStep(2);
                    }}
                  >
                    <div className="inputGroup">
                      <div className="inputIcon">
                        <i className="bi bi-microsoft"></i>
                      </div>
                      <input
                        type="text"
                        placeholder="Müəssisə"
                        className="customInput"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <button type="submit" className="actionBtn">
                      İrəli
                    </button>
                  </form>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      senToLoginBrand();
                    }}
                  >
                    <div className="inputGroup mb-3">
                      <div className="inputIcon">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M20 17H4C2.89543 17 2 16.1046 2 15V5C2 3.89543 2.89543 3 4 3H20C21.1046 3 22 3.89543 22 5V15C22 16.1046 21.1046 17 20 17Z"
                            stroke="#292D32"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M8 21H16"
                            stroke="#292D32"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M12 17V21"
                            stroke="#292D32"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Terminal ID"
                        className="customInput"
                        value={terminalId}
                        onChange={(e) => setTerminalId(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="inputGroup mb-3">
                      <div className="inputIcon">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M6 10V8C6 4.69 7 2 12 2C17 2 18 4.69 18 8V10"
                            stroke="#292D32"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M17 22H7C3 22 2 21 2 17V15C2 11 3 10 7 10H17C21 10 22 11 22 15V17C22 21 21 22 17 22Z"
                            stroke="#292D32"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M15.9965 16H16.0054"
                            stroke="#292D32"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M11.9955 16H12.0045"
                            stroke="#292D32"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M7.99451 16H8.00349"
                            stroke="#292D32"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <input
                        type="password"
                        placeholder="Şifrə"
                        className="customInput"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="backBtn"
                        onClick={() => setStep(1)}
                      >
                        Geri
                      </button>
                      <button
                        type="submit"
                        className="actionBtn flex-grow-1"
                        onClick={senToLoginBrand}
                      >
                        Daxil ol
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Terminal Info Footer */}
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

      {/* Support Modal */}
      <SupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        terminalId={terminalInfo?.name || "P3257"}
        terminalName={terminalInfo?.terminal_id || "Terminal 1"}
        branchName={profileInfo?.username || "Main"}
      />

      {/* Settings Menu */}
      <SettingsMenu
        isOpen={isSettingsMenuOpen}
        onClose={() => setIsSettingsMenuOpen(false)}
        onRefresh={handleRefresh}
        onBrandList={handleBrandList}
        onDownloadData={handleDownloadData}
        onExit={handleExit}
        onQuitApp={handleQuitApp}
      />

      {/* Refreshing Overlay */}
      <RefreshLoader isOpen={isRefreshing} />

      {/* Brands Modal */}
      <BrandsModal
        show={isBrandsModalOpen}
        onHide={() => setIsBrandsModalOpen(false)}
      />
    </>
  );
};

export default Login;
