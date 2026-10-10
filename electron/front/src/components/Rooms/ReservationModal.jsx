import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { createReservation, fetchRooms as _fetchRooms } from "../../redux/Slices/HotelSlice";
import { createCustomerViaAdmin, fetchCustomersFromAdmin } from "../../redux/Slices/CustomersSlice";
import { t } from "../../utils/translations";
import { formatPrice } from "../../utils/formatPrice";
import "./ReservationModal.css";

const ReservationModal = ({ show, onHide, preselectedRoom, onSuccess }) => {
  const dispatch = useDispatch();
  const { rooms, isCreatingReservation } = useSelector((state) => state.HotelSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { customers } = useSelector((state) => state.CustomersSlice);

  const profileId = loginedProfileData?.data?.profile?.id;

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
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
    setSelectedCustomerId(null);
    setCustomerSearch("");
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

  // Filtered customers for search dropdown
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim() || !customers?.length) return [];
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q)
    ).slice(0, 10);
  }, [customerSearch, customers]);

  const handleCustomerSelect = (customer) => {
    setSelectedCustomerId(customer.id);
    setGuestName(customer.name || "");
    setGuestPhone(customer.phone || "");
    setCustomerSearch(customer.name || "");
    setShowCustomerDropdown(false);
  };

  const handleCreateCustomer = async () => {
    const name = customerSearch.trim();
    const phone = guestPhone.trim();
    if (!name) {
      toast.error(t("musteri_yaratmaq_ucun_ad_daxil_edin"));
      return;
    }
    setIsCreatingCustomer(true);
    try {
      const result = await dispatch(createCustomerViaAdmin({
        name,
        phone: phone || undefined,
      })).unwrap();
      const newCustomer = result?.data || result;
      if (newCustomer?.id) {
        setSelectedCustomerId(newCustomer.id);
        setGuestName(name);
        toast.success(t("musteri_yaradildi"));
        dispatch(fetchCustomersFromAdmin());
        setShowCustomerDropdown(false);
      }
    } catch (err) {
      toast.error(err?.error || t("musteri_yaradilmadi"));
    } finally {
      setIsCreatingCustomer(false);
    }
  };

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
      toast.error(t("qonaq_adi_daxil_edin"));
      return;
    }
    if (!selectedRoomId) {
      toast.error(t("otaq_secin"));
      return;
    }
    if (!checkIn || !checkOut) {
      toast.error(t("giris_ve_cixis_tarixlerini_secin"));
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      toast.error(t("cixis_tarixi_giris_tarixinden_sonra_olmalidir"));
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
          customer_id: selectedCustomerId || undefined,
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
      toast.error(error?.error || t("emeliyyat_mumkun_olmadi"));
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered animation={false} size="lg" className="reservation-modal">
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

          {/* Customer Search */}
          <div className="mb-3">
            <label className="form-label">
              <i className="bi bi-person-fill" style={{ marginRight: 4 }}></i>{t("musteri_sec")}</label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="form-control"
                placeholder={t("ad_ve_ya_telefon_nomresi_ile_axtar")}
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerDropdown(true);
                  if (selectedCustomerId) {
                    setSelectedCustomerId(null);
                    if (!e.target.value) {
                      setGuestName("");
                      setGuestPhone("");
                    }
                  }
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
              />
              {selectedCustomerId && customerSearch && (
                <span
                  style={{
                    position: "absolute", right: "10px", top: "50%",
                    transform: "translateY(-50%)",
                    color: "#10B981", fontSize: "12px", fontWeight: 600,
                    background: "#F0FDF4", padding: "4px 12px",
                    borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "5px",
                    pointerEvents: "none", lineHeight: 1,
                  }}
                >
                  <i className="bi bi-check-circle-fill" style={{ fontSize: "12px" }}></i>{t("secildi")}</span>
              )}
              {showCustomerDropdown && !selectedCustomerId && customerSearch.trim() && (
                <div
                  style={{
                    position: "absolute", top: "100%", left: 0, right: 0,
                    zIndex: 50, background: "#fff",
                    border: "1px solid #D1D5DB", borderRadius: "6px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    maxHeight: "220px", overflowY: "auto",
                  }}
                >
                  {filteredCustomers.map((c) => (
                    <div
                      key={c.id}
                      onMouseDown={() => handleCustomerSelect(c)}
                      style={{
                        padding: "10px 12px", cursor: "pointer",
                        borderBottom: "1px solid #F3F4F6",
                        display: "flex", alignItems: "center", gap: "8px",
                      }}
                      className="rm-customer-option"
                      onMouseEnter={(e) => e.currentTarget.style.background = "#EFF6FF"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <i className="bi bi-person-circle" style={{ color: "#9CA3AF", fontSize: "18px" }}></i>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "13px", color: "#1F2937" }}>{c.name}</div>
                        {c.phone && <div style={{ fontSize: "12px", color: "#6B7280" }}>{c.phone}</div>}
                      </div>
                    </div>
                  ))}
                  <div
                    onMouseDown={handleCreateCustomer}
                    style={{
                      padding: "10px 12px", cursor: "pointer",
                      borderTop: "1px solid #E5E7EB",
                      display: "flex", alignItems: "center", gap: "8px",
                      color: "#053796", fontWeight: 600, fontSize: "13px",
                    }}
                    className="rm-customer-option"
                    onMouseEnter={(e) => e.currentTarget.style.background = "#EFF6FF"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    {isCreatingCustomer ? (
                      <><span className="spinner-border spinner-border-sm me-1" role="status"></span>{t("yaradilir")}</>
                    ) : (
                      <>
                        <i className="bi bi-plus-circle-fill" style={{ color: "#053796", fontSize: "16px" }}></i>
                        <span>"{customerSearch}" — Yeni müştəri yarat</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Guest Name */}
          <div className="mb-3">
            <label className="form-label">{t("qonaq_adi")}<span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Ad Soyad"
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                if (selectedCustomerId) setSelectedCustomerId(null);
              }}
            />
          </div>

          {/* Guest Phone */}
          <div className="mb-3">
            <label className="form-label">{t("phone")}</label>
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
              <i className="bi bi-card-text" style={{ marginRight: 4 }}></i>{t("sexsiyyet_vesiqesi_/_fi̇n")}</label>
            <input
              type="text"
              className="form-control"
              placeholder={t("aze_aa1234567_ve_ya_fi̇n_kodu")}
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
            />
          </div>

          {/* Room Selection */}
          <div className="mb-3">
            <label className="form-label">{t("room")}<span className="required">*</span>
            </label>
            <select
              className="form-select"
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
            >
              <option value="">{t("otaq_secin")}</option>
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
              <label className="form-label">{t("giris_tarixi")}<span className="required">*</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>
            <div className="col-6">
              <label className="form-label">{t("cixis_tarixi")}<span className="required">*</span>
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
                <span>{formatPrice(roomPrice)} × {nights} gecə</span>
                <span className="rm-price-total">{formatPrice(totalPrice)}</span>
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
              <label className="form-label">{t("boyukler")}</label>
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
              <label className="form-label">{t("usaqlar")}</label>
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
              <i className="bi bi-wallet2" style={{ marginRight: 4 }}></i>{t("odenilen_beh_/_depozit_₼")}</label>
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
            <label className="form-label">{t("qeydler")}</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder={t("elave_qeydler")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="reservation-footer">
          <button className="btn-cancel" onClick={onHide}>{t("cancel")}</button>

          {action === "checkin" ? (
            <button
              className="btn-checkin"
              onClick={() => handleSubmit("checkin")}
              disabled={isCreatingReservation}
            >
              {isCreatingReservation ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>{t("gonderilir")}</>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right"></i>{t("giris_et")}</>
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
                <span className="spinner-border spinner-border-sm" role="status"></span>{t("gonderilir")}</>
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
