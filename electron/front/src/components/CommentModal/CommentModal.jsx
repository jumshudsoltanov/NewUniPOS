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
  const [comment, setComment] = useState("");

  useEffect(() => {
    setComment(order?.note ?? "");
  }, [order?.note]);

  const handleUpdateComment = async () => {
    const result = await dispatch(
      updateComments({ orderId: order?.uuid, comments: comment }),
    ).unwrap();

    console.log(result);

    // Refresh data
    if (loginedProfileData?.data?.profile?.id) {
      if (order?.table_id) {
        await dispatch(getTableGroups(loginedProfileData.data.profile.id));
      } else {
        await dispatch(getActiveOrders({ profileId: loginedProfileData.data.profile.id }));
      }
    }

    onClose(true);
  };

  return (
    <Modal show={show} onHide={onClose} backdrop="static" keyboard={false}>
      <Modal.Header closeButton style={{ backgroundColor: "#0d6efd" }}>
        <Modal.Title className="text-white">Çekə şərh yaz</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Control
          as="textarea"
          className="comment-area"
          onChange={(e) => setComment(e.target.value)}
          value={comment}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="danger" onClick={onClose}>
          Bağla
        </Button>
        <Button
          variant="primary"
          style={{ backgroundColor: "#0d6efd !important" }}
          onClick={handleUpdateComment}
        >
          Saxla
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CommentModal;
