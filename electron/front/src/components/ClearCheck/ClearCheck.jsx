import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import { useDispatch, useSelector } from "react-redux";
import { clearOrders, deleteOrderItems } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";

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
    <Modal
      show={show}
      onHide={onClose}
      centered
      className="product-modal"
    >
      <div className="product-modal-header">
        <div className="header-left">
          <div className="header-icon-circle">
            <i className="bi bi-exclamation-triangle"></i>
          </div>
          <h5 className="modal-title">Qəbzi Təmizləmək</h5>
        </div>
        <button className="close-btn" onClick={onClose}>
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      <div className="product-modal-body text-center py-4">
        <p className="mb-0" style={{ fontSize: '14px', color: '#444' }}>
          Qəbzi təmizləmək istədiyinizə əminsiniz?
          <br />
          <span className="text-muted" style={{ fontSize: '12px' }}>Bu əməliyyat bütün seçilmiş məhsulları siləcək.</span>
        </p>

        <div className="modal-footer-custom justify-content-center border-0 pb-0">
          <button className="btn-cancel" onClick={onClose}>Ləvğ et</button>
          <button
            className="btn-save"
            onClick={() => {
              handleClearCheck();
              onClose(true);
            }}
          >
            <i className="bi bi-check-lg"></i>
            Təsdiqlə
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ClearCheck;
