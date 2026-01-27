import { Col, Row, Container } from "react-bootstrap";
import "./Login.css";
import RightBoxContainerImg2 from "../../assets/images/PinContainerImagesDefault.jpg";
import DefaultLogo from "../../assets/images/unipos_logo.png";
import SupportModal from "../SupportModal/SupportModal";
import SettingsMenu from "../SettingsMenu/SettingsMenu";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { authPos } from "../../redux/Slices/LoginSlice";
import { useEffect } from "react";

const Login = () => {
  const [isError, setIsError] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [brand, setBrand] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [password, setPassword] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const [checkingLogin, setCheckingLogin] = useState(true);

  // Settings menu handlers
  const handleRefresh = () => {
    window.location.reload();
  };

  const handleBrandList = () => {
    console.log("Brend siyahısı");
  };

  const handleDownloadData = () => {
    console.log("Məlumatları yüklə");
  };

  const handleExit = () => {
    console.log("Terminaldan çıx");
  };

  const senToLoginBrand = async () => {
    const profileData = {
      username: brand,
      terminalId: terminalId,
      password: password,
      login: true,
    };

    try {
      setCheckingLogin(true); // Show loader while logging in
      await dispatch(authPos(profileData)).unwrap();
      localStorage.setItem("profile", JSON.stringify(profileData));
      navigate("/pin");
    } catch (err) {
      console.error("Manual login failed:", err);
      setIsError(true);
    } finally {
      setCheckingLogin(false);
    }
  };

  useEffect(() => {
    const storageData = JSON.parse(localStorage.getItem("profile"));
    if (!storageData) {
      setCheckingLogin(false);
      return;
    }

    const loginAndRedirect = async () => {
      try {
        await dispatch(authPos(storageData)).unwrap();
        navigate("/pin");
      } catch (err) {
        console.log("Login failed", err);
      } finally {
        setCheckingLogin(false);
      }
    };

    loginAndRedirect();
  }, [dispatch, navigate]);

  return (
    <>
      <Container fluid className="p-0 vh-100 overflow-hidden">
        <Row className="g-0 h-100">
          {/* IMAGE SECTION */}
          <Col md={6} lg={7} xl={8} className="d-none d-md-block p-0 h-100">
            <div
              className="RightBoxContainer"
              style={{ backgroundImage: `url(${RightBoxContainerImg2})` }}
            />
          </Col>

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
                  <span>Texniki dəstək</span>
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
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2 8.3601C8.06 3.6801 15.94 3.6801 22 8.3601"
                      stroke="#00FF6A"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4.91 11.8401C9.21 8.5201 14.8 8.5201 19.1 11.8401"
                      stroke="#00FF6A"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6.79 15.4902C9.94 13.0502 14.05 13.0502 17.2 15.4902"
                      stroke="#00FF6A"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9.4 19.1501C10.98 17.9301 13.03 17.9301 14.61 19.1501"
                      stroke="#00FF6A"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Logo */}
              <div className="logoContainer">
                <img src={DefaultLogo} alt="logo" />
              </div>

              {/* Login Container */}
              <div className="loginFormContainer">
                {checkingLogin ? (
                  <div className="loginLoadingState">
                    <div className="premium-loader">
                      <div className="loader-ring"></div>
                      <div className="loader-dot"></div>
                    </div>
                    <p className="loadingText">Məlumatlar yoxlanılır...</p>
                  </div>
                ) : step === 1 ? (
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
                            d="M12 2C7.58 2 4 5.58 4 10V14H20V10C20 5.58 16.42 2 12 2Z"
                            stroke="#292D32"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M16 14H8V20C8 21.1 8.9 22 10 22H14C15.1 22 16 21.1 16 20V14Z"
                            stroke="#292D32"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M11 17H13"
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
                <span className="terminalId">P3257</span>
                <span className="terminalDivider">•</span>
                <span className="terminalName">
                  Terminal: <strong>Terminal 1</strong>
                </span>
                <span className="terminalDivider">•</span>
                <span className="terminalBranch">
                  Filial: <strong>Main</strong>
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
        terminalId="P3257"
        terminalName="Terminal 1"
        branchName="Main"
      />

      {/* Settings Menu */}
      <SettingsMenu
        isOpen={isSettingsMenuOpen}
        onClose={() => setIsSettingsMenuOpen(false)}
        onRefresh={handleRefresh}
        onBrandList={handleBrandList}
        onDownloadData={handleDownloadData}
        onExit={handleExit}
      />
    </>
  );
};

export default Login;
