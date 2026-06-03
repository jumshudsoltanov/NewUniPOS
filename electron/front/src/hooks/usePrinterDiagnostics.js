import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchPrinterDiagnostics,
  getPrinterKey,
  readCachedPrinterDiagnostics,
  summarizePrinterDiagnostics,
} from "../utils/printerDiagnostics";

const buildPrinterSignature = (printers) => {
  if (!Array.isArray(printers)) return "";
  return printers
    .map((printer) =>
      [
        printer?.id,
        printer?.name,
        printer?.local_name,
        printer?.connection_type,
        printer?.ip,
        printer?.port,
        printer?.usb_name,
      ].join(":"),
    )
    .join("|");
};

export const usePrinterDiagnostics = (printers = [], options = {}) => {
  const {
    enabled = true,
    intervalMs = 60000,
    timeoutMs = 3500,
    initialFromCache = true,
  } = options;
  const [diagnostics, setDiagnostics] = useState(() =>
    initialFromCache ? readCachedPrinterDiagnostics() : {},
  );
  const [isChecking, setIsChecking] = useState(false);
  const runningRef = useRef(false);
  const mountedRef = useRef(false);
  const signature = useMemo(() => buildPrinterSignature(printers), [printers]);

  const visibleDiagnostics = useMemo(() => {
    if (!Array.isArray(printers) || printers.length === 0) return {};
    const next = {};
    printers.forEach((printer) => {
      const key = getPrinterKey(printer);
      if (diagnostics[key]) next[key] = diagnostics[key];
    });
    return next;
  }, [diagnostics, printers]);

  const summary = useMemo(
    () => summarizePrinterDiagnostics(visibleDiagnostics),
    [visibleDiagnostics],
  );

  const refresh = useCallback(async () => {
    if (!enabled || !Array.isArray(printers) || printers.length === 0) return {};
    if (runningRef.current) return visibleDiagnostics;
    runningRef.current = true;
    setIsChecking(true);
    try {
      const result = await fetchPrinterDiagnostics(printers, { timeoutMs });
      if (mountedRef.current) setDiagnostics(result);
      return result;
    } finally {
      runningRef.current = false;
      if (mountedRef.current) setIsChecking(false);
    }
  }, [enabled, printers, timeoutMs, visibleDiagnostics]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !signature) return undefined;
    let cancelled = false;
    const run = async () => {
      if (!cancelled) await refresh();
    };
    const firstTimer = setTimeout(run, 500);
    const interval = setInterval(run, Math.max(15000, Number(intervalMs) || 60000));
    return () => {
      cancelled = true;
      clearTimeout(firstTimer);
      clearInterval(interval);
    };
  }, [enabled, intervalMs, refresh, signature]);

  useEffect(() => {
    const handleUpdate = (event) => {
      if (event?.detail && typeof event.detail === "object") {
        setDiagnostics(event.detail);
      }
    };
    window.addEventListener("printerDiagnosticsUpdated", handleUpdate);
    return () => window.removeEventListener("printerDiagnosticsUpdated", handleUpdate);
  }, []);

  return {
    diagnostics: visibleDiagnostics,
    summary,
    isChecking,
    refresh,
  };
};
