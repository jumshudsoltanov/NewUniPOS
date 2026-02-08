import React from "react";
import "./Table.css";
import { useParams } from "react-router-dom";

const Table = React.memo(({ table, onTableClick, loginedWaiter }) => {
  const { name, status, shape_type, orders } = table || {};

  const hasOrders = orders && orders.length > 0;
  const isMyTable = hasOrders && loginedWaiter?.data?.id && (orders[0]?.waiter_id == loginedWaiter.data.id || orders[0]?.waiter?.id == loginedWaiter.data.id);
  const isOtherTable = hasOrders && !isMyTable;

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
    return (
      <>
        <div className="seat seat-top"></div>
        <div className="seat seat-left"></div>
        <div className="seat seat-right"></div>
        <div className="seat seat-bottom"></div>
      </>
    );
  };

  const handleTableClick = () => {
    if (onTableClick) {
      onTableClick(table);
    }
  };


  return (
    <>
      <div
        className={`table-wrapper wrapper-${shape_type || "square"}`}
        onClick={() => handleTableClick(table)}
        style={{ cursor: "pointer" }}
      >
        {renderSeats()}

        <div
          className={`table-surface table-${shape_type || "square"} ${status} ${hasOrders ? "has-orders" : ""} ${isMyTable ? "my-table" : ""} ${isOtherTable ? "other-waiter-table" : ""}`}
        >
          {/* Status Dot */}
          <div
            className={`status-dot ${orders?.length > 0 ? "has-orders" : ""}`}
          ></div>

          {/* Center Content */}
          <div className="table-content">
            <h3
              className={`table-name ${status} ${orders?.length > 0 ? "" : ""}`}
            >
              {name}
            </h3>
            <p
              className={`table-amount ${status} ${orders?.length > 0 ? "" : ""}`}
            >
              {orders?.[0]?.total?.toFixed(2) ?? 0.0} ₼
            </p>

            <div
              className={`table-waiter-info ${status} ${orders?.length > 0 ? "" : ""}`}
            >
              <i className="bi bi-people"></i>
              <span>{orders?.[0]?.waiter?.name || "—"}</span>
            </div>
          </div>

          <div className="print-action">
            <div className="notification-badge fw-bold">
              {orders?.length || 0}
            </div>
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
    </>
  );
});

export default Table;
