import React, { useState, useEffect } from "react";
import { Modal } from "react-bootstrap";
import { toast } from "sonner";
import "../DiscountModal/DiscountModal.css";
import "../SettingsMenu/SettingsMenu.css";
import "./PinAdvancedSettingsModal.css";
import apiConfig from "../../utils/apiConfig";

const PinAdvancedSettingsModal = ({ show, onClose, onExitTerminal }) => {
  const [resettingDb, setResettingDb] = useState(false);
  const [showDbResetConfirm, setShowDbResetConfirm] = useState(false);

  useEffect(() => {
    if (!show) setShowDbResetConfirm(false);
  }, [show]);

  const handleOpenDevtools = async () => {
    if (!window.electronAPI?.openDevToolsDetached) {
      toast.error("Bu funksiya yalnız desktop (Electron) tətbiqində mövcuddur.");
      return;
    }
    const res = await window.electronAPI.openDevToolsDetached();
    if (res?.ok) {
      toast.success("Developer Tools ayrıca pəncərədə açıldı.");
    } else {
      toast.error(res?.message || "DevTools açıla bilmədi.");
    }
    onClose();
  };

  const handleAskResetDatabase = () => {
    setShowDbResetConfirm(true);
  };

  const executeResetDatabase = async () => {
    setResettingDb(true);
    try {
      const { data } = await apiConfig.post("/admin/reset-local-database");
      if (data?.ok) {
        toast.success(data.message || "Baza sıfırlandı.");
        try {
          localStorage.removeItem("profile");
          localStorage.removeItem("authResult");
          localStorage.removeItem("authlogin");
        } catch (_) {
          /* ignore */
        }
        setShowDbResetConfirm(false);
        onClose();
        window.location.reload();
      } else {
        toast.error(data?.message || "Sıfırlama alınmadı.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Serverə qoşula bilmədi və ya xəta baş verdi.");
    } finally {
      setResettingDb(false);
    }
  };

  const handleModalHide = () => {
    if (showDbResetConfirm) {
      setShowDbResetConfirm(false);
      return;
    }
    onClose();
  };

  const handleExitTerminal = () => {
    onClose();
    onExitTerminal?.();
  };

  return (
    <Modal
      show={show}
      onHide={handleModalHide}
      centered
      animation={false}
      dialogClassName="custom-modal-width"
      contentClassName="custom-modal-content"
    >
      <div className="discount-modal-container">
        <div className="discount-header">
          <div className="header-left">
            <div className="header-icon">
              {showDbResetConfirm ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#053796"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              )}
            </div>
            <span className="header-title">{showDbResetConfirm ? "Databaseni sıfırla" : "Ayarlar"}</span>
          </div>
          <button type="button" className="close-btn" onClick={handleModalHide}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {showDbResetConfirm ? (
          <div className="discount-body pin-advanced-reset-confirm-body">
            <p className="pin-advanced-reset-confirm-text">
              Bütün lokal verilənlər bazası silinəcək (masalar, sifarişlər, menyu surəti və s.).
              <strong> Bu geri qaytarılmır.</strong> Davam edək?
            </p>
            <div className="action-row pin-advanced-reset-confirm-actions">
              <button
                type="button"
                className="delete-all-btn pin-advanced-reset-cancel"
                onClick={() => setShowDbResetConfirm(false)}
                disabled={resettingDb}
              >
                İmtina
              </button>
              <button
                type="button"
                className="apply-btn pin-advanced-reset-confirm-btn"
                onClick={executeResetDatabase}
                disabled={resettingDb}
              >
                {resettingDb ? "Sıfırlanır..." : "Bəli, sıfırla"}
              </button>
            </div>
          </div>
        ) : (
        <div className="discount-body pin-advanced-settings-body">
          <div className="settings-menu-items pin-advanced-settings-items">
            <button
              type="button"
              className="settings-menu-item danger"
              onClick={handleExitTerminal}
            >
              <span className="settings-menu-item-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
              <span className="settings-menu-item-label">Terminaldan çıx</span>
            </button>

            <button
              type="button"
              className="settings-menu-item danger"
              onClick={handleAskResetDatabase}
              disabled={resettingDb}
            >
              <span className="settings-menu-item-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </span>
              <span className="settings-menu-item-label">
                {resettingDb ? "Sıfırlanır..." : "Databaseni sıfırla"}
              </span>
            </button>

            <button type="button" className="settings-menu-item" onClick={handleOpenDevtools}>
              <span className="settings-menu-item-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </span>
              <span className="settings-menu-item-label">Devtools açmaq</span>
            </button>
          </div>
        </div>
        )}
      </div>
    </Modal>
  );
};

export default PinAdvancedSettingsModal;
