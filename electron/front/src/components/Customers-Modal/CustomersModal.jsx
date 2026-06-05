import React, { useCallback, useEffect, useRef, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Container, Row, Col, Button } from "react-bootstrap";
import "./CustomersModal.css";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getNextOrderId, saleNewOrders } from "../../redux/Slices/SaleSlice";
import {
  getTableGroups,
  currentTableList,
  addOrderToTableOptimistic,
} from "../../redux/Slices/TablesSlice";
import { saveLog, deleteCheck, updateGuestCountOrder } from "../../redux/Slices/OrdersSlice";
import { addOrderOptimistic, updateOrderOptimisticId } from "../../redux/Slices/BooksSlice";
import { preloadCheck } from "../../utils/preloadCheck";

const CustomersModal = ({ show, onHide, table, selectedHall, autoCreate }) => {
  const [guestCount, setGuestCount] = useState("0");
  const dispatch = useDispatch();
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { currentHallId } = useSelector((state) => state.TablesSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const [serviceValue, setServiceValue] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (show) preloadCheck();
  }, [show]);

  useEffect(() => {
    const hallFee = selectedHall?.service_fee;
    if (hallFee !== 0) {
      setServiceValue(Number(hallFee));
    } else {
      setServiceValue(Number(loginedProfileData?.data?.profile?.service_fee));
    }
  }, [selectedHall, loginedProfileData]);

  useEffect(() => {
    if (show) {
      setGuestCount("0");
    }
  }, [show]);

  const handleCancel = useCallback(() => {
    setGuestCount("0");
    onHide();
  }, [onHide]);

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
  const isCreatingRef = useRef(false);
  const createOrderRef = useRef(null);

  const createOrder = useCallback(async () => {
    if (isCreatingRef.current) {
      console.warn("[CustomersModal] createOrder: artıq işləyir");
      return;
    }

    const waiterId = loginedWaiter?.data?.id;
    const terminalId = loginedProfileData?.data?.terminal?.terminal_id;
    const profileId = loginedProfileData?.data?.profile?.id;
    if (!waiterId || !terminalId || !profileId || !table?.id) {
      console.warn("[CustomersModal] createOrder: məlumat çatışmır", { waiterId, terminalId, profileId, tableId: table?.id });
      onHide();
      return;
    }

    setIsCreating(true);
    isCreatingRef.current = true;

    // 15 saniyə timeout — cavab gəlməsə da spinner dayansın
    const fallbackTimer = setTimeout(() => {
      if (isCreatingRef.current) {
        setIsCreating(false);
        isCreatingRef.current = false;
      }
    }, 15000);

    const sv = selectedHall?.service_fee !== 0
      ? Number(selectedHall?.service_fee)
      : Number(loginedProfileData?.data?.profile?.service_fee);

    const generatedUuid = crypto.randomUUID();
    const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

    const optimisticOrder = {
      uuid: generatedUuid,
      id: null,
      waiter_id: waiterId,
      profile_id: profileId,
      terminal_id: terminalId,
      sale_type: "dine_in",
      sale_type_name: "Restoranda",
      table_id: table.id,
      guest_count: Number(guestCount),
      status: 1,
      is_selected: 1,
      orders_items: [],
      table: { id: table.id, name: table.name, hall: { name: selectedHall?.name } },
      table_name: table.name,
      hall_name: selectedHall?.name,
      amount: 0,
      total: 0,
      start_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      discount: 0,
      service_value: sv || 0,
      service_type: sv ? "percent" : null,
      waiter: { id: waiterId, name: waiterName }
    };

    // Optimistic update + navigate immediately (no waiting for API)
    dispatch(addOrderOptimistic(optimisticOrder));
    dispatch(addOrderToTableOptimistic({ order: optimisticOrder, tableId: table.id }));
    onHide();
    navigate(`/check/${generatedUuid}?tableId=${table.id}`);

    // Fire API calls in the background
    dispatch(saveLog({
      orderId: generatedUuid,
      action: "Yeni sifariş yaradıldı",
      waiterName,
      details: `Masa: ${table?.name || "Naməlum"}, Qonaq sayı: ${guestCount}`
    }));

    // Get next ID and create order in background
    (async () => {
      try {
        let nextId = null;
        try {
          const nextIdRes = await dispatch(getNextOrderId(profileId)).unwrap();
          nextId = nextIdRes?.data?.nextId;
        } catch (e) {
          console.warn("getNextOrderId failed, using backend-generated id", e);
        }

        const payload = {
          guestCount: Number(guestCount),
          tableId: table.id,
          waiterId,
          terminalId,
          profileId,
          sale_type: "dine_in",
          hallId: currentHallId,
          status: 1,
          serviceType: sv ? "percent" : null,
          serviceValue: sv,
          is_selected: 1,
          uuid: generatedUuid,
          ...(nextId && { id: nextId }),
        };

        const res = await dispatch(saleNewOrders(payload)).unwrap();
        const serverOrder = res?.data;
        const finalId = serverOrder?.id ?? res?.count;
        if (finalId) {
          dispatch(updateOrderOptimisticId({ uuid: generatedUuid, newOrderData: { id: finalId } }));
        }
      } catch (err) {
        console.error("API Create Error:", err);
      } finally {
        clearTimeout(fallbackTimer);
        setIsCreating(false);
        isCreatingRef.current = false;
      }
    })();
  }, [
    dispatch,
    guestCount,
    table?.id,
    table?.name,
    loginedWaiter,
    loginedProfileData,
    currentHallId,
    selectedHall,
    navigate,
    onHide,
    isCreating,
  ]);

  // Ref-i her defe yenile (useCallback-den sonra olmalidi)
  createOrderRef.current = createOrder;

  useEffect(() => {
    if (show && autoCreate && createOrderRef.current) {
      const t = setTimeout(() => {
        if (createOrderRef.current) {
          createOrderRef.current().catch((e) => {
            console.warn("[CustomersModal] autoCreate xeta:", e);
          });
        }
      }, 100);
      return () => clearTimeout(t);
    }
  }, [show, autoCreate]);

  return (
    <Modal show={show} onHide={handleCancel} centered className="customers-modal" backdrop="static" animation={false}>
      <div className="modal-content-wrapper">
        <div className="customers-modal-header">
          <div className="customers-header-content">
            <div className="customers-icon-circle">
              <i className="bi bi-people-fill"></i>
            </div>
            <div className="customers-modal-title">Qonaq sayı</div>
          </div>
          <button className="btn-close-custom" onClick={handleCancel}>
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
            disabled={isCreating}
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
