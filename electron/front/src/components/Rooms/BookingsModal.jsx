import React, { useEffect, useState, useCallback } from "react";
import { Modal } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { fetchBookings, updateBookingStatus, deleteBooking, fetchRooms } from "../../redux/Slices/HotelSlice";

const statusLabels = {
  active: "Aktiv",
  confirmed: "Təsdiqlənmiş",
  cancelled: "Ləğv edilmiş",
  completed: "Bitmiş",
};

const statusColors = {
  active: { bg: "#D1FAE5", text: "#065F46" },
  confirmed: { bg: "#DBEAFE", text: "#1E40AF" },
  cancelled: { bg: "#FEE2E2", text: "#991B1B" },
  completed: { bg: "#F3F4F6", text: "#6B7280" },
};

const BookingsModal = ({ show, onHide, profileId }) => {
  const dispatch = useDispatch();
  const { bookings, rooms } = useSelector((state) => state.HotelSlice);
  const [processingId, setProcessingId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'cancel'|'delete', booking }

  useEffect(() => {
    if (show && profileId) {
      dispatch(fetchBookings(profileId));
    }
  }, [show, profileId, dispatch]);

  const roomMap = {};
  rooms.forEach((r) => { roomMap[r.id] = r; });

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return;
    const { type, booking } = confirmAction;
    setProcessingId(booking.id);
    setConfirmAction(null);
    try {
      if (type === "cancel") {
        await dispatch(updateBookingStatus({ bookingId: booking.id, status: "cancelled" })).unwrap();
        toast.success("Rezervasiya ləğv edildi");
        dispatch(fetchBookings(profileId));
      } else if (type === "delete") {
        await dispatch(deleteBooking(booking.id)).unwrap();
        toast.success("Rezervasiya silindi");
      }
    } catch (err) {
      toast.error(type === "cancel" ? "Ləğv etmək mümkün olmadı" : "Silmək mümkün olmadı");
    } finally {
      setProcessingId(null);
    }
  }, [confirmAction, dispatch, profileId]);

  const confirmLabels = {
    cancel: {
      title: "Rezervasiyanı ləğv et",
      body: (name) => `${name} - rezervasiyanı ləğv etmək istəyirsiniz?`,
      btn: "Ləğv et",
    },
    delete: {
      title: "Rezervasiyanı sil",
      body: (name) => `${name} - rezervasiyanı silmək istəyirsiniz? (Bu əməliyyat geri alına bilməz)`,
      btn: "Sil",
    },
  };

  const formatDate = (d) => {
    if (!d) return "—";
    const date = new Date(d);
    const months = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const sorted = [...bookings].sort((a, b) => new Date(b.created_at || b.check_in) - new Date(a.created_at || a.check_in));

  // Count by status
  const activeBookings = bookings.filter((b) => b.status === "active" || b.status === "confirmed");
  const cancelledCount = bookings.filter((b) => b.status === "cancelled").length;
  const completedCount = bookings.filter((b) => b.status === "completed").length;

  return (
    <Modal show={show} onHide={onHide} centered animation={false} size="lg" className="reservation-modal">
      <div className="modal-content-wrapper">
        {/* Header */}
        <div className="reservation-header">
          <div className="reservation-header-left">
            <div className="reservation-header-icon">
              <i className="bi bi-journal-text"></i>
            </div>
            <span className="reservation-header-title">Bütün rezervasiyalar</span>
          </div>
          <button className="reservation-close-btn" onClick={onHide}>
            <i className="bi bi-x-lg" style={{ fontSize: "13px" }}></i>
          </button>
        </div>

        {/* Stats Bar */}
        <div style={{
          display: "flex", gap: "16px", padding: "14px 20px",
          background: "#F9FAFB", borderBottom: "1px solid #E5E7EB",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981" }}></span>
            <span style={{ fontSize: "13px", color: "#374151" }}>Aktiv: <strong>{activeBookings.length}</strong></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#EF4444" }}></span>
            <span style={{ fontSize: "13px", color: "#374151" }}>Ləğv edilmiş: <strong>{cancelledCount}</strong></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#6B7280" }}></span>
            <span style={{ fontSize: "13px", color: "#374151" }}>Bitmiş: <strong>{completedCount}</strong></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3B82F6" }}></span>
            <span style={{ fontSize: "13px", color: "#374151" }}>Ümumi: <strong>{bookings.length}</strong></span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px", background: "#fff", maxHeight: "420px", overflowY: "auto" }}>
          {sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#9CA3AF" }}>
              <i className="bi bi-journal-text" style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}></i>
              <p style={{ margin: 0 }}>Heç bir rezervasiya tapılmadı</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E5E7EB" }}>
                  <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 600, color: "#6B7280", fontSize: "11px", textTransform: "uppercase" }}>Qonaq</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 600, color: "#6B7280", fontSize: "11px", textTransform: "uppercase" }}>Otaq</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 600, color: "#6B7280", fontSize: "11px", textTransform: "uppercase" }}>Giriş</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 600, color: "#6B7280", fontSize: "11px", textTransform: "uppercase" }}>Çıxış</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 600, color: "#6B7280", fontSize: "11px", textTransform: "uppercase" }}>Status</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600, color: "#6B7280", fontSize: "11px", textTransform: "uppercase" }}>Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((booking) => {
                  const room = roomMap[booking.room_id];
                  const sc = statusColors[booking.status] || statusColors.active;
                  const isProcessing = processingId === booking.id;

                  return (
                    <tr
                      key={booking.id}
                      style={{
                        borderBottom: "1px solid #F3F4F6",
                        background: booking.status === "cancelled" ? "#F9FAFB" : "#fff",
                        opacity: booking.status === "cancelled" || booking.status === "completed" ? 0.7 : 1,
                      }}
                    >
                      <td style={{ padding: "10px 6px", fontWeight: 600, color: "#1F2937" }}>
                        <i className="bi bi-person-fill me-1" style={{ color: "#9CA3AF", fontSize: "12px" }}></i>
                        {booking.guest_name || "—"}
                      </td>
                      <td style={{ padding: "10px 6px", color: "#374151" }}>
                        {room ? `Otaq ${room.room_number}` : `#${booking.room_id}`}
                        {room?.room_type ? <span style={{ color: "#9CA3AF", fontSize: "11px", display: "block" }}>{room.room_type}</span> : null}
                      </td>
                      <td style={{ padding: "10px 6px", color: "#374151", whiteSpace: "nowrap" }}>{formatDate(booking.check_in)}</td>
                      <td style={{ padding: "10px 6px", color: "#374151", whiteSpace: "nowrap" }}>{formatDate(booking.check_out)}</td>
                      <td style={{ padding: "10px 6px" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: sc.bg,
                          color: sc.text,
                        }}>
                          {statusLabels[booking.status] || booking.status || "Aktiv"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 6px", textAlign: "right" }}>
                        {(booking.status === "active" || booking.status === "confirmed") && (
                          <button
                            onClick={() => setConfirmAction({ type: "cancel", booking })}
                            disabled={isProcessing}
                            style={{
                              padding: "5px 12px",
                              borderRadius: "6px",
                              border: "1px solid #FCA5A5",
                              background: "#FEF2F2",
                              color: "#991B1B",
                              fontSize: "12px",
                              fontWeight: 500,
                              cursor: isProcessing ? "not-allowed" : "pointer",
                              opacity: isProcessing ? 0.6 : 1,
                            }}
                          >
                            {isProcessing ? (
                              <><span className="spinner-border spinner-border-sm me-1" role="status"></span>Göndərilir</>
                            ) : (
                              "Ləğv et"
                            )}
                          </button>
                        )}
                        {(booking.status === "cancelled" || booking.status === "completed") && (
                          <button
                            onClick={() => setConfirmAction({ type: "delete", booking })}
                            disabled={isProcessing}
                            style={{
                              padding: "5px 12px",
                              borderRadius: "6px",
                              border: "1px solid #D1D5DB",
                              background: "#fff",
                              color: "#6B7280",
                              fontSize: "12px",
                              fontWeight: 500,
                              cursor: isProcessing ? "not-allowed" : "pointer",
                              opacity: isProcessing ? 0.6 : 1,
                            }}
                          >
                            {isProcessing ? (
                              <><span className="spinner-border spinner-border-sm me-1" role="status"></span>Silinir</>
                            ) : (
                              "Sil"
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (() => {
        const labels = confirmLabels[confirmAction.type];
        return (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.3)", zIndex: 1050,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: "12px",
          }}>
            <div style={{
              background: "#fff", borderRadius: "12px", width: "380px",
              maxWidth: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                background: "#053796", padding: "16px 20px",
                display: "flex", alignItems: "center", gap: "12px",
              }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px", color: "#fff",
                }}>
                  <i className={`bi ${confirmAction.type === "cancel" ? "bi-x-circle" : "bi-trash3"}`}></i>
                </div>
                <span style={{ fontSize: "16px", fontWeight: 600, color: "#fff" }}>
                  {labels.title}
                </span>
              </div>
              {/* Body */}
              <div style={{ padding: "20px", fontSize: "14px", color: "#374151" }}>
                {labels.body(confirmAction.booking.guest_name || "Bu rezervasiya")}
              </div>
              {/* Footer */}
              <div style={{
                padding: "12px 20px", display: "flex", justifyContent: "flex-end", gap: "10px",
                borderTop: "1px solid #E5E7EB",
              }}>
                <button
                  onClick={() => setConfirmAction(null)}
                  style={{
                    padding: "8px 18px", borderRadius: "8px",
                    border: "1px solid #D1D5DB", background: "#fff",
                    color: "#374151", fontSize: "13px", fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  İmtina
                </button>
                <button
                  onClick={handleConfirmAction}
                  style={{
                    padding: "8px 18px", borderRadius: "8px",
                    border: "none", background: "#053796",
                    color: "#fff", fontSize: "13px", fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {labels.btn}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </Modal>
  );
};

export default BookingsModal;
