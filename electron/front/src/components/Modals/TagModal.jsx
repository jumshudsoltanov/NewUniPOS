import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import InputGroup from "react-bootstrap/InputGroup";
import Form from "react-bootstrap/Form";
import "./Modal.css";
import { useState } from "react";
import { useEffect } from "react";
import { updateTags } from "../../redux/Slices/OrdersSlice";
import { useDispatch, useSelector } from "react-redux";
import { useCallback } from "react";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";

const TagModal = ({ show, onClose, order }) => {
  const [tag, setTag] = useState("");
  const dispatch = useDispatch();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);

  useEffect(() => {
    if (!show) return;
    setTag(order?.tags ?? "");
  }, [show, order?.tags]);

  const handleUpdateTags = async () => {
    try {
      await dispatch(
        updateTags({ orderId: order?.uuid, tags: tag }),
      ).unwrap();

      const profileId = loginedProfileData.data.profile.id;
      Promise.all([
        dispatch(getTableGroups(profileId)),
        dispatch(getActiveOrders({ profileId }))
      ]);
      onClose(true);
    } catch (error) {
      console.error("Failed to update tags:", error);
    }
  };

  return (
    <Modal show={show} onHide={onClose} animation={false}>
      <Modal.Header
        closeButton
        className="text-white"
        style={{ backgroundColor: "#4F85F4" }}
      >
        <Modal.Title>Qəbz etiketi</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <InputGroup className="mb-3">
          <Form.Control
            aria-label="Dollar amount (with dot and two decimal places)"
            onChange={(e) => setTag(e.target.value)}
            value={tag ?? ""}
            style={{ border: "1px solid #4F85F4", height: "35px" }}
          />
        </InputGroup>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          className="w-100"
          onClick={handleUpdateTags}
          style={{ backgroundColor: "#4F85F4" }}
        >
          Saxla
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TagModal;
