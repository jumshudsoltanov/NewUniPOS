import React from "react";
import "./Table.css";
import { useParams } from "react-router-dom";

const Table = ({ table, onTableClick, loginedWaiter, customStyle }) => {
  const { name, status, shape_type, orders } = table || {};

  const hasOrders = React.useMemo(() => orders && orders.length > 0, [orders]);

  const isMyTable = React.useMemo(() => {
    if (!hasOrders || !loginedWaiter?.data?.id) return false;
    const waiterId = orders[0]?.waiter_id || orders[0]?.waiter?.id;
    return waiterId == loginedWaiter.data.id;
  }, [hasOrders, orders, loginedWaiter]);

  const isOtherTable = React.useMemo(() => hasOrders && !isMyTable, [hasOrders, isMyTable]);

  const hasMultipleChecks = React.useMemo(() => orders && orders.length > 1, [orders]);

  const totalPrintCount = React.useMemo(
    () => orders?.reduce((sum, o) => sum + (o.print_count || 0), 0) || 0,
    [orders]
  );
  const hasPrintCount = totalPrintCount > 0;

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
        className={`table-wrapper wrapper-${shape_type || "square"} ${customStyle ? "resizable-mode" : ""}`}
        onClick={() => handleTableClick(table)}
        style={{ cursor: "pointer", ...customStyle }}
      >
        {renderSeats()}

        <div
          className={`table-surface table-${shape_type || "square"} ${status} ${hasOrders ? "has-orders" : ""} ${isMyTable ? "my-table" : ""} ${isOtherTable ? "other-waiter-table" : ""} ${hasPrintCount ? "multi-checks" : ""}`}
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
              {(() => {
                const order = orders?.[0];
                if (!order) return "0.00 ₼";

                // Consistency with CheckDetailModal and CheckBottom
                const subtotal = Number(order.amount || 0);
                const discount = Number(order.discount || 0);
                const deposit = Number(order.deposit || 0);
                const service = Number(order.service_charge || 0);
                const deliveryFee = Number(order.delivery_fee || 0);

                let timerCharge = Number(order.rate_per_minute || 0);

                // Auto-calculate timer charge if missing but clock exists (hall view fallback)
                if (timerCharge === 0 && order.is_timer_clock && order.is_timer_clock !== "00:00:00") {
                  const hPrice = Number(table?.hourly_price || 0);
                  if (hPrice > 0) {
                    const parts = order.is_timer_clock.split(':').map(Number);
                    if (parts.length === 3) {
                      const totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                      timerCharge = (hPrice / 3600) * totalSeconds;
                    }
                  }
                }

                const subtotalAfterDiscount = (subtotal + timerCharge) - discount;
                const displayAmount = Math.max(subtotalAfterDiscount, deposit) + service + deliveryFee;
                const isDepositFloor = deposit > subtotalAfterDiscount;

                return (
                  <>
                    {displayAmount.toFixed(2)} ₼
                    {isDepositFloor && (
                      <span className="deposit-indicator">
                        DEPOZİT
                      </span>
                    )}
                  </>
                );
              })()}
            </p>

            <div
              className={`table-waiter-info ${status} ${orders?.length > 0 ? "" : ""}`}
            >
              <i className="bi bi-people"></i>
              <span>{orders?.[0]?.waiter?.name || "—"}</span>
            </div>

            {hasMultipleChecks && (
              <div className="table-multi-checks-badge">
                {orders?.length} çek
              </div>
            )}

            {(orders?.[0]?.is_timer_status == 1 || (orders?.[0]?.is_timer_clock && orders?.[0]?.is_timer_clock !== "00:00:00") || Number(orders?.[0]?.rate_per_minute || 0) > 0) && Number(table?.hourly_price || 0) > 0 && (
              <div className="table-timer-info" style={{ color: '#053796', fontSize: '0.9rem', fontWeight: '700', marginTop: '6px', background: 'rgba(5, 55, 150, 0.05)', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center' }}>
                <i className={`bi bi-clock${orders?.[0]?.is_timer_status == 1 ? '-fill' : ''} me-1`} style={{ fontSize: '0.8rem', opacity: orders?.[0]?.is_timer_status == 1 ? 1 : 0.6 }}></i>
                <span style={{ fontVariantNumeric: 'tabular-nums', opacity: orders?.[0]?.is_timer_status == 1 ? 1 : 0.8 }}>{orders?.[0]?.is_timer_clock || "00:00:00"}</span>
              </div>
            )}
          </div>

          <div className="print-action">
            <div className="notification-badge fw-bold">
              {orders?.reduce((sum, order) => sum + (order.print_count || 0), 0) || 0}
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
};

// Performans optimizasiyası: Yalnız masanın öz məlumatı və ya loginedWaiter dəyişəndə render et
const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.table === nextProps.table &&
    prevProps.loginedWaiter === nextProps.loginedWaiter &&
    prevProps.customStyle === nextProps.customStyle
  );
};

export default React.memo(Table, areEqual);
