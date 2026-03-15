import React, { useCallback, useEffect, useState } from "react";
import "./DiscountModal.css";
import Modal from "react-bootstrap/Modal";
import { useDispatch, useSelector } from "react-redux";
import { updateDiscountOnOrders } from "../../redux/Slices/OrdersSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";

const DiscountModal = React.memo(({ show, onClose, order }) => {
  const dispatch = useDispatch();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const [value, setValue] = useState("0");
  const [discountType, setDiscountType] = useState("percent");

  // Calculate order subtotal from items
  const subtotal = (order?.orders_items || []).reduce((sum, item) => {
    const qty = Number(item.count || item.quantity || 0);
    const price = Number(item.price || 0);
    if (Number(item.is_gift || 0) === 1) return sum;
    return sum + qty * price;
  }, 0);

  const deposit = Number(order?.deposit || 0);
  // Max cash discount = subtotal minus deposit (customer already paid deposit)
  const maxCashDiscount = Math.max(0, subtotal - deposit);
  // Max percent = percentage that corresponds to maxCashDiscount
  const maxPercentDiscount = subtotal > 0 ? (maxCashDiscount / subtotal) * 100 : 100;

  const clampValue = (raw, type) => {
    const num = parseFloat(raw);
    if (isNaN(num)) return raw;
    if (type === "percent") return String(Math.min(num, maxPercentDiscount));
    return String(Math.min(num, maxCashDiscount));
  };

  useEffect(() => {
    if (order) {
      setValue(order.discount_value ? String(order.discount_value) : "0");
      setDiscountType(order.discount_type || "percent");
    }
  }, [order]);

  const handleNumClick = (num) => {
    // Prevent multiple decimal points
    if (num === "." && value.includes(".")) return;

    let newVal;
    if (String(value) === "0" && num !== ".") {
      newVal = num.toString();
    } else {
      newVal = value + num.toString();
    }

    // If ending with ".", preserve it — user is still typing (e.g. "25.")
    if (String(newVal).endsWith(".")) {
      setValue(newVal);
    } else {
      setValue(clampValue(newVal, discountType));
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

  const handleUpdateDisCount = useCallback(async () => {
    try {
      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
      const safeValue = clampValue(value, discountType);
      await dispatch(
        updateDiscountOnOrders({
          orderId: order?.uuid,
          discountValue: safeValue,
          discountType,
          oldDiscountValue: order?.discount_value,
          oldDiscountType: order?.discount_type,
          waiterName
        }),
      ).unwrap();

      if (loginedProfileData?.data?.profile?.id) {
        const profileId = loginedProfileData.data.profile.id;
        await Promise.all([
          dispatch(getTableGroups(profileId)),
          dispatch(getActiveOrders({ profileId }))
        ]);
      }
    } catch (error) {
      console.error("Discount update failed:", error);
    }
  }, [dispatch, order, value, discountType, onClose, loginedProfileData]);

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      animation={false}
      dialogClassName="custom-modal-width"
      contentClassName="custom-modal-content"
    >
      <div className="discount-modal-container">
        {/* Header */}
        <div className="discount-header">
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
            <span className="header-title">Endirim</span>
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
        <div className="discount-body">
          {/* Max limit hint */}
          {deposit > 0 && (
            <div style={{ fontSize: '12px', color: '#888', padding: '4px 12px 0', textAlign: 'right' }}>
              Maks: {discountType === "percent"
                ? `${maxPercentDiscount % 1 === 0 ? maxPercentDiscount.toFixed(0) : maxPercentDiscount.toFixed(1)}%`
                : `${maxCashDiscount.toFixed(2)} ₼`}
              {' '}(depozit: {deposit.toFixed(2)} ₼)
            </div>
          )}
          {/* Input Area */}
          <div className="input-row">
            <div className="input-wrapper">
              <input
                type="text"
                value={value}
                readOnly
                className="discount-input"
              />
            </div>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${discountType === "percent" ? "active" : ""}`}
                onClick={() => { setDiscountType("percent"); setValue(v => clampValue(v.replace(/\.$/, ""), "percent")); }}
              >
                %
              </button>
              <button
                className={`toggle-btn ${discountType === "cash" ? "active" : ""}`}
                onClick={() => { setDiscountType("cash"); setValue(v => clampValue(v.replace(/\.$/, ""), "cash")); }}
              >
                ₼
              </button>
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
            <button
              className="apply-btn"
              onClick={async () => {
                await handleUpdateDisCount();
                onClose(false);
              }}
            >
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
});

export default DiscountModal;
