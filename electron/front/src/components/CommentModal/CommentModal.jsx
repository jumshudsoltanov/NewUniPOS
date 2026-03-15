import React from "react";
import Modal from "react-bootstrap/Modal";
import "./CommentModal.css";
import Form from "react-bootstrap/Form";
import { useState } from "react";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateComments } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";

const CommentModal = React.memo(({ show, onClose, order }) => {
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
    <Modal show={show} onHide={onClose} centered className="comment-modal" backdrop="static" animation={false}>
      <div className="modal-content-wrapper">
        <div className="comment-modal-header">
          <div className="comment-header-content">
            <div className="comment-icon-circle">
              <i className="bi bi-chat-text"></i>
            </div>
            <div className="comment-modal-title">Çekə Şərh Yaz</div>
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

        <div className="comment-modal-body">
          <Form.Control
            as="textarea"
            className="comment-textarea"
            onChange={(e) => setComment(e.target.value)}
            value={comment}
            rows={4}
            placeholder="Şərhinizi bura yazın..."
            style={{ resize: "none" }}
          />

          <div className="comment-footer-buttons">
            <button className="comment-cancel-btn" onClick={onClose}>Bağla</button>
            <button className="comment-save-btn" onClick={handleUpdateComment}>
              <i className="bi bi-check2 me-2" style={{ fontSize: '1.2rem' }}></i>
              Saxla
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
});

export default CommentModal;
