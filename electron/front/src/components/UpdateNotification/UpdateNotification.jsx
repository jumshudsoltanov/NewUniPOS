import { useEffect, useState } from "react";
import "./UpdateNotification.css";

export default function UpdateNotification() {
  const [status, setStatus] = useState(null); // null | 'checking' | 'found' | 'downloading' | 'ready'
  const [version, setVersion] = useState(null);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!window.electronAPI) return;

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
      window.electronAPI.onUpdateDownloaded(() => {
        setStatus("ready");
        setCountdown(5);
        setVisible(true);
      });
    }
  }, []);

  // Auto-hide "checking" after 10s if nothing happens
  useEffect(() => {
    if (status === "checking") {
      const timer = setTimeout(() => {
        setVisible(false);
        setStatus(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Countdown when ready
  useEffect(() => {
    if (status !== "ready") return;
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, countdown]);

  if (!visible) return null;

  const getContent = () => {
    switch (status) {
      case "checking":
        return {
          icon: "bi-arrow-repeat spin",
          text: "Yeni versiya axtarılır...",
          color: "#64748b",
        };
      case "found":
        return {
          icon: "bi-cloud-download",
          text: version ? `Yeni versiya tapıldı: v${version}` : "Yeni versiya tapıldı",
          color: "#4F85F4",
        };
      case "downloading":
        return {
          icon: "bi-cloud-arrow-down",
          text: `Yüklənir... ${progress}%`,
          color: "#f59e0b",
          showBar: true,
        };
      case "ready":
        return {
          icon: "bi-check-circle",
          text: `Yenilənmə hazırdır! ${countdown > 0 ? `${countdown}s sonra quraşdırılır...` : "Quraşdırılır..."}`,
          color: "#10b981",
        };
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  return (
    <div className="update-notification" style={{ borderLeftColor: content.color }}>
      <i className={`bi ${content.icon}`} style={{ color: content.color }} />
      <span className="update-text">{content.text}</span>

      {content.showBar && (
        <div className="update-progress-bar">
          <div className="update-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {status === "ready" && (
        <div className="update-countdown-bar">
          <div
            className="update-countdown-fill"
            style={{
              width: `${((5 - countdown) / 5) * 100}%`,
              background: content.color,
            }}
          />
        </div>
      )}

      {(status === "checking" || status === "found") && (
        <button className="update-dismiss-btn" onClick={() => { setVisible(false); setStatus(null); }}>
          <i className="bi bi-x" />
        </button>
      )}
    </div>
  );
}
