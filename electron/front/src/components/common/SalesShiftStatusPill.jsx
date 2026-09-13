import React from "react";
import { useSalesShiftStatus } from "../../hooks/useSalesShiftStatus";
import "./SalesShiftStatusPill.css";
import { t } from "../../utils/translations";

/**
 * @param {object} props
 * @param {string|number} [props.profileId]
 * @param {string|null} [props.terminalId]
 * @param {'header'|'check'} [props.variant]
 * @param {string} [props.className]
 */
const SalesShiftStatusPill = ({ profileId, variant = "header", className = "", onClick }) => {
    const { isOpen, shiftRow, loading, fetchFailed } = useSalesShiftStatus(profileId);

    if (!profileId) return null;

    const openedHint = shiftRow?.opened_at
        ? t("novbe_acilis", { date: new Date(shiftRow.opened_at).toLocaleString("az-AZ") })
        : "";

    const modeClass = loading
        ? "sales-shift-pill--loading"
        : fetchFailed
          ? "sales-shift-pill--error"
          : isOpen
            ? "sales-shift-pill--open"
            : "sales-shift-pill--closed";

    const title = loading
        ? t("novbe_veziyyeti_yoxlanir")
        : fetchFailed
          ? t("novbe_statusu_alinmadi")
          : isOpen
            ? t("satis_novbesi_aciqdir", { hint: openedHint }).trim()
            : t("satis_novbesi_baglidir_kontrol_panelden_acin");

    const labelFull = loading
        ? t("yoxlanir")
        : fetchFailed
          ? t("novbe_1")
          : isOpen
            ? t("novbe_aciq")
            : t("novbe_bagli");
    const labelShort = loading ? "…" : fetchFailed ? "—" : isOpen ? t("shift_aciq") : t("shift_bagli");

    const rootClass = [
        "sales-shift-pill",
        variant === "check" ? "sales-shift-pill--check" : "",
        modeClass,
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <span
            className={rootClass}
            title={title}
            role="status"
            aria-live="polite"
            onClick={onClick}
            style={onClick ? { cursor: "pointer" } : undefined}
        >
            <span className="sales-shift-pill-dot" aria-hidden />
            <span className="sales-shift-pill-label-full">{labelFull}</span>
            <span className="sales-shift-pill-label-short">{labelShort}</span>
        </span>
    );
};

export default SalesShiftStatusPill;
