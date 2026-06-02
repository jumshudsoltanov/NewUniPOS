import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { updateRoomStatus, fetchRooms } from "../../redux/Slices/HotelSlice";
import "../Table/Table.css";

const statusToTableClass = {
  available: "free",
  occupied: "occupied",
  cleaning: "pending",
  reserved: "reserved",
  maintenance: "other-waiter-table",
};

const statusOptions = [
  { value: "available", label: "Boş", icon: "bi-check-circle", color: "#10B981" },
  { value: "occupied", label: "Dolu", icon: "bi-person-fill", color: "#F59E0B" },
  { value: "cleaning", label: "Təmizlənir", icon: "bi-arrow-repeat", color: "#D97706" },
  { value: "reserved", label: "Bron", icon: "bi-calendar-check", color: "#8B5CF6" },
  { value: "maintenance", label: "Təmirdə", icon: "bi-tools", color: "#EF4444" },
];

const RoomCard = ({ room, onRoomClick, checkTotal = 0 }) => {
  const dispatch = useDispatch();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const status = room.status || "available";
  const tableStatus = statusToTableClass[status] || "free";
  // checkTotal varsa göstər, yoxdursa folio_balance (restoran modulundakı kimi)
  const displayAmount = checkTotal > 0 ? checkTotal : Number(room.folio_balance || 0);

  const handleStatusChange = async (newStatus, e) => {
    e.stopPropagation();
    try {
      await dispatch(updateRoomStatus({ roomId: room.id, status: newStatus })).unwrap();
      toast.success(`Otaq statusu "${statusOptions.find(s => s.value === newStatus)?.label}" olaraq dəyişdirildi`);
      setShowStatusMenu(false);
      // Otaqları yenilə
      const pid = loginedProfileData?.data?.profile?.id;
      if (pid) dispatch(fetchRooms(pid));
    } catch (err) {
      toast.error("Status dəyişdirilmədi");
    }
  };

  return (
    <div className="table-wrapper wrapper-square" style={{ cursor: "pointer" }} onClick={() => onRoomClick?.(room)}>
      <div className={`table-surface table-square ${tableStatus}`}>
        {/* Status Dot */}
        <div className={`status-dot ${status === "occupied" ? "has-orders" : ""}`}></div>

        {/* Center Content */}
        <div className="table-content">
          <h3 className={`table-name ${tableStatus}`}>
            {room.room_number || "?"}
          </h3>
          <p className={`table-amount ${tableStatus}`}>
            {displayAmount.toFixed(2)} ₼
          </p>

          {status === "occupied" && room.guest_name ? (
            <div className={`table-waiter-info ${tableStatus}`}>
              <i className="bi bi-person-fill"></i>
              <span>{room.guest_name}</span>
            </div>
          ) : status === "reserved" ? (
            <div className={`table-waiter-info ${tableStatus}`}>
              <i className="bi bi-calendar-check"></i>
              <span>Bron</span>
            </div>
          ) : status !== "occupied" ? (
            <div className={`table-waiter-info ${tableStatus}`}>
              <i className="bi bi-info-circle"></i>
              <span>{
                status === "available" ? "Boş" :
                status === "cleaning" ? "Təmizlənir" :
                status === "maintenance" ? "Təmirdə" : status
              }</span>
            </div>
          ) : null}

          {/* Check-out tarixi — yalnız dolu otaqlarda */}
          {status === "occupied" && room.check_out ? (
            <div style={{
              fontSize: "10px",
              fontWeight: 600,
              color: "#1d4ed8",
              marginTop: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "3px",
            }}>
              <i className="bi bi-box-arrow-right" style={{ fontSize: "9px" }}></i>
              Çıxış: {new Date(room.check_out).toLocaleDateString("az-AZ", { day: "2-digit", month: "2-digit" })}
            </div>
          ) : null}
        </div>

        {/* Print Action */}
        <div className="print-action">
          <div className="notification-badge">0</div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
        </div>

        {/* Status Change Gear */}
        <div
          style={{
            position: "absolute",
            bottom: "-8px",
            left: "-8px",
            width: "26px",
            height: "26px",
            background: "white",
            borderRadius: "50%",
            boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 20,
            color: "#6B7280",
            fontSize: "12px",
            border: "1px solid #E5E7EB",
            transition: "all 0.15s",
          }}
          className="room-status-trigger"
          onClick={(e) => {
            e.stopPropagation();
            setShowStatusMenu(!showStatusMenu);
          }}
          title="Statusu dəyiş"
        >
          <i className="bi bi-gear-fill"></i>
        </div>

        {/* Status Menu */}
        {showStatusMenu && (
          <>
            <div
              style={{
                position: "fixed",
                top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 99,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setShowStatusMenu(false);
              }}
            ></div>
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: "0",
                background: "white",
                borderRadius: "8px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                zIndex: 100,
                minWidth: "160px",
                padding: "4px",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    border: "none",
                    background: status === opt.value ? "#EFF6FF" : "transparent",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: status === opt.value ? 600 : 500,
                    color: status === opt.value ? "#1E3A8A" : "#374151",
                    width: "100%",
                    textAlign: "left",
                    transition: "background 0.1s",
                  }}
                  className="room-status-option-hover"
                  onClick={(e) => {
                    if (status !== opt.value) {
                      handleStatusChange(opt.value, e);
                    } else {
                      setShowStatusMenu(false);
                    }
                  }}
                >
                  <i className={`bi ${opt.icon}`} style={{ color: opt.color, fontSize: "14px", width: "18px", textAlign: "center" }}></i>
                  <span>{opt.label}</span>
                  {status === opt.value && (
                    <i className="bi bi-check-lg" style={{ marginLeft: "auto", color: "#053796", fontSize: "13px" }}></i>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(RoomCard);
