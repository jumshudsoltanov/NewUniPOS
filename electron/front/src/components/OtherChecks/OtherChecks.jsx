import React, { useEffect, useState } from "react";
import "./OtherChecks.css";
import { Modal } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
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
  onCreateNew,
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
      if (item.sale_type === "delivery") return "Çatdırılma";
      if (item.sale_type === "takeaway") return "Takeaway";
      return item.sale_type.charAt(0).toUpperCase() + item.sale_type.slice(1);
    }

    if (item.table?.name) {
      return `${item.table.hall?.name || "Zal"} / ${item.table.name}`;
    }

    if ((!showAll || item.table_id === table?.id) && table) {
      return `${currentHallName || "Zal"} / ${table.name}`;
    }

    return "Zal / Masa";
  };

  const handleGoNewCheck = (orderId, tableId) => {
    const url = tableId
      ? `/check/${orderId}?tableId=${tableId}`
      : `/check/${orderId}`;

    navigate(url);
    onClose(false);
  };

  const handleMergeCheck = async (currentOrderId, newOrderId, currentCheckData, newCheckData) => {
    try {
      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
      await dispatch(mergeChecks({
        currentOrderId,
        newOrderId,
        currentCheckId: currentCheckData.id,
        newCheckId: newCheckData.id,
        currentTotal: currentCheckData.total,
        newTotal: newCheckData.total,
        waiterName
      })).unwrap();
      await dispatch(getTableGroups(loginedProfileData?.data?.profile?.id));
      await dispatch(
        getActiveOrders({ profileId: loginedProfileData?.data?.profile?.id }),
      );
      onClose(true);
    } catch (err) {
      console.error("Merge failed", err);
    }
  };

  const onMultiFunctionOtherChecs = async (type, orderId, tableId, orderData) => {
    if (type !== "merge") {
      handleGoNewCheck(orderId, tableId);
    } else {
      handleMergeCheck(order.uuid, orderId, order, orderData);
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
                className="check-item py-3 align-items-center"
                onClick={() =>
                  onMultiFunctionOtherChecs(type, item.uuid, item.table_id, item)
                }
              >
                <div className="d-flex flex-column text-start overflow-hidden pe-3" style={{ flex: 1 }}>
                  <div className="fw-bold text-truncate text-dark" style={{ fontSize: '1rem' }} title={resolveNames(item)}>
                    {resolveNames(item)}
                  </div>
                  <div className="text-muted small text-truncate mt-1">
                    <span className="me-2">Çek #{item.id}</span>
                    <span className="me-2">•</span>
                    <span className="me-2">Qonaq: {item.guest_count || 1}</span>
                    <span className="me-2">•</span>
                    <span>{item.waiter?.name || "terminal_user"}</span>
                  </div>
                </div>
                <div className="fw-bold text-nowrap text-primary fs-5">
                  {Number(item.total || 0).toFixed(2)} ₼
                </div>
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
            onClick={onCreateNew}
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
