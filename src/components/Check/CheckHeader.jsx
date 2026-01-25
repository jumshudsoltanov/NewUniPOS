import React from "react";
import './Check.css';

const CheckHeader = () => {
    return (
        <div className="check-header-bar">
            {/* Left Section: Edit + Info */}
            <div className="header-left-section">
                <div className="header-edit-btn">
                    <i className="bi bi-pencil-fill"></i>
                </div>
                <div className="header-info-text">
                    <span className="header-title">Takeaway</span>
                    {/* <span className="header-subtitle">salam</span> */}
                </div>
            </div>

            {/* Center Section: Time */}
            <div className="header-center-section">
                <span className="header-time">02:30</span>
            </div>

            {/* Right Section: Order IDs + Toggle */}
            <div className="header-right-section">
                <span className="header-order-id">#42626 / #1</span>
                <div className="header-toggle-btn">
                    <i className="bi bi-chevron-down"></i>
                </div>
            </div>
        </div>
    );
};

export default CheckHeader;
