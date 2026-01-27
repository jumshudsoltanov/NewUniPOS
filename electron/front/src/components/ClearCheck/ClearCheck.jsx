import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import { useDispatch, useSelector } from "react-redux";
import { clearOrders } from "../../redux/Slices/OrdersSlice";

const ClearCheck = ({ show, onClose }) => {
  const dispatch = useDispatch();

  return (
    <Modal show={show} onHide={onClose} size="md">
      <Modal.Header closeButton style={{ backgroundColor: "#0062CC" }}>
        <Modal.Title className="text-white">Xəbərdarlıq</Modal.Title>
      </Modal.Header>
      <Modal.Body className="text-center fw-bold">
        Qəbzi təmizləmək istədiyinizə əminsiniz?
      </Modal.Body>
      <Modal.Footer>
        <Button variant="danger" onClick={onClose}>
          Ləvğ et
        </Button>
        <Button
          style={{ backgroundColor: "#0062CC" }}
          onClick={() => {
            dispatch(clearOrders());
            onClose(true);
          }}
        >
          Təsdiqlə
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ClearCheck;
