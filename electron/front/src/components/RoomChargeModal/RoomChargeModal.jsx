import React, { useState, useEffect } from "react";
import { Modal } from "react-bootstrap";
import apiConfig from "../../utils/apiConfig";
import { t } from "../../utils/translations";

const RoomChargeModal = ({ show, onHide, onSelect, profileId }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!show || !profileId) return;
    const fetchRooms = async () => {
      setLoading(true);
      try {
        const res = await apiConfig.get(`/rooms/${profileId}/summary`);
        const data = Array.isArray(res.data?.data || res.data) ? (res.data?.data || res.data) : [];
        // Filter only occupied rooms
        setRooms(data.filter(r => r.status === "occupied"));
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
      (r.guest_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <Modal show={show} onHide={onHide} centered animation={false} size="lg" className="reservation-modal">
      <div className="modal-content-wrapper">
        {/* Header — reservation-modal style */}
        <div className="reservation-header">
          <div className="reservation-header-left">
            <div className="reservation-header-icon">
              <i className="bi bi-building"></i>
            </div>
            <span className="reservation-header-title">{t("otaga_yaz")}</span>
          </div>
          <button className="reservation-close-btn" onClick={onHide}>
            <i className="bi bi-x-lg" style={{ fontSize: "13px" }}></i>
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #E5E7EB" }}>
          <input
            type="text"
            placeholder={t("otaq_nomresi_ve_ya_qonaq_adi_axtar")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-control"
            style={{
              borderRadius: "6px",
              border: "1px solid #D1D5DB",
              padding: "9px 12px",
              fontSize: "14px",
              width: "100%",
            }}
          />
        </div>

        {/* Room List — reservation-body style */}
        <div className="reservation-body" style={{ padding: "8px", maxHeight: "400px", overflowY: "auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#9CA3AF" }}>
              <div className="spinner-border spinner-border-sm text-primary" role="status" />
              <p style={{ marginTop: "8px", fontSize: "13px" }}>{t("otaqlar_yuklenir")}</p>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#9CA3AF" }}>
              <i className="bi bi-building" style={{ fontSize: "32px", color: "#D1D5DB" }}></i>
              <p style={{ marginTop: "8px", fontSize: "13px" }}>
                {search ? "Heç bir otaq tapılmadı" : "Dolu otaq yoxdur"}
              </p>
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
                  padding: "12px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  marginBottom: "4px",
                  border: "1px solid transparent",
                }}
                className="room-charge-item-hover"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#EFF6FF";
                  e.currentTarget.style.borderColor = "#BFDBFE";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "44px", height: "44px",
                    background: "#DBEAFE",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "16px",
                    color: "#053796",
                  }}>
                    {room.room_number}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: "#1F2937" }}>
                      Otaq {room.room_number}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6B7280" }}>
                      {room.guest_name ? (
                        <span style={{ color: "#053796", fontWeight: 500 }}>{room.guest_name}</span>
                      ) : (
                        <span>{t("bos_1")}</span>
                      )}
                      {room.room_type ? ` · ${room.room_type}` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    padding: "3px 10px",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: "#FEF3C7",
                    color: "#D97706",
                  }}>
                    Dolu
                  </span>
                  {room.folio_balance > 0 && (
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>
                      {Number(room.folio_balance).toFixed(2)} ₼
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer — reservation-footer style */}
        <div className="reservation-footer" style={{ justifyContent: "center" }}>
          <button className="btn-cancel" onClick={onHide}>{t("bagla")}</button>
        </div>
      </div>
    </Modal>
  );
};

export default RoomChargeModal;
