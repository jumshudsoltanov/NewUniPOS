import React from "react";
import Modal from "react-bootstrap/Modal";
import { useDispatch, useSelector } from "react-redux";
import { clearOrders, deleteOrderItems } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import "./ClearCheck.css";

const ClearCheck = ({ show, onClose, order }) => {
  const dispatch = useDispatch();
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);

  const handleClearCheck = async () => {
    try {
      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
      const profileId = loginedProfileData?.data?.profile?.id;

      await dispatch(
        deleteOrderItems({ orderId: order.uuid, waiterName }),
      ).unwrap();

      if (profileId) {
        await dispatch(getTableGroups(profileId));
        await dispatch(getActiveOrders({ profileId }));
      }
    } catch (error) {
      console.error("Clear Check Error:", error);
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered className="clear-check-modal" backdrop="static" animation={false}>
      <div className="modal-content-wrapper">
        <div className="clear-check-modal-header">
          <div className="clear-check-header-content">
            <div className="clear-check-icon-circle">
              <i className="bi bi-exclamation-triangle"></i>
            </div>
            <div className="clear-check-modal-title">Qəbzi Təmizləmək</div>
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

        <div className="clear-check-modal-body">
          <div className="clear-check-message">
            <p className="clear-check-question">Qəbzi təmizləmək istədiyinizə əminsiniz?</p>
            <p className="clear-check-warning">Bu əməliyyat bütün seçilmiş məhsulları siləcək.</p>
          </div>

          <div className="clear-check-footer-buttons">
            <button className="clear-check-cancel-btn" onClick={onClose}>Ləğv et</button>
            <button
              className="clear-check-confirm-btn"
              onClick={() => {
                handleClearCheck();
                onClose(true);
              }}
            >
              <i className="bi bi-check2 me-2" style={{ fontSize: '1.2rem' }}></i>
              Təsdiqlə
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ClearCheck;
