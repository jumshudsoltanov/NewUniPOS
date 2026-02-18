import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import "./CommentModal.css";
import Form from "react-bootstrap/Form";
import { useState } from "react";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateComments } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";

const CommentModal = ({ show, onClose, order }) => {
  const dispatch = useDispatch();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const [comment, setComment] = useState("");

  useEffect(() => {
    setComment(order?.note ?? "");
  }, [order?.note]);

  const handleUpdateComment = async () => {
    const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

    const result = await dispatch(
      updateComments({ orderId: order?.uuid, comments: comment, waiterName }),
    ).unwrap();

    console.log(result);

    // Refresh data
    if (loginedProfileData?.data?.profile?.id) {
      const profileId = loginedProfileData.data.profile.id;
      await Promise.all([
        dispatch(getTableGroups(profileId)),
        dispatch(getActiveOrders({ profileId }))
      ]);
    }

    onClose(true);
  };

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
            <i className="bi bi-chat-text"></i>
          </div>
          <h5 className="modal-title">Çekə Şərh Yaz</h5>
        </div>
        <button className="close-btn" onClick={onClose}>
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      <div className="product-modal-body">
        <Form.Control
          as="textarea"
          className="form-control-custom"
          onChange={(e) => setComment(e.target.value)}
          value={comment}
          rows={4}
          placeholder="Şərhinizi bura yazın..."
          style={{ resize: "none" }}
        />

        <div className="modal-footer-custom px-0 pb-0">
          <button className="btn-cancel" onClick={onClose}>Bağla</button>
          <button
            className="btn-save"
            onClick={handleUpdateComment}
          >
            <i className="bi bi-check-lg"></i>
            Saxla
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CommentModal;
