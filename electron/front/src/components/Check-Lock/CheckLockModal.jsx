import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import "./CheckLockModal.css";
import { Container, Col, Row } from "react-bootstrap";
import { useState } from "react";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateLockChecK } from "../../redux/Slices/OrdersSlice";
import { useCallback } from "react";
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
    order?.table_id,
    loginedProfileData?.data?.profile?.id,
    dispatch,
    onClose,
  ]);

  return (
    <Modal
      show={show}
      onHide={onClose}
      backdrop="static"
      keyboard={false}
      centered
      className="product-modal"
    >
      <div className="product-modal-header">
        <div className="header-left">
          <div className="header-icon-circle">
            <i className={`bi ${status === 0 ? 'bi-lock-fill' : 'bi-unlock-fill'}`}></i>
          </div>
          <h5 className="modal-title">Çeki kilidlə</h5>
        </div>
        <button className="close-btn" onClick={onClose}>
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      <div className="product-modal-body text-center py-4">
        <div className="mb-4">
          <div style={{
            width: '64px',
            height: '64px',
            background: '#eff6ff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            color: '#053796',
            fontSize: '32px'
          }}>
            <i className={`bi ${status === 0 ? 'bi-lock-fill' : 'bi-unlock-fill'}`}></i>
          </div>
        </div>

        <h6 className="mb-3" style={{ fontWeight: 700, color: '#333' }}>
          {status === 0
            ? "Qəbzi kilidləmək istədiyinizə əminsiniz?"
            : "Qəbzin kilidini açmaq istədiyinizə əminsiniz?"}
        </h6>

        <p className="text-muted mb-4" style={{ fontSize: '13px', maxWidth: '80%', margin: '0 auto' }}>
          {status === 0
            ? "Kilidlənmiş qəbzlərdə dəyişiklik etmək mümkün olmayacaq."
            : "Kilid açıldıqdan sonra qəbzdə dəyişiklik etmək mümkün olacaq."}
        </p>

        <div className="modal-footer-custom justify-content-center border-0 pb-0">
          <button className="btn-cancel" onClick={onClose}>Ləğv et</button>
          <button
            className="btn-save"
            onClick={handleUpdateStatus}
          >
            <i className={`bi ${status === 0 ? 'bi-lock-fill' : 'bi-unlock-fill'}`}></i>
            {status === 0 ? "Kilidlə" : "Kilidi Aç"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CheckLockModal;
