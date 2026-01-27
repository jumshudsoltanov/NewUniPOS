import React, { useState } from "react";
import "./Table.css";
import CustomersModal from "../Customers-Modal/CustomersModal";

const Table = ({ table }) => {
  const { name, status, shape_type } = table || {};
  const [selectedTable, setSelectedTable] = useState(null);

  const renderSeats = () => {
    if (shape_type === "rectangle") {
      return (
        <>
          <div className="seat seat-left-1"></div>
          <div className="seat seat-left-2"></div>
          <div className="seat seat-left-3"></div>
          <div className="seat seat-right-1"></div>
          <div className="seat seat-right-2"></div>
          <div className="seat seat-right-3"></div>
        </>
      );
    }
    // Default for square and round (4 seats)
    return (
      <>
        <div className="seat seat-top"></div>
        <div className="seat seat-left"></div>
        <div className="seat seat-right"></div>
        <div className="seat seat-bottom"></div>
      </>
    );
  };

  const [showModal, setShowModal] = useState(false);

  const handleTableClick = (table) => {
    setSelectedTable(table);
    setShowModal(true);
  };

  return (
    <>
      <div
        className={`table-wrapper wrapper-${shape_type || "square"}`}
        onClick={() => handleTableClick(table)}
        style={{ cursor: "pointer" }}
      >
        {/* Seats */}
        {renderSeats()}

        {/* Table Surface/Body */}
        <div
          className={`table-surface table-${shape_type || "square"} ${status}`}
        >
          {/* Status Dot */}
          <div className="status-dot"></div>

          {/* Center Content */}
          <div className="table-content">
            <h3 className="table-name">{name}</h3>
            <p className="table-amount">0 ₼</p>

            <div className="table-waiter-info">
              <i className="bi bi-people"></i>
              <span>Tural</span>
            </div>
          </div>

          {/* Print Action */}
          <div className="print-action">
            <div className="notification-badge fw-bold">8</div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
          </div>
        </div>
      </div>

      <CustomersModal
        show={showModal}
        onHide={() => setShowModal(false)}
        table={selectedTable}
      />
    </>
  );
};

export default Table;
