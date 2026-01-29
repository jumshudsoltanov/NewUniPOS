import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import "./CheckLockModal.css";
import { Container, Col, Row } from "react-bootstrap";
const CheckLockModal = ({ show, onClose }) => {
  return (
    <Modal
      show={show}
      onHide={onClose}
      backdrop="static"
      keyboard={false}
      centered
    >
      <Modal.Header
        closeButton
        className="text-white"
        style={{ backgroundColor: "#0d6efd" }}
      >
        <Modal.Title>Çeki kilidlə</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Container>
          <Row>
            <Col lg={12} className="d-flex justify-content-center">
              <div className="lockIcon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M12 9V14"
                    stroke="#053796"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12.0004 21.4098H5.94042C2.47042 21.4098 1.02042 18.9298 2.70042 15.8998L5.82042 10.2798L8.76042 4.99979C10.5404 1.78979 13.4604 1.78979 15.2404 4.99979L18.1804 10.2898L21.3004 15.9098C22.9804 18.9398 21.5204 21.4198 18.0604 21.4198H12.0004V21.4098Z"
                    stroke="#053796"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M11.9941 17H12.0031"
                    stroke="#053796"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </Col>
            <Col lg={12}>
              <div className="lockTextHeader fw-bold text-center mt-3">
                Qəbzi kilidləmək istədiyinizə əminsiniz?
              </div>
            </Col>
            <Col>
              <div className="lockTextHeader text-center mt-2">
                "Kilidlənmiş qəbzlərdə dəyişiklik etmək mümkün olmayacaq."
              </div>
            </Col>
          </Row>
        </Container>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          className="w-100"
          style={{ backgroundColor: "#0d6efd", height: "45px" }}
        >
          Qəbzi kilidləyin
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CheckLockModal;
