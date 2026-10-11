// Limitsiz böyüməsin deyə — hər hadisədə bütün siyahı JSON.stringify/parse
// olunduğu üçün array böyüdükcə proqram tədricən yavaşlayır (saatlarla açıq
// qalan POS-da min-larla bildiriş yığıla bilər)
const MAX_STORED_NOTIFICATIONS = 300;

const isSuppressedNotification = (notification) => {
  return (
    notification?.title === "Printer təyinatı yoxdur" ||
    String(notification?.dedupeKey || "").startsWith("no-kitchen-printer-")
  );
};

const readNotifications = () => {
  const notifications = JSON.parse(
    localStorage.getItem("pos_notifications") || "[]",
  );
  const visibleNotifications = notifications.filter(
    (notification) => !isSuppressedNotification(notification),
  );

  if (visibleNotifications.length !== notifications.length) {
    localStorage.setItem(
      "pos_notifications",
      JSON.stringify(visibleNotifications),
    );
  }

  return visibleNotifications;
};

export const addNotification = (title, message, options = {}) => {
  const {
    orderId = null,
    printerName = null,
    category = "info",
    type = "info",
    dedupeKey = null,
    dedupeTtlMs = 180000,
    // Kartın struktur məlumatı (məs. QR sifarişində masa, məhsul sayı, məbləğ).
    // Mətnin içinə yığmaq əvəzinə ayrıca saxlanılır ki, panel onu çip kimi
    // göstərə bilsin və tərcümə mətni pozulmasın.
    meta = null,
  } = options;
  if (isSuppressedNotification({ title, dedupeKey })) {
    return;
  }

  const notifications = readNotifications();
  if (dedupeKey) {
    const now = Date.now();
    const ttl = Number(dedupeTtlMs) > 0 ? Number(dedupeTtlMs) : 180000;
    const hasRecent = notifications.some(
      (n) =>
        n.dedupeKey === dedupeKey &&
        n.id != null &&
        now - n.id < ttl,
    );
    if (hasRecent) {
      return;
    }
  }
  const now = Date.now();
  const lastId = Number(
    localStorage.getItem("pos_notifications_last_id") || "0",
  );
  const nextId = now > lastId ? now : lastId + 1;
  localStorage.setItem("pos_notifications_last_id", String(nextId));
  const newNotif = {
    id: nextId,
    title,
    message,
    orderId,
    printerName,
    category, // new field for filtering (e.g., 'product', 'system', 'order')
    time: new Date().toLocaleTimeString("az-AZ", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    fullDate: new Date().toLocaleString("az-AZ"),
    status: "new", // new, old
    type, // error, info, success, warning
    ...(dedupeKey != null && dedupeKey !== "" ? { dedupeKey } : {}),
    ...(meta && typeof meta === "object" ? { meta } : {}),
  };
  notifications.unshift(newNotif);
  if (notifications.length > MAX_STORED_NOTIFICATIONS) {
    notifications.length = MAX_STORED_NOTIFICATIONS;
  }
  localStorage.setItem("pos_notifications", JSON.stringify(notifications));
  // Trigger a custom event so Header can update count
  window.dispatchEvent(new CustomEvent("newNotification"));
};

export const getNotifications = () => {
  const notifications = readNotifications();
  const now = Date.now();
  const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;

  // Auto-mark as old if older than 2 days
  let changed = false;
  const updated = notifications.map((n) => {
    if (n.status === "new" && now - n.id > twoDaysInMs) {
      changed = true;
      return { ...n, status: "old" };
    }
    return n;
  });

  if (changed) {
    localStorage.setItem("pos_notifications", JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("newNotification"));
  }

  return updated;
};

export const clearNotifications = (status) => {
  const notifications = readNotifications();
  const updated = notifications.filter((n) => n.status !== status);
  localStorage.setItem("pos_notifications", JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("newNotification"));
};

export const markAllAsOld = () => {
  const notifications = readNotifications();
  const updated = notifications.map((n) => ({ ...n, status: "old" }));
  localStorage.setItem("pos_notifications", JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("newNotification"));
};
