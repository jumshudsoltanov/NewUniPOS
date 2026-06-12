import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { fetchRooms, sendBookingWhatsapp, updateFolioBalance } from "../../redux/Slices/HotelSlice";
import { addOrderOptimistic } from "../../redux/Slices/BooksSlice";
import { saleNewOtherOrders } from "../../redux/Slices/SaleSlice";
import { saveLog } from "../../redux/Slices/OrdersSlice";
import { resolveCashierPrintersForPrint } from "../../utils/printerHelpers";
import { t } from "../../utils/translations";
import { formatPrice, getCurrencySymbol } from "../../utils/formatPrice";
import "./RoomFolio.css";

const formatDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const year = dt.getFullYear();
  const hours = String(dt.getHours()).padStart(2, "0");
  const mins = String(dt.getMinutes()).padStart(2, "0");
  return { full: `${day}.${month}.${year} ${hours}:${mins}`, day, month, year, hours, mins };
};

const statusLabels = {
  occupied: "Dolu",
  available: "Boş",
  cleaning: "Təmizlənir",
  maintenance: "Təmirdə",
};

const RoomFolio = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { rooms, isSendingWhatsapp } = useSelector((state) => state.HotelSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);

  const profileId = loginedProfileData?.data?.profile?.id;
  const room = rooms.find((r) => String(r.id) === String(roomId));

  const [depositValue, setDepositValue] = useState("0");
  const [showDepositKeypad, setShowDepositKeypad] = useState(false);
  const [isUpdatingDeposit, setIsUpdatingDeposit] = useState(false);

  useEffect(() => {
    if (profileId && rooms.length === 0) {
      dispatch(fetchRooms(profileId));
    }
  }, [profileId, rooms.length, dispatch]);

  useEffect(() => {
    if (room) {
      const bal = Number(room.folio_balance || 0);
      setDepositValue(bal > 0 ? String(bal) : "0");
    }
  }, [room]);

  const handleBack = useCallback(() => {
    navigate("/tables");
  }, [navigate]);

  if (!room) {
    return (
      <Container fluid className="rf-root p-0">
        <div className="rf-loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">{t("loading")}</span>
          </div>
          <p>{t("otaq_tapilmadi")}</p>
          <button
            className="rf-back-btn"
            onClick={handleBack}
            style={{ background: "rgba(0,0,0,0.08)", color: "#64748b", border: "1px solid #e5e7eb" }}
          >
            <i className="bi bi-arrow-left"></i>
          </button>
        </div>
      </Container>
    );
  }

  const balance = Number(room.folio_balance || 0);
  const statusClass = Object.keys(statusLabels).includes(room.status) ? room.status : "unknown";
  const statusText = statusLabels[room.status] || room.status;

  const checkIn = formatDate(room.check_in);
  const checkOut = formatDate(room.check_out);

  let nights = "";
  if (checkIn && checkOut) {
    const d1 = new Date(room.check_in);
    const d2 = new Date(room.check_out);
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    if (diff > 0) nights = `${diff} gecə`;
  }

  const handleSendWhatsapp = () => {
    if (!room.guest_phone) { toast.error(t("no_phone")); return; }
    if (!room.booking_id) { toast.error(t("no_booking_id")); return; }
    dispatch(sendBookingWhatsapp({ bookingId: room.booking_id, profileId }))
      .unwrap()
      .then(() => toast.success(t("whatsapp_sent")))
      .catch((err) => toast.error(err?.error || "WhatsApp göndərilmədi"));
  };

  const handleDepositNum = (n) => {
    setDepositValue((p) => (p === "0" && n !== "." ? String(n) : n === "." && p.includes(".") ? p : p + String(n)));
  };
  const handleDepositBs = () => setDepositValue((p) => (p.length > 1 ? p.slice(0, -1) : "0"));
  const handleDepositClear = () => setDepositValue("0");

  const handleDepositSave = async () => {
    const val = parseFloat(depositValue) || 0;
    setIsUpdatingDeposit(true);
    try {
      await dispatch(updateFolioBalance({ roomId: room.id, profileId, balance: val })).unwrap();
      toast.success(t("deposit_updated"));
      setShowDepositKeypad(false);
      dispatch(fetchRooms(profileId));
    } catch { toast.error(t("deposit_update_error")); }
    finally { setIsUpdatingDeposit(false); }
  };

  const cashierPrinters = useMemo(() => {
    return resolveCashierPrintersForPrint(loginedProfileData?.data?.printers || []);
  }, [loginedProfileData]);

  const handlePrintReceipt = async () => {
    const printers = cashierPrinters;
    if (!printers.length) { toast.error(t("printer_not_found")); return; }
    if (!window.electronAPI?.printReceipt) { toast.error(t("print_system_unavailable")); return; }

    const d1 = room.check_in ? new Date(room.check_in) : null;
    const d2 = room.check_out ? new Date(room.check_out) : null;
    const nightsVal = d1 && d2 ? Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) : 0;

    const line = (a, b) => `<tr><td style="padding:4px 2px;border-bottom:1px dashed #666;font-size:12px;font-weight:600">${a}</td><td style="padding:4px 2px;border-bottom:1px dashed #666;font-size:12px;font-weight:600;text-align:right">${b}</td></tr>`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{t("receipt")}</title></head><body style="font-family:'Arial',sans-serif;width:300px;margin:0 auto;padding:10px">
  <div style="text-align:center;margin-bottom:12px">
    <div style="font-size:16px;font-weight:700">{t("qebz")}</div>
    <div style="font-size:10px;color:#666">{t("room_receipt")}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    ${line("Otaq", room.room_number || "")}
    ${line("Tip", room.room_type || "—")}
    ${line("Mərtəbə", room.floor ? `${room.floor}. mərtəbə` : "—")}
    ${line("Qonaq", room.guest_name || "—")}
    ${line("Telefon", room.guest_phone || "—")}
  </table>
  ${d1 || d2 ? `<table style="width:100%;border-collapse:collapse;margin-bottom:12px"><tr><td style="padding:4px 2px;font-size:11px;font-weight:700;border-bottom:1px solid #000" colspan="2">{t("dates")}</td></tr>
    ${d1 ? line("Giriş", `${String(d1.getDate()).padStart(2,"0")}.${String(d1.getMonth()+1).padStart(2,"0")}.${d1.getFullYear()}`) : ""}
    ${d2 ? line("Çıxış", `${String(d2.getDate()).padStart(2,"0")}.${String(d2.getMonth()+1).padStart(2,"0")}.${d2.getFullYear()}`) : ""}
    ${nightsVal > 0 ? line("Gecə", `${nightsVal}`) : ""}
  </table>` : ""}
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px"><tr><td style="padding:4px 2px;font-size:11px;font-weight:700;border-bottom:1px solid #000" colspan="2">{t("financial")}</td></tr>
    ${line("Depozit", `${formatPrice(balance)}`)}
  </table>
  <div style="border-top:2px solid #000;margin:8px 0"></div>
  <div style="text-align:center;font-size:10px;color:#999;margin-top:8px">${new Date().toLocaleString("az-AZ")}<br>{t("thanks")}</div>
</body></html>`;

    try {
      for (const printer of printers) {
        const connType = printer.connection_type;
        const isNetwork = connType === "network" || (connType !== "usb" && connType !== "com" && !!printer.ip);
        const hasUsbName = !!(printer.usb_name && printer.usb_name.trim() && printer.usb_name !== "RASTER");
        const ps = {
          paper_size: printer.paper_size || "80", cut_mode: printer.cut_mode || "full",
          sound_notify: printer.sound_notify || 0, cash_drawer: printer.cash_drawer || 0,
          encoding: printer.encoding || "utf8", copies: printer.copies || 1,
          darkness: printer.darkness || 5, trailing_space: printer.trailing_space || 0,
          receipt_header: printer.receipt_header || null, receipt_footer: printer.receipt_footer || null,
          bold_header: printer.bold_header || 0, double_height_header: printer.double_height_header || 0,
          font_family: printer.font_family || "Arial", fast_print: printer.fast_print ? 1 : 0,
          print_logo: printer.print_logo != null ? Number(printer.print_logo) : 1,
          rotate_180: printer.rotate_180 ? 1 : 0,
          usb_name: hasUsbName ? printer.usb_name : null,
          printer_label: printer.local_name || printer.name || "",
        };
        let payload;
        if (isNetwork && printer.ip && !hasUsbName) {
          payload = { html, printerName: "", printerIp: String(printer.ip), printerPort: Number(printer.port) || 9100, printerSettings: ps };
        } else {
          payload = { html, printerName: String(hasUsbName ? printer.usb_name : (printer.local_name || printer.name) || ""), printerSettings: ps };
        }
        await window.electronAPI.printReceipt(payload);
      }
      toast.success(t("qebz_cap_edildi"));
    } catch (err) {
      console.error("Print error:", err);
      toast.error("Çap xətası: " + (err.message || "Bilinməyən xəta"));
    }
  };

  const handlePlaceOrder = useCallback(() => {
    const waiterId = loginedWaiter?.data?.id;
    const terminalId = loginedProfileData?.data?.terminal?.terminal_id;
    const profileIdVal = loginedProfileData?.data?.profile?.id;
    if (!waiterId || !terminalId || !profileIdVal) {
      toast.error(t("i̇stifadeci_melumatlari_tapilmadi"));
      return;
    }

    const generatedUuid = crypto.randomUUID();
    const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

    const optimisticOrder = {
      uuid: generatedUuid,
      id: null,
      waiter_id: waiterId,
      profile_id: profileIdVal,
      terminal_id: terminalId,
      sale_type: "dine_in",
      sale_type_name: "Restoranda",
      guest_count: 1,
      status: 1,
      is_selected: 1,
      orders_items: [],
      room_id: room.id,
      room_number: room.room_number,
      guest_name: room.guest_name,
      folio_balance: room.folio_balance,
      amount: 0,
      total: 0,
      start_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      discount: 0,
      service_value: 0,
      waiter: { id: waiterId, name: waiterName },
    };

    dispatch(addOrderOptimistic(optimisticOrder));
    navigate(`/check/${generatedUuid}?hotel=${room.id}`);

    dispatch(saveLog({
      orderId: generatedUuid,
      action: "Yeni otaq sifarişi yaradıldı",
      waiterName,
      details: `Otaq: ${room.room_number || ""}, Qonaq: ${room.guest_name || "—"}`,
    }));

    (async () => {
      try {
        await dispatch(saleNewOtherOrders({
          waiterId,
          terminalId,
          profileId: profileIdVal,
          sale_type: "dine_in",
          status: 1,
          is_selected: 1,
          uuid: generatedUuid,
        })).unwrap();
      } catch (err) {
        console.error("Hotel order create error:", err);
      }
    })();
  }, [room, loginedWaiter, loginedProfileData, dispatch, navigate]);

  return (
    <Container fluid className="rf-root p-0">
      {/* ────────── HEADER ────────── */}
      <div className="rf-header">
        <div className="rf-header-left">
          <button className="rf-back-btn" onClick={handleBack}>
            <i className="bi bi-arrow-left"></i>
          </button>
          {room.room_type && <span className="rf-room-type-badge">{room.room_type}</span>}
          <span className="rf-room-number-label">Otaq {room.room_number}</span>
          {room.floor ? <span className="rf-room-floor-label"><i className="bi bi-layers me-1"></i>{room.floor}. mərtəbə</span> : null}
        </div>
        <div className="rf-header-right">
          <span className={`rf-status-pill ${statusClass}`}>{statusText}</span>
          <span className="rf-balance-pill">{formatPrice(balance)}</span>
        </div>
      </div>

      {/* ────────── CONTENT ────────── */}
      <div className="rf-content">
        <div className="rf-content-inner">
          <Row className="g-4">

            {/* ════ LEFT COLUMN ════ */}
            <Col md={7} lg={8}>
              <div className="d-flex flex-column" style={{ gap: "20px" }}>

                {/* ── Guest Info ── */}
                <div className="rf-card">
                  <div className="rf-card-header">
                    <i className="bi bi-person-fill"></i>{t("qonaq_melumatlari")}</div>
                  <div className="rf-card-body">
                    <div className="rf-guest-row">
                      <span className="rf-guest-label"><i className="bi bi-person"></i>Ad Soyad</span>
                      <span className="rf-guest-value">{room.guest_name || "—"}</span>
                    </div>
                    <div className="rf-guest-row">
                      <span className="rf-guest-label"><i className="bi bi-telephone"></i>{t("phone")}</span>
                      {room.guest_phone ? (
                        <a href={`tel:${room.guest_phone}`} className="rf-guest-value rf-phone">{room.guest_phone}</a>
                      ) : (
                        <span className="rf-guest-value">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Reservation Dates ── */}
                {(checkIn || checkOut) && (
                  <div className="rf-card">
                    <div className="rf-card-header">
                      <i className="bi bi-calendar3"></i>
                      Rezervasiya
                    </div>
                    <div className="rf-card-body">
                      <div className="rf-date-timeline">
                        <div className="rf-date-box">
                          <div className="rf-date-box-inner">
                            <div className="rf-date-box-label">{t("check_in")}</div>
                            {checkIn ? (
                              <>
                                <div className="rf-date-box-day">{checkIn.day}.{checkIn.month}</div>
                                <div className="rf-date-box-time">{checkIn.hours}:{checkIn.mins}</div>
                              </>
                            ) : (
                              <div className="rf-date-box-day" style={{ color: "#94a3b8" }}>—</div>
                            )}
                          </div>
                        </div>

                        <div className="rf-date-connector">
                          <div className="rf-date-connector-dot"></div>
                          <div className="rf-date-connector-line"></div>
                          <div className="rf-date-connector-line"></div>
                          <div className="rf-date-connector-dot"></div>
                        </div>

                        <div className="rf-date-box">
                          <div className="rf-date-box-inner rf-date-box-out">
                            <div className="rf-date-box-label">{t("check_out")}</div>
                            {checkOut ? (
                              <>
                                <div className="rf-date-box-day">{checkOut.day}.{checkOut.month}</div>
                                <div className="rf-date-box-time">{checkOut.hours}:{checkOut.min}</div>
                              </>
                            ) : (
                              <div className="rf-date-box-day" style={{ color: "#94a3b8" }}>—</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {nights && (
                        <div className="rf-nights-badge">
                          <i className="bi bi-moon-stars"></i>
                          {nights}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Col>

            {/* ════ RIGHT COLUMN ════ */}
            <Col md={5} lg={4}>
              <div className="d-flex flex-column" style={{ gap: "20px" }}>

                {/* ── Finance / Folio ── */}
                <div className="rf-card">
                  <div className="rf-card-header">
                    <i className="bi bi-wallet2"></i>{t("financial")}</div>
                  <div className="rf-card-body">
                    {!showDepositKeypad ? (
                      <>
                        {/* Folio table */}
                        <div className="rf-folio-row">
                          <span className="rf-folio-label">Depozit / Balans</span>
                          <span className={`rf-folio-amount ${balance > 0 ? "success" : balance < 0 ? "danger" : ""}`}>
                            {formatPrice(balance)}
                          </span>
                        </div>

                        <div className="rf-balance-edit-row">
                          <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>Cari balans</span>
                          <span className="rf-balance-current">{formatPrice(balance)}</span>
                        </div>

                        <button
                          className="rf-action-btn outline"
                          onClick={() => { setDepositValue(String(balance > 0 ? balance : "0")); setShowDepositKeypad(true); }}
                        >
                          <i className="bi bi-pencil"></i>{t("balansa_duzelis_et")}</button>
                      </>
                    ) : (
                      /* ── Keypad ── */
                      <div className="rf-keypad">
                        <div className="rf-keypad-screen">{depositValue || "0"} {getCurrencySymbol()}</div>
                        <div className="rf-key-grid">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                            <button key={n} className="rf-key-btn" onClick={() => handleDepositNum(n)}>{n}</button>
                          ))}
                          <button className="rf-key-btn" onClick={() => handleDepositNum(".")}>.</button>
                          <button className="rf-key-btn" onClick={() => handleDepositNum(0)}>0</button>
                          <button className="rf-key-btn danger" onClick={handleDepositBs}><i className="bi bi-backspace"></i></button>
                        </div>
                        <div className="rf-key-actions">
                          <button
                            className="rf-key-btn"
                            style={{ flex: "0 0 auto", padding: "10px 18px", color: "#ef4444", borderColor: "#fca5a5", background: "#fef2f2" }}
                            onClick={handleDepositClear}
                          >
                            <i className="bi bi-trash3"></i>
                          </button>
                          <button
                            className="rf-action-btn outline"
                            style={{ flex: 1, margin: 0 }}
                            onClick={handleDepositSave}
                            disabled={isUpdatingDeposit}
                          >
                            {isUpdatingDeposit ? (
                              <><span className="spinner-border spinner-border-sm"></span>{t("gonderilir_1")}</>
                            ) : (
                              <><i className="bi bi-check2"></i>{t("save")}</>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Actions ── */}
                <div className="rf-card">
                  <div className="rf-card-header">
                    <i className="bi bi-gear"></i>{t("emeliyyatlar")}</div>
                  <div className="rf-card-body">
                    <div className="rf-actions">
                      <button className="rf-action-btn primary" onClick={handlePlaceOrder}>
                        <i className="bi bi-plus-lg"></i>{t("new_order")}</button>
                      <button
                        className="rf-action-btn whatsapp"
                        onClick={handleSendWhatsapp}
                        disabled={isSendingWhatsapp || !room.guest_phone || !room.booking_id}
                      >
                        <i className="bi bi-whatsapp"></i>
                        {isSendingWhatsapp ? "Göndərilir..." : "WhatsApp ilə xatırlat"}
                      </button>
                      <button className="rf-action-btn outline" onClick={handlePrintReceipt}>
                        <i className="bi bi-receipt"></i>{t("qebz_cap_et")}</button>
                      <button className="rf-action-btn checkout">
                        <i className="bi bi-box-arrow-right"></i>{t("cixis_emeliyyati")}</button>
                    </div>
                  </div>
                </div>

                {/* ── Future Actions ── */}
                <div className="rf-future-actions">
                  <button className="rf-action-btn outline" style={{ flex: 1 }} disabled>
                    <i className="bi bi-file-text"></i> Faktura
                  </button>
                  <button className="rf-action-btn outline" style={{ flex: 1 }} disabled>
                    <i className="bi bi-arrows-move"></i>{t("otaq_deyis")}</button>
                </div>
              </div>
            </Col>
          </Row>
        </div>
      </div>
    </Container>
  );
};

export default RoomFolio;
