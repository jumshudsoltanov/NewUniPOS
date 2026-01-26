import React from "react";
import { Modal, Row, Col } from "react-bootstrap";
import "./OperationsModal.css";

export const OperationsModal = ({ show, onHide }) => {
  const operations = [
    { icon: "bi-arrows-angle-expand", text: "Çeki böl" },
    { icon: "bi-chat-left-text", text: "Çekə şərh yaz" },
    { icon: "bi-person-plus", text: "Müştəri əlavə et" },
    { icon: "bi-journal-x", text: "Çeki təmizləmə" },
    { icon: "bi-percent", text: "Endirim" },
    { icon: "bi-collection", text: "Çeki birləşdir" },
    { icon: "bi-person-check", text: "Satıcı təyin et" },
    { icon: "bi-arrow-left-right", text: "Satış üsulunu dəyiş" },
    { icon: "bi-bell", text: "Xidmət haqqı əlavə et" },
    { icon: "bi-people", text: "Əməkdaş dəyiş" },
  ];

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      className="operations-modal"
    >
      <Modal.Header className="bg-primary text-white border-0 py-3 px-4 d-flex align-items-center justify-content-between">
        <h5 className="m-0">Əməliyyatlar</h5>
        {/* Close X Button for Desktop */}
        <div
          className="close-btn cursor-pointer d-none d-lg-flex align-items-center justify-content-center p-1 rounded-circle"
          onClick={onHide}
          style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.2)' }}
        >
          <i className="bi bi-x-lg text-white" style={{ fontSize: '16px' }}></i>
        </div>
      </Modal.Header>
      <Modal.Body className="p-3 position-relative">
        <Row className="g-2">
          {operations.map((op, index) => (
            <Col xs={12} md={6} key={index}>
              <div className="operation-item d-flex align-items-center gap-2 py-2 px-2 rounded cursor-pointer">
                <i className={`bi ${op.icon} fs-5 operation-icon`}></i>
                <span className="text-dark fw-medium fs-6">{op.text}</span>
              </div>
            </Col>
          ))}
        </Row>
        <button
          className="btn w-100 mt-4 close-operation-btn d-md-none"
          onClick={onHide}
        >
          Bağla
        </button>
      </Modal.Body>
    </Modal>
  );
};

export default OperationsModal;
