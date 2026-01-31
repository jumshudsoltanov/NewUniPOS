import { Modal, Button, Col, Row, Container } from "react-bootstrap";
import React from "react";

const TableGroupsModal = ({ show, onClose, tableGroups }) => {
  console.log(tableGroups);
  return (
    <Modal show={show}>
      <Modal.Header style={{ background: "#053796" }}>
        <Modal.Title className="text-white">
          {tableGroups?.data?.map((item) => {
            <div>{item.name}</div>;
          })}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>Woohoo, you are reading this text in a modal!</Modal.Body>
      <Modal.Footer></Modal.Footer>
    </Modal>
  );
};

export default TableGroupsModal;
