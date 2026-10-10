
import React from "react";
import { useSelector } from "react-redux";
import "./Table.css";
import { getEffectiveHourlyPrice } from "../../utils/orderHourlyPrice";
import { computeOrderCardMeta } from "../../utils/orderDisplayTotal";
import { normalizeTableShape } from "../../utils/tableShape";
import { t } from "../../utils/translations";
import { formatPrice } from "../../utils/formatPrice";
import { selectLiveTimerData, selectBookOrder } from "../../utils/liveOrderTimerData";

const LiveTableTimerBadge = ({ initialClock, isTimerRunning }) => {
  const [localSeconds, setLocalSeconds] = React.useState(0);
  React.useEffect(() => {
    let s = 0;
    if (initialClock && initialClock.includes(':')) {
      const parts = initialClock.split(':').map(Number);
      if (parts.length === 3) s = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    setLocalSeconds(s);
  }, [initialClock]);

  React.useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setLocalSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const hh = Math.floor(localSeconds / 3600);
  const mm = Math.floor((localSeconds % 3600) / 60);
  const ss = localSeconds % 60;
  const clockStr = [hh, mm, ss].map((v) => (v < 10 ? "0" + v : v)).join(":");
  return <span style={{ fontVariantNumeric: 'tabular-nums', opacity: isTimerRunning ? 1 : 0.8 }}>{clockStr}</span>;
};

const Table = ({ table, onTableClick, loginedWaiter, customStyle, rotation = 0 }) => {
  const { name, orders } = table || {};
  const shape_type = normalizeTableShape(table?.shape_type);

  // PERFORMANS: bütün BooksSlice-a abunə olmaq əvəzinə yalnız bu masanın
  // sifarişini indeksdən O(1) götürürük — başqa çeklər dəyişəndə bu masa
  // yenidən render olunmur
  const firstOrderUuid = orders?.[0]?.uuid;
  const firstOrderId = orders?.[0]?.id;
  const liveOrder = useSelector((state) =>
    firstOrderUuid == null && firstOrderId == null
      ? null
      : selectBookOrder(state, firstOrderUuid, firstOrderId)
  );

  const orderUuid = orders?.[0]?.uuid;
  const liveTimerData = useSelector((state) => selectLiveTimerData(state, orderUuid));

  const tagText = liveOrder?.tags || orders?.[0]?.tags;

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

  // Compute effective status for CSS class
  const statusClass = React.useMemo(() => {
    if (!hasOrders) return "free";
    if (isMyTable) return "my-table";
    if (isOtherTable) return "other-waiter-table";
    return "occupied";
  }, [hasOrders, isMyTable, isOtherTable]);

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
    if (shape_type === "billiard") {
      return (
        <>
          {/* 4 Corner pockets */}
          <div className="seat seat-billiard-top-left"></div>
          <div className="seat seat-billiard-top-right"></div>
          <div className="seat seat-billiard-bottom-left"></div>
          <div className="seat seat-billiard-bottom-right"></div>
          {/* 2 Center pockets on top/bottom (long edges) */}
          <div className="seat seat-billiard-top-center"></div>
          <div className="seat seat-billiard-bottom-center"></div>
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
          className={`table-surface table-${shape_type || "square"} ${statusClass} ${hasOrders ? "has-orders" : ""} ${hasPrintCount ? "multi-checks" : ""}`}
        >
          {/* Status Dot */}
          <div
            className={`status-dot ${orders?.length > 0 ? "has-orders" : ""}`}
            style={rotation ? { transform: `rotate(${-rotation}deg)` } : undefined}
          ></div>

          {/* Center Content */}
          <div className="table-content" style={rotation ? { transform: `rotate(${-rotation}deg)` } : undefined}>
            <h3
              className={`table-name ${statusClass}`}
            >
              {name}
            </h3>
            <p
              className={`table-amount ${statusClass}`}
            >
              {(() => {
                const rawOrder = orders?.[0];
                if (!rawOrder) return formatPrice(0);
                // liveOrder (BooksSlice) daha fresh data-ya malikdir
                const orderForDisplay = liveOrder
                  ? { ...rawOrder, ...liveOrder, table: rawOrder.table || liveOrder.table }
                  : { ...rawOrder };
                // Live timer clock-u inject edirik ki, stale is_timer_clock istifadə edilməsin
                if (liveTimerData?.is_timer_clock) {
                  orderForDisplay.is_timer_clock = liveTimerData.is_timer_clock;
                }
                const { displayAmount, isDepositFloor } = computeOrderCardMeta(orderForDisplay, table?.hourly_price);
                return (
                  <>
                    {formatPrice(displayAmount)}
                    {isDepositFloor && (
                      <span className="deposit-indicator">{t("depozi̇t")}</span>
                    )}
                  </>
                );
              })()}
            </p>

            <div
              className={`table-waiter-info ${statusClass}`}
            >
              <i className="bi bi-people"></i>
              <span>{orders?.[0]?.waiter?.name || "—"}</span>
            </div>

            {tagText && (
              <div
                className={`table-waiter-info ${statusClass}`}
                style={{ marginTop: '2px', opacity: 0.9 }}
              >
                <i className="bi bi-tag-fill"></i>
                <span 
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >{tagText}</span>
              </div>
            )}

            {hasMultipleChecks && (
              <div className="table-multi-checks-badge">
                {orders?.length} çek
              </div>
            )}

            {(() => {
              const o = orders?.[0];
              if (!o) return false;
              const eff = getEffectiveHourlyPrice({
                ...o,
                table: { hourly_price: table?.hourly_price },
                orders_items: o.orders_items || [],
              });
              const hasTimerSignal =
                o.is_timer_status == 1 ||
                (o.is_timer_clock && o.is_timer_clock !== "00:00:00") ||
                Number(o.rate_per_minute || 0) > 0;
              return hasTimerSignal && eff > 0;
            })() && (
              <div className="table-timer-info" style={{
                color: shape_type === 'billiard' ? '#FFFFFF' : '#053796',
                marginTop: '4px',
                background: shape_type === 'billiard' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(5, 55, 150, 0.05)',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                textShadow: shape_type === 'billiard' ? '0 1px 3px rgba(0,0,0,0.5)' : 'none'
              }}>
                <i className={`bi bi-clock${orders?.[0]?.is_timer_status == 1 ? '-fill' : ''} me-1`} style={{ fontSize: '11px', opacity: orders?.[0]?.is_timer_status == 1 ? 1 : 0.6 }}></i>
                <LiveTableTimerBadge 
                  initialClock={orders?.[0]?.is_timer_clock || "00:00:00"} 
                  isTimerRunning={orders?.[0]?.is_timer_status == 1} 
                />
              </div>
            )}
          </div>

          <div className="print-action" style={rotation ? { transform: `rotate(${-rotation}deg)` } : undefined}>
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
// Diqqət: Tables.jsx hər render zamanı customStyle üçün TƏZƏ obyekt yaradır
// ({width, height, ...}) — reference (===) müqayisəsi buna görə HƏMİŞƏ fərqli
// çıxır və memo faktiki heç vaxt işləmirdi. Masa sayı çoxaldıqca (məs. Check-dən
// Tables-a qayıdanda hər dəfə YÜZLƏRLƏ masa lazımsız yenidən render olunurdu —
// "donma" hissi məhz budur). Ona görə yalnız real fərqli olan sahələri (en/hünd.)
// müqayisə edirik.
const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.table === nextProps.table &&
    prevProps.loginedWaiter === nextProps.loginedWaiter &&
    prevProps.customStyle?.width === nextProps.customStyle?.width &&
    prevProps.customStyle?.height === nextProps.customStyle?.height &&
    prevProps.rotation === nextProps.rotation
  );
};

export default React.memo(Table, areEqual);
