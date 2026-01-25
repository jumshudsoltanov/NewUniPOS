import React from 'react';

const CheckBottom = () => {
    return (
        <div className="checkBottom">
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
    );
};

export default CheckBottom;
