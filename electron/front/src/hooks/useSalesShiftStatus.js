import { useState, useEffect, useCallback } from "react";
import apiConfig, { getSocket } from "../utils/apiConfig";

/**
 * Satış növbəsinin açıq/bağlı vəziyyəti — bütün terminallarda eyni.
 */
export function useSalesShiftStatus(profileId) {
    const [isOpen, setIsOpen] = useState(false);
    const [shiftRow, setShiftRow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fetchFailed, setFetchFailed] = useState(false);

    const refresh = useCallback(async () => {
        if (!profileId) {
            setLoading(false);
            setIsOpen(false);
            setShiftRow(null);
            setFetchFailed(false);
            return;
        }
        setLoading(true);
        setFetchFailed(false);
        try {
            const res = await apiConfig.get(`/sales-shifts/${profileId}/current`);
            const row = res.data?.data ?? null;
            setShiftRow(row);
            setIsOpen(!!row);
        } catch {
            setFetchFailed(true);
            setShiftRow(null);
            setIsOpen(false);
        } finally {
            setLoading(false);
        }
    }, [profileId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        // Eyni pəncərədən gələn event
        const onChanged = () => refresh();
        window.addEventListener("salesShiftChanged", onChanged);

        // Socket ilə digər terminallardan gələn event
        const socket = getSocket();
        const onShiftUpdated = () => refresh();
        if (socket) socket.on("shift_updated", onShiftUpdated);

        // Hər dəqiqə yenilə
        const t = setInterval(() => refresh(), 60000);

        return () => {
            window.removeEventListener("salesShiftChanged", onChanged);
            if (socket) socket.off("shift_updated", onShiftUpdated);
            clearInterval(t);
        };
    }, [refresh]);

    return { isOpen, shiftRow, loading, fetchFailed, refresh };
}
