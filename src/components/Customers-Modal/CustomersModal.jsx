import React, { useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Container, Row, Col, Button } from "react-bootstrap";
import "./CustomersModal.css";

const CustomersModal = ({ show, onHide }) => {
  const [guestCount, setGuestCount] = useState("5");

  const handleNumberClick = (num) => {
    if (guestCount === "0") {
      setGuestCount(num.toString());
    } else {
      setGuestCount((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    setGuestCount((prev) => {
      if (prev.length <= 1) return "0";
      return prev.slice(0, -1);
    });
  };

  const handleClear = () => {
    setGuestCount("0");
  }

  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <Modal show={show} onHide={onHide} centered className="customers-modal">
      <Modal.Header closeButton className="modal-header-custom">
        <div className="header-content">
          <div className="icon-circle">
            <i className="bi bi-people"></i>
          </div>
          <Modal.Title>Qonaq sayı</Modal.Title>
        </div>
      </Modal.Header>

      <Modal.Body className="p-0">
        <div className="display-area text-center py-2">
          <h1 className="guest-count-display">{guestCount}</h1>
          <p className="text-muted mb-1">Qonaq sayını seçin</p>
        </div>

        <Container className="keypad-container pb-3 px-3">
          <Row className="g-2 justify-content-center">
            {numbers.map((num) => (
              <Col xs={4} key={num} className="d-flex justify-content-center">
                <Button
                  variant="light"
                  className="keypad-btn"
                  onClick={() => handleNumberClick(num)}
                >
                  {num}
                </Button>
              </Col>
            ))}
            <Col xs={4} className="d-flex justify-content-center">
              <Button
                variant="light"
                className="keypad-btn"
                onClick={() => handleNumberClick(".")}
              >
                .
              </Button>
            </Col>
            <Col xs={4} className="d-flex justify-content-center">
              <Button
                variant="light"
                className="keypad-btn"
                onClick={() => handleNumberClick(0)}
              >
                0
              </Button>
            </Col>
            <Col xs={4} className="d-flex justify-content-center">
              <Button
                variant="light"
                className="keypad-btn backspace-btn"
                onClick={handleBackspace}
              >
                <i className="bi bi-backspace"></i>
              </Button>
            </Col>
          </Row>
        </Container>
      </Modal.Body>

      <Modal.Footer className="justify-content-center p-2 border-0">
        <Button className="w-100 save-btn" onClick={onHide}>
          Yadda saxla
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CustomersModal;
