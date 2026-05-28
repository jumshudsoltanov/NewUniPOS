import { Container, Modal, Form, Row, Col, Spinner } from "react-bootstrap";
import "./Checks.css";
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getActiveOrders, getArchivedOrders, addOrderOptimistic } from "../../redux/Slices/BooksSlice";
import { getWaitersList } from "../../redux/Slices/WaitersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { useNavigate } from "react-router-dom";
import CheckDetailModal from "./CheckDetailModal";
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
    () => filteredDisplayOrders.reduce((sum, o) => sum + computeOrderCardDisplayAmount(o), 0),
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

  if (isHotelMode) {
    return (
      <Container fluid className="checks-container" style={{ background: "#ebf2fe" }}>
        {/* Header */}
        <div className="checks-nav-tabs">
          <div className="checks-nav-tab active">
            Dolu otaqlar ({occupiedRooms.length})
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
          <div style={{ position: "relative", maxWidth: 320 }}>
            <i className="bi bi-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 14 }}></i>
            <input
              type="text"
              placeholder="Otaq nömrəsi və ya qonaq adı"
              value={hotelSearch}
              onChange={(e) => setHotelSearch(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px 10px 36px", border: "1px solid #E5E7EB",
                borderRadius: 8, fontSize: 13, outline: "none", background: "#fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
              }}
            />
          </div>
        </div>

        {/* Room Cards Grid */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 24px 24px" }}>
          {filteredOccupiedRooms.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#9CA3AF" }}>
              <i className="bi bi-building" style={{ fontSize: 48, color: "#D1D5DB", marginBottom: 12 }}></i>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>Dolu otaq tapılmadı</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {filteredOccupiedRooms.map((room) => {
                const d1 = room.check_in ? new Date(room.check_in) : null;
                const d2 = room.check_out ? new Date(room.check_out) : null;
                const nights = d1 && d2 ? Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24))) : 0;
                return (
                  <div
                    key={room.id}
                    onClick={() => handleHotelRoomClick(room)}
                    style={{
                      background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)", cursor: "pointer",
                      padding: 0, overflow: "hidden", transition: "all 0.15s",
                    }}
                    className="hotel-check-card-hover"
                  >
                    {/* Top bar */}
                    <div style={{
                      background: "#F59E0B", padding: "12px 16px",
                      display: "flex", alignItems: "center", justifyContent: "space-between"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "#fff", fontSize: 11, fontWeight: 600, background: "rgba(0,0,0,0.15)", padding: "2px 8px", borderRadius: 4 }}>
                          Otaq
                        </span>
                        <span style={{ color: "#fff", fontSize: 20, fontWeight: 800, letterSpacing: 0.5 }}>
                          {room.room_number || "?"}
                        </span>
                      </div>
                      <div style={{
                        background: "rgba(0,0,0,0.15)", borderRadius: 6,
                        padding: "4px 10px", textAlign: "right"
                      }}>
                        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Balans</div>
                        <div style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>{(Number(room.folio_balance) || 0).toFixed(2)} ₼</div>
                      </div>
                    </div>

                    {/* Body */}
                    <div style={{ padding: "14px 16px" }}>
                      {/* Guest */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%", background: "#FEF3C7",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                        }}>
                          <i className="bi bi-person-fill" style={{ color: "#D97706", fontSize: 14 }}></i>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {room.guest_name || "Naməlum"}
                          </div>
                          {room.guest_phone && (
                            <div style={{ fontSize: 11, color: "#053796", fontWeight: 600, marginTop: 1 }}>
                              <i className="bi bi-telephone-fill" style={{ fontSize: 9, marginRight: 4 }}></i>
                              {room.guest_phone}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Room type */}
                      {room.room_type && (
                        <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 10, fontWeight: 500 }}>
                          <i className="bi bi-door-open" style={{ marginRight: 4 }}></i>
                          {room.room_type}
                        </div>
                      )}

                      {/* Dates */}
                      {(d1 || d2) && (
                        <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                          {d1 && (
                            <div style={{ flex: 1, background: "#F9FAFB", borderRadius: 6, padding: "8px 10px", textAlign: "center", border: "1px solid #F3F4F6" }}>
                              <div style={{ fontSize: 9, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>
                                <i className="bi bi-box-arrow-in-right" style={{ marginRight: 3 }}></i>Giriş
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#1F2937" }}>
                                {d1.toLocaleString("az-AZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          )}
                          {d2 && (
                            <div style={{ flex: 1, background: "#F9FAFB", borderRadius: 6, padding: "8px 10px", textAlign: "center", border: "1px solid #F3F4F6" }}>
                              <div style={{ fontSize: 9, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>
                                <i className="bi bi-box-arrow-right" style={{ marginRight: 3 }}></i>Çıxış
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#1F2937" }}>
                                {d2.toLocaleString("az-AZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Nights */}
                      {nights > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6B7280", fontWeight: 600 }}>
                          <i className="bi bi-moon" style={{ color: "#F59E0B", fontSize: 11 }}></i>
                          {nights} gecə
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Container>
    );
  }

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
