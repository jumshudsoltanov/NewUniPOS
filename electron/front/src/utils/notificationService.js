export const addNotification = (title, message, options = {}) => {
  const {
    orderId = null,
    printerName = null,
    category = "info",
    type = "info",
    dedupeKey = null,
    dedupeTtlMs = 180000,
  } = options;
  const notifications = JSON.parse(
    localStorage.getItem("pos_notifications") || "[]",
  );
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
  };
  notifications.unshift(newNotif);
  localStorage.setItem("pos_notifications", JSON.stringify(notifications));
  // Trigger a custom event so Header can update count
  window.dispatchEvent(new CustomEvent("newNotification"));
};

export const getNotifications = () => {
  const notifications = JSON.parse(
    localStorage.getItem("pos_notifications") || "[]",
  );
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
  const notifications = JSON.parse(
    localStorage.getItem("pos_notifications") || "[]",
  );
  const updated = notifications.filter((n) => n.status !== status);
  localStorage.setItem("pos_notifications", JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("newNotification"));
};

export const markAllAsOld = () => {
  const notifications = JSON.parse(
    localStorage.getItem("pos_notifications") || "[]",
  );
  const updated = notifications.map((n) => ({ ...n, status: "old" }));
  localStorage.setItem("pos_notifications", JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("newNotification"));
};
