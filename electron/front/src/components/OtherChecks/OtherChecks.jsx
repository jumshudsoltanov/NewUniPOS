import React, { useCallback, useEffect, useState } from "react";
import "./OtherChecks.css";
import { Button, Modal } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { saleNewOrders } from "../../redux/Slices/SaleSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";

const OtherChecks = ({ show, onClose, table }) => {
  const { currentHallId } = useSelector((state) => state.TablesSlice);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const [guestCount, setGuestCount] = useState("0");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    dispatch(getTableGroups(loginedProfileData?.data?.profile.id));
  }, []);

  const filteredOrders = table?.orders?.filter((o) => o.uuid != id) || [];

  const createOrder = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);

    const payload = {
      guestCount: 0,
      tableId: table.id,
      waiterId: loginedWaiter.data.id,
      terminalId: loginedProfileData.data.terminal.terminal_id,
      profileId: loginedProfileData.data.profile.id,
      sale_type: "dine_in",
      hallId: currentHallId,
      status: 1,
      is_selected: 1,
    };

    try {
      const result = await dispatch(saleNewOrders(payload)).unwrap();
      if (result.message === "success") {
        await dispatch(getTableGroups(payload.profileId));
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
    navigate(`/check/${orderId}?tableId=${tableId}`);
    onClose(false);
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
            {table?.orders?.length || 0}
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
                onClick={() => handleGoNewCheck(item.uuid, table.id)}
              >
                <span>
                  Çek #{item.id} / #{item.guest_count || 1} (
                  {item.sale_type === "dine_in" ? "Restoranda" : "Çatdırılma"})
                  ({item.waiter?.name || "terminal_user"})
                </span>
                <span style={{ fontWeight: "bold" }}>
                  {item.total || item.amount || 0} ₼
                </span>
              </button>
            ))
          ) : (
            <div className="d-flex flex-column align-items-center justify-content-center text-muted py-5 text-center">
              <i className="bi bi-receipt mb-2 fs-1"></i>
              <span className="fs-5">Bu masada aktiv çek tapılmadı</span>
            </div>
          )}
        </div>
        <button
          className="check-item create-check-item"
          onClick={() => createOrder()}
        >
          <span className="me-2 fw-bold" style={{ fontSize: "20px" }}>
            +
          </span>
          <span className="fw-medium">Yeni yarat</span>
        </button>
      </Modal.Body>
    </Modal>
  );
};

export default OtherChecks;
