import React, { useState, useCallback, useEffect } from "react";
import ReactDOM from "react-dom";
import "./VirtualKeyboard.css";

const NUMBER_ROW = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

const ROWS_LOWER = [
  ["q", "ü", "e", "r", "t", "y", "u", "i", "o", "p", "ö", "ğ"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ı", "ə"],
  ["z", "x", "c", "v", "b", "n", "m", "ç", "ş"],
];

const ROWS_UPPER = [
  ["Q", "Ü", "E", "R", "T", "Y", "U", "İ", "O", "P", "Ö", "Ğ"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "I", "Ə"],
  ["Z", "X", "C", "V", "B", "N", "M", "Ç", "Ş"],
];

const VirtualKeyboard = ({ onKeyPress, onBackspace, onClose }) => {
  const [isUpper, setIsUpper] = useState(false);

  const rows = isUpper ? ROWS_UPPER : ROWS_LOWER;

  // Add/remove body class to push modals up
  useEffect(() => {
    document.body.classList.add("vk-keyboard-open");
    return () => {
      document.body.classList.remove("vk-keyboard-open");
    };
  }, []);

  const handleKeyPress = useCallback(
    (key) => {
      if (onKeyPress) onKeyPress(key);
    },
    [onKeyPress]
  );

  const handleBackspace = useCallback(() => {
    if (onBackspace) onBackspace();
  }, [onBackspace]);

  const handleSpace = useCallback(() => {
    if (onKeyPress) onKeyPress(" ");
  }, [onKeyPress]);

  const toggleShift = useCallback(() => {
    setIsUpper((prev) => !prev);
  }, []);

  const handleClose = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClose) onClose();
  }, [onClose]);

  const keyboard = (
    <div className="vk-overlay" onMouseDown={(e) => e.preventDefault()}>
      <div className="virtual-keyboard">
        {/* Title bar */}
        <div className="vk-titlebar">
          <div className="vk-titlebar-handle"></div>
          {onClose && (
            <button
              className="vk-close-btn"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={handleClose}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          )}
        </div>

        {/* Keyboard body */}
        <div className="vk-body">
          {/* Number Row */}
          <div className="vk-row">
            {NUMBER_ROW.map((key) => (
              <div
                className="vk-key"
                key={key}
                onClick={() => handleKeyPress(key)}
              >
                {key}
              </div>
            ))}
          </div>
          {/* Letter Rows */}
          {rows.map((row, rowIndex) => (
            <div className="vk-row" key={rowIndex}>
              {rowIndex === 2 && (
                <div
                  className={`vk-key vk-key-shift ${isUpper ? "vk-key-active" : ""}`}
                  onClick={toggleShift}
                >
                  <i className="bi bi-shift"></i>
                </div>
              )}
              {row.map((key) => (
                <div
                  className="vk-key"
                  key={key}
                  onClick={() => handleKeyPress(key)}
                >
                  {key}
                </div>
              ))}
              {rowIndex === 2 && (
                <div className="vk-key vk-key-backspace" onClick={handleBackspace}>
                  <i className="bi bi-backspace"></i>
                </div>
              )}
            </div>
          ))}
          <div className="vk-row vk-row-bottom">
            <div className="vk-key vk-key-space" onClick={handleSpace}>
              Boşluq
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(keyboard, document.body);
};

export default VirtualKeyboard;
