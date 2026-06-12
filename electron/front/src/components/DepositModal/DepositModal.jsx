import React, { useState, useEffect } from "react";
import "./DepositModal.css";
import Modal from "react-bootstrap/Modal";
import { useDispatch, useSelector } from "react-redux";
import { updateDepositOnOrders } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { t } from "../../utils/translations";

const DepositModal = ({ show, onClose, order }) => {
    const dispatch = useDispatch();
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);
    const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
    const [value, setValue] = useState("0");

    useEffect(() => {
        if (order && show) {
            setValue(order.deposit ? String(order.deposit) : "0");
        }
    }, [order, show]);

    const handleNumClick = (num) => {
        if (value === "0" && num !== ".") {
            setValue(num.toString());
        } else {
            // Prevent multiple dots
            if (num === "." && value.includes(".")) return;
            setValue(value + num.toString());
        }
    };

    const handleBackspace = () => {
        if (value.length > 1) {
            setValue(value.slice(0, -1));
        } else {
            setValue("0");
        }
    };

    const handleClear = () => {
        setValue("0");
    };

    const handleApply = async () => {
        try {
            if (!order?.uuid) {
                onClose();
                return;
            }

            const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
            await dispatch(updateDepositOnOrders({
                orderId: order.uuid,
                depositValue: value,
                oldDepositValue: order.deposit,
                waiterName
            })).unwrap();

            if (loginedProfileData?.data?.profile?.id) {
                const profileId = loginedProfileData.data.profile.id;
                dispatch(getTableGroups(profileId));
                dispatch(getActiveOrders({ profileId, silentRefresh: true }));
            }

            onClose();
        } catch (error) {
            console.error("Deposit update failed:", error);
        }
    };

    return (
        <Modal
            show={show}
            onHide={onClose}
            centered
            className="customers-modal deposit-override-modal"
            backdrop="static"
            animation={false}
        >
            <div className="modal-content-wrapper">
                {/* Header */}
                <div className="customers-modal-header">
                    <div className="customers-header-content">
                        <div className="customers-icon-circle">
                            <i className="bi bi-wallet2"></i>
                        </div>
                        <div className="customers-modal-title">{t("deposit")}</div>
                    </div>
                    <button className="btn-close-custom" onClick={onClose}>
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

                {/* Body */}
                <div className="customers-modal-body">
                    {/* Input Area */}
                    <div className="guest-count-display-box deposit-display-box">
                        <span className="guest-count-value">{value || "0"} ₼</span>
                    </div>

                    {/* Keypad Grid */}
                    <div className="customers-keypad-grid">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <button
                                key={num}
                                className="customers-keypad-btn"
                                onClick={() => handleNumClick(num)}
                            >
                                {num}
                            </button>
                        ))}
                        <button className="customers-keypad-btn" onClick={() => handleNumClick(".")}>
                            .
                        </button>
                        <button className="customers-keypad-btn" onClick={() => handleNumClick(0)}>
                            0
                        </button>
                        <button
                            className="customers-keypad-btn customers-backspace-btn"
                            onClick={handleBackspace}
                        >
                            <i className="bi bi-backspace"></i>
                        </button>
                    </div>

                    {/* Footer Actions */}
                    <div className="deposit-action-row">
                        <button className="deposit-delete-all-btn" onClick={handleClear}>
                            <i className="bi bi-trash3"></i>
                        </button>
                        <button className="customers-save-btn deposit-save-btn" onClick={handleApply}>
                            <i className="bi bi-check2 me-2" style={{ fontSize: '1.5rem' }}></i>{t("apply")}</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default DepositModal;
