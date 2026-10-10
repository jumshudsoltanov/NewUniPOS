import React, { useEffect, useRef, useState } from "react";
import logo from "../../assets/images/logo-build.png";
import { t } from "../../utils/translations";
import "./RefreshSyncWindow.css";

const SYNC_STEPS = [
    { key: "products",          label: t("products") },
    { key: "categories",        label: "Alt kateqoriyalar" },
    { key: "generalCategories", label: t("categories") },
    { key: "tables",            label: t("tables") },
    { key: "tableGroups",       label: t("masa_qruplari") },
    { key: "waiters",           label: "Ofisiantlar" },
    { key: "paymentMethods",    label: t("odenis_usullari") },
];

const ROW_APPEAR_MS = 70;
const EXIT_START_MS = 500;
const EXIT_STEP_MS = 90;
const EXIT_TRANSITION_MS = 300;
const CLOSE_HOLD_MS = 350;
const WATCHDOG_MS = 20000;

const OFFLINE_COLOR = "#9a6a12";
const fmt = (n) => Number(n || 0).toLocaleString("az-AZ");

const RefreshSyncWindow = () => {
    const [phase, setPhase] = useState("loading"); // loading | done
    const [isOnline, setIsOnline] = useState(true);
    const [progress, setProgress] = useState(0);
    const [visibleRows, setVisibleRows] = useState(0);
    const [counts, setCounts] = useState(null);
    const [deltas, setDeltas] = useState({});
    const [exitingKeys, setExitingKeys] = useState([]);
    const timersRef = useRef([]);
    const watchdogRef = useRef(null);

    const clearTimers = () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    };

    const armWatchdog = () => {
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
        watchdogRef.current = setTimeout(() => {
            window.electronAPI?.closeRefreshWindow?.();
        }, WATCHDOG_MS);
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
                setVisibleRows(0);
                setCounts(null);
                setDeltas({});
                setExitingKeys([]);
            } else if (payload.type === "done") {
                if (watchdogRef.current) clearTimeout(watchdogRef.current);
                setCounts(payload.counts || {});
                setDeltas(payload.deltas || {});
                setIsOnline(payload.isOnline !== false);
                setProgress(100);
                setVisibleRows(SYNC_STEPS.length);
                setPhase("done");
            }
        });

        return () => {
            if (watchdogRef.current) clearTimeout(watchdogRef.current);
            clearTimers();
        };
    }, []);

    // Yüklənmə zamanı proqres və sətirlərin ardıcıl görünməsi
    useEffect(() => {
        if (phase !== "loading") return undefined;
        const duration = isOnline ? 1600 : 700;
        const intervalTime = 30;
        const totalTicks = duration / intervalTime;
        let tick = 0;
        const progInt = setInterval(() => {
            tick++;
            setProgress(Math.min((tick / totalTicks) * 92, 92));
            if (tick >= totalTicks) clearInterval(progInt);
        }, intervalTime);

        let rowIdx = 0;
        const rowInt = setInterval(() => {
            rowIdx++;
            setVisibleRows(rowIdx);
            if (rowIdx >= SYNC_STEPS.length) clearInterval(rowInt);
        }, ROW_APPEAR_MS);

        return () => {
            clearInterval(progInt);
            clearInterval(rowInt);
        };
    }, [phase, isOnline]);

    // Bitəndən sonra sətirlər növbə ilə sağa çıxır, sonda pəncərə bağlanır
    useEffect(() => {
        if (phase !== "done") return undefined;
        clearTimers();

        SYNC_STEPS.forEach((step, i) => {
            timersRef.current.push(
                setTimeout(
                    () => setExitingKeys((prev) => [...prev, step.key]),
                    EXIT_START_MS + i * EXIT_STEP_MS,
                ),
            );
        });

        const closeDelay =
            EXIT_START_MS + SYNC_STEPS.length * EXIT_STEP_MS + EXIT_TRANSITION_MS + CLOSE_HOLD_MS;
        timersRef.current.push(
            setTimeout(() => window.electronAPI?.closeRefreshWindow?.(), closeDelay),
        );

        return clearTimers;
    }, [phase]);

    const done = phase === "done";
    const offline = !isOnline && done;
    const total = counts
        ? SYNC_STEPS.reduce((sum, s) => sum + (counts[s.key] || 0), 0)
        : null;

    const statusText = offline ? "OFLAYN REJİM" : done ? "TAMAMLANDI" : "YENİLƏNİR";
    const statusColor = offline ? OFFLINE_COLOR : undefined;

    return (
        <div className="rs-root" style={statusColor ? { "--rs-status-color": statusColor } : undefined}>
            <div className="rs-head">
                <div className="rs-logo-tile">
                    <img className="rs-logo" src={logo} alt="UniPOS" />
                </div>
                <div className="rs-titles">
                    <div className="rs-title">{t("melumatlarin_yenilenmesi")}</div>
                    <div className="rs-status">{statusText}</div>
                </div>
                <div className="rs-summary">
                    <div className="rs-percent">{offline ? "—" : `${Math.round(progress)}%`}</div>
                    <div className="rs-total">{total === null ? "— qeyd" : `${fmt(total)} qeyd`}</div>
                </div>
            </div>

            <div className="rs-line">
                <div className="rs-line-fill" style={{ width: `${progress}%` }} />
            </div>

            {offline && (
                <div className="rs-offline">{t("no_internet_local")}</div>
            )}

            <div className="rs-rows">
                {SYNC_STEPS.map((step, i) => {
                    const count = counts?.[step.key];
                    const ready = count !== undefined;
                    const delta = deltas?.[step.key] || 0;
                    const hidden = i >= visibleRows;
                    const exiting = exitingKeys.includes(step.key);
                    const cls = `rs-row${exiting ? " rs-exiting" : hidden ? " rs-hidden" : ""}`;
                    return (
                        <div key={step.key} className={cls}>
                            <div className={`rs-mark${ready && !offline ? "" : " rs-dot"}`}>
                                {ready && !offline ? "✓" : ""}
                            </div>
                            <div className="rs-name">{step.label}</div>
                            {ready && !offline && delta > 0 ? (
                                <div className="rs-new">+{delta}</div>
                            ) : (
                                <div />
                            )}
                            <div className={`rs-count${ready ? "" : " rs-pending"}`}>
                                {ready ? fmt(count) : "——"}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RefreshSyncWindow;
