import React, { useEffect, useState } from 'react';
import DefaultLogo from "../../assets/images/unipos_logo.png";
import "./RefreshLoader.css";

const SYNC_STEPS = [
    { key: "products",          label: "Məhsullar",         icon: "bi-box-seam" },
    { key: "categories",        label: "Alt kateqoriyalar",  icon: "bi-tag" },
    { key: "generalCategories", label: "Kateqoriyalar",      icon: "bi-grid" },
    { key: "tables",            label: "Masalar",            icon: "bi-table" },
    { key: "tableGroups",       label: "Masa qrupları",      icon: "bi-diagram-3" },
    { key: "waiters",           label: "Ofisiantlar",        icon: "bi-person-badge" },
    { key: "paymentMethods",    label: "Ödəniş üsulları",   icon: "bi-credit-card" },
    { key: "tags",              label: "Etiketlər",          icon: "bi-bookmark" },
    { key: "printers",          label: "Printerlər",         icon: "bi-printer" },
    { key: "salesTypes",        label: "Satış növləri",      icon: "bi-cart" },
    { key: "activeChecks",      label: "Aktiv çeklər",       icon: "bi-receipt" },
];

const RefreshLoader = ({ isOpen, syncCounts, isOnline = true }) => {
    const [progress, setProgress] = useState(0);
    const [visibleSteps, setVisibleSteps] = useState(0);
    const [isDone, setIsDone] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setProgress(0);
            setVisibleSteps(0);
            setIsDone(false);
            return;
        }

        // Offline rejimində animasiya qısa olsun
        const duration = isOnline ? 4000 : 1500;
        const intervalTime = 40;
        const totalSteps = duration / intervalTime;
        let current = 0;
        const interval = setInterval(() => {
            current++;
            setProgress(Math.min((current / totalSteps) * 92, 92));
            if (current >= totalSteps) clearInterval(interval);
        }, intervalTime);

        let stepIndex = 0;
        const stepInterval = setInterval(() => {
            stepIndex++;
            setVisibleSteps(stepIndex);
            if (stepIndex >= SYNC_STEPS.length) clearInterval(stepInterval);
        }, isOnline ? 350 : 130);

        return () => {
            clearInterval(interval);
            clearInterval(stepInterval);
        };
    }, [isOpen, isOnline]);

    useEffect(() => {
        if (syncCounts) {
            setProgress(100);
            setVisibleSteps(SYNC_STEPS.length);
            setTimeout(() => setIsDone(true), 300);
        }
    }, [syncCounts]);

    if (!isOpen) return null;

    const totalCount = syncCounts
        ? Object.values(syncCounts).reduce((a, b) => a + b, 0)
        : null;

    return (
        <div className="rl-overlay">
            <div className="rl-card">
                <div className="rl-logo-wrap">
                    <img src={DefaultLogo} alt="UniPOS" className="rl-logo" />
                </div>

                {!isOnline && (
                    <div className="rl-offline-banner">
                        <i className="bi bi-wifi-off" /> İnternet yoxdur — lokal məlumatlar
                    </div>
                )}

                <div className={`rl-status ${isDone ? "done" : ""}`}>
                    {isDone ? (
                        <>
                            <span className="rl-check-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </span>
                            {isOnline ? "Sinxronizasiya tamamlandı" : "Lokal məlumatlar yükləndi"}
                            {totalCount !== null && (
                                <span className="rl-total-badge">{totalCount} qeyd</span>
                            )}
                        </>
                    ) : (
                        <>
                            <span className="rl-spinner" />
                            {isOnline ? "Məlumatlar yenilənir..." : "Lokal məlumatlar yüklənir..."}
                        </>
                    )}
                </div>

                <div className="rl-progress-track">
                    <div className="rl-progress-fill" style={{ width: `${progress}%` }} />
                </div>

                <div className="rl-steps">
                    {SYNC_STEPS.slice(0, visibleSteps).map((step) => {
                        const count = syncCounts?.[step.key];
                        const done = count !== undefined;
                        return (
                            <div key={step.key} className={`rl-step ${done ? "done" : "loading"}`}>
                                <span className="rl-step-icon">
                                    {done ? (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                            <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    ) : (
                                        <i className={`bi ${step.icon}`} />
                                    )}
                                </span>
                                <span className="rl-step-label">{step.label}</span>
                                <span className="rl-step-count">
                                    {done ? count : <span className="rl-dots" />}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default RefreshLoader;
