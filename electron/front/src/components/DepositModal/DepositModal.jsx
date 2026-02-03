import React, { useState, useEffect } from "react";
import "./DepositModal.css";
import Modal from "react-bootstrap/Modal";
import { useDispatch, useSelector } from "react-redux";
import { updateDepositOnOrders } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";

const DepositModal = ({ show, onClose, order }) => {
    const dispatch = useDispatch();
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);
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

            await dispatch(updateDepositOnOrders({
                orderId: order.uuid,
                depositValue: value
            })).unwrap();

            if (loginedProfileData?.data?.profile?.id) {
                const profileId = loginedProfileData.data.profile.id;
                await Promise.all([
                    dispatch(getTableGroups(profileId)),
                    dispatch(getActiveOrders({ profileId }))
                ]);

                // Small delay to ensure Redux state is fully committed
                await new Promise((resolve) => setTimeout(resolve, 100));
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
            animation={false}
            dialogClassName="custom-modal-width"
            contentClassName="custom-modal-content"
        >
            <div className="deposit-modal-container">
                {/* Header */}
                <div className="deposit-header">
                    <div className="header-left">
                        <div className="header-icon">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                            >
                                <path
                                    d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                                    stroke="#053796"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <path
                                    d="M12 6V18"
                                    stroke="#053796"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <path
                                    d="M9 9C9 9 10 7.5 12 7.5C14 7.5 15 9 15 10C15 11.5 12.5 12 12 12.5C11.5 13 9 13.5 9 15C9 16.5 11 17.5 13 17.5C15 17.5 16 16.5 16 16.5"
                                    stroke="#053796"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>
                        <span className="header-title">Depozit</span>
                    </div>
                    <button className="close-btn" onClick={onClose}>
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
                <div className="deposit-body">
                    {/* Input Area */}
                    <div className="input-row">
                        <div className="input-wrapper">
                            <input
                                type="text"
                                value={value}
                                readOnly
                                className="deposit-input"
                            />
                        </div>
                        <div className="toggle-group permanent-cash">
                            <button className="toggle-btn active">₼</button>
                        </div>
                    </div>

                    {/* Keypad */}
                    <div className="keypad-grid">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <button
                                key={num}
                                className="keypad-btn"
                                onClick={() => handleNumClick(num)}
                            >
                                {num}
                            </button>
                        ))}
                        <button className="keypad-btn" onClick={() => handleNumClick(".")}>
                            .
                        </button>
                        <button className="keypad-btn" onClick={() => handleNumClick(0)}>
                            0
                        </button>
                        <button
                            className="keypad-btn backspace-btn"
                            onClick={handleBackspace}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-9.172a2 2 0 00-1.414.586L3 12z"
                                />
                            </svg>
                        </button>
                    </div>

                    {/* Footer Actions */}
                    <div className="action-row">
                        <button className="delete-all-btn" onClick={handleClear}>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                        </button>
                        <button className="apply-btn" onClick={handleApply}>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ marginRight: "8px" }}
                            >
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Tətbiq et
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default DepositModal;
