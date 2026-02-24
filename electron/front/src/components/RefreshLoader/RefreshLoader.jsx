import React, { useEffect, useState } from 'react';
import DefaultLogo from "../../assets/images/unipos_logo.png";
import "./RefreshLoader.css";

const RefreshLoader = ({ isOpen, text = "Məlumatlar yenilənir...", duration = 5000 }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!isOpen) {
            setProgress(0);
            return;
        }

        const intervalTime = 50; // update every 50ms
        const steps = duration / intervalTime;
        let currentStep = 0;

        const interval = setInterval(() => {
            currentStep++;
            const newProgress = Math.min((currentStep / steps) * 100, 100);
            setProgress(newProgress);
            if (currentStep >= steps) {
                clearInterval(interval);
            }
        }, intervalTime);

        return () => clearInterval(interval);
    }, [isOpen, duration]);

    if (!isOpen) return null;

    const currentItems = Math.floor((progress / 100) * 500);

    return (
        <div className="refresh-loader-overlay">
            <div className="refresh-loader-content">
                <img src={DefaultLogo} alt="UniPOS" className="refresh-loader-logo" />

                <div className="refresh-loader-status">{text}</div>
                <div className="refresh-loader-count">{currentItems} / 500</div>

                <div className="refresh-loader-progress-container">
                    <div className="refresh-loader-progress-bar" style={{ width: `${progress}%` }}></div>
                </div>

                <div className="refresh-loader-subtext">
                    <span className="refresh-loader-message">*Məlumatlar yenilənir...</span>
                </div>
            </div>
        </div>
    );
};

export default RefreshLoader;
