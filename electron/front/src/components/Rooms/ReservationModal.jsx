import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { createReservation, fetchRooms } from "../../redux/Slices/HotelSlice";
import "./ReservationModal.css";

const ReservationModal = ({ show, onHide, preselectedRoom, onSuccess }) => {
  const dispatch = useDispatch();
  const { rooms, isCreatingReservation } = useSelector((state) => state.HotelSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);

  const profileId = loginedProfileData?.data?.profile?.id;

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [deposit, setDeposit] = useState("");
  const [notes, setNotes] = useState("");
  const [action, setAction] = useState("reserve");

  // Set defaults when modal opens
  useEffect(() => {
    if (!show) return;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const fmt = (d) => d.toISOString().split("T")[0];

    setGuestName("");
    setGuestPhone("");
    setDocumentId("");
    setNotes("");
    setAdults(1);
    setChildren(0);
    setDeposit("");
    setCheckIn(fmt(today));
    setCheckOut(fmt(tomorrow));
    setAction("reserve");

    if (preselectedRoom) {
      setSelectedRoomId(String(preselectedRoom.id));
      // If preselected room is reserved, default to check-in action
      if (preselectedRoom.status === "reserved") {
        setAction("checkin");
      }
    } else {
      setSelectedRoomId("");
    }
  }, [show, preselectedRoom]);

  // Available rooms for dropdown
  const availableRooms = useMemo(() => {
    if (preselectedRoom) {
      return rooms.filter(
        (r) => r.id === preselectedRoom.id || r.status === "available" || r.status === "reserved"
      );
    }
    return rooms.filter((r) => r.status === "available" || r.status === "reserved");
  }, [rooms, preselectedRoom]);

  // Seçilmiş otaq
  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null;
    return rooms.find((r) => String(r.id) === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  // Gecə hesabı
  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    const diff = d2.getTime() - d1.getTime();
    if (diff <= 0) return 0;
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  }, [checkIn, checkOut]);

  // Otaq qiyməti
  const roomPrice = useMemo(() => {
    return Number(selectedRoom?.price || 0);
  }, [selectedRoom]);

  // Cəmi
  const totalPrice = nights * roomPrice;

  const handleSubmit = async (actionType) => {
    if (!guestName.trim()) {
      toast.error("Qonaq adı daxil edin");
      return;
    }
    if (!selectedRoomId) {
      toast.error("Otaq seçin");
      return;
    }
    if (!checkIn || !checkOut) {
      toast.error("Giriş və çıxış tarixlərini seçin");
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      toast.error("Çıxış tarixi giriş tarixindən sonra olmalıdır");
      return;
    }

    const isCheckin = actionType === "checkin";

    try {
      const result = await dispatch(
        createReservation({
          profile_id: profileId,
          room_id: Number(selectedRoomId),
          guest_name: guestName.trim(),
          guest_phone: guestPhone.trim(),
          document_id: documentId.trim() || undefined,
          check_in: checkIn,
          check_out: checkOut,
          adults: Number(adults),
          children: Number(children),
          deposit: deposit ? parseFloat(deposit) : undefined,
          notes: notes.trim(),
          status: isCheckin ? "occupied" : "reserved",
        })
      ).unwrap();

      toast.success(isCheckin ? "Giriş edildi!" : "Rezervasiya uğurla yaradıldı!");
      const bookingData = result?.data || result;
      onSuccess?.(bookingData, isCheckin ? "checkin" : "reserve");
    } catch (error) {
      toast.error(error?.error || "Əməliyyat mümkün olmadı");
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered animation={false} size="md" className="reservation-modal">
      <div className="modal-content-wrapper">
        {/* Header */}
        <div className="reservation-header">
          <div className="reservation-header-left">
            <div className="reservation-header-icon">
              <i className={`bi ${action === "checkin" ? "bi-box-arrow-in-right" : "bi-calendar-check"}`}></i>
            </div>
            <span className="reservation-header-title">
              {preselectedRoom
                ? `Otaq ${preselectedRoom.room_number} — ${action === "checkin" ? "Giriş" : "Rezervasiya"}`
                : "Yeni rezervasiya"}
            </span>
          </div>
          <button className="reservation-close-btn" onClick={onHide}>
            <i className="bi bi-x-lg" style={{ fontSize: "13px" }}></i>
          </button>
        </div>

        {/* Body */}
        <div className="reservation-body">
          {/* Action Type Toggle */}
          <div className="rm-action-toggle mb-3">
            <button
              className={`rm-action-btn ${action === "reserve" ? "active" : ""}`}
              onClick={() => setAction("reserve")}
            >
              <i className="bi bi-calendar-check"></i>
              Rezervasiya
            </button>
            <button
              className={`rm-action-btn ${action === "checkin" ? "active" : ""}`}
              onClick={() => setAction("checkin")}
            >
              <i className="bi bi-box-arrow-in-right"></i>
              Check-in
            </button>
          </div>

          {/* Guest Name */}
          <div className="mb-3">
            <label className="form-label">
              Qonaq adı <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Ad Soyad"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
          </div>

          {/* Guest Phone */}
          <div className="mb-3">
            <label className="form-label">Telefon</label>
            <input
              type="tel"
              className="form-control"
              placeholder="+994 XX XXX XX XX"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
            />
          </div>

          {/* Document ID */}
          <div className="mb-3">
            <label className="form-label">
              <i className="bi bi-card-text" style={{ marginRight: 4 }}></i>
              Şəxsiyyət vəsiqəsi / FİN
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="AZE AA1234567 və ya FİN kodu"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
            />
          </div>

          {/* Room Selection */}
          <div className="mb-3">
            <label className="form-label">
              Otaq <span className="required">*</span>
            </label>
            <select
              className="form-select"
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
            >
              <option value="">Otaq seçin</option>
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Otaq {r.room_number} — {r.room_type || "Standard"}
                  {r.status === "reserved" ? " (Bron)" : r.status === "available" ? " (Boş)" : ""}
                  {r.price > 0 ? ` — ${r.price} ₼/gecə` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="row mb-3">
            <div className="col-6">
              <label className="form-label">
                Giriş tarixi <span className="required">*</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>
            <div className="col-6">
              <label className="form-label">
                Çıxış tarixi <span className="required">*</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
          </div>

          {/* Price Summary */}
          {nights > 0 && roomPrice > 0 ? (
            <div className="rm-price-summary mb-3">
              <div className="rm-price-row">
                <span>{roomPrice.toFixed(2)} ₼ × {nights} gecə</span>
                <span className="rm-price-total">{totalPrice.toFixed(2)} ₼</span>
              </div>
            </div>
          ) : nights > 0 ? (
            <div className="rm-price-summary mb-3">
              <div className="rm-price-row">
                <span>Cəmi: {nights} gecə</span>
                <span className="rm-price-total">{nights} gecə</span>
              </div>
            </div>
          ) : null}

          {/* Guests */}
          <div className="row mb-3">
            <div className="col-6">
              <label className="form-label">Böyüklər</label>
              <input
                type="number"
                className="form-control"
                min={1}
                max={20}
                value={adults}
                onChange={(e) => setAdults(e.target.value)}
              />
            </div>
            <div className="col-6">
              <label className="form-label">Uşaqlar</label>
              <input
                type="number"
                className="form-control"
                min={0}
                max={20}
                value={children}
                onChange={(e) => setChildren(e.target.value)}
              />
            </div>
          </div>

          {/* Deposit */}
          <div className="mb-3">
            <label className="form-label">
              <i className="bi bi-wallet2" style={{ marginRight: 4 }}></i>
              Ödənilən beh / Depozit (₼)
            </label>
            <input
              type="number"
              className="form-control"
              placeholder="0.00"
              min={0}
              step="0.01"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="mb-3">
            <label className="form-label">Qeydlər</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Əlavə qeydlər..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="reservation-footer">
          <button className="btn-cancel" onClick={onHide}>
            Ləğv et
          </button>

          {action === "checkin" ? (
            <button
              className="btn-checkin"
              onClick={() => handleSubmit("checkin")}
              disabled={isCreatingReservation}
            >
              {isCreatingReservation ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  Göndərilir...
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right"></i>
                  Giriş et
                </>
              )}
            </button>
          ) : null}

          <button
            className="btn-submit"
            onClick={() => handleSubmit("reserve")}
            disabled={isCreatingReservation}
          >
            {isCreatingReservation ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status"></span>
                Göndərilir...
              </>
            ) : (
              <>
                <i className="bi bi-check-lg"></i>
                Rezervasiya et
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ReservationModal;
