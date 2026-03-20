import { Container, Modal, Form, Row, Col, Spinner } from "react-bootstrap";
import "./Checks.css";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getActiveOrders, getArchivedOrders } from "../../redux/Slices/BooksSlice";
import { getWaitersList } from "../../redux/Slices/WaitersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { useNavigate } from "react-router-dom";
import CheckDetailModal from "./CheckDetailModal";
import { toast } from "sonner";
import { isPacksOnlyWaiter } from "../../utils/waiterPermissions";

const getStatusColor = (status) => {
  switch (status) {
    case 1: return "#053796";
    case 2: return "#28a745";
    case 3: return "#9E9E9E";
    default: return "#9E9E9E";
  }
};

const formatTime = (startDate) => {
  if (!startDate) return "";
  const diffMins = Math.floor((new Date() - new Date(startDate)) / 60000);
  return diffMins < 60 ? `${diffMins} dəq` : `${Math.floor(diffMins / 60)} Saat`;
};

const CheckListItem = React.memo(({ check, onClick }) => (
  <div className="checks-check-item" onClick={() => onClick(check)}>
    <div className="checks-check-left">
      <div className="checks-check-id-row">
        <span className="checks-status-dot" style={{ backgroundColor: getStatusColor(check.status) }}></span>
        <span className="checks-check-id">#{check.id}</span>
        {check.status === 1 ? (
          <span className="checks-check-badge checks-badge-open">Açıq</span>
        ) : (
          <span className={`checks-check-badge ${check.status === 3 ? "warning" : ""}`}>
            {check.status === 2 ? "Bağlanmış" : "Silinib"}
          </span>
        )}
        {check.sale_type && (
          <span className={`checks-check-badge checks-badge-${check.sale_type}`}>
            {check.sale_type === "dine_in"
              ? "Restoranda"
              : check.sale_type === "takeaway"
                ? "Gəl götür"
                : check.sale_type === "delivery"
                  ? "Çatdırılma"
                  : (check.sale_type?.charAt(0).toUpperCase() + check.sale_type?.slice(1))}
          </span>
        )}
      </div>
      <div className="checks-check-info">
        <span className="checks-check-time">{formatTime(check.start_date)}</span>
        <span className="checks-check-user">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z" />
          </svg>
          {check?.waiter?.name || "Naməlum"}
        </span>
        {(check.is_timer_status === 1 || Number(check.rate_per_minute || 0) > 0) && (
          <span className="timer-pill ms-2" style={{
            fontSize: '11px',
            background: check.is_timer_status === 1 ? '#053796' : '#e2e8f0',
            color: check.is_timer_status === 1 ? '#fff' : '#053796',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <i className={`bi bi-clock${check.is_timer_status === 1 ? '-fill' : ''}`}></i>
            {check.is_timer_clock || "00:00:00"}
            {Number(check.rate_per_minute || 0) > 0 && ` (${Number(check.rate_per_minute).toFixed(2)} ₼)`}
          </span>
        )}
      </div>
    </div>
    <div className="checks-check-right">
      <span className="checks-check-amount">{Number(check.total || 0).toFixed(2)} ₼</span>
      {check.status !== 1 && check.order_payments?.length > 0 && (
        <div className="mt-1 d-flex flex-wrap justify-content-end">
          {check.order_payments.map((p, idx) => (
            <span key={idx} className="payment-method-tag">
              {p.payment_method?.name || p.tag?.name || (p.without_payment_method_id ? "Ödənişsiz" : "Naməlum")}
            </span>
          ))}
        </div>
      )}
    </div>
  </div>
));

const Checks = () => {
  const [activeTab, setActiveTab] = useState("open");
  const dispatch = useDispatch();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { archivedBooks, status } = useSelector((state) => state.BooksSlice);
  const { waitersLists } = useSelector((state) => state.WaitersSlice);
  const { tableGroups } = useSelector((state) => state.TablesSlice);

  const [openOrders, setOpenOrders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const navigate = useNavigate();

  // Filter States
  const [searchId, setSearchId] = useState("");
  const [filterSaleType, setFilterSaleType] = useState("");
  const [filterWaiter, setFilterWaiter] = useState("");
  const [filterHall, setFilterHall] = useState("");
  const [filterTable, setFilterTable] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const profileId = loginedProfileData?.data?.profile?.id;

  // Debounce searchID
  const [debouncedSearchId, setDebouncedSearchId] = useState(searchId);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchId(searchId);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchId]);

  // Fetch reference data (waiters, tables)
  useEffect(() => {
    if (profileId) {
      dispatch(getWaitersList(profileId));
      dispatch(getTableGroups(profileId));
    }
  }, [profileId, dispatch]);

  const waiters = useMemo(() => waitersLists?.data || [], [waitersLists]);
  const halls = useMemo(() => tableGroups?.data || [], [tableGroups]);
  const tables = useMemo(() => {
    if (!filterHall) return [];
    const hall = halls.find(h => h.id.toString() === filterHall);
    return hall ? hall.tables : [];
  }, [halls, filterHall]);

  // Fetch orders based on tab, date, and filters
  useEffect(() => {
    if (!profileId) return;

    const fetchData = async () => {
      try {
        const filters = {
          profileId,
          id: debouncedSearchId,
          sale_type: filterSaleType,
          waiter_id: filterWaiter,
          hall_id: filterHall,
          table_id: filterTable
        };

        if (activeTab === "open") {
          const result = await dispatch(getActiveOrders(filters)).unwrap();
          setOpenOrders(result.data || []);
        } else {
          // Send YYYY-MM-DD format for the date parameter
          // Send YYYY-MM-DD format for the date parameter using local time to avoid timezone issues
          const offsetCallback = (date) => {
            const offset = date.getTimezoneOffset();
            const resultDate = new Date(date.getTime() - (offset * 60 * 1000));
            return resultDate.toISOString().split('T')[0];
          }

          let dateStr;
          if (activeTab === "offline") {
            // For offline mode, force today's date and ignore other filters if needed
            dateStr = offsetCallback(new Date());
          } else {
            dateStr = offsetCallback(selectedDate);
          }

          await dispatch(getArchivedOrders({ ...filters, type: activeTab, date: dateStr })).unwrap();
        }
      } catch (err) {
        console.error("Error fetching orders:", err);
      }
    };

    fetchData();

  }, [activeTab, profileId, dispatch, selectedDate, debouncedSearchId, filterSaleType, filterWaiter, filterHall, filterTable]);

  const currentDisplayOrders = useMemo(() => {
    let orders = activeTab === "open" ? openOrders : archivedBooks;
    return orders;
  }, [activeTab, openOrders, archivedBooks]);

  const filteredDisplayOrders = useMemo(() => {
    let orders = currentDisplayOrders;
    if (isPacksOnlyWaiter(loginedWaiter?.data)) {
      orders = orders.filter((o) => o.sale_type !== "dine_in");
    }
    // Status filter (yalnız arxiv/offline tab üçün)
    if ((activeTab === "archive" || activeTab === "offline") && filterStatus) {
      const statusNum = Number(filterStatus);
      orders = orders.filter((o) => Number(o.status) === statusNum);
    }
    return orders;
  }, [currentDisplayOrders, loginedWaiter?.data, activeTab, filterStatus]);

  const totalAmount = useMemo(
    () => filteredDisplayOrders.reduce((sum, order) => sum + Number(order?.total || 0), 0),
    [filteredDisplayOrders],
  );

  const formatDisplayDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const day = d.getDate();
    const monthNames = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
    return `${day} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatDateKey = (date) => (date ? new Date(date).toISOString().split("T")[0] : "");

  const handleOrderClick = useCallback((order) => {
    // can_access_own_checks_only=0: yalnız öz çeklərinə; =1: bütün çeklərə giriş
    if (Number(loginedWaiter?.data?.can_access_own_checks_only) === 0) {
      if (order?.waiter_id !== loginedWaiter?.data?.id && order?.waiter?.id !== loginedWaiter?.data?.id) {
        toast.error("İcazəniz yoxdur: Bu çek başqa ofisianta aiddir.");
        return;
      }
    }

    if (activeTab === "open") {
      navigate(`/check/${order.uuid}?tableId=${order.table_id}`, { state: { from: "/checks" } });
    } else {
      setSelectedOrder(order);
      setShowModal(true);
    }
  }, [activeTab, loginedWaiter?.data?.id, loginedWaiter?.data?.can_access_own_checks_only, navigate]);

  const changeDay = (delta) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + delta);
    setSelectedDate(newDate);
  };

  const formatFilterDate = (date) => {
    const d = new Date(date);
    const months = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];
    return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
  };

  // Calendar logic
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());

  const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month, year) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Mon=0, Sun=6
  };

  const renderCalendarDays = () => {
    const month = calendarViewDate.getMonth();
    const year = calendarViewDate.getFullYear();
    const totalDays = daysInMonth(month, year);
    const startOffset = firstDayOfMonth(month, year);
    const days = [];

    // Empty spots for previous month
    for (let i = 0; i < startOffset; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Actual days
    for (let i = 1; i <= totalDays; i++) {
      const isSelected = selectedDate.getDate() === i &&
        selectedDate.getMonth() === month &&
        selectedDate.getFullYear() === year;

      const isToday = new Date().getDate() === i &&
        new Date().getMonth() === month &&
        new Date().getFullYear() === year;

      days.push(
        <div
          key={i}
          className={`calendar-day ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
          onClick={() => {
            const newDate = new Date(year, month, i);
            setSelectedDate(newDate);
            setShowCalendar(false);
          }}
        >
          {i}
        </div>
      );
    }
    return days;
  };

  const changeCalendarMonth = (delta) => {
    const newViewDate = new Date(calendarViewDate);
    newViewDate.setMonth(newViewDate.getMonth() + delta);
    setCalendarViewDate(newViewDate);
  };

  const monthNamesAz = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

  return (
    <Container fluid className="checks-container">
      {/* Top Navigation Tabs */}
      <div className="checks-nav-tabs">
        <button
          className={`checks-nav-tab ${activeTab === "open" ? "active" : ""}`}
          onClick={() => setActiveTab("open")}
        >
          Açıq
        </button>
        <button
          className={`checks-nav-tab ${activeTab === "archive" ? "active" : ""}`}
          onClick={() => setActiveTab("archive")}
        >
          Arxiv
        </button>
        <button
          className={`checks-nav-tab ${activeTab === "offline" ? "active" : ""}`}
          onClick={() => setActiveTab("offline")}
        >
          Offline arxiv
        </button>
      </div>

      {/* Date Filter Bar & Advanced Filters - Show for ALL tabs, but hide Date part for 'open' tab if not needed */}
      {/* Date Filter Bar & Advanced Filters - Show for ALL tabs, but hide Date part for 'open' tab if not needed */}
      {(activeTab !== "offline") && (
        <div className="checks-filter-container">
          <div className="checks-advanced-filters">
            <Form.Control
              type="text"
              placeholder="ID"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="filter-input-id"
            />
            <Form.Select
              value={filterSaleType}
              onChange={(e) => setFilterSaleType(e.target.value)}
              className="filter-select"
            >
              <option value="">Satış üsulu</option>
              <option value="dine_in">Restoranda</option>
              <option value="takeaway">Gəl götür</option>
              <option value="delivery">Çatdırılma</option>
            </Form.Select>

            {Number(loginedWaiter?.data?.can_edit_all_checks) !== 1 && (
              <Form.Select
                value={filterWaiter}
                onChange={(e) => setFilterWaiter(e.target.value)}
                className="filter-select"
              >
                <option value="">Əməkdaş</option>
                {waiters.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Form.Select>
            )}

            <Form.Select
              value={filterHall}
              onChange={(e) => { setFilterHall(e.target.value); setFilterTable(""); }}
              className="filter-select"
            >
              <option value="">Zal</option>
              {halls.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </Form.Select>

            <Form.Select
              value={filterTable}
              onChange={(e) => setFilterTable(e.target.value)}
              className="filter-select"
              disabled={!filterHall}
            >
              <option value="">Masa</option>
              {tables.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Form.Select>

            <Form.Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="">Status</option>
              <option value="2">Bağlanmış</option>
              <option value="3">Silinib</option>
            </Form.Select>
          </div>

          {(activeTab === "archive") && (
            <div className="date-nav-wrapper">
              <button className="date-nav-btn" onClick={() => changeDay(-1)}>
                <i className="bi bi-chevron-left"></i>
              </button>
              <div className="date-display" onClick={() => { setCalendarViewDate(selectedDate); setShowCalendar(true); }}>
                {formatFilterDate(selectedDate)}
              </div>
              <button className="date-nav-btn" onClick={() => changeDay(1)}>
                <i className="bi bi-chevron-right"></i>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Summary Bar */}
      <div className="checks-summary-bar">
        <div className="checks-summary-left">
          <span className="checks-summary-label">Çek sayı:</span>
          <span className="checks-summary-value">{filteredDisplayOrders.length}</span>
        </div>
        <div className="checks-summary-right">
          <span className="checks-summary-label">Cəm:</span>
          <span className="checks-summary-value checks-total">
            {totalAmount.toFixed(2)} ₼
          </span>
        </div>
      </div>

      {/* Checks List */}
      <div className="checks-list">
        {status === 'loading' && (
          <div className="checks-loading-overlay">
            <Spinner animation="border" variant="primary" />
            <span className="checks-loading-text">Yüklənir...</span>
          </div>
        )}

        {filteredDisplayOrders.length === 0 ? (
          <div className="checks-empty-state"><p>Heç bir çek tapılmadı</p></div>
        ) : (
          filteredDisplayOrders.map((check, index) => {
            const showDateHeader = index === 0 || formatDateKey(filteredDisplayOrders[index - 1]?.start_date) !== formatDateKey(check?.start_date);
            return (
              <div key={check.id}>
                {showDateHeader && <div className="checks-date-header">{formatDisplayDate(check?.start_date)}</div>}
                <CheckListItem check={check} onClick={handleOrderClick} />
              </div>
            );
          })
        )}
      </div>

      {/* Calendar Modal */}
      <Modal show={showCalendar} onHide={() => setShowCalendar(false)} centered className="calendar-modal">
        <Modal.Header closeButton>
          <Modal.Title>Təqvim</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="calendar-header">
            <div className="calendar-view-title">
              {monthNamesAz[calendarViewDate.getMonth()]} {calendarViewDate.getFullYear()}
            </div>
            <div className="calendar-nav-btns">
              <button className="cal-nav-btn" onClick={() => changeCalendarMonth(-1)}>
                <i className="bi bi-chevron-left"></i>
              </button>
              <button className="cal-nav-btn" onClick={() => changeCalendarMonth(1)}>
                <i className="bi bi-chevron-right"></i>
              </button>
            </div>
          </div>
          <div className="calendar-weekdays">
            {["B.E", "Ç.A", "Ç.", "C.A", "C.", "Ş.", "B."].map(day => (
              <div key={day} className="weekday">{day}</div>
            ))}
          </div>
          <div className="calendar-days-grid">
            {renderCalendarDays()}
          </div>
        </Modal.Body>
      </Modal>

      {/* Check Detail Modal */}
      <CheckDetailModal
        show={showModal}
        onClose={() => setShowModal(false)}
        order={selectedOrder}
      />
    </Container>
  );
};

export default Checks;
