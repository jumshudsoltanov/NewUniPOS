import React, { useState } from "react";
import "./Waiters.css";
import Modal from "react-bootstrap/Modal";

const WaitersModal = ({ show, onClose }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const waiters = [
    { id: 1, name: "Məhəmmədəli Məmmədov", role: "Kassir", status: "Müsait" },
    { id: 2, name: "Məhəmmədəli Məmmədov", role: "Ofisiant", status: "Müsait" },
    { id: 3, name: "Məhəmmədəli Məmmədov", role: "Menecer", status: "Məşğul" },
    { id: 4, name: "Orxan Əliyev", role: "Ofisiant", status: "Müsait" },
    { id: 5, name: "Tural Həsənov", role: "Kassir", status: "Məşğul" },
    { id: 6, name: "Elvin Quliyev", role: "Ofisiant", status: "Müsait" },
  ];

  const filteredWaiters = waiters.filter((waiter) =>
    waiter.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      animation={false}
      dialogClassName="waiters-modal-dialog"
      contentClassName="waiters-modal-content"
    >
      <div className="waiters-modal-container">
        {/* Header */}
        <div className="waiters-header">
          <div className="header-left">
            <div className="header-icon">
              {/* Group Users Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#053796"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <span className="header-title">Əməkdaş seç</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="waiters-body">
          {/* Search Input */}
          <div className="search-container">
            <input
              type="text"
              className="waiters-search-input"
              placeholder="Əməkdaş axtar"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Waiters List */}
          <div className="waiters-list">
            {filteredWaiters.map((waiter) => (
              <div key={waiter.id} className="waiter-card">
                <div className="waiter-avatar">
                  {/* Single User with refresh/cycle hint */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                    <path d="M18 10a2 2 0 0 0 2-2M22 10a2 2 0 0 0-2-2" opacity="0.5" />
                    {/* Simplified user icon with a subtle hint, or just user */}
                  </svg>
                </div>
                <div className="waiter-info">
                  <span className="waiter-name">{waiter.name}</span>
                  <span className="waiter-role">{waiter.role}</span>
                </div>
                <div className="waiter-actions">
                  <span
                    className={`status-badge ${waiter.status === "Müsait" ? "available" : "busy"
                      }`}
                  >
                    {waiter.status}
                  </span>
                  <button
                    className={`select-btn ${waiter.status === "Məşğul" ? "secondary" : ""
                      }`}
                  >
                    Seç
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Apply Button */}
          <button className="waiter-apply-btn">Tətbiq et</button>
        </div>
      </div>
    </Modal>
  );
};

export default WaitersModal;