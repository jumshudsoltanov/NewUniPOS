import { Col, Row, Container } from "react-bootstrap";
import "./Pin.css";
import RightBoxContainerImg2 from "../../assets/images/PinContainerImagesDefault.jpg";
import DefaultLogo from "../../assets/images/unipos_logo.png";
import SupportModal from "../SupportModal/SupportModal";
import SettingsMenu from "../SettingsMenu/SettingsMenu";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { getWaiter } from "../../redux/Slices/WaitersSlice";

const PIN_LENGTH = 4;
const Pin = () => {
  const [pin, setPin] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const dispatch = useDispatch();
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const navigate = useNavigate();

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

  const handleNumberClick = useCallback(
    (num) => {
      if (pin.length < PIN_LENGTH) {
        const newPin = pin + num;
        setPin(newPin);
        setIsError(false);
        if (newPin.length === PIN_LENGTH) {
          handlePinSubmit(newPin);
        }
      }
    },
    [pin],
  );

  const handleBackspace = useCallback(() => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setIsError(false);
    }
  }, [pin]);

  const handleClear = useCallback(() => {
    setPin("");
    setIsError(false);
  }, []);

  const handlePinSubmit = async (submittedPin) => {
    const result = await dispatch(getWaiter(submittedPin)).unwrap();
    if (result.message === "success") {
      navigate("/tables");
    } else {
      setIsError(true);
      setTimeout(() => {
        setIsError(false);
        setPin("");
      }, 500);
    }
  };

  const PinDot = ({ filled, isError }) => (
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
  );

  const NumberButton = ({ value, onClick, children, variant = "default" }) => (
    <button
      className={`pin-btn pin-btn-${variant}`}
      onClick={() => onClick(value)}
      type="button"
    >
      {children || value}
    </button>
  );

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

              {/* PIN Container */}
              <div className="pinContainer">
                {/* PIN Header */}
                <div className="pinHeader">
                  <span className="pinText">PIN Kodu daxil edin</span>
                </div>

                {/* PIN Dots */}
                <div className="pinDots">
                  {Array.from({ length: PIN_LENGTH }).map((_, index) => (
                    <PinDot
                      key={index}
                      filled={index < pin.length}
                      isError={isError}
                    />
                  ))}
                </div>

                {/* PIN Keypad */}
                <div className="pinKeypad">
                  {/* Row 1: 1-2-3 */}
                  <div className="pinKeypadRow">
                    <NumberButton value={1} onClick={handleNumberClick}>
                      1
                    </NumberButton>
                    <NumberButton value={2} onClick={handleNumberClick}>
                      2
                    </NumberButton>
                    <NumberButton value={3} onClick={handleNumberClick}>
                      3
                    </NumberButton>
                  </div>

                  {/* Row 2: 4-5-6 */}
                  <div className="pinKeypadRow">
                    <NumberButton value={4} onClick={handleNumberClick}>
                      4
                    </NumberButton>
                    <NumberButton value={5} onClick={handleNumberClick}>
                      5
                    </NumberButton>
                    <NumberButton value={6} onClick={handleNumberClick}>
                      6
                    </NumberButton>
                  </div>

                  {/* Row 3: 7-8-9 */}
                  <div className="pinKeypadRow">
                    <NumberButton value={7} onClick={handleNumberClick}>
                      7
                    </NumberButton>
                    <NumberButton value={8} onClick={handleNumberClick}>
                      8
                    </NumberButton>
                    <NumberButton value={9} onClick={handleNumberClick}>
                      9
                    </NumberButton>
                  </div>

                  {/* Row 4: Clear-0-Backspace */}
                  <div className="pinKeypadRow">
                    <NumberButton
                      value="clear"
                      onClick={handleClear}
                      variant="danger"
                    >
                      <ClearIcon />
                    </NumberButton>
                    <NumberButton value={0} onClick={handleNumberClick}>
                      0
                    </NumberButton>
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

export default Pin;
