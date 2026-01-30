import { Container, Row, Col } from "react-bootstrap";
import "./Checks.css";
import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { useNavigate } from "react-router-dom";

const Checks = () => {
  const [activeTab, setActiveTab] = useState("open");
  const dispatch = useDispatch();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const [orders, setOrders] = useState([]);
  const navigate = useNavigate();
  // Fetch active orders
  useEffect(() => {
    const getChecks = async () => {
      if (!loginedProfileData?.data?.profile?.id) return;

      try {
        const result = await dispatch(
          getActiveOrders({
            profileId: loginedProfileData.data.profile.id,
          }),
        ).unwrap();

        setOrders(result.data || []);
      } catch (err) {
        console.error("Error fetching orders:", err);
      }
    };

    getChecks();
  }, []);

  const hanldeGoCheck = (orderId, tableId) => {
    navigate(`/check/${orderId}?tableId=${tableId}`, {
      state: { from: "/checks" },
    });
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => order.status === 1);
  }, [orders]);

  // Total amount calculation
  const totalAmount = useMemo(
    () =>
      filteredOrders.reduce((sum, order) => sum + Number(order?.total || 0), 0),
    [filteredOrders],
  );

  // Helper to format date for display: "30 yanvar 2026"
  const formatDisplayDate = (date) => {
    if (!date) return "";

    const d = new Date(date);
    const day = d.getDate();
    const monthNames = [
      "yanvar",
      "fevral",
      "mart",
      "aprel",
      "may",
      "iyun",
      "iyul",
      "avqust",
      "sentyabr",
      "oktyabr",
      "noyabr",
      "dekabr",
    ];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();

    return `${day} ${month} ${year}`;
  };

  // Helper to get only date part for comparison
  const formatDateKey = (date) => {
    if (!date) return "";
    return new Date(date).toISOString().split("T")[0];
  };

  // Helper to format time: "5 dəq" or "1 Saat"
  const formatTime = (startDate) => {
    if (!startDate) return "";
    const now = new Date();
    const start = new Date(startDate);
    const diffMs = now - start;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins} dəq`;
    } else {
      const hours = Math.floor(diffMins / 60);
      return `${hours} Saat`;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 1: // Active
        return "#2196F3";
      case 2: // Closed
        return "#28a745";
      case 3: // Deleted
        return "#9E9E9E";
      default:
        return "#9E9E9E";
    }
  };

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

      {/* Summary Bar */}
      <div className="checks-summary-bar">
        <div className="checks-summary-left">
          <span className="checks-summary-label">Çek sayı:</span>
          <span className="checks-summary-value">{filteredOrders.length}</span>
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
        {filteredOrders.length === 0 ? (
          <div className="checks-empty-state">
            <p>Heç bir çek tapılmadı</p>
          </div>
        ) : (
          filteredOrders.map((check, index) => {
            const showDateHeader =
              index === 0 ||
              formatDateKey(filteredOrders[index - 1]?.start_date) !==
                formatDateKey(check?.start_date);

            return (
              <div key={check.id}>
                {showDateHeader && (
                  <div className="checks-date-header">
                    {formatDisplayDate(check?.start_date)}
                  </div>
                )}

                <div
                  className="checks-check-item"
                  onClick={() => {
                    hanldeGoCheck(check?.uuid, check?.table_id);
                  }}
                >
                  <div className="checks-check-left">
                    <div className="checks-check-id-row">
                      <span
                        className="checks-status-dot"
                        style={{
                          backgroundColor: getStatusColor(check.status),
                        }}
                      ></span>
                      <span className="checks-check-id">#{check.id}</span>
                      <span className="checks-check-badge checks-badge-open">
                        Açıq
                      </span>
                      {check.sale_type && (
                        <span
                          className={`checks-check-badge checks-badge-${check.sale_type}`}
                        >
                          {check.sale_type === "dine_in"
                            ? "Restoranda"
                            : check.sale_type === "takeaway"
                              ? "Gəl götür"
                              : check.sale_type === "delivery"
                                ? "Çatdırılma"
                                : ""}
                        </span>
                      )}
                    </div>
                    <div className="checks-check-info">
                      <span className="checks-check-time">
                        {formatTime(check.start_date)}
                      </span>
                      <span className="checks-check-user">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z" />
                        </svg>
                        {check?.waiter?.name || "Naməlum"}
                      </span>
                    </div>
                  </div>
                  <div className="checks-check-right">
                    <span className="checks-check-amount">
                      {Number(check.total || 0).toFixed(2)} ₼
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Container>
  );
};

export default Checks;
