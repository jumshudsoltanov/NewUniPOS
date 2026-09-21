import React, { useEffect, useRef, useState } from "react";
import DefaultLogo from "../../assets/images/unipos_logo.png";
import { t } from "../../utils/translations";
import "./RefreshLoader.css";

const SYNC_STEPS = [
    { key: "products",          label: t("products"),         icon: "bi-box-seam" },
    { key: "categories",        label: "Alt kateqoriyalar",  icon: "bi-tag" },
    { key: "generalCategories", label: t("categories"),      icon: "bi-grid" },
    { key: "tables",            label: t("tables"),            icon: "bi-table" },
    { key: "tableGroups",       label: t("masa_qruplari"),      icon: "bi-diagram-3" },
    { key: "waiters",           label: "Ofisiantlar",        icon: "bi-person-badge" },
    { key: "paymentMethods",    label: t("odenis_usullari"),   icon: "bi-credit-card" },
];

const STEP_STAGGER_MS = 90;
const REMOVE_TRANSITION_MS = 300;
const CLOSE_HOLD_MS = 350;

const RefreshSyncWindow = () => {
    const [phase, setPhase] = useState("loading"); // loading | done
    const [isOnline, setIsOnline] = useState(true);
    const [progress, setProgress] = useState(0);
    const [visibleSteps, setVisibleSteps] = useState(0);
    const [counts, setCounts] = useState(null);
    const [deltas, setDeltas] = useState({});
    const [removingKeys, setRemovingKeys] = useState([]);
    const [removedKeys, setRemovedKeys] = useState([]);
    const timersRef = useRef([]);

    const clearTimers = () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    };

    // Watchdog: hər hansı səbəbdən "done" hadisəsi heç vaxt gəlməsə (itən IPC,
    // uğursuz sorğu və s.), pəncərə əbədi açıq qalmasın deyə məcburi bağlanır
    const watchdogRef = useRef(null);
    const armWatchdog = () => {
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
        watchdogRef.current = setTimeout(() => {
            window.electronAPI?.closeRefreshWindow?.();
        }, 20000);
    };

    useEffect(() => {
        armWatchdog();
        if (!window.electronAPI?.onRefreshSyncEvent) return undefined;
        window.electronAPI.onRefreshSyncEvent((payload) => {
            if (!payload) return;
            if (payload.type === "start") {
                armWatchdog();
                clearTimers();
                setPhase("loading");
                setIsOnline(payload.isOnline !== false);
                setProgress(0);
                setVisibleSteps(0);
                setCounts(null);
                setDeltas({});
                setRemovingKeys([]);
                setRemovedKeys([]);
            } else if (payload.type === "done") {
                if (watchdogRef.current) clearTimeout(watchdogRef.current);
                setCounts(payload.counts || {});
                setDeltas(payload.deltas || {});
                setIsOnline(payload.isOnline !== false);
                setProgress(100);
                setVisibleSteps(SYNC_STEPS.length);
                setPhase("done");
            }
        });

        return () => {
            if (watchdogRef.current) clearTimeout(watchdogRef.current);
        };
    }, []);

    // Yüklənmə zamanı proqres/addım animasiyası
    useEffect(() => {
        if (phase !== "loading") return;
        const duration = isOnline ? 1600 : 700;
        const intervalTime = 30;
        const totalTicks = duration / intervalTime;
        let tick = 0;
        const progInt = setInterval(() => {
            tick++;
            setProgress(Math.min((tick / totalTicks) * 92, 92));
            if (tick >= totalTicks) clearInterval(progInt);
        }, intervalTime);

        let stepIdx = 0;
        const stepInt = setInterval(() => {
            stepIdx++;
            setVisibleSteps(stepIdx);
            if (stepIdx >= SYNC_STEPS.length) clearInterval(stepInt);
        }, isOnline ? 130 : 60);

        return () => {
            clearInterval(progInt);
            clearInterval(stepInt);
        };
    }, [phase, isOnline]);

    // Bitəndə hər addımı növbə ilə kənara sürüşdürüb silir, sonda pəncərəni bağlayır
    useEffect(() => {
        if (phase !== "done") return;
        clearTimers();

        SYNC_STEPS.forEach((step, i) => {
            const removeAt = 300 + i * STEP_STAGGER_MS;
            const unmountAt = removeAt + REMOVE_TRANSITION_MS;
            timersRef.current.push(
                setTimeout(() => setRemovingKeys((prev) => [...prev, step.key]), removeAt),
            );
            timersRef.current.push(
                setTimeout(() => setRemovedKeys((prev) => [...prev, step.key]), unmountAt),
            );
        });

        const closeDelay =
            300 + SYNC_STEPS.length * STEP_STAGGER_MS + REMOVE_TRANSITION_MS + CLOSE_HOLD_MS;
        timersRef.current.push(
            setTimeout(() => {
                window.electronAPI?.closeRefreshWindow?.();
            }, closeDelay),
        );

        return clearTimers;
    }, [phase]);

    const totalCount = counts
        ? Object.values(counts).reduce((a, b) => a + (b || 0), 0)
        : null;

    const remainingSteps = SYNC_STEPS.slice(0, visibleSteps).filter(
        (s) => !removedKeys.includes(s.key),
    );

    return (
        <div className="rl-window">
            <div className="rl-card rl-card-window">
                <div className={`rl-logo-wrap ${phase === "done" ? "done" : "loading"}`}>
                    <span className="rl-logo-ring" />
                    <img src={DefaultLogo} alt="UniPOS" className="rl-logo" />
                </div>

                {!isOnline && (
                    <div className="rl-offline-banner">
                        <i className="bi bi-wifi-off" />{t("i̇nternet_yoxdur_lokal_melumatlar")}
                    </div>
                )}

                <div className={`rl-status ${phase === "done" ? "done" : ""}`}>
                    {phase === "done" ? (
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

                <div className="rl-progress-row">
                    <div className="rl-progress-track">
                        <div className="rl-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="rl-progress-pct">{Math.round(progress)}%</span>
                </div>

                <div className="rl-steps">
                    {remainingSteps.map((step) => {
                        const count = counts?.[step.key];
                        const done = count !== undefined;
                        const delta = deltas?.[step.key] || 0;
                        const removing = removingKeys.includes(step.key);
                        return (
                            <div
                                key={step.key}
                                className={`rl-step ${done ? "done" : "loading"} ${removing ? "removing" : ""}`}
                            >
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
                                {delta > 0 && <span className="rl-new-badge">+{delta} YENİ</span>}
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

export default RefreshSyncWindow;
