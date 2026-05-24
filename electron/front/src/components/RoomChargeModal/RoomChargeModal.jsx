import React, { useState, useEffect } from "react";
import { Modal } from "react-bootstrap";
import axios from "axios";
import apiConfig from "../../utils/apiConfig";

const RoomChargeModal = ({ show, onHide, onSelect, profileId }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!show || !profileId) return;
    const fetchRooms = async () => {
      setLoading(true);
      try {
        const res = await apiConfig.get(`/rooms/${profileId}`);
        const data = Array.isArray(res.data) ? res.data : [];
        // Filter only available/occupied rooms
        setRooms(data.filter(r => r.status === "available" || r.status === "occupied"));
      } catch (err) {
        console.error("Failed to fetch rooms:", err);
        setRooms([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, [show, profileId]);

  const filteredRooms = rooms.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(r.room_number).toLowerCase().includes(q) ||
      (r.notes || "").toLowerCase().includes(q)
    );
  });

  const statusLabels = {
    available: "Boş",
    occupied: "Dolu",
    cleaning: "Təmizlənir",
    maintenance: "Təmirdə",
  };

  const statusColors = {
    available: "#10B981",
    occupied: "#F59E0B",
    cleaning: "#3B82F6",
    maintenance: "#EF4444",
  };

  return (
    <Modal show={show} onHide={onHide} centered animation={false} size="lg">
      <div style={{
        background: "white",
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)"
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #F59E0B, #D97706)",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "40px", height: "40px",
              background: "rgba(255,255,255,0.2)",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px"
            }}>
              🏨
            </div>
            <div>
              <div style={{ color: "white", fontWeight: 700, fontSize: "16px" }}>
                Otağa Yaz
              </div>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
                Hesabı otaq nömrəsinə əlavə et
              </div>
            </div>
          </div>
          <button
            onClick={onHide}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "white",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #E5E7EB" }}>
          <input
            type="text"
            placeholder="Otaq nömrəsi axtar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #D1D5DB",
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
        </div>

        {/* Room List */}
        <div style={{ maxHeight: "350px", overflowY: "auto", padding: "8px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#9CA3AF" }}>
              Yüklənir...
            </div>
          ) : filteredRooms.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#9CA3AF" }}>
              {search ? "Heç bir otaq tapılmadı" : "Aktiv otaq yoxdur"}
            </div>
          ) : (
            filteredRooms.map((room) => (
              <div
                key={room.id}
                onClick={() => onSelect(room)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  marginBottom: "4px",
                  border: "1px solid transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#FFF7ED";
                  e.currentTarget.style.borderColor = "#FDE68A";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "44px", height: "44px",
                    background: "#FEF3C7",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "16px",
                    color: "#D97706"
                  }}>
                    {room.room_number}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: "#1F2937" }}>
                      Otaq {room.room_number}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6B7280" }}>
                      {room.room_type || "Standard"} · {room.floor ? `${room.floor}. mərtəbə` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    padding: "3px 10px",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: `${statusColors[room.status] || "#6B7280"}15`,
                    color: statusColors[room.status] || "#6B7280",
                  }}>
                    {statusLabels[room.status] || room.status}
                  </span>
                  {room.price > 0 && (
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>
                      {room.price} ₼
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};

export default RoomChargeModal;
