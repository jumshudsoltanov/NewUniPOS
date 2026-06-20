import React, { useMemo } from "react";
import Modal from "react-bootstrap/Modal";
import "./CommentModal.css";
import Form from "react-bootstrap/Form";
import { useState } from "react";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateComments } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import VirtualKeyboard from "../VirtualKeyboard/VirtualKeyboard";
import { t } from "../../utils/translations";

const CommentModal = React.memo(({ show, onClose, order }) => {
  const dispatch = useDispatch();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const [comment, setComment] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(true);
  const posKeyboardEnabled = useMemo(() => {
    try { return localStorage.getItem("pos_keyboard_enabled") === "1"; } catch { return false; }
  }, []);

  useEffect(() => {
    setComment(order?.note ?? "");
    if (show) setShowKeyboard(true);
  }, [order?.note, show]);

  const handleUpdateComment = async () => {
    const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

    const result = await dispatch(
      updateComments({ orderId: order?.uuid, comments: comment, waiterName }),
    ).unwrap();

    if (loginedProfileData?.data?.profile?.id) {
      const profileId = loginedProfileData.data.profile.id;
      dispatch(getTableGroups(profileId));
      dispatch(getActiveOrders({ profileId, silentRefresh: true }));
    }

    onClose(true);
  };

  return (
  <>
  <Modal show={show} onHide={onClose} centered className="comment-modal" backdrop="static" animation={false}>
    <div className="modal-content-wrapper">
      <div className="comment-modal-header">
        <div className="comment-header-content">
          <div className="comment-icon-circle">
            <i className="bi bi-chat-text"></i>
          </div>
          <div className="comment-modal-title">{t("ceke_serh_yaz")}</div>
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
          placeholder={t("serhinizi_bura_yazin")}
          style={{ resize: "none" }}
        />

        <div className="comment-footer-buttons">
          <button className="comment-cancel-btn" onClick={onClose}>{t("bagla")}</button>
          <button className="comment-save-btn" onClick={handleUpdateComment}>
            <i className="bi bi-check2 me-2" style={{ fontSize: '1.2rem' }}></i>
            {t("saxla")}
          </button>
        </div>
      </div>
    </div>
  </Modal>

  {show && posKeyboardEnabled && showKeyboard && (
    <VirtualKeyboard
      onKeyPress={(key) => setComment((prev) => prev + key)}
      onBackspace={() => setComment((prev) => prev.slice(0, -1))}
      onClose={() => setShowKeyboard(false)}
    />
  )}
  </>
);
});

export default CommentModal;
