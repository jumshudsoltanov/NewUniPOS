import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "react-bootstrap";
import { toast } from "sonner";
import {
  REMINDER_CHANGED_EVENT,
  cancelCheckReminder,
  getCheckReminder,
  getReminderRemainingSeconds,
  setCheckReminder,
} from "../../utils/checkReminders";
import "./CheckReminderModal.css";

const QUICK_MINUTES = [5, 10, 15, 30];

const CheckReminderModal = ({ show, onClose, orderUuid, orderId, label }) => {
  const [value, setValue] = useState("");
  const [active, setActive] = useState(() => getCheckReminder(orderUuid));
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!show) return;
    setValue("");
    const refresh = () => setActive(getCheckReminder(orderUuid));
    refresh();
    window.addEventListener(REMINDER_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(REMINDER_CHANGED_EVENT, refresh);
  }, [show, orderUuid]);

  useEffect(() => {
    if (!show || !active) return;
    const tick = () => setRemaining(getReminderRemainingSeconds(active));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [show, active]);

  const remainingLabel = useMemo(() => {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [remaining]);

  const press = (ch) => {
    setValue((prev) => {
      if (ch === ".") {
        if (prev.includes(".")) return prev;
        return prev === "" ? "0." : prev + ".";
      }
      if (prev === "0") return String(ch);
      if (prev.replace(".", "").length >= 4) return prev;
      return prev + String(ch);
    });
  };

  const backspace = () => setValue((prev) => prev.slice(0, -1));

  const save = () => {
    const mins = Number(value);
    if (!(mins > 0)) {
      toast.warning("Dəqiqə daxil edin");
      return;
    }
    if (!orderUuid) {
      toast.error("Çek hələ yaradılmayıb");
      return;
    }
    setCheckReminder({ orderUuid, orderId, label, minutes: mins });
    toast.success(`${mins} dəqiqədən sonra xatırladılacaq`);
    onClose();
  };

  const remove = () => {
    cancelCheckReminder(orderUuid);
    setActive(null);
    setValue("");
    toast.info("Xatırlatma silindi");
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      animation={false}
      backdrop="static"
      className="check-reminder-modal"
    >
      <div className="crm-header">
        <div className="crm-header-left">
          <span className="crm-header-icon">
            <i className="bi bi-alarm"></i>
          </span>
          <span className="crm-title">Çek bildiriş</span>
        </div>
        <button type="button" className="crm-close" onClick={onClose} aria-label="Bağla">
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      <div className="crm-body">
        {active && (
          <div className="crm-active">
            <span className="crm-active-dot" aria-hidden />
            <span>Aktiv xatırlatma</span>
            <strong className="crm-active-time">{remainingLabel}</strong>
          </div>
        )}

        <div className="crm-display">
          <span className={`crm-display-value ${value ? "" : "is-empty"}`}>
            {value || "0"}
          </span>
          <span className="crm-display-unit">dəq</span>
        </div>

        <div className="crm-quick">
          {QUICK_MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              className={`crm-quick-btn ${value === String(m) ? "is-active" : ""}`}
              onClick={() => setValue(String(m))}
            >
              {m} dəq
            </button>
          ))}
        </div>

        <div className="crm-keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} type="button" className="crm-key" onClick={() => press(n)}>
              {n}
            </button>
          ))}
          <button type="button" className="crm-key" onClick={() => press(".")}>
            .
          </button>
          <button type="button" className="crm-key" onClick={() => press(0)}>
            0
          </button>
          <button type="button" className="crm-key crm-key-muted" onClick={backspace} aria-label="Sil">
            <i className="bi bi-backspace"></i>
          </button>
        </div>

        <div className="crm-actions">
          <button
            type="button"
            className="crm-btn crm-btn-secondary"
            onClick={remove}
            disabled={!active}
          >
            <i className="bi bi-x-lg"></i>
            Sil
          </button>
          <button type="button" className="crm-btn crm-btn-primary" onClick={save}>
            <i className="bi bi-check-lg"></i>
            Saxla
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CheckReminderModal;
