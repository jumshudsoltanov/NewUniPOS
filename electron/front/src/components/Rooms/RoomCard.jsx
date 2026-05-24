import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { updateRoomStatus } from "../../redux/Slices/HotelSlice";
import "./RoomCard.css";

const statusConfig = {
  available: { label: "Boş", cssClass: "free" },
  occupied: { label: "Dolu", cssClass: "occupied" },
  cleaning: { label: "Təmizlənir", cssClass: "pending" },
  maintenance: { label: "Təmirdə", cssClass: "other" },
};

const statusOptions = [
  { value: "available", label: "Boş", icon: "bi-check-circle", color: "#10B981" },
  { value: "occupied", label: "Dolu", icon: "bi-person-fill", color: "#F59E0B" },
  { value: "cleaning", label: "Təmizlənir", icon: "bi-arrow-repeat", color: "#3B82F6" },
  { value: "maintenance", label: "Təmirdə", icon: "bi-tools", color: "#EF4444" },
];

const formatDateTime = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return { date: `${day}.${month}`, time: `${hours}:${mins}` };
};

const RoomCard = ({ room, onRoomClick }) => {
  const dispatch = useDispatch();
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const status = room.status || "available";
  const cfg = statusConfig[status] || statusConfig.available;

  const guestName = room.guest_name || "";
  const balance = Number(room.folio_balance || 0);
  const roomType = room.room_type || "";
  const floor = room.floor || "";

  const checkIn = formatDateTime(room.check_in);
  const checkOut = formatDateTime(room.check_out);

  // Calculate nights
  let nights = "";
  if (room.check_in && room.check_out) {
    const d1 = new Date(room.check_in);
    const d2 = new Date(room.check_out);
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    if (diff > 0) nights = `${diff} gecə`;
  }

  const handleStatusChange = async (newStatus, e) => {
    e.stopPropagation();
    try {
      await dispatch(updateRoomStatus({ roomId: room.id, status: newStatus })).unwrap();
      toast.success(`Otaq statusu "${statusOptions.find(s => s.value === newStatus)?.label}" olaraq dəyişdirildi`);
      setShowStatusMenu(false);
    } catch (err) {
      toast.error("Status dəyişdirilmədi");
    }
  };

  return (
    <div
      className="room-wrapper"
      onClick={() => onRoomClick?.(room)}
      style={{ cursor: "pointer" }}
    >
      <div className={`room-surface ${cfg.cssClass}`}>
        {/* Status Dot */}
        <div className={`room-status-dot ${status}`}></div>

        {/* Center Content */}
        <div className="room-content">
          <h3 className={`room-number ${cfg.cssClass}`}>
            {room.room_number || "?"}
          </h3>

          {roomType || floor ? (
            <p className="room-detail">
              {roomType}{roomType && floor ? " · " : ""}{floor ? `${floor}. mərtəbə` : ""}
            </p>
          ) : null}

          {status === "occupied" && guestName ? (
            <div className={`room-guest ${cfg.cssClass}`}>
              <i className="bi bi-person-fill"></i>
              <span>{guestName}</span>
            </div>
          ) : null}

          {/* Check-in / Check-out times */}
          {status === "occupied" && (checkIn || checkOut) ? (
            <div className="room-check-dates">
              {checkIn ? (
                <span className="room-check-item">
                  <i className="bi bi-box-arrow-in-right"></i>
                  {checkIn.date} {checkIn.time}
                </span>
              ) : null}
              {checkOut ? (
                <span className="room-check-item">
                  <i className="bi bi-box-arrow-right"></i>
                  {checkOut.date} {checkOut.time}
                </span>
              ) : null}
            </div>
          ) : null}

          {nights ? (
            <div className="room-nights">
              <i className="bi bi-calendar3"></i>
              <span>{nights}</span>
            </div>
          ) : null}

          {balance > 0 ? (
            <div className="room-balance">{balance.toFixed(2)} ₼</div>
          ) : null}

          {status === "cleaning" ? (
            <div className="room-sub-status">
              <i className="bi bi-arrow-repeat"></i> Təmizlənir
            </div>
          ) : null}

          {status === "maintenance" ? (
            <div className="room-sub-status">
              <i className="bi bi-tools"></i> Təmirdə
            </div>
          ) : null}
        </div>

        {/* Badge */}
        <div className="room-badge">{cfg.label}</div>

        {/* Status Change Button */}
        <div
          className="room-status-action"
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
              className="room-status-overlay"
              onClick={(e) => {
                e.stopPropagation();
                setShowStatusMenu(false);
              }}
            ></div>
            <div
              className="room-status-menu"
              onClick={(e) => e.stopPropagation()}
            >
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={`room-status-option ${status === opt.value ? "active" : ""}`}
                  onClick={(e) => {
                    if (status !== opt.value) {
                      handleStatusChange(opt.value, e);
                    } else {
                      setShowStatusMenu(false);
                    }
                  }}
                >
                  <i className={`bi ${opt.icon}`} style={{ color: opt.color }}></i>
                  <span>{opt.label}</span>
                  {status === opt.value && <i className="bi bi-check-lg ms-auto"></i>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RoomCard;
