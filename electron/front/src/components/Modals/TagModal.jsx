import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import InputGroup from "react-bootstrap/InputGroup";
import Form from 'react-bootstrap/Form';

import "./Modal.css";
import { useState } from "react";

const TagModal = ({ show, onClose }) => {
  const [tag, setTag] = useState()

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
          <Form.Control aria-label="Dollar amount (with dot and two decimal places)" onChange={(e)=>setTag(e.target.value)}  style={{border: '1px solid #4F85F4', height: '35px'}}/>
        </InputGroup>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          className="w-100"
          style={{ backgroundColor: "#4F85F4" }}
        >
          Saxla
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TagModal;
