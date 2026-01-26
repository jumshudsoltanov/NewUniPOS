import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import "./CommentModal.css";
import Form from "react-bootstrap/Form";
const CommentModal = ({ show, onClose }) => {
  return (
    <Modal show={show} onHide={onClose} backdrop="static" keyboard={false}>
      <Modal.Header closeButton style={{ backgroundColor: "#0d6efd" }}>
        <Modal.Title className="text-white">Çekə şərh yaz</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Control
          as="textarea"
          className="comment-area"
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="danger" onClick={onClose}>
          Bağla
        </Button>
        <Button
          variant="primary"
          style={{ backgroundColor: "#0d6efd !important" }}
        >
          Saxla
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CommentModal;
