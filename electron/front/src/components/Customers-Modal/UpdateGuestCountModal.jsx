import React, { useCallback, useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import "./CustomersModal.css";
import { useDispatch, useSelector } from "react-redux";
import { updateGuestCountOrder, saveLog } from "../../redux/Slices/OrdersSlice";
import { toast } from "sonner";
import { t } from "../../utils/translations";

const UpdateGuestCountModal = ({ show, onHide, order, onSuccess }) => {
    const [guestCount, setGuestCount] = useState("0");
    const dispatch = useDispatch();
    const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (show && order) {
            setGuestCount(order.guest_count?.toString() || "0");
        }
    }, [show, order]);

    const handleNumberClick = (num) => {
        if (guestCount === "0") {
            setGuestCount(num.toString());
        } else {
            setGuestCount((prev) => prev + num);
        }
    };

    const handleBackspace = () => {
        setGuestCount((prev) => {
            if (prev.length <= 1) return "0";
            return prev.slice(0, -1);
        });
    };

    const handleClear = () => {
        setGuestCount("0");
    };

    const updateCount = useCallback(async () => {
        if (isUpdating || !order?.uuid) return;

        setIsUpdating(true);

        const payload = {
            orderId: order.uuid,
            guestCount: Number(guestCount) || 0,
        };

        try {
            const result = await dispatch(updateGuestCountOrder(payload)).unwrap();
            if (result) {
                // Persistent Log
                const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
                dispatch(saveLog({
                    orderId: order.uuid,
                    action: "Qonaq sayı dəyişdirildi",
                    waiterName,
                    details: `Yeni qonaq sayı: ${guestCount}`
                }));

                toast.success(t("qonaq_sayi_guncellendi"));
                if (onSuccess) {
                    onSuccess();
                }
                onHide();
            }
        } catch (err) {
            console.error("Guest count update error:", err);
            toast.error(t("error_occurred"));
        } finally {
            setIsUpdating(false);
        }
    }, [
        dispatch,
        guestCount,
        order,
        loginedWaiter,
        loginedProfileData,
        onHide,
        onSuccess,
        isUpdating,
    ]);

    return (
        <Modal show={show} onHide={onHide} centered className="customers-modal" backdrop="static" animation={false}>
            <div className="modal-content-wrapper">
                <div className="customers-modal-header">
                    <div className="customers-header-content">
                        <div className="customers-icon-circle">
                            <i className="bi bi-people-fill"></i>
                        </div>
                        <div className="customers-modal-title">{t("qonaq_sayini_deyis")}</div>
                    </div>
                    <button className="btn-close-custom" onClick={onHide}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div className="customers-modal-body">
                    <div className="guest-count-display-box">
                        <span className="guest-count-value">{guestCount || "0"}</span>
                    </div>

                    <div className="customers-keypad-grid">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <button
                                key={num}
                                className="customers-keypad-btn"
                                onClick={() => handleNumberClick(num)}
                                disabled={isUpdating}
                            >
                                {num}
                            </button>
                        ))}
                        <button
                            className="customers-keypad-btn customers-backspace-btn"
                            onClick={handleClear}
                            disabled={isUpdating}
                        >
                            C
                        </button>
                        <button
                            className="customers-keypad-btn"
                            onClick={() => handleNumberClick(0)}
                            disabled={isUpdating}
                        >
                            0
                        </button>
                        <button
                            className="customers-keypad-btn customers-backspace-btn"
                            onClick={handleBackspace}
                            disabled={isUpdating}
                        >
                            <i className="bi bi-backspace"></i>
                        </button>
                    </div>

                    <button
                        className="customers-save-btn"
                        onClick={updateCount}
                        disabled={isUpdating}
                    >
                        {isUpdating ? "Yenilənir..." : "Tətbiq et"}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default UpdateGuestCountModal;
