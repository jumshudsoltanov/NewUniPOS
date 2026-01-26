import { useState } from "react";
import "./SupportModal.css";

const SupportModal = ({ isOpen, onClose, terminalId, terminalName, branchName }) => {
    if (!isOpen) return null;

    const phoneNumber = "+994705401040";

    // QR kod URL - WhatsApp link
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://wa.me/994705401040`;

    const handleCall = () => {
        window.location.href = `tel:${phoneNumber}`;
    };

    const handleOverlayClick = (e) => {
        if (e.target.classList.contains("support-modal-overlay")) {
            onClose();
        }
    };

    return (
        <div className="support-modal-overlay" onClick={handleOverlayClick}>
            <div className="support-modal">
                {/* Header */}
                <div className="support-modal-header">
                    <h2 className="support-modal-title">Texniki dəstək</h2>
                    <button className="support-modal-close" onClick={onClose}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                {/* Phone Section */}
                <div className="support-phone-section" onClick={handleCall}>
                    <div className="support-phone-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <path d="M21.97 18.33C21.97 18.69 21.89 19.06 21.72 19.42C21.55 19.78 21.33 20.12 21.04 20.44C20.55 20.98 20.01 21.37 19.4 21.62C18.8 21.87 18.15 22 17.45 22C16.43 22 15.34 21.76 14.19 21.27C13.04 20.78 11.89 20.12 10.75 19.29C9.6 18.45 8.51 17.52 7.47 16.49C6.44 15.45 5.51 14.36 4.68 13.22C3.86 12.08 3.2 10.94 2.72 9.81C2.24 8.67 2 7.58 2 6.54C2 5.86 2.12 5.21 2.36 4.61C2.6 4 2.98 3.44 3.51 2.94C4.15 2.31 4.85 2 5.59 2C5.87 2 6.15 2.06 6.4 2.18C6.66 2.3 6.89 2.48 7.07 2.74L9.39 6.01C9.57 6.26 9.7 6.49 9.79 6.71C9.88 6.92 9.93 7.13 9.93 7.32C9.93 7.56 9.86 7.8 9.72 8.03C9.59 8.26 9.4 8.5 9.16 8.74L8.4 9.53C8.29 9.64 8.24 9.77 8.24 9.93C8.24 10.01 8.25 10.08 8.27 10.16C8.3 10.24 8.33 10.3 8.35 10.36C8.53 10.69 8.84 11.12 9.28 11.64C9.73 12.16 10.21 12.69 10.73 13.22C11.27 13.75 11.79 14.24 12.32 14.69C12.84 15.13 13.27 15.43 13.61 15.61C13.66 15.63 13.72 15.66 13.79 15.69C13.87 15.72 13.95 15.73 14.04 15.73C14.21 15.73 14.34 15.67 14.45 15.56L15.21 14.81C15.46 14.56 15.7 14.37 15.93 14.25C16.16 14.11 16.39 14.04 16.64 14.04C16.83 14.04 17.03 14.08 17.25 14.17C17.47 14.26 17.7 14.39 17.95 14.56L21.26 16.91C21.52 17.09 21.7 17.3 21.81 17.55C21.91 17.8 21.97 18.05 21.97 18.33Z" fill="white" />
                        </svg>
                    </div>
                    <div className="support-phone-info">
                        <span className="support-phone-label">Dəstək xətti</span>
                        <span className="support-phone-number">{phoneNumber}</span>
                    </div>
                </div>

                {/* QR Code Section */}
                <div className="support-qr-section">
                    <div className="support-qr-header">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M2 9V6.5C2 4.01 4.01 2 6.5 2H9" stroke="#6c757d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M15 2H17.5C19.99 2 22 4.01 22 6.5V9" stroke="#6c757d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M22 16V17.5C22 19.99 19.99 22 17.5 22H16" stroke="#6c757d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M9 22H6.5C4.01 22 2 19.99 2 17.5V15" stroke="#6c757d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M10.5 7V9C10.5 10 10 10.5 9 10.5H7C6 10.5 5.5 10 5.5 9V7C5.5 6 6 5.5 7 5.5H9C10 5.5 10.5 6 10.5 7Z" stroke="#6c757d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M18.5 7V9C18.5 10 18 10.5 17 10.5H15C14 10.5 13.5 10 13.5 9V7C13.5 6 14 5.5 15 5.5H17C18 5.5 18.5 6 18.5 7Z" stroke="#6c757d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M10.5 15V17C10.5 18 10 18.5 9 18.5H7C6 18.5 5.5 18 5.5 17V15C5.5 14 6 13.5 7 13.5H9C10 13.5 10.5 14 10.5 15Z" stroke="#6c757d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M13.5 14V13.5H14" stroke="#6c757d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M13.5 18.5V17" stroke="#6c757d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M16 18.5H17C18 18.5 18.5 18 18.5 17V16" stroke="#6c757d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M18.5 13.5H17" stroke="#6c757d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>QR kod</span>
                    </div>
                    <div className="support-qr-container">
                        <img src={qrCodeUrl} alt="QR Code" className="support-qr-image" />
                    </div>
                    <p className="support-qr-text">Bizə yazmaq üçün skan edin</p>
                </div>

                {/* Terminal Info Footer */}
                <div className="support-modal-footer">
                    <span className="support-terminal-id">{terminalId || "P3257"}</span>
                    <span className="support-divider">|</span>
                    <span>Terminal: <strong>{terminalName || "Terminal 1"}</strong></span>
                    <span className="support-divider">|</span>
                    <span>Filial: <strong>{branchName || "Main"}</strong></span>
                </div>
            </div>
        </div>
    );
};

export default SupportModal;
