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
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [notes, setNotes] = useState("");

  // Set defaults when modal opens
  useEffect(() => {
    if (!show) return;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const fmt = (d) => d.toISOString().split("T")[0];

    setGuestName("");
    setGuestPhone("");
    setNotes("");
    setAdults(1);
    setChildren(0);
    setCheckIn(fmt(today));
    setCheckOut(fmt(tomorrow));

    if (preselectedRoom) {
      setSelectedRoomId(String(preselectedRoom.id));
    } else {
      setSelectedRoomId("");
    }
  }, [show, preselectedRoom]);

  // Available rooms for dropdown
  const availableRooms = useMemo(() => {
    if (preselectedRoom) {
      return rooms.filter(
        (r) => r.id === preselectedRoom.id || r.status === "available"
      );
    }
    return rooms.filter((r) => r.status === "available");
  }, [rooms, preselectedRoom]);

  const handleSubmit = async () => {
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

    try {
      await dispatch(
        createReservation({
          profile_id: profileId,
          room_id: Number(selectedRoomId),
          guest_name: guestName.trim(),
          guest_phone: guestPhone.trim(),
          check_in: checkIn,
          check_out: checkOut,
          adults: Number(adults),
          children: Number(children),
          notes: notes.trim(),
        })
      ).unwrap();

      toast.success("Rezervasiya uğurla yaradıldı!");
      onSuccess?.();
    } catch (error) {
      toast.error(error?.error || "Rezervasiya yaratmaq mümkün olmadı");
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered animation={false} size="md" className="reservation-modal">
      <div className="modal-content-wrapper">
        {/* Header */}
        <div className="reservation-header">
          <div className="reservation-header-left">
            <div className="reservation-header-icon">
              <i className="bi bi-calendar-check"></i>
            </div>
            <span className="reservation-header-title">
              {preselectedRoom
                ? `Otaq ${preselectedRoom.room_number} - Rezervasiya`
                : "Yeni rezervasiya"}
            </span>
          </div>
          <button className="reservation-close-btn" onClick={onHide}>
            <i className="bi bi-x-lg" style={{ fontSize: "13px" }}></i>
          </button>
        </div>

        {/* Body */}
        <div className="reservation-body">
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
                  Otaq {r.room_number} — {r.room_type || "Standard"} ({r.status === "available" ? "Boş" : "Dolu"})
                  {r.price > 0 ? ` — ${r.price} ₼` : ""}
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
          <button
            className="btn-submit"
            onClick={handleSubmit}
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
