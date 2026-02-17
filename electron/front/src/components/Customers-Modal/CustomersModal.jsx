import React, { useCallback, useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Container, Row, Col, Button } from "react-bootstrap";
import "./CustomersModal.css";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { saleNewOrders } from "../../redux/Slices/SaleSlice";
import {
  getTableGroups,
  currentTableList,
} from "../../redux/Slices/TablesSlice";
import { saveLog } from "../../redux/Slices/OrdersSlice";

const CustomersModal = ({ show, onHide, table, selectedHall }) => {
  const [guestCount, setGuestCount] = useState("0");
  const dispatch = useDispatch();
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { currentHallId } = useSelector((state) => state.TablesSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const [serviceValue, setServiceValue] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const hallFee = selectedHall?.service_fee;

    if (hallFee !== 0) {
      setServiceValue(Number(hallFee));
    } else {
      setServiceValue(Number(loginedProfileData?.data?.profile?.service_fee));
    }
  }, [selectedHall]);




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

  const [isCreating, setIsCreating] = useState(false);

  const createOrder = useCallback(async () => {
    if (isCreating) return;

    const waiterId = loginedWaiter?.data?.id;
    const terminalId = loginedProfileData?.data?.terminal?.terminal_id;
    const profileId = loginedProfileData?.data?.profile?.id;

    if (!waiterId || !terminalId || !profileId) {
      console.error("Missing required user data for creating order");
      return;
    }

    setIsCreating(true);

    const payload = {
      guestCount,
      tableId: table.id,
      waiterId,
      terminalId,
      profileId,
      sale_type: "dine_in",
      hallId: currentHallId,
      status: 1,
      serviceType: serviceValue ? "percent" : null,
      serviceValue: serviceValue,
      is_selected: 1,
    };

    try {
      const result = await dispatch(saleNewOrders(payload)).unwrap();
      if (result?.message === "success") {
        // Persistent Log
        const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
        dispatch(saveLog({
          orderId: result.data.uuid,
          action: "Yeni sifariş yaradıldı",
          waiterName,
          details: `Masa: ${table?.name || "Naməlum"}, Qonaq sayı: ${guestCount}`
        }));

        navigate(`/check/${result?.data?.uuid}?tableId=${table.id}`);
      }
    } catch (err) {
      console.error("Check created error:", err);
    } finally {
      setIsCreating(false);
    }
  }, [
    dispatch,
    guestCount,
    table?.id,
    loginedWaiter,
    loginedProfileData,
    currentHallId,
    navigate,
    isCreating,
  ]);

  return (
    <Modal show={show} onHide={onHide} centered className="customers-modal" backdrop="static" animation={false}>
      <div className="modal-content-wrapper">
        <div className="customers-modal-header">
          <div className="customers-header-content">
            <div className="customers-icon-circle">
              <i className="bi bi-people-fill"></i>
            </div>
            <div className="customers-modal-title">Qonaq sayı</div>
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
                disabled={isCreating}
              >
                {num}
              </button>
            ))}
            <button
              className="customers-keypad-btn"
              onClick={() => handleNumberClick(".")}
              disabled={isCreating}
            >
              .
            </button>
            <button
              className="customers-keypad-btn"
              onClick={() => handleNumberClick(0)}
              disabled={isCreating}
            >
              0
            </button>
            <button
              className="customers-keypad-btn customers-backspace-btn"
              onClick={handleBackspace}
              disabled={isCreating}
            >
              <i className="bi bi-backspace"></i>
            </button>
          </div>

          <button
            className="customers-save-btn"
            disabled={isCreating || guestCount === "0"}
            onClick={createOrder}
          >
            {isCreating ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Yaradılır...
              </>
            ) : (
              <>
                <i className="bi bi-check2 me-2" style={{ fontSize: '1.5rem' }}></i>
                Təsdiqlə
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CustomersModal;
