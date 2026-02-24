import React, { useState, useEffect, useCallback } from "react";
import Modal from "react-bootstrap/Modal";
import "./CheckLockModal.css";
import { useDispatch, useSelector } from "react-redux";
import { updateLockChecK } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { toast } from "react-toastify";

const CheckLockModal = ({ show, onClose, order }) => {
  const [status, setStatus] = useState(0);
  const dispatch = useDispatch();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);

  useEffect(() => {
    setStatus(order?.is_locked);
  }, [order]);

  const handleUpdateStatus = useCallback(async () => {
    try {
      const newStatus = status === 0 ? 1 : 0;
      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

      await dispatch(
        updateLockChecK({
          orderId: order?.uuid,
          status: newStatus,
          waiterName
        }),
      ).unwrap();

      if (loginedProfileData?.data?.profile?.id) {
        const profileId = loginedProfileData.data.profile.id;
        // Refresh both to be safe and ensure reactivity in all views
        await Promise.all([
          dispatch(getTableGroups(profileId)),
          dispatch(getActiveOrders({ profileId }))
        ]);
      }

      toast.success(newStatus === 1 ? "Qəbz kilidləndi" : "Qəbz kilidi açıldı");
      onClose(false);
    } catch (error) {
      toast.error("Xəta baş verdi");
      console.error("Lock error:", error);
    }
  }, [
    status,
    order?.uuid,
    loginedProfileData?.data?.profile?.id,
    dispatch,
    onClose,
    loginedWaiter?.data?.name,
    loginedProfileData?.data?.profile?.name
  ]);

  return (
    <Modal
      show={show}
      onHide={onClose}
      backdrop="static"
      keyboard={false}
      centered
      className="check-lock-modal"
      animation={false}
    >
      <div className="modal-content-wrapper">
        <div className="check-lock-modal-header">
          <div className="check-lock-header-content">
            <div className="check-lock-icon-circle">
              <i className={`bi ${status === 0 ? 'bi-lock-fill' : 'bi-unlock-fill'}`}></i>
            </div>
            <div className="check-lock-modal-title">Çeki kilidlə</div>
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

        <div className="check-lock-modal-body text-center">
          <div className="lock-icon-big-wrapper">
            <i className={`bi ${status === 0 ? 'bi-lock-fill' : 'bi-unlock-fill'}`}></i>
          </div>

          <h5 className="modal-question-text">
            {status === 0
              ? "Qəbzi kilidləmək istədiyinizə əminsiniz?"
              : "Qəbzin kilidini açmaq istədiyinizə əminsiniz?"}
          </h5>

          <p className="modal-sub-text">
            {status === 0
              ? "Kilidlənmiş qəbzlərdə dəyişiklik etmək mümkün olmayacaq."
              : "Kilid açıldıqdan sonra qəbzdə dəyişiklik etmək mümkün olacaq."}
          </p>
        </div>

        <div className="modal-footer-custom">
          <button className="btn-cancel" onClick={onClose}>Ləğv et</button>
          <button className="check-lock-save-btn" onClick={handleUpdateStatus}>
            <i className={`bi ${status === 0 ? 'bi-lock-fill' : 'bi-unlock-fill'} me-2`}></i>
            {status === 0 ? "Kilidlə" : "Kilidi Aç"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CheckLockModal;
