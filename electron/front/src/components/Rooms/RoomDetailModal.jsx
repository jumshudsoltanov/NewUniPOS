import React, { useState, useEffect } from "react";
import { Modal } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { sendBookingWhatsapp, updateFolioBalance, fetchRooms } from "../../redux/Slices/HotelSlice";
import { t } from "../../utils/translations";
import { formatPrice, getCurrencySymbol } from "../../utils/formatPrice";
import "./RoomDetailModal.css";

const formatDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const year = dt.getFullYear();
  const hours = String(dt.getHours()).padStart(2, "0");
  const mins = String(dt.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${mins}`;
};

const formatDateShort = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
};

const RoomDetailModal = ({ show, onHide, room }) => {
  const dispatch = useDispatch();
  const { isSendingWhatsapp } = useSelector((state) => state.HotelSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);

  const [depositValue, setDepositValue] = useState("0");
  const [showDepositKeypad, setShowDepositKeypad] = useState(false);
  const [isUpdatingDeposit, setIsUpdatingDeposit] = useState(false);

  useEffect(() => {
    if (show && room) {
      const bal = Number(room.folio_balance || 0);
      setDepositValue(bal > 0 ? String(bal) : "0");
      setShowDepositKeypad(false);
    }
  }, [show, room]);

  if (!room) return null;

  const profileId = loginedProfileData?.data?.profile?.id;
  const currentBalance = Number(room.folio_balance || 0);
  const roomType = room.room_type || "";
  const floor = room.floor || "";

  const handleSendWhatsapp = () => {
    if (!room.guest_phone) {
      toast.error(t("qonagin_telefon_nomresi_yoxdur"));
      return;
    }
    if (!room.booking_id) {
      toast.error(t("rezervasiya_id_tapilmadi"));
      return;
    }
    dispatch(sendBookingWhatsapp({ bookingId: room.booking_id, profileId }))
      .unwrap()
      .then(() => toast.success(t("whatsapp_mesaji_gonderildi")))
      .catch((err) => toast.error(err?.error || t("whatsapp_error")));
  };

  const handleDepositNumClick = (num) => {
    setDepositValue((prev) => {
      if (prev === "0" && num !== ".") return String(num);
      if (num === "." && prev.includes(".")) return prev;
      return prev + String(num);
    });
  };

  const handleDepositBackspace = () => {
    setDepositValue((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
  };

  const handleDepositClear = () => setDepositValue("0");

  const handleDepositApply = async () => {
    const val = parseFloat(depositValue) || 0;
    setIsUpdatingDeposit(true);
    try {
      await dispatch(updateFolioBalance({ roomId: room.id, profileId, balance: val })).unwrap();
      toast.success(t("deposit_updated"));
      setShowDepositKeypad(false);
      dispatch(fetchRooms(profileId));
    } catch (err) {
      toast.error(t("deposit_update_error"));
    } finally {
      setIsUpdatingDeposit(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered animation={false} size="md" className="room-detail-modal">
      <div className="rd-modal-content">
        {/* Başlıq */}
        <div className="rd-header">
          <div className="rd-header-left">
            <div className="rd-header-icon">
              <i className="bi bi-building"></i>
            </div>
            <span className="rd-header-title">
              Otaq {room.room_number} — {roomType || "Standard"}
            </span>
          </div>
          <button className="rd-close-btn" onClick={onHide}>
            <i className="bi bi-x-lg" style={{ fontSize: "13px" }}></i>
          </button>
        </div>

        {/* Bədən */}
        <div className="rd-body">
          {/* Status paneli */}
          <div className="rd-status-bar">
            <span className={`rd-status-badge ${room.status}`}>
              {room.status === "occupied" ? "Dolu" : room.status === "available" ? "Boş" : room.status}
            </span>
            {floor ? (
              <span className="rd-floor-badge">
                <i className="bi bi-layers"></i> {floor}. mərtəbə
              </span>
            ) : null}
            {currentBalance > 0 ? (
              <span className="rd-balance-badge">
                <i className="bi bi-coin"></i> {formatPrice(currentBalance)}
              </span>
            ) : (
              <span className="rd-balance-badge rd-balance-zero">
                <i className="bi bi-coin"></i> 0.00 ₼
              </span>
            )}
          </div>

          {/* Qonaq məlumatları */}
          {room.guest_name ? (
            <div className="rd-section">
              <div className="rd-section-title">
                <i className="bi bi-person-fill"></i>{t("qonaq_melumatlari")}</div>
              <div className="rd-info-grid">
                <div className="rd-info-item">
                  <span className="rd-info-label">Ad Soyad</span>
                  <span className="rd-info-value">{room.guest_name}</span>
                </div>
                {room.guest_phone ? (
                  <div className="rd-info-item">
                    <span className="rd-info-label">{t("phone")}</span>
                    <span className="rd-info-value rd-phone">{room.guest_phone}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Giriş / Çıxış */}
          {(room.check_in || room.check_out) ? (
            <div className="rd-section">
              <div className="rd-section-title">
                <i className="bi bi-calendar3"></i>{t("rezervasiya_tarixleri")}</div>
              <div className="rd-date-grid">
                <div className="rd-date-box">
                  <i className="bi bi-box-arrow-in-right"></i>
                  <div className="rd-date-label">{t("check_in")}</div>
                  <div className="rd-date-value">{formatDate(room.check_in)}</div>
                </div>
                <div className="rd-date-arrow">
                  <i className="bi bi-arrow-right"></i>
                </div>
                <div className="rd-date-box rd-date-out">
                  <i className="bi bi-box-arrow-right"></i>
                  <div className="rd-date-label">{t("check_out")}</div>
                  <div className="rd-date-value">{formatDate(room.check_out)}</div>
                </div>
              </div>
              {(() => {
                if (!room.check_in || !room.check_out) return null;
                const d1 = new Date(room.check_in);
                const d2 = new Date(room.check_out);
                const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
                if (diff <= 0) return null;
                return (
                  <div className="rd-nights">
                    <i className="bi bi-moon-stars"></i> {diff} gecə ({formatDateShort(room.check_in)} - {formatDateShort(room.check_out)})
                  </div>
                );
              })()}
            </div>
          ) : null}

          {/* Depozit bölməsi */}
          <div className="rd-section">
            <div className="rd-section-title">
              <i className="bi bi-wallet2"></i>{t("deposit")}</div>

            {!showDepositKeypad ? (
              <>
                <div className="rd-depozit-goster">
                  <span className="rd-depozit-qiymet">{formatPrice(currentBalance)}</span>
                  <button className="rd-depozit-duzelt-btn" onClick={() => { setDepositValue(String(currentBalance > 0 ? currentBalance : "0")); setShowDepositKeypad(true); }}>
                    <i className="bi bi-pencil-fill"></i>{t("edit")}</button>
                </div>
              </>
            ) : (
              <div className="rd-depozit-keypad">
                <div className="rd-depozit-ekran">
                  <span className="rd-depozit-ekran-qiymet">{depositValue || "0"} {getCurrencySymbol()}</span>
                </div>
                <div className="rd-depozit-duymeler">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <button key={n} className="rd-key-btn" onClick={() => handleDepositNumClick(n)}>
                      {n}
                    </button>
                  ))}
                  <button className="rd-key-btn" onClick={() => handleDepositNumClick(".")}>.</button>
                  <button className="rd-key-btn" onClick={() => handleDepositNumClick(0)}>0</button>
                  <button className="rd-key-btn rd-key-sil" onClick={handleDepositBackspace}>
                    <i className="bi bi-backspace"></i>
                  </button>
                </div>
                <div className="rd-depozit-emeliyyat">
                  <button className="rd-depozit-temizle" onClick={handleDepositClear}>
                    <i className="bi bi-trash3"></i>
                  </button>
                  <button className="rd-depozit-yadda-saxla" onClick={handleDepositApply} disabled={isUpdatingDeposit}>
                    {isUpdatingDeposit ? (
                      <><span className="spinner-border spinner-border-sm" role="status"></span>{t("gonderilir_1")}</>
                    ) : (
                      <><i className="bi bi-check2"></i>{t("save")}</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* WhatsApp */}
          <div className="rd-section">
            <div className="rd-section-title">
              <i className="bi bi-whatsapp"></i>{t("whatsapp_bildirisi")}</div>
            <p className="rd-wa-desc">{t("qonaga_rezervasiya_xatirlatma_mesaji_gonder")}</p>
            <button
              className="rd-wa-btn"
              onClick={handleSendWhatsapp}
              disabled={isSendingWhatsapp || !room.guest_phone || !room.booking_id}
            >
              {isSendingWhatsapp ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>{t("gonderilir")}</>
              ) : (
                <>
                  <i className="bi bi-whatsapp"></i>{t("whatsapp_ile_xatirlat")}</>
              )}
            </button>
            {!room.guest_phone ? (
              <span className="rd-wa-hint">{t("qonagin_telefon_nomresi_movcud_deyil")}</span>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default RoomDetailModal;
