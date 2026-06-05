import { Container, Modal, Form, Row, Col, Spinner } from "react-bootstrap";
import "./Checks.css";
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getActiveOrders, getArchivedOrders, addOrderOptimistic } from "../../redux/Slices/BooksSlice";
import { getWaitersList } from "../../redux/Slices/WaitersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { useNavigate } from "react-router-dom";
import CheckDetailModal from "./CheckDetailModal";
import AdvancedFilterModal from "./AdvancedFilterModal";
import { toast } from "sonner";
import { isPacksOnlyWaiter } from "../../utils/waiterPermissions";
import { computeOrderCardDisplayAmount } from "../../utils/orderDisplayTotal";
import { getSocket } from "../../utils/apiConfig";
import { fetchRooms } from "../../redux/Slices/HotelSlice";
import { saleNewOtherOrders } from "../../redux/Slices/SaleSlice";
import { saveLog } from "../../redux/Slices/OrdersSlice";
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

const CheckListItem = React.memo(({ check, onClick, roomNumber }) => (
  <div className="checks-check-item" onClick={() => onClick(check)}>
    <div className="checks-check-left">
      <div className="checks-check-id-row">
        <span className="checks-status-dot" style={{ backgroundColor: getStatusColor(check.status) }}></span>
        <span className="checks-check-id">{check.id ? `#${check.id}` : "Yeni"}</span>
        {roomNumber && (
          <span className="checks-check-badge checks-badge-room" style={{ background: "#FEF3C7", color: "#D97706" }}>
            <i className="bi bi-building" style={{ verticalAlign: "middle" }}></i>Otaq {roomNumber}
          </span>
        )}
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
      <span className="checks-check-amount">
        {computeOrderCardDisplayAmount(check).toFixed(2)} ₼
      </span>
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
  const { books, archivedBooks, status } = useSelector((state) => state.BooksSlice);
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
  const [sortOrder, setSortOrder] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("");
  const [filterDifference, setFilterDifference] = useState("");
  const [filterTaxSent, setFilterTaxSent] = useState("");
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);

  const profileId = loginedProfileData?.data?.profile?.id;

  // ── Hotel mode ──
  const isHotelMode = Number(loginedProfileData?.data?.profile?.is_hotel_mode) === 1;
  const { rooms: hotelRooms } = useSelector((state) => state.HotelSlice);

  useEffect(() => {
    if (isHotelMode && profileId && hotelRooms.length === 0) {
      dispatch(fetchRooms(profileId));
    }
  }, [isHotelMode, profileId, hotelRooms.length, dispatch]);

  const occupiedRooms = useMemo(() => {
    if (!isHotelMode) return [];
    return (hotelRooms || []).filter((r) => r.status === "occupied");
  }, [isHotelMode, hotelRooms]);

  const [hotelSearch, setHotelSearch] = useState("");

  const filteredOccupiedRooms = useMemo(() => {
    if (!isHotelMode) return [];
    let list = occupiedRooms;
    if (hotelSearch.trim()) {
      const q = hotelSearch.trim().toLowerCase();
      list = list.filter(
        (r) =>
          String(r.room_number).toLowerCase().includes(q) ||
          (r.guest_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [occupiedRooms, hotelSearch, isHotelMode]);

  const handleHotelRoomClick = useCallback(
    (room) => {
      if (!room) return;
      const waiterId = loginedWaiter?.data?.id;
      const terminalId = loginedProfileData?.data?.terminal?.terminal_id;
      const pid = loginedProfileData?.data?.profile?.id;
      if (!waiterId || !terminalId || !pid) {
        toast.error("İstifadəçi məlumatları tapılmadı");
        return;
      }
      const generatedUuid = crypto.randomUUID();
      const waiterName =
        loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

      localStorage.setItem(`hotel_room_order_${room.id}`, generatedUuid);

      const optimisticOrder = {
        uuid: generatedUuid,
        id: null,
        waiter_id: waiterId,
        profile_id: pid,
        terminal_id: terminalId,
        sale_type: "dine_in",
        sale_type_name: "Restoranda",
        guest_count: 1,
        status: 1,
        is_selected: 1,
        orders_items: [],
        room_id: room.id,
        room_number: room.room_number,
        amount: 0,
        total: 0,
        start_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        discount: 0,
        service_value: 0,
        waiter: { id: waiterId, name: waiterName },
      };

      dispatch(addOrderOptimistic(optimisticOrder));
      navigate(`/check/${generatedUuid}?hotel=${room.id}`);

      dispatch(
        saveLog({
          orderId: generatedUuid,
          action: "Yeni otaq sifarişi yaradıldı",
          waiterName,
          details: `Otaq: ${room.room_number || ""}, Qonaq: ${room.guest_name || "—"}`,
        })
      );

      (async () => {
        try {
          await dispatch(
            saleNewOtherOrders({
              waiterId,
              terminalId,
              profileId: pid,
              sale_type: "dine_in",
              status: 1,
              is_selected: 1,
              uuid: generatedUuid,
            })
          ).unwrap();
        } catch (err) {
          console.error("Hotel order create error:", err);
        }
      })();
    },
    [loginedWaiter, loginedProfileData, navigate, dispatch]
  );

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

  // Real-time socket sync: başqa terminaldan çek silinəndə/bağlananda siyahını yenilə
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !profileId) return;

    const refreshOpenOrders = async () => {
      if (activeTabRef.current !== "open") return;
      try {
        const result = await dispatch(getActiveOrders({ profileId, silentRefresh: true })).unwrap();
        setOpenOrders(result.data || []);
      } catch (e) { /* silent */ }
    };

    socket.on("order_deleted", refreshOpenOrders);
    socket.on("order_closed", refreshOpenOrders);
    socket.on("table_updated", refreshOpenOrders);

    return () => {
      socket.off("order_deleted", refreshOpenOrders);
      socket.off("order_closed", refreshOpenOrders);
      socket.off("table_updated", refreshOpenOrders);
    };
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
    if (activeTab !== "open") return archivedBooks;
    // Serverden gelen elə plus Redux-dakı optimistik orderları birləşdir
    const booksList = Array.isArray(books) ? books : (Array.isArray(books?.data) ? books.data : []);
    if (booksList.length === 0) return openOrders;

    const merged = [...openOrders];
    booksList.forEach((b) => {
      if (b.status !== 0 && !merged.some((o) => String(o.uuid) === String(b.uuid))) {
        merged.push(b);
      }
    });
    return merged;
  }, [activeTab, openOrders, archivedBooks, books]);

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
    // Payment method filter
    if (filterPaymentMethod) {
      const pmId = Number(filterPaymentMethod);
      orders = orders.filter((o) =>
        o.order_payments?.some((p) => Number(p.payment_method_id) === pmId)
      );
    }
    // Difference (balance) filter
    if (filterDifference) {
      orders = orders.filter((o) => {
        const total = computeOrderCardDisplayAmount(o);
        const paid = (o.order_payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
        const diff = total - paid;
        if (filterDifference === "zero") return Math.abs(diff) < 0.01;
        if (filterDifference === "positive") return diff > 0.01;
        if (filterDifference === "negative") return diff < -0.01;
        return true;
      });
    }
    // Tax sent filter
    if (filterTaxSent) {
      orders = orders.filter((o) => {
        if (filterTaxSent === "sent") return Number(o.is_synced) === 1;
        if (filterTaxSent === "not_sent") return Number(o.is_synced) !== 1;
        return true;
      });
    }
    // Amount range filter
    if (filterAmountMin || filterAmountMax) {
      const minVal = filterAmountMin ? Number(filterAmountMin) : -Infinity;
      const maxVal = filterAmountMax ? Number(filterAmountMax) : Infinity;
      orders = orders.filter((o) => {
        const amt = computeOrderCardDisplayAmount(o);
        return amt >= minVal && amt <= maxVal;
      });
    }
    // Sort
    if (sortOrder) {
      orders = [...orders].sort((a, b) => {
        if (sortOrder === "id_asc") return Number(a.id || 0) - Number(b.id || 0);
        if (sortOrder === "id_desc") return Number(b.id || 0) - Number(a.id || 0);
        if (sortOrder === "amount_asc") return computeOrderCardDisplayAmount(a) - computeOrderCardDisplayAmount(b);
        if (sortOrder === "amount_desc") return computeOrderCardDisplayAmount(b) - computeOrderCardDisplayAmount(a);
        if (sortOrder === "date_asc") return new Date(a.start_date) - new Date(b.start_date);
        if (sortOrder === "date_desc") return new Date(b.start_date) - new Date(a.start_date);
        return 0;
      });
    }
    return orders;
  }, [
    currentDisplayOrders, loginedWaiter?.data, activeTab, filterStatus,
    filterPaymentMethod, filterDifference, filterTaxSent, filterAmountMin, filterAmountMax, sortOrder,
  ]);

  const totalAmount = useMemo(
    () => filteredDisplayOrders.reduce((sum, o) => sum + computeOrderCardDisplayAmount(o), 0),
    [filteredDisplayOrders],
  );

  const handleFilterApply = useCallback((f) => {
    setSearchId(f.searchId || "");
    setFilterSaleType(f.filterSaleType || "");
    setFilterWaiter(f.filterWaiter || "");
    setFilterHall(f.filterHall || "");
    setFilterTable(f.filterTable || "");
    setFilterStatus(f.filterStatus || "");
    setSortOrder(f.sortOrder || "");
    setFilterPaymentMethod(f.filterPaymentMethod || "");
    setFilterDifference(f.filterDifference || "");
    setFilterTaxSent(f.filterTaxSent || "");
    setFilterAmountMin(f.filterAmountMin || "");
    setFilterAmountMax(f.filterAmountMax || "");
  }, []);

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

  // Hotel mode: normal checks listi göstər (restoran modulundakı kimi)

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

      {/* Filter Bar */}
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
            <button
              className={`filter-modal-btn ${(filterSaleType || filterWaiter || filterHall || filterStatus || filterPaymentMethod || filterDifference || filterTaxSent || sortOrder || filterAmountMin || filterAmountMax) ? "has-filters" : ""}`}
              onClick={() => setShowFilterModal(true)}
            >
              <i className="bi bi-funnel-fill me-1"></i>
              Filter
              {(filterSaleType || filterWaiter || filterHall || filterStatus || filterPaymentMethod || filterDifference || filterTaxSent || sortOrder || filterAmountMin || filterAmountMax) && (
                <span className="filter-active-dot"></span>
              )}
            </button>
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
            // Otaq nömrəsini tap: əvvəl check-dən, sonra localStorage-dan
            let roomNumber = check.room_number || null;
            if (!roomNumber && isHotelMode && check.uuid) {
              try {
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key?.startsWith("hotel_room_order_") && localStorage.getItem(key) === String(check.uuid)) {
                    const roomId = key.replace("hotel_room_order_", "");
                    const room = occupiedRooms.find(r => String(r.id) === roomId);
                    if (room) roomNumber = room.room_number;
                    break;
                  }
                }
              } catch (e) { /* ignore */ }
            }
            return (
              <div key={check.id}>
                {showDateHeader && <div className="checks-date-header">{formatDisplayDate(check?.start_date)}</div>}
                <CheckListItem check={check} onClick={handleOrderClick} roomNumber={roomNumber} />
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

      {/* Advanced Filter Modal */}
      <AdvancedFilterModal
        show={showFilterModal}
        onHide={() => setShowFilterModal(false)}
        filters={{
          searchId,
          filterSaleType,
          filterWaiter,
          filterHall,
          filterTable,
          filterStatus,
          sortOrder,
          filterPaymentMethod,
          filterDifference,
          filterTaxSent,
          filterAmountMin,
          filterAmountMax,
        }}
        onApply={handleFilterApply}
        onClear={handleFilterApply}
        halls={halls}
        tables={tables}
      />
    </Container>
  );
};

export default Checks;
