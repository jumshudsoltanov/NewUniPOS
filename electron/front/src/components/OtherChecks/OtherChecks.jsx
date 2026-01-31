import React, { useCallback, useEffect, useState } from "react";
import "./OtherChecks.css";
import { Button, Modal } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { saleNewOrders } from "../../redux/Slices/SaleSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { mergeChecks } from "../../redux/Slices/OrdersSlice";

const OtherChecks = ({
  show,
  onClose,
  table,
  showAll = false,
  type,
  order,
}) => {
  const { currentHallId, tableGroups } = useSelector(
    (state) => state.TablesSlice,
  );

  const currentHallData = tableGroups?.data?.find(
    (item) => item.id === currentHallId,
  );

  const { books } = useSelector((state) => state.BooksSlice);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const [guestCount, setGuestCount] = useState("0");
  const [isCreating, setIsCreating] = useState(false);
  const [serviceValue, setserviceValue] = useState(0);

  useEffect(() => {
    const hallFee = currentHallData?.service_fee;
    const hasServiceType = currentHallData?.service_type !== null && currentHallData?.service_type !== undefined;

    if (hasServiceType && hallFee !== null && hallFee !== undefined && hallFee !== "") {
      setserviceValue(Number(hallFee));
    } else {
      setserviceValue(0);
    }
  }, [currentHallData]);
  useEffect(() => {
    dispatch(getTableGroups(loginedProfileData?.data?.profile.id));
    dispatch(
      getActiveOrders({ profileId: loginedProfileData?.data?.profile.id }),
    );
  }, [dispatch, loginedProfileData]);

  const filteredOrders =
    showAll || !table
      ? books?.data?.filter((o) => o.uuid != id) || []
      : table?.orders?.filter((o) => o.uuid != id) || [];

  const currentHallName = tableGroups?.data?.find(
    (h) => h.id === currentHallId,
  )?.name;

  const resolveNames = (item) => {
    if (item.sale_type !== "dine_in") {
      return item.sale_type === "delivery" ? "Çatdırılma" : "Takeaway";
    }

    if (item.table?.name) {
      return `${item.table.hall?.name || "Zal"} / ${item.table.name}`;
    }

    if ((!showAll || item.table_id === table?.id) && table) {
      return `${currentHallName || "Zal"} / ${table.name}`;
    }

    return "Zal / Masa";
  };

  const createOrder = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);

    const payload = {
      guestCount: 0,
      tableId: table?.id,
      waiterId: loginedWaiter.data.id,
      terminalId: loginedProfileData.data.terminal.terminal_id,
      profileId: loginedProfileData.data.profile.id,
      sale_type: "dine_in",
      hallId: currentHallId,
      status: 1,
      serviceType: serviceValue ? "percent" : null,
      serviceValue: serviceValue,
      is_selected: 1,
    };

    try {
      const result = await dispatch(saleNewOrders(payload)).unwrap();
      if (result.message === "success") {
        await dispatch(getTableGroups(payload.profileId));
        await dispatch(getActiveOrders({ profileId: payload.profileId }));
        navigate(`/check/${result.data.uuid}?tableId=${table.id}`);
        onClose(false);
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
    loginedWaiter.data.id,
    loginedProfileData.data.terminal.terminal_id,
    loginedProfileData.data.profile.id,
    currentHallId,
    navigate,
    isCreating,
  ]);

  const handleGoNewCheck = (orderId, tableId) => {
    const url = tableId
      ? `/check/${orderId}?tableId=${tableId}`
      : `/check/${orderId}`;

    navigate(url);
    onClose(false);
  };

  const handleMergeCheck = async (currentOrderId, newOrderId) => {
    try {
      await dispatch(mergeChecks({ currentOrderId, newOrderId })).unwrap();
      await dispatch(getTableGroups(loginedProfileData?.data?.profile?.id));
      await dispatch(
        getActiveOrders({ profileId: loginedProfileData?.data?.profile?.id }),
      );
      onClose(true);
    } catch (err) {
      console.error("Merge failed", err);
    }
  };

  const onMultiFunctionOtherChecs = async (type, orderId, tableId) => {
    if (type !== "merge") {
      handleGoNewCheck(orderId, tableId);
    } else {
      handleMergeCheck(order.uuid, orderId);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      dialogClassName="other-checks-modal"
      centered
    >
      <Modal.Header closeButton style={{ background: "#4F85F4" }}>
        <Modal.Title style={{ fontSize: "18px" }}>
          Açıq çeklər
          <span className="ms-2 badge bg-light text-primary rounded-pill">
            {filteredOrders?.length || 0}
          </span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="check-list-container">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((item, index) => (
              <button
                key={index}
                className="check-item"
                onClick={() =>
                  onMultiFunctionOtherChecs(type, item.uuid, item.table_id)
                }
              >
                <span>
                  <span style={{ fontWeight: "bold", marginRight: "5px" }}>
                    {resolveNames(item)}
                  </span>
                  - Çek #{item.id} / Qonaq: {item.guest_count || 1}
                  <span className="ms-2">
                    ({item.waiter?.name || "terminal_user"})
                  </span>
                </span>
                <span style={{ fontWeight: "bold" }}>
                  {item.total || item.amount || 0} ₼
                </span>
              </button>
            ))
          ) : (
            <div className="d-flex flex-column align-items-center justify-content-center text-muted py-5 text-center">
              <i className="bi bi-receipt mb-2 fs-1"></i>
              <span className="fs-5">Aktiv çek tapılmadı</span>
            </div>
          )}
        </div>

        {table && (
          <button
            className="check-item create-check-item"
            onClick={() => createOrder()}
          >
            <span className="me-2 fw-bold" style={{ fontSize: "20px" }}>
              +
            </span>
            <span className="fw-medium">Yeni yarat</span>
          </button>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default OtherChecks;
