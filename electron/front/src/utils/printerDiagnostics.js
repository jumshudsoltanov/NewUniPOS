export const PRINTER_DIAGNOSTICS_STORAGE_KEY = "pos_printer_diagnostics";

export const getPrinterKey = (printer) => {
  return String(
    printer?.id ??
      printer?.key ??
      printer?.usb_name ??
      printer?.local_name ??
      printer?.name ??
      printer?.ip ??
      "printer",
  );
};

export const getPrinterDiagnosticLabel = (diagnostic) => {
  if (!diagnostic) return "Yoxlanır";
  if (diagnostic.label) return diagnostic.label;
  if (diagnostic.status === "error") return "Problem";
  if (diagnostic.status === "warning") return "Xəbərdarlıq";
  if (diagnostic.status === "ok") return "Online";
  return "Status məlum deyil";
};

export const getPrinterDiagnosticClass = (diagnostic) => {
  if (!diagnostic) return "checking";
  if (diagnostic.status === "ok") return "online";
  if (diagnostic.status === "warning") return "warning";
  if (diagnostic.status === "error") return "offline";
  return "unknown";
};

export const summarizePrinterDiagnostics = (diagnosticsMap = {}) => {
  const diagnostics = Object.values(diagnosticsMap || {});
  const errorCount = diagnostics.filter((item) => item?.status === "error").length;
  const warningCount = diagnostics.filter((item) => item?.status === "warning").length;
  const unknownCount = diagnostics.filter((item) => item?.status === "unknown").length;
  const problemCount = errorCount + warningCount;
  const status =
    errorCount > 0 ? "error" : warningCount > 0 ? "warning" : diagnostics.length ? "ok" : "unknown";
  const label =
    errorCount > 0
      ? `${errorCount} printerdə problem`
      : warningCount > 0
        ? `${warningCount} printer xəbərdarlığı`
        : diagnostics.length
          ? "Printerlər normaldır"
          : "Printer yoxlanmayıb";

  return {
    total: diagnostics.length,
    errorCount,
    warningCount,
    unknownCount,
    problemCount,
    status,
    label,
  };
};

const withTimeout = (promise, timeoutMs, fallback) => {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, Math.max(500, Number(timeoutMs) || 3500));

    Promise.resolve(promise)
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      });
  });
};

const sanitizePrinter = (printer) => ({
  id: printer?.id,
  name: printer?.name,
  local_name: printer?.local_name,
  is_cashier: printer?.is_cashier,
  type: printer?.type,
  ip: printer?.ip,
  port: printer?.port,
  connection_type: printer?.connection_type,
  usb_name: printer?.usb_name,
  com_port: printer?.com_port,
});

export const readCachedPrinterDiagnostics = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(PRINTER_DIAGNOSTICS_STORAGE_KEY) || "{}");
    return cached && typeof cached === "object" ? cached : {};
  } catch {
    return {};
  }
};

export const writeCachedPrinterDiagnostics = (diagnosticsMap) => {
  try {
    localStorage.setItem(PRINTER_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(diagnosticsMap || {}));
  } catch {
    // localStorage dolu və ya bloklu ola bilər; POS axınına təsir etməsin.
  }
};

export const fetchPrinterDiagnostics = async (printers = [], options = {}) => {
  const timeoutMs = Number(options.timeoutMs) || 3500;
  const fallback = {
    success: false,
    printers: [],
    error: "Printer diaqnostikası timeout oldu",
  };

  if (!Array.isArray(printers) || printers.length === 0) return {};
  if (!window.electronAPI?.getPrinterDiagnostics) {
    return readCachedPrinterDiagnostics();
  }

  const response = await withTimeout(
    window.electronAPI.getPrinterDiagnostics({
      printers: printers.map(sanitizePrinter),
      timeoutMs,
    }),
    timeoutMs + 900,
    fallback,
  );

  const diagnosticsMap = {};
  const list = Array.isArray(response?.printers) ? response.printers : [];
  list.forEach((diagnostic) => {
    diagnosticsMap[getPrinterKey(diagnostic)] = diagnostic;
  });

  if (Object.keys(diagnosticsMap).length > 0) {
    writeCachedPrinterDiagnostics(diagnosticsMap);
    window.dispatchEvent(
      new CustomEvent("printerDiagnosticsUpdated", {
        detail: diagnosticsMap,
      }),
    );
    return diagnosticsMap;
  }

  return readCachedPrinterDiagnostics();
};
