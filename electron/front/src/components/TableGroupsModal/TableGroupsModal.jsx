import { Modal, Button, Col, Row, Container, Alert } from "react-bootstrap";
import React, { useState, useEffect } from "react";
import "./TableGroupsModal.css";

const TableGroupsModal = ({ show, onClose, tableGroups }) => {
  const [activeTab, setActiveTab] = useState(null);

  useEffect(() => {
    if (tableGroups?.data?.length > 0 && !activeTab) {
      setActiveTab(tableGroups.data[0].id);
    }
  }, [tableGroups]);

  const activeGroup = tableGroups?.data?.find((group) => group.id === activeTab);

  return (
    <Modal show={show} onHide={() => onClose(null)} fullscreen="sm-down" size="lg">
      <Modal.Header style={{ background: "#053796", border: "none" }} closeButton className="text-white">
        <div className="d-flex align-items-center w-100 overflow-auto no-scrollbar">
          {tableGroups?.data?.map((group) => (
            <div
              key={group.id}
              className={`modal-tab ${activeTab === group.id ? "active" : ""}`}
              onClick={() => setActiveTab(group.id)}
            >
              {group.name}
            </div>
          ))}
        </div>
      </Modal.Header>
      <Modal.Body className="p-3" style={{ backgroundColor: "#f8f9fa", minHeight: "400px" }}>
        <Container fluid>
          <div className="tables-grid-container">
            <Row className="g-3">
              {activeGroup?.tables?.map((table) => (
                <Col key={table.id} xs={4} md={3} className="mb-2">
                  <div className="table-card" onClick={() => {
                    onClose({ ...table, hall_id: activeGroup.id });
                  }}>
                    <div className="table-card-number">{table.number || table.name}</div>
                  </div>
                </Col>
              ))}
              {(!activeGroup?.tables || activeGroup.tables.length === 0) && (
                <Col xs={12}>
                  <Alert variant="warning" className="text-center mt-4">
                    Bu zalda masa yoxdur.
                  </Alert>
                </Col>
              )}
            </Row>
          </div>
        </Container>
      </Modal.Body>
    </Modal>
  );
};

export default TableGroupsModal;
