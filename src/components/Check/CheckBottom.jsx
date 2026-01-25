import React from 'react';

const CheckBottom = () => {
    return (
        <>
            {/* Desktop View */}
            <div className="checkBottom d-none d-lg-flex">
                <div className="summary-section">
                    <div className="summary-row">
                        <span>Cəm:</span>
                        <span>1,500.00 ₼</span>
                    </div>
                    <div className="summary-row">
                        <span>Endirim:</span>
                        <span>275.00 ₼ (~18%)</span>
                    </div>
                </div>

                <div className="pt-3 action-buttons">
                    <button className="btn-send">
                        <i className="bi bi-send"></i>
                        <span>Göndər</span>
                    </button>
                    <button className="btn-pay">
                        <i className="bi bi-check2-all"></i>
                        <span>1,225.00 ₼</span>
                    </button>
                </div>
            </div>

            {/* Mobile View */}
            <div className="checkBottomMobile d-flex d-lg-none">
                <button className="mobile-icon-btn gray-btn">
                    <i className="bi bi-printer-fill"></i>
                </button>
                <button className="mobile-icon-btn gray-btn">
                    <i className="bi bi-trash-fill"></i>
                </button>
                <button className="mobile-pay-btn">
                    <i className="bi bi-check2-all fs-4 text-white"></i>
                    <span className="pay-amount">27,750.00 ₼</span>
                </button>
            </div>
        </>
    );
};

export default CheckBottom;
