import React, { useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { t } from "../../utils/translations";
import "../DiscountModal/DiscountModal.css";

const DeleteQtyModal = React.memo(({ show, onClose, onConfirm, product }) => {
  const [value, setValue] = useState("1");
  const [isFirstKeypress, setIsFirstKeypress] = useState(true);
  const maxQty = Number(product?.count || 1);

  useEffect(() => {
    if (show) {
      setValue("1");
      setIsFirstKeypress(true);
    }
  }, [show]);

  const handleNumClick = (num) => {
    let newVal;
    if (isFirstKeypress) {
      newVal = num.toString();
      setIsFirstKeypress(false);
    } else {
      if (value === "0") {
        newVal = num.toString();
      } else {
        newVal = value + num.toString();
      }
    }
    
    const valNum = parseInt(newVal, 10);
    if (valNum > maxQty) {
      setValue(String(maxQty));
    } else {
      setValue(String(valNum));
    }
  };

  const handleBackspace = () => {
    if (value.length > 1) {
      setValue(value.slice(0, -1));
    } else {
      setValue("0");
    }
  };

  const handleClear = () => {
    setValue("0");
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      animation={false}
      dialogClassName="custom-modal-width"
      contentClassName="custom-modal-content"
    >
      <div className="discount-modal-container">
        {/* Header */}
        <div className="discount-header">
          <div className="header-left">
            <div className="header-icon">
              <i className="bi bi-trash3-fill" style={{ color: '#053796', fontSize: '20px' }}></i>
            </div>
            <span className="header-title">{t("silinecek_say")}</span>
          </div>
          <button className="close-btn" onClick={onClose}>
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
        <div className="discount-body">
          <div style={{ fontSize: '13px', color: '#888', padding: '4px 12px 0', textAlign: 'right' }}>
            Maksimum: {maxQty} ədəd
          </div>

          {/* Input Area */}
          <div className="input-row">
            <div className="input-wrapper" style={{ flex: 1, marginRight: 0 }}>
              <input
                type="text"
                value={value}
                readOnly
                className="discount-input"
              />
            </div>
          </div>

          {/* Keypad */}
          <div className="keypad-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                className="keypad-btn"
                onClick={() => handleNumClick(num)}
              >
                {num}
              </button>
            ))}
            <button className="keypad-btn" onClick={() => handleNumClick(0)} style={{ gridColumn: 'span 2' }}>
              0
            </button>
            <button
              className="keypad-btn backspace-btn"
              onClick={handleBackspace}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-9.172a2 2 0 00-1.414.586L3 12z"
                />
              </svg>
            </button>
          </div>

          {/* Footer Actions */}
          <div className="action-row">
            <button className="delete-all-btn" onClick={handleClear}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
            <button
              className="apply-btn"
              onClick={() => {
                const qty = parseInt(value, 10);
                if (qty > 0) {
                  onConfirm(qty >= maxQty ? 'full' : 'partial', qty);
                }
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: "8px" }}
              >
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>{t("tesdiqle")}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
});

export default DeleteQtyModal;
