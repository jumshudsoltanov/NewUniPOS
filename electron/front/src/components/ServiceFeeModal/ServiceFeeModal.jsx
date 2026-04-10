import React, { useState } from "react";
import "./ServiceFeeModal.css";
import Modal from "react-bootstrap/Modal";
import { useEffect } from "react";
import { useCallback } from "react";
import { updateServiceFeeOnOrders } from "../../redux/Slices/OrdersSlice";
import { useDispatch, useSelector } from "react-redux";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";

const ServiceFeeModal = ({ show, onClose, order, hall }) => {
  const [value, setValue] = useState("0");
  const [feeType, setFeeType] = useState("percent");
  const dispatch = useDispatch();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);

  useEffect(() => {
    if (order) {
      if (order?.service_value !== undefined && order?.service_value !== null) {
        setValue(String(order.service_value));
        setFeeType(order?.service_type || "percent");
      }
    }
  }, [order]);

  const handleNumClick = (num) => {
    if (value === "0" && num !== ".") {
      setValue(num.toString());
    } else {
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

  const handleUpdateServiceFee = useCallback(async () => {
    try {
      if (!order?.uuid) {
        onClose();
        return;
      }

      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
      await dispatch(
        updateServiceFeeOnOrders({
          orderId: order.uuid,
          serviceValue: Number(value) === 0 ? "0.00001" : Number(value),
          feeType,
          oldServiceValue: order.service_charge,
          oldFeeType: order.service_type,
          waiterName
        }),
      ).unwrap();

      if (loginedProfileData?.data?.profile?.id) {
        const profileId = loginedProfileData.data.profile.id;
        dispatch(getTableGroups(profileId));
        dispatch(getActiveOrders({ profileId, silentRefresh: true }));
      }
      onClose();
    } catch (error) {
      console.error("service update failed:", error);
    }
  }, [dispatch, order, value, feeType, onClose, loginedProfileData]);

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      animation={false}
      dialogClassName="custom-modal-width"
      contentClassName="custom-modal-content"
    >
      <div className="service-fee-modal-container">
        {/* Header */}
        <div className="service-fee-header">
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
                  d="M9.75 3.75H14.25C14.6478 3.75 15.0294 3.90804 15.3107 4.18934L20.8107 9.68934C21.3965 10.2751 21.3965 11.2249 20.8107 11.8107L11.8107 20.8107C11.2249 21.3965 10.2751 21.3965 9.68934 20.8107L4.18934 15.3107C3.90804 15.0294 3.75 14.6478 3.75 14.25V9.75C3.75 6.43629 6.43629 3.75 9.75 3.75Z"
                  stroke="#053796"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="9.75"
                  cy="9.75"
                  r="2.25"
                  stroke="#053796"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
            <span className="header-title">Servis Haqqı</span>
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
        <div className="service-fee-body">
          {/* Input Area */}
          <div className="input-row">
            <div className="input-wrapper">
              <input
                type="text"
                value={value}
                readOnly
                className="service-fee-input"
              />
            </div>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${feeType === "percent" ? "active" : ""}`}
                onClick={() => setFeeType("percent")}
              >
                %
              </button>
              <button
                className={`toggle-btn ${feeType === "cash" ? "active" : ""}`}
                onClick={() => setFeeType("cash")}
              >
                ₼
              </button>
            </div>
          </div>

          {/* Hall Fee Shortcut */}
          {/* {hall?.service_fee && (
            <div
              className="hall-fee-shortcut"
              onClick={() => {
                setValue(String(hall.service_fee));
                setFeeType("percent");
              }}
            >
              <div className="shortcut-icon">
                <i className="bi bi-info-circle-fill"></i>
              </div>
              <div className="shortcut-text">
                Zal üzrə servis haqqı: <strong>{hall.service_fee}%</strong>
              </div>
              <div className="shortcut-action">Tətbiq et</div>
            </div>
          )} */}

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
            <button className="apply-btn" onClick={handleUpdateServiceFee}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: "8px" }}
              >
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
              Tətbiq et
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ServiceFeeModal;
