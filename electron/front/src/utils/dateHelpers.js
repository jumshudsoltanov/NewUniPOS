/**
 * Tarix yoxlaması — timezone səhvlərini aradan qaldırır.
 * next_payment_date "YYYY-MM-DD" formatında gəlir, local tarix kimi müqayisə edirik.
 */
export const parseDateOnly = (dateStr) => {
    if (!dateStr) return null;
    try {
        const str = String(dateStr).split("T")[0].trim();
        const parts = str.split(/[-/.]/).map((p) => parseInt(p, 10));
        if (parts.length >= 3 && !parts.some(isNaN)) {
            return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
        }
        return new Date(dateStr);
    } catch {
        return null;
    }
};

/** is_pos_block aktivdir? (1, "1", true) */
export const isPosBlocked = (val) =>
  val === 1 || val === "1" || val === true || Number(val) === 1;

/** Abunəlik bitibmi? (next_payment_date bu gündən əvvəldirsə) */
export const isPaymentExpired = (nextPaymentDate) => {
    if (!nextPaymentDate) return false;
    const payDate = parseDateOnly(nextPaymentDate);
    if (!payDate || isNaN(payDate.getTime())) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return payDate < now;
};
