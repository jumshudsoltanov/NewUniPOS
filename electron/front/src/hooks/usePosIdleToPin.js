import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const LS_ENABLED = "pos_auto_lock_enabled";
const LS_SECONDS = "pos_auto_lock_seconds";

function getPathForLock() {
    try {
        const h = window.location.hash || "";
        if (h.length > 1) {
            return (h.replace(/^#/, "").split("?")[0] || "/").split("?")[0];
        }
    } catch { /* ignore */ }
    return (window.location.pathname || "/").split("?")[0] || "/";
}

/** Giriş, PIN, blok, müştəri/mətbəx ekranları xaricində POS səhifələrində taimer qoşulsun. */
function shouldArmIdleLock(path) {
    const p = (path || "/").split("?")[0];
    if (p === "/pin" || p === "/login" || p === "/blocked" || p === "" || p === "/") return false;
    if (p.startsWith("/customer") || p.startsWith("/kitchen") || p.startsWith("/kds")) return false;
    return true;
}

function getLockDelayMs() {
    try {
        if (localStorage.getItem(LS_ENABLED) !== "1") return null;
        const s = parseInt(String(localStorage.getItem(LS_SECONDS) || "0").trim(), 10);
        if (Number.isNaN(s) || s < 1) return null;
        const clamped = Math.min(Math.max(s, 5), 48 * 3600);
        return clamped * 1000;
    } catch {
        return null;
    }
}

/**
 * Tənzimləmə aktivdirsə, müəyyən müddət ekranda əməliyyat olmazsa /pin-ə yönləndirir.
 */
export function usePosIdleToPin({ disabled }) {
    const navigate = useNavigate();
    const location = useLocation();
    const timeoutRef = useRef(null);
    const lastThrottleRef = useRef(0);

    const clearTimer = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const schedule = useCallback(() => {
        clearTimer();
        if (disabled) return;
        const path = getPathForLock();
        if (!shouldArmIdleLock(path)) return;
        const delay = getLockDelayMs();
        if (delay == null) return;
        timeoutRef.current = setTimeout(() => {
            const p = getPathForLock();
            if (!shouldArmIdleLock(p)) return;
            if (getLockDelayMs() == null) return;
            navigate("/pin", { replace: true });
        }, delay);
    }, [navigate, disabled, clearTimer]);

    useEffect(() => {
        if (disabled) {
            clearTimer();
            return;
        }
        schedule();
    }, [disabled, location.pathname, schedule, clearTimer]);

    useEffect(() => {
        if (disabled) return;
        const throttledSchedule = () => {
            const now = Date.now();
            if (now - lastThrottleRef.current < 200) return;
            lastThrottleRef.current = now;
            schedule();
        };
        const events = ["mousedown", "keydown", "touchstart", "click", "scroll", "wheel"];
        events.forEach((e) => {
            document.addEventListener(e, throttledSchedule, { capture: true, passive: true });
        });
        window.addEventListener("mousemove", throttledSchedule, { capture: true, passive: true });
        const onUpdate = () => schedule();
        window.addEventListener("unipos_pos_auto_lock_update", onUpdate);
        return () => {
            events.forEach((e) => {
                document.removeEventListener(e, throttledSchedule, { capture: true });
            });
            window.removeEventListener("mousemove", throttledSchedule, { capture: true });
            window.removeEventListener("unipos_pos_auto_lock_update", onUpdate);
            clearTimer();
        };
    }, [disabled, schedule, clearTimer]);
}
