import { useEffect, useState } from "react";
import "./UpdateNotification.css";

export default function UpdateNotification() {
  const [status, setStatus] = useState(null); // null | 'checking' | 'found' | 'downloading' | 'ready'
  const [version, setVersion] = useState(null);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    if (window.electronAPI.onCheckingForUpdate) {
      window.electronAPI.onCheckingForUpdate(() => {
        setStatus("checking");
        setVisible(true);
        setDismissed(false);
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
        setVisible(true);
      });
    }
  }, []);

  // Auto-hide "checking" state after 10s if nothing else happens
  useEffect(() => {
    if (status === "checking") {
      const timer = setTimeout(() => {
        setVisible(false);
        setStatus(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (!visible || dismissed) return null;

  const handleInstall = () => {
    if (window.electronAPI?.installUpdate) {
      window.electronAPI.installUpdate();
    }
  };

  const handleDismiss = () => {
    if (status !== "downloading" && status !== "ready") {
      setDismissed(true);
      setVisible(false);
    }
  };

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
          text: "Yenilənmə hazırdır!",
          color: "#10b981",
          showInstall: true,
        };
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  return (
    <div className="update-notification">
      <i className={`bi ${content.icon}`} style={{ color: content.color }} />
      <span className="update-text">{content.text}</span>

      {content.showBar && (
        <div className="update-progress-bar">
          <div className="update-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {content.showInstall && (
        <button className="update-install-btn" onClick={handleInstall}>
          Quraşdır
        </button>
      )}

      {status !== "downloading" && status !== "ready" && (
        <button className="update-dismiss-btn" onClick={handleDismiss}>
          <i className="bi bi-x" />
        </button>
      )}
    </div>
  );
}
