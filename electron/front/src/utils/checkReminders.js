/**
 * ÇEK XATIRLATMALARI
 * ==================
 * Çek başlığındakı saata basıb dəqiqə yazılır. Vaxt bitəndə bildirişlər bölməsinə
 * xatırlatma düşür, zəng ikonu titrəyir və səs çalınır.
 *
 * Saxlanma: localStorage (`pos_check_reminders`) — proqram yenilənsə də itmir.
 * Yoxlama: App.jsx-də bir dəfə başladılan qlobal tik (hər saniyə).
 */
import { addNotification } from "./notificationService";
import { playNotificationSound } from "./notificationSound";

const STORAGE_KEY = "pos_check_reminders";
export const REMINDER_CHANGED_EVENT = "checkReminderChanged";
export const REMINDER_FIRED_EVENT = "checkReminderFired";

function readAll() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* yaddaş dolu/bağlı — kritik deyil */
  }
  window.dispatchEvent(new CustomEvent(REMINDER_CHANGED_EVENT));
}

/** Çek üçün aktiv xatırlatma (yoxdursa null) */
export function getCheckReminder(orderUuid) {
  if (!orderUuid) return null;
  return readAll().find((r) => String(r.orderUuid) === String(orderUuid)) || null;
}

/** Xatırlatma qoy (mövcud olanı əvəz edir) */
export function setCheckReminder({ orderUuid, orderId, label, minutes }) {
  const mins = Number(minutes);
  if (!orderUuid || !(mins > 0)) return null;
  const now = Date.now();
  const reminder = {
    id: now,
    orderUuid: String(orderUuid),
    orderId: orderId ?? null,
    label: label || "",
    minutes: mins,
    createdAt: now,
    dueAt: now + Math.round(mins * 60000),
  };
  const rest = readAll().filter((r) => String(r.orderUuid) !== String(orderUuid));
  writeAll([reminder, ...rest]);
  return reminder;
}

export function cancelCheckReminder(orderUuid) {
  if (!orderUuid) return;
  const list = readAll();
  const next = list.filter((r) => String(r.orderUuid) !== String(orderUuid));
  if (next.length !== list.length) writeAll(next);
}

/** Qalan saniyə (bitibsə 0) */
export function getReminderRemainingSeconds(reminder) {
  if (!reminder?.dueAt) return 0;
  return Math.max(0, Math.ceil((reminder.dueAt - Date.now()) / 1000));
}

function fire(reminder) {
  const title = "Çek xatırlatması";
  const where = reminder.label ? `${reminder.label} — ` : "";
  const idPart = reminder.orderId ? ` (#${reminder.orderId})` : "";
  const message = `${where}${reminder.minutes} dəqiqə bitdi${idPart}`;
  addNotification(title, message, {
    orderId: reminder.orderId,
    category: "clock",
    type: "reminder",
  });
  playNotificationSound({ times: 2, gapMs: 700, volume: 0.15 });
  window.dispatchEvent(new CustomEvent(REMINDER_FIRED_EVENT, { detail: reminder }));
}

/**
 * Qlobal tik — App.jsx-də bir dəfə başladılır. Dayandırma funksiyası qaytarır.
 */
export function startCheckReminderTicker() {
  const check = () => {
    const list = readAll();
    if (list.length === 0) return;
    const now = Date.now();
    const due = list.filter((r) => r.dueAt <= now);
    if (due.length === 0) return;
    writeAll(list.filter((r) => r.dueAt > now));
    due.forEach(fire);
  };
  check();
  const interval = setInterval(check, 1000);
  return () => clearInterval(interval);
}
