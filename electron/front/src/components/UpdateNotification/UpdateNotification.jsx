import { useEffect, useState } from "react";
import { t } from "../../utils/translations";
import "./UpdateNotification.css";

export default function UpdateNotification() {
  const [status, setStatus] = useState(null); // null | 'checking' | 'found' | 'downloading' | 'ready'
  const [version, setVersion] = useState(null);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [manualEnabled, setManualEnabled] = useState(
    () => localStorage.getItem("manualUpdateEnabled") === "true"
  );

  // manualUpdateEnabled dəyişdikdə sinxronlaşdır
  useEffect(() => {
    const handler = (e) => setManualEnabled(e.detail === true || e.detail === "true");
    window.addEventListener("manualUpdateEnabledChanged", handler);
    return () => window.removeEventListener("manualUpdateEnabledChanged", handler);
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;

    // Query current update state (in case events already fired before component mounted)
    if (window.electronAPI.getUpdateState) {
      window.electronAPI.getUpdateState().then((state) => {
        if (!state || !state.status) return;
        setVersion(state.version || null);
        setProgress(state.progress || 0);
        setStatus(state.status);
        setVisible(true);
        const auto = state.autoEnabled !== false;
        setAutoEnabled(auto);
        if (state.status === "ready" && auto) setCountdown(5);
      }).catch(() => {});
    }

    if (window.electronAPI.onCheckingForUpdate) {
      window.electronAPI.onCheckingForUpdate(() => {
        setStatus("checking");
        setVisible(true);
      });
    }

    if (window.electronAPI.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable((info) => {
        setVersion(info?.version || null);
        setStatus("found");
        setVisible(true);
      });
    }

    if (window.electronAPI.onUpdateDownloadProgress) {
      window.electronAPI.onUpdateDownloadProgress((percent) => {
        setProgress(percent);
        setStatus("downloading");
        setVisible(true);
      });
    }

    if (window.electronAPI.onUpdateDownloaded) {
      window.electronAPI.onUpdateDownloaded((info) => {
        const auto = info?.autoEnabled !== false;
        setAutoEnabled(auto);
        setStatus("ready");
        setVisible(true);
        if (auto) setCountdown(5);
      });
    }
  }, []);

  // Auto-hide "checking" after 10s if nothing happens
  useEffect(() => {
    if (status === "checking") {
      const timer = setTimeout(() => { setVisible(false); setStatus(null); }, 10000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Countdown — yalnız avto-yeniləmə açıqdırsa
  useEffect(() => {
    if (status !== "ready" || !autoEnabled) return;
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, countdown, autoEnabled]);

  // Avto söndürülüb, manual da söndürülübsə — ready badge-i göstərmə
  if (!visible || (status === "ready" && !autoEnabled && !manualEnabled)) return null;

  const getContent = () => {
    switch (status) {
      case "checking":
        return { icon: "bi-arrow-repeat spin", text: "Yeni versiya axtarılır...", color: "#64748b" };
      case "found":
        return { icon: "bi-cloud-download", text: version ? `Yeni versiya tapıldı: v${version}` : "Yeni versiya tapıldı", color: "#4F85F4" };
      case "downloading":
        return { icon: "bi-cloud-arrow-down", text: `Yüklənir... ${progress}%`, color: "#f59e0b", showBar: true };
      case "ready":
        if (autoEnabled) {
          return {
            icon: "bi-check-circle",
            text: `Yenilənmə hazırdır! ${countdown > 0 ? `${countdown}s sonra quraşdırılır...` : "Quraşdırılır..."}`,
            color: "#10b981",
          };
        }
        // manual mode
        return {
          icon: "bi-download",
          text: version ? `v${version} hazırdır!` : "Yenilənmə hazırdır!",
          color: "#10b981",
        };
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  const handleInstall = async () => {
    if (window.electronAPI?.installUpdate) {
      await window.electronAPI.installUpdate();
    }
  };

  return (
    <div className="update-notification" style={{ borderLeftColor: content.color }}>
      <i className={`bi ${content.icon}`} style={{ color: content.color }} />
      <span className="update-text">{content.text}</span>

      {content.showBar && (
        <div className="update-progress-bar">
          <div className="update-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {status === "ready" && autoEnabled && (
        <div className="update-countdown-bar">
          <div className="update-countdown-fill" style={{ width: `${((5 - countdown) / 5) * 100}%`, background: content.color }} />
        </div>
      )}

      {/* Manual mode: Quraşdır düyməsi */}
      {status === "ready" && !autoEnabled && manualEnabled && (
        <button className="update-install-btn" onClick={handleInstall} style={{ background: content.color }}>{t("qurasdir")}</button>
      )}

      {(status === "checking" || status === "found" || (status === "ready" && !autoEnabled)) && (
        <button className="update-dismiss-btn" onClick={() => { setVisible(false); setStatus(null); }}>
          <i className="bi bi-x" />
        </button>
      )}
    </div>
  );
}
