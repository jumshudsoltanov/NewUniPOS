import React from "react";
import { Modal } from "react-bootstrap";
import "./SalesTypesModal.css";

export const SalesTypesModal = ({ show, onClose, onSelect }) => {
  const salesTypes = [
    {
      id: "dine_in",
      label: "Yerində",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
        </svg>
      )
    },
    {
      id: "delivery",
      label: "Çatdırılma",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 18.5a1.5 1.5 0 0 1-1.5-1.5a1.5 1.5 0 0 1 1.5-1.5a1.5 1.5 0 0 1 1.5 1.5a1.5 1.5 0 0 1-1.5 1.5m1.5-9l1.96 2.5V14h-1.5c0 1.11-.89 2-2 2s-2-.89-2-2H9c0 1.11-.89 2-2 2s-2-.89-2-2H3V6c0-1.11.89-2 2-2h12v5.5M7 18.5A1.5 1.5 0 0 1 5.5 17A1.5 1.5 0 0 1 7 15.5A1.5 1.5 0 0 1 8.5 17A1.5 1.5 0 0 1 7 18.5z" />
        </svg>
      )
    },
    {
      id: "takeaway",
      label: "Takeaway",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z" />
        </svg>
      )
    },
  ];

  const handleSelect = (type) => {
    if (onSelect) {
      onSelect(type);
    }
    onClose();
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="sales-type-modal"
      backdrop={true}
      dialogClassName="sales-type-dialog"
    >
      <Modal.Body className="sales-type-modal-body">
        <div className="sales-type-options">
          {salesTypes.map((type) => (
            <button
              key={type.id}
              className="sales-type-option"
              onClick={() => handleSelect(type)}
            >
              <div className="sales-type-icon">
                {type.icon}
              </div>
              <span className="sales-type-label">{type.label}</span>
            </button>
          ))}
        </div>
      </Modal.Body>
    </Modal>
  );
};
