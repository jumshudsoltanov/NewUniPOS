import React, { useState, useEffect, useRef } from "react";
import { Modal } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import apiConfig from "../../utils/apiConfig";
import { t } from "../../utils/translations";
import { toast } from "react-toastify";
import { normalizeCardId } from "../../utils/cardId";
import "../Pin/Pin.css"; // Reuse Pin.css for numpad styles

const PIN_LENGTH = 4;

const PinDot = React.memo(({ filled, isError }) => (
  <div className={`pin-dot ${filled ? "filled" : ""} ${isError ? "error" : ""}`}>
    {filled ? (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" fill={isError ? "#ff4757" : "#053796"} />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke={isError ? "#ff4757" : "#053796"} strokeWidth="1" fill="none" />
      </svg>
    )}
  </div>
));

const NumberButton = React.memo(({ value, onClick, children, variant = "default" }) => (
  <button className={`pin-btn pin-btn-${variant}`} onClick={() => onClick(value)} type="button">
    {children || value}
  </button>
));

const BackspaceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M9.57 5.93L3.5 12L9.57 18.07" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20.5 12H3.67" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ClearIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AdminOverrideModal = ({ show, onHide, onSuccess, requiredPermissionKey, operationName }) => {
  const _dispatch = useDispatch();
  const [pin, setPin] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  
  const profileId = React.useMemo(() => {
    let id = loginedProfileData?.data?.profile?.id;
    if (!id) {
      try {
        const stored = JSON.parse(localStorage.getItem("authlogin") || "{}");
        id = stored?.data?.profile?.id;
      } catch {
        // Ignored
      }
    }
    return id;
  }, [loginedProfileData]);

  const keyboardBufferRef = useRef("");
  const pinTimerRef = useRef(null);

  const clearPinTimerOnly = () => {
    if (pinTimerRef.current) {
      clearTimeout(pinTimerRef.current);
      pinTimerRef.current = null;
    }
  };

  const verifyCard = React.useCallback(async (cardId) => {
    if (!profileId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ profile_id: String(profileId), card_id: normalizeCardId(cardId) });
      const res = await apiConfig.get(`/waiters/resolve?${params.toString()}`);
      const result = res.data;
      if (result && result.message === "success" && result.data) {
        const waiterData = result.data;
        if (waiterData[requiredPermissionKey]) {
          onSuccess();
          onHide();
        } else {
          setIsError(true);
          setPin("");
          toast.error(t("selahiyyetiniz_yoxdur") || "Səlahiyyətiniz yoxdur!");
        }
      } else {
        setIsError(true);
        setPin("");
      }
    } catch (err) {
      setIsError(true);
      setPin("");
      toast.error(err?.response?.data?.message || err?.message || "Səhv Kart");
    } finally {
      setIsLoading(false);
    }
  }, [profileId, requiredPermissionKey, onSuccess, onHide]);

  useEffect(() => {
    if (!show) return;
    const onKeyDown = (e) => {
      if (e.target.tagName.toLowerCase() === "input" || e.target.tagName.toLowerCase() === "textarea") return;
      
      clearPinTimerOnly();
      if (e.key !== "Enter") {
        keyboardBufferRef.current += e.key;
        pinTimerRef.current = setTimeout(() => {
          keyboardBufferRef.current = "";
        }, 300);
      }
      
      if (e.key === "Enter") {
        e.preventDefault();
        clearPinTimerOnly();
        const raw = keyboardBufferRef.current.trim();
        const digitsOnly = normalizeCardId(raw);
        keyboardBufferRef.current = "";
        if (digitsOnly) {
          verifyCard(digitsOnly);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [show, profileId, verifyCard]);

  useEffect(() => {
    if (show) {
      setPin("");
      setIsError(false);
    }
  }, [show]);

  const handleNumberClick = (num) => {
    if (pin.length < PIN_LENGTH) {
      setPin((prev) => prev + num);
      setIsError(false);
    }
  };

  const handleClear = () => {
    setPin("");
    setIsError(false);
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setIsError(false);
  };

  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      verifyPin();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const verifyPin = async () => {
    if (!profileId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ profile_id: String(profileId), pin: String(pin).trim() });
      const res = await apiConfig.get(`/waiters/resolve?${params.toString()}`);
      const result = res.data;
      if (result && result.message === "success" && result.data) {
        const waiterData = result.data;
        if (waiterData[requiredPermissionKey]) {
          onSuccess();
          onHide();
        } else {
          setIsError(true);
          setPin("");
          toast.error(t("selahiyyetiniz_yoxdur") || "Səlahiyyətiniz yoxdur!");
        }
      } else {
        setIsError(true);
        setPin("");
      }
    } catch (err) {
      setIsError(true);
      setPin("");
      toast.error(err?.response?.data?.message || err?.message || "Səhv PİN");
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <Modal show={show} onHide={onHide} centered backdrop="static" className="admin-override-modal" style={{ zIndex: 1060 }}>
      <Modal.Body className="d-flex flex-column align-items-center justify-content-center py-5" style={{ background: "#f8f9fa", borderRadius: "16px" }}>
        <h4 className="mb-2 fw-bold text-dark">{t("admin_sifresi_teleb_olunur") === "admin_sifresi_teleb_olunur" ? "Admin şifrəsi tələb olunur" : t("admin_sifresi_teleb_olunur")}</h4>
        <p className="text-muted mb-4 text-center">
          "{operationName}" {t("emeliyyati_ucun_selahiyyet_teleb_olunur") === "emeliyyati_ucun_selahiyyet_teleb_olunur" ? "əməliyyatı üçün səlahiyyət tələb olunur." : t("emeliyyati_ucun_selahiyyet_teleb_olunur")}
        </p>

        <div className="pinContainer" style={{ background: "transparent", padding: 0, minHeight: "auto", boxShadow: "none" }}>
          <div className="pinDots mb-4" style={{ justifyContent: "center" }}>
            {Array.from({ length: PIN_LENGTH }).map((_, index) => (
              <PinDot key={index} filled={index < pin.length} isError={isError} />
            ))}
          </div>

          <div className="pinKeypad mx-auto" style={{ gap: "15px", opacity: isLoading ? 0.5 : 1, pointerEvents: isLoading ? "none" : "auto", transform: "scale(0.85)", transformOrigin: "top center", marginBottom: "-40px" }}>
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
              <NumberButton value="clear" onClick={handleClear} variant="danger">
                <ClearIcon />
              </NumberButton>
              <NumberButton value={0} onClick={handleNumberClick}>0</NumberButton>
              <NumberButton value="backspace" onClick={handleBackspace} variant="secondary">
                <BackspaceIcon />
              </NumberButton>
            </div>
          </div>
        </div>

        <button 
          className="btn btn-light mt-4 px-4 py-2 text-muted fw-medium border shadow-sm"
          onClick={onHide}
          style={{ borderRadius: "12px" }}
        >
          {t("bagla")}
        </button>
      </Modal.Body>
    </Modal>
  );
};

export default AdminOverrideModal;
