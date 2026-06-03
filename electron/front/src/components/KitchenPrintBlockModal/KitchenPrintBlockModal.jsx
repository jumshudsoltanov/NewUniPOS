import React, { useCallback, useEffect, useState } from "react";
import "./KitchenPrintBlockModal.css";
import Modal from "react-bootstrap/Modal";
import { useSelector } from "react-redux";
import apiConfig from "../../utils/apiConfig";

const KitchenPrintBlockModal = React.memo(({ show, onClose }) => {
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const [blockedPrinters, setBlockedPrinters] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPrinters = async () => {
      const profileId = loginedProfileData?.data?.profile?.id;
      if (!profileId) return;
      
      setLoading(true);
      try {
        const prRes = await apiConfig.get(`/pos/printers/${profileId}`);
        setPrinters(prRes.data.data || []);
      } catch (error) {
        console.error("Failed to fetch printers:", error);
      } finally {
        setLoading(false);
      }
    };

    if (show) {
      fetchPrinters();
    }
  }, [show, loginedProfileData]);

  useEffect(() => {
    if (show) {
      try {
        const saved = localStorage.getItem("pos_blocked_printers");
        if (saved) {
          setBlockedPrinters(JSON.parse(saved));
        } else {
          setBlockedPrinters([]);
        }
      } catch (e) {
        setBlockedPrinters([]);
      }
    }
  }, [show]);

  const handleTogglePrinter = (printerId) => {
    setBlockedPrinters((prev) => {
      if (prev.includes(printerId)) {
        return prev.filter((id) => id !== printerId);
      }
      return [...prev, printerId];
    });
  };

  const handleApply = useCallback(() => {
    try {
      localStorage.setItem("pos_blocked_printers", JSON.stringify(blockedPrinters));
      window.dispatchEvent(new CustomEvent("kitchenPrintBlockedChanged", { detail: blockedPrinters }));
    } catch (e) {
      console.error(e);
    }
    onClose(false);
  }, [blockedPrinters, onClose]);

  return (
    <Modal
      show={show}
      onHide={() => onClose(false)}
      centered
      animation={false}
      dialogClassName="kitchen-block-modal-width"
      contentClassName="custom-modal-content"
    >
      <div className="kitchen-block-modal-container">
        {/* Header */}
        <div className="kitchen-block-header">
          <div className="header-left">
            <div className="header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
            </div>
            <span className="header-title">Çapın bloklanması</span>
          </div>
          <button className="close-btn" onClick={() => onClose(false)}>
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="kitchen-block-body">
          <p className="kitchen-block-subtitle">Printerləri idarə edin (Mavi rəngdə olanlar çap edəcək, qırmızı olanlar bloklanıb):</p>
          <div className="printers-list">
            {loading ? (
              <div className="no-printers">
                <i className="bi bi-arrow-repeat spin" style={{ marginRight: '8px', fontSize: '18px' }}></i>
                Printerlər yüklənir...
              </div>
            ) : printers.length > 0 ? (
              printers.map((printer) => {
                const isBlocked = blockedPrinters.includes(printer.id);
                return (
                  <div
                    key={printer.id}
                    className={`printer-item ${isBlocked ? "blocked" : "active"}`}
                    onClick={() => handleTogglePrinter(printer.id)}
                  >
                    <div className="printer-info-left">
                       <div className="printer-item-icon">
                         {Number(printer.is_cashier) === 1 ? (
                           <i className="bi bi-receipt"></i>
                         ) : (
                           <i className="bi bi-printer"></i>
                         )}
                       </div>
                       <div className="printer-item-details">
                         <span className="printer-name">{printer.local_name || printer.name}</span>
                         <span className="printer-type">
                           {Number(printer.is_cashier) === 1 ? 'Kassa Printeri' : 'Mətbəx Printeri'}
                           {printer.ip ? ` • ${printer.ip}` : ''}
                         </span>
                       </div>
                    </div>
                    
                    <div className="printer-status-right">
                      {isBlocked ? (
                        <span className="status-badge blocked-badge">Bloklanıb</span>
                      ) : (
                        <span className="status-badge active-badge">Aktivdir</span>
                      )}
                      <div className={`block-switch ${!isBlocked ? "active" : ""}`}>
                        <div className="switch-handle"></div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="no-printers">
                <i className="bi bi-exclamation-circle" style={{ fontSize: '24px', display: 'block', marginBottom: '8px', color: '#94a3b8' }}></i>
                Sistemdə printer tapılmadı
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="action-row">
            <button
              className="apply-btn"
              onClick={handleApply}
            >
              Tətbiq et
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
});

export default KitchenPrintBlockModal;
