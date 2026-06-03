import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Container, Col, Row, Modal } from "react-bootstrap";
import "./Check.css";
import "../Header/Header.css";
import "./HotelCheck.css";
import Menu from "../Menu/Menu";
import CheckHeader from "./CheckHeader";
import CheckMain from "./CheckMain";
import CheckBottom from "./CheckBottom";
import TimerModal from "./TimerModal";
import OperationsModal from "../Operations/OperationsModal";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { SalesTypesModal } from "../SalesTypeModal/SalesTypesModal";
import CheckLockModal from "../Check-Lock/CheckLockModal";
import CommentModal from "../CommentModal/CommentModal";
import ClearCheck from "../ClearCheck/ClearCheck";
import DiscountModal from "../DiscountModal/DiscountModal";
import ServiceFeeModal from "../ServiceFeeModal/ServiceFeeModal";
import DepositModal from "../DepositModal/DepositModal";
import WaitersModal from "../Waiters/WaitersModal";
import { getTableGroups, removeOrderOptimisticFromTables, addOrderToTableOptimistic, clearDeletedOrderId } from "../../redux/Slices/TablesSlice";
import { getActiveOrders, removeOrderOptimistic, tickTimer, addOrderOptimistic, updateOrderOptimisticId, clearDeletedOrderIdBooks } from "../../redux/Slices/BooksSlice";
import OtherChecks from "../OtherChecks/OtherChecks";
import ChangeSaleTypeModal from "../ChangeSaleTypeModal/ChangeSaleTypeModal";
import SplitOrderModal from "../SlpitOrderModa/SplitOrderModal";
import { deleteCheck, splitOrder, saveLog, assignCustomerToOrder, updateDiscountOnOrders, incrementPrintCount, sendOrdersItems, deleteOrderItem, batchDeleteOrderItems, stopTimer, clearOrders, addProducts } from "../../redux/Slices/OrdersSlice";
import { fetchCustomersFromAdmin, fetchCustomerGroupsFromAdmin } from "../../redux/Slices/CustomersSlice";
import { deleteProduct } from "../../redux/Slices/ProductSlice";
import { getNextOrderId, saleNewOrders } from "../../redux/Slices/SaleSlice";
import { printCustomerReceipt, processAndPrintOrders, resolveCashierPrintersForPrint } from "../../utils/printerHelpers.jsx";
import { toast } from "sonner";
import { fetchRooms, sendBookingWhatsapp, updateFolioBalance } from "../../redux/Slices/HotelSlice";
import CheckDeleteModal from "../CheckDeleteModal/CheckDeleteModal";

import OrderLogsModal from "./OrderLogsModal"; // Import Modal
import { getSocket } from "../../utils/apiConfig";
import { isPacksOnlyWaiter } from "../../utils/waiterPermissions";
import CustomersSourceModal from "../Customers-Modal/CustomersSourceModal";
import CourierModal from "../CourierModal/CourierModal";
import { assignCourierToOrder } from "../../redux/Slices/CouriersSlice";
import {
  getEffectiveHourlyPrice,
  getTableHourlyPrice,
  getProductHourlySum,
} from "../../utils/orderHourlyPrice";
import { isOrderEditLocked, orderEditLockedToast } from "../../utils/checkEditLock";
import NotificationSidebar from "../NotificationSidebar/NotificationSidebar";
import ProductModal from "../ProductModal/ProductModal";
import UpdateGuestCountModal from "../Customers-Modal/UpdateGuestCountModal";
import apiConfig from "../../utils/apiConfig";
import { addNotification } from "../../utils/notificationService";
import StatusModal from "../StatusModal/StatusModal";
import { checkShiftGuard } from "../../utils/shiftGuard";
import VirtualKeyboard from "../VirtualKeyboard/VirtualKeyboard";
import { usePrinterDiagnostics } from "../../hooks/usePrinterDiagnostics";

// Cloud API Base URL (Same as Admin)
// Local Backend Sync URL
const LOCAL_SYNC_URL = "/sync";
const KITCHEN_PRINT_BLOCK_SETTING_KEY = "pos_kitchen_print_block";
const KITCHEN_PRINT_ENABLED_KEY = "pos_kitchen_print_enabled";

const readKitchenPrintEnabled = () => {
  try {
    const saved = localStorage.getItem(KITCHEN_PRINT_ENABLED_KEY);
    return saved == null ? true : saved === "true";
  } catch {
    return true;
  }
};

const readKitchenPrintBlockSetting = () => {
  try {
    return localStorage.getItem(KITCHEN_PRINT_BLOCK_SETTING_KEY) === "true";
  } catch {
    return false;
  }
};

import {
  menuWithGeneralCategories,
  menuWithCategories,
  applyProductOrdering,
} from "../../redux/Slices/MenuSlice";

const Check = () => {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const posKeyboardEnabled = useMemo(() => {
    try { return localStorage.getItem("pos_keyboard_enabled") === "1"; } catch { return false; }
  }, []);
  const [activeMobileTab, setActiveMobileTab] = useState("menu");
  const [showOpeationsModal, setShowOperationsModal] = useState(false);

  // Settings toolbar states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDragMode, setIsDragMode] = useState(false);
  const [customOrders, setCustomOrders] = useState({});
  const customOrdersRef = useRef({});
  const [tempCustomOrders, setTempCustomOrders] = useState(null);
  const [lockCheck, setLockCheck] = useState(false);
  const [comment, setComment] = useState(false);
  const [onShowClearModal, setOnShowClearModal] = useState(false);
  const [onShowDiscount, setOnShowDiscount] = useState(false);
  const [onShowServiceFee, setOnShowServiceFee] = useState(false);
  const [onShowDeposit, setOnShowDeposit] = useState(false);
  const [showWaitersModal, setShowWaitersModal] = useState(false);
  const [openACtiveChecks, setOpenActiveChecks] = useState(false);
  const [openChangeSaleType, setOpenChangeSaleType] = useState(false);
  const [openSplitModal, setOpenSplitModal] = useState(false)
  const [isPrintingCheck, setIsPrintingCheck] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { products, menu, categories } = useSelector((state) => state.OrderSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { tableGroups, currentHallId } = useSelector(
    (state) => state.TablesSlice,
    (a, b) => {
      // Skip re-render if only timer fields changed in tableGroups
      if (a.currentHallId !== b.currentHallId) return false;
      if (a.tableGroups === b.tableGroups) return true;
      const ad = a.tableGroups?.data;
      const bd = b.tableGroups?.data;
      if (!ad && !bd) return true;
      if (!ad || !bd || ad.length !== bd.length) return false;
      // Only re-render if non-timer fields changed
      for (let i = 0; i < ad.length; i++) {
        const ah = ad[i], bh = bd[i];
        if (ah.id !== bh.id || ah.tables?.length !== bh.tables?.length) return false;
        if (ah.tables) {
          for (let j = 0; j < ah.tables.length; j++) {
            const at = ah.tables[j], bt = bh.tables[j];
            if (at.id !== bt.id) return false;
            const ao = at.orders?.[0], bo = bt.orders?.[0];
            if (!ao && !bo) continue;
            if (!ao || !bo) return false;
            if (
              ao.uuid !== bo.uuid ||
              ao.id !== bo.id ||
              ao.discount !== bo.discount ||
              ao.discount_value !== bo.discount_value ||
              ao.service_charge !== bo.service_charge ||
              ao.service_value !== bo.service_value ||
              ao.total !== bo.total ||
              ao.amount !== bo.amount ||
              ao.status !== bo.status ||
              ao.is_locked !== bo.is_locked ||
              ao.tags !== bo.tags ||
              ao.orders_items?.length !== bo.orders_items?.length ||
              (ao.print_count || 0) !== (bo.print_count || 0)
            ) return false;
          }
        }
      }
      return true;
    }
  );
  const { books } = useSelector((state) => state.BooksSlice,
    (a, b) => {
      // Skip re-render only if timer-only fields changed (is_timer_clock, rate_per_minute)
      const ab = Array.isArray(a.books) ? a.books : a.books?.data;
      const bb = Array.isArray(b.books) ? b.books : b.books?.data;
      if (!ab && !bb) return true;
      if (!ab || !bb || ab.length !== bb.length) return false;
      for (let i = 0; i < ab.length; i++) {
        const ao = ab[i], bo = bb[i];
        if (
          ao.uuid !== bo.uuid ||
          ao.id !== bo.id ||
          ao.discount !== bo.discount ||
          ao.discount_value !== bo.discount_value ||
          ao.service_charge !== bo.service_charge ||
          ao.service_value !== bo.service_value ||
          ao.total !== bo.total ||
          ao.amount !== bo.amount ||
          ao.status !== bo.status ||
          ao.is_locked !== bo.is_locked ||
          ao.note !== bo.note ||
          ao.tags !== bo.tags ||
          ao.customer_id !== bo.customer_id ||
          ao.courier_id !== bo.courier_id ||
          ao.delivery_fee !== bo.delivery_fee ||
          ao.orders_items?.length !== bo.orders_items?.length ||
          (ao.print_count || 0) !== (bo.print_count || 0) ||
          ao.sale_type !== bo.sale_type ||
          ao.table_id !== bo.table_id ||
          ao.hall_id !== bo.hall_id ||
          ao.waiter_id !== bo.waiter_id
        ) return false;
      }
      return true;
    }
  );
  const { customers } = useSelector((state) => state.CustomersSlice);
  const { menuDataWithGeneralCategories, menuDataWithCategories } = useSelector((state) => state.MenuSlice);

  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get("tableId");

  // ── Hotel mode (detected from ?hotel=roomId search param) ──
  const isHotelMode = searchParams.get("hotel") !== null;
  const hotelRoomId = searchParams.get("hotel");
  const { rooms, isSendingWhatsapp } = useSelector((state) => state.HotelSlice);
  const hotelRoom = useMemo(() => {
    if (!isHotelMode || !hotelRoomId) return null;
    return rooms.find((r) => String(r.id) === hotelRoomId) || null;
  }, [isHotelMode, hotelRoomId, rooms]);

  // Hotel actions state
  const [depositValue, setDepositValue] = useState("0");
  const [showDepositKeypad, setShowDepositKeypad] = useState(false);
  const [isUpdatingDeposit, setIsUpdatingDeposit] = useState(false);

  // Print to kitchen toggle
  const [printToKitchen, setPrintToKitchen] = useState(readKitchenPrintEnabled);
  const [showKitchenPrintToggle, setShowKitchenPrintToggle] = useState(
    readKitchenPrintBlockSetting
  );

  useEffect(() => {
    const handleKitchenPrintBlockChange = (e) => {
      setShowKitchenPrintToggle(e.detail);
    };
    window.addEventListener("kitchenPrintBlockChanged", handleKitchenPrintBlockChange);
    return () => window.removeEventListener("kitchenPrintBlockChanged", handleKitchenPrintBlockChange);
  }, []);

  const handleKitchenPrintToggle = useCallback(() => {
    setPrintToKitchen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(KITCHEN_PRINT_ENABLED_KEY, next ? "true" : "false");
      } catch (error) {
        void error;
      }
      window.dispatchEvent(new CustomEvent("kitchenPrintStateChanged", { detail: next }));
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKitchenPrintStateChange = (event) => {
      if (typeof event.detail === "boolean") {
        setPrintToKitchen(event.detail);
      }
    };
    const handleKitchenPrintStorage = (event) => {
      if (event.key === KITCHEN_PRINT_ENABLED_KEY) {
        setPrintToKitchen(event.newValue == null ? true : event.newValue === "true");
      }
    };

    window.addEventListener("kitchenPrintStateChanged", handleKitchenPrintStateChange);
    window.addEventListener("storage", handleKitchenPrintStorage);
    return () => {
      window.removeEventListener("kitchenPrintStateChanged", handleKitchenPrintStateChange);
      window.removeEventListener("storage", handleKitchenPrintStorage);
    };
  }, []);

  // WhatsApp modal state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waCustomMessage, setWaCustomMessage] = useState("");
  const [waSendMode, setWaSendMode] = useState("now");
  const [waScheduleTime, setWaScheduleTime] = useState("");
  const [waAutoRemind, setWaAutoRemind] = useState(false);
  const [waRemindHours, setWaRemindHours] = useState(2);
  const [waReminderSent, setWaReminderSent] = useState(false);
  const [waReminderType, setWaReminderType] = useState("info");
  const [countdownText, setCountdownText] = useState("");

  const buildDefaultMessage = useCallback((type) => {
    if (!hotelRoom) return "";
    const roomNumber = hotelRoom.room_number || "?";
    const guestName = hotelRoom.guest_name || "qonaq";
    const fmt = (d) => d ? new Date(d).toLocaleString("az-AZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    if (type === "checkout") {
      return [
        `\u{1F514} ÇIXIŞ XATIRLATMASI \u{1F514}`,
        ``,
        `Hörmətli ${guestName},`,
        `Otaq rezervasiyanızın çıxış vaxtı yaxınlaşır:`,
        ``,
        `Otaq: ${roomNumber}`,
        hotelRoom.check_out ? `Çıxış: ${fmt(hotelRoom.check_out)}` : "",
        ``,
        `Zəhmət olmasa vaxtında çıxış etməyinizi xahiş edirik.`,
        `Təşəkkür edirik!`,
      ].filter(Boolean).join("\n");
    }
    return [
      `\u{1F514} OTAQ XATIRLATMASI \u{1F514}`,
      ``,
      `Hörmətli ${guestName},`,
      `Otaq rezervasiyanızın təfərrüatları:`,
      ``,
      `Otaq: ${roomNumber}`,
      hotelRoom.check_in ? `Giriş: ${fmt(hotelRoom.check_in)}` : "",
      hotelRoom.check_out ? `Çıxış: ${fmt(hotelRoom.check_out)}` : "",
      ``,
      `Xoş gəlmisiniz!`,
    ].filter(Boolean).join("\n");
  }, [hotelRoom]);

  useEffect(() => {
    if (isHotelMode && hotelRoom) {
      const bal = Number(hotelRoom.folio_balance || 0);
      setDepositValue(bal > 0 ? String(bal) : "0");
    }
  }, [isHotelMode, hotelRoom]);

  // Fetch rooms if in hotel mode and empty
  useEffect(() => {
    const pid = loginedProfileData?.data?.profile?.id;
    if (isHotelMode && pid && rooms.length === 0) {
      dispatch(fetchRooms(pid));
    }
  }, [isHotelMode, loginedProfileData?.data?.profile?.id, rooms.length, dispatch]);

  // ── Barkod skaner dinləyicisi ──
  const barcodeBufferRef = useRef("");
  const barcodeTimerRef = useRef(null);

  useEffect(() => {
    const barcodeScanEnabled = localStorage.getItem("pos_barcode_scan_enabled") === "true";
    if (!barcodeScanEnabled) return;

    // Bütün məhsulları menu data-dan düz bir yerə yığ
    const allProducts = (menuDataWithCategories?.data || [])
      .flatMap((cat) => cat.products || [])
      .filter((p) => p && p.name);

    const handleKeyDown = (e) => {
      // Input və textarea fokuslanıbsa müdaxilə etmə
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;

      if (e.key === "Enter") {
        const buf = barcodeBufferRef.current.trim();
        if (buf.length > 0) {
          const product = allProducts.find(
            (p) => p.barcode && p.barcode.toString().trim() === buf
          );
          if (product) {
            e.preventDefault();
            dispatch(addProducts(product));
            toast.success(`${product.name} check-ə əlavə edildi`);
          }
        }
        barcodeBufferRef.current = "";
        return;
      }

      // Yalnız çap olunan simvolları yığ
      if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
        if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
        // Skaner sürətli yazır — 100ms-dən gec simvol gəlsə buffer təmizlənir
        barcodeTimerRef.current = setTimeout(() => {
          barcodeBufferRef.current = "";
        }, 100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuDataWithCategories, dispatch]);

  const hotelProfileId = loginedProfileData?.data?.profile?.id;

  const handleHotelOpenWhatsApp = () => {
    if (!hotelRoom) return;
    if (!hotelRoom.guest_phone) { toast.error("Nömrə yoxdur"); return; }
    if (!hotelRoom.booking_id) { toast.error("Rezervasiya ID yoxdur"); return; }
    setWaReminderType("info");
    setWaCustomMessage(buildDefaultMessage("info"));
    setWaSendMode("now");
    setWaScheduleTime("");
    setShowWhatsAppModal(true);
  };

  const handleWASend = () => {
    if (!hotelRoom) return;
    const payload = {
      bookingId: hotelRoom.booking_id,
      profileId: hotelProfileId,
      custom_message: waCustomMessage || undefined,
      reminder_type: waReminderType === "checkout" ? "checkout_reminder" : "info",
    };
    if (waSendMode === "schedule" && waScheduleTime) {
      payload.schedule_time = waScheduleTime;
    }
    dispatch(sendBookingWhatsapp(payload))
      .unwrap()
      .then((res) => {
        if (res?.data?.scheduled) {
          toast.success("WhatsApp təyin edildi");
        } else {
          toast.success("WhatsApp göndərildi");
        }
        setShowWhatsAppModal(false);
      })
      .catch((err) => toast.error(err?.error || "WhatsApp göndərilmədi"));
  };

  const handleSendCheckoutReminder = () => {
    if (!hotelRoom) return;
    dispatch(sendBookingWhatsapp({
      bookingId: hotelRoom.booking_id,
      profileId: hotelProfileId,
      reminder_type: "checkout_reminder",
    }))
      .unwrap()
      .then(() => {
        toast.success("Çıxış xatırlatması göndərildi");
        setWaReminderSent(true);
      })
      .catch((err) => toast.error(err?.error || "Xatırlatma göndərilmədi"));
  };

  // Check-out countdown and auto-reminder interval
  useEffect(() => {
    if (!isHotelMode || !hotelRoom?.check_out) return;
    const updateCountdown = () => {
      const now = new Date();
      const co = new Date(hotelRoom.check_out);
      const diffMs = co - now;
      if (diffMs <= 0) {
        setCountdownText("Çıxış vaxtı keçib");
        return;
      }
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 24) {
        setCountdownText("");
      } else if (hours > 0) {
        setCountdownText(`Çıxışa ${hours} saat ${mins} dəq qaldı`);
      } else {
        setCountdownText(`Çıxışa ${mins} dəq qaldı`);
      }
      // Auto-reminder
      if (waAutoRemind && !waReminderSent && diffMs > 0 && diffMs <= waRemindHours * 60 * 60 * 1000) {
        dispatch(sendBookingWhatsapp({
          bookingId: hotelRoom.booking_id,
          profileId: hotelProfileId,
          reminder_type: "checkout_reminder",
        }))
          .unwrap()
          .then(() => setWaReminderSent(true))
          .catch(() => {});
      }
    };
    updateCountdown();
    const iv = setInterval(updateCountdown, 60000);
    return () => clearInterval(iv);
  }, [isHotelMode, hotelRoom, waAutoRemind, waRemindHours, waReminderSent, hotelProfileId, dispatch]);

  const handleDepositNum = (n) => {
    setDepositValue((p) => (p === "0" && n !== "." ? String(n) : n === "." && p.includes(".") ? p : p + String(n)));
  };
  const handleDepositBs = () => setDepositValue((p) => (p.length > 1 ? p.slice(0, -1) : "0"));
  const handleDepositClear = () => setDepositValue("0");

  const handleDepositSave = async () => {
    if (!hotelRoom) return;
    const val = parseFloat(depositValue) || 0;
    setIsUpdatingDeposit(true);
    try {
      await dispatch(updateFolioBalance({ roomId: hotelRoom.id, profileId: hotelProfileId, balance: val })).unwrap();
      toast.success("Depozit yeniləndi");
      setShowDepositKeypad(false);
      dispatch(fetchRooms(hotelProfileId));
    } catch { toast.error("Depozit yenilənə bilmədi"); }
    finally { setIsUpdatingDeposit(false); }
  };

  const cashierPrinters = useMemo(() => {
    return resolveCashierPrintersForPrint(loginedProfileData?.data?.printers || []);
  }, [loginedProfileData]);
  const configuredPrinters = useMemo(
    () => loginedProfileData?.data?.printers || [],
    [loginedProfileData?.data?.printers],
  );
  const { summary: printerDiagnosticSummary } = usePrinterDiagnostics(configuredPrinters, {
    enabled: configuredPrinters.length > 0,
    intervalMs: 60000,
    timeoutMs: 3500,
  });
  const printerDiagnosticBadgeClass =
    printerDiagnosticSummary.status === "error"
      ? "offline"
      : printerDiagnosticSummary.status === "warning"
        ? "warning"
        : "";
  const printerActionTitle =
    printerDiagnosticSummary.problemCount > 0
      ? `Çap et • ${printerDiagnosticSummary.label}`
      : "Çap et";

  const handleHotelPrintReceipt = async () => {
    if (!hotelRoom) return;
    const printers = cashierPrinters;
    if (!printers.length) { toast.error("Kassa printeri tapılmadı"); return; }
    if (!window.electronAPI?.printReceipt) { toast.error("Çap sistemi mövcud deyil"); return; }

    const d1 = hotelRoom.check_in ? new Date(hotelRoom.check_in) : null;
    const d2 = hotelRoom.check_out ? new Date(hotelRoom.check_out) : null;
    const nights = d1 && d2 ? Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) : 0;
    const bal = Number(hotelRoom.folio_balance || 0);
    const line = (a, b) => `<tr><td style="padding:4px 2px;border-bottom:1px dashed #666;font-size:12px;font-weight:600">${a}</td><td style="padding:4px 2px;border-bottom:1px dashed #666;font-size:12px;font-weight:600;text-align:right">${b}</td></tr>`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Qəbz</title></head><body style="font-family:'Arial',sans-serif;width:300px;margin:0 auto;padding:10px">
  <div style="text-align:center;margin-bottom:12px">
    <div style="font-size:16px;font-weight:700">QƏBZ</div>
    <div style="font-size:10px;color:#666">Otaq Qəbzi</div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    ${line("Otaq", hotelRoom.room_number || "")}
    ${line("Tip", hotelRoom.room_type || "—")}
    ${line("Mərtəbə", hotelRoom.floor ? `${hotelRoom.floor}. mərtəbə` : "—")}
    ${line("Qonaq", hotelRoom.guest_name || "—")}
    ${line("Telefon", hotelRoom.guest_phone || "—")}
  </table>
  ${d1 || d2 ? `<table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <tr><td style="padding:4px 2px;font-size:11px;font-weight:700;border-bottom:1px solid #000" colspan="2">Tarixlər</td></tr>
    ${d1 ? line("Giriş", `${String(d1.getDate()).padStart(2,"0")}.${String(d1.getMonth()+1).padStart(2,"0")}.${d1.getFullYear()}`) : ""}
    ${d2 ? line("Çıxış", `${String(d2.getDate()).padStart(2,"0")}.${String(d2.getMonth()+1).padStart(2,"0")}.${d2.getFullYear()}`) : ""}
    ${nights > 0 ? line("Gecə", `${nights}`) : ""}
  </table>` : ""}
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <tr><td style="padding:4px 2px;font-size:11px;font-weight:700;border-bottom:1px solid #000" colspan="2">Maliyyə</td></tr>
    ${line("Depozit", `${bal.toFixed(2)} ₼`)}
  </table>
  <div style="border-top:2px solid #000;margin:8px 0"></div>
  <div style="text-align:center;font-size:10px;color:#999;margin-top:8px">
    ${new Date().toLocaleString("az-AZ")}<br>
    Təşəkkür edirik!
  </div>
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
          rotate_180: printer.rotate_180 ? 1 : 0, usb_name: hasUsbName ? printer.usb_name : null,
          printer_label: printer.local_name || printer.name || "",
        };
        const payload = isNetwork && printer.ip && !hasUsbName
          ? { html, printerName: "", printerIp: String(printer.ip), printerPort: Number(printer.port) || 9100, printerSettings: ps }
          : { html, printerName: String(hasUsbName ? printer.usb_name : (printer.local_name || printer.name) || ""), printerSettings: ps };
        await window.electronAPI.printReceipt(payload);
      }
      toast.success("Qəbz çap edildi");
    } catch (err) {
      toast.error("Çap xətası: " + (err.message || "Bilinməyən xəta"));
    }
  };

  // Live timer status for sidebar badge (reads directly from Redux, bypasses Check equality filter)
  const liveTimerStatus = useSelector((state) => {
    if (!id) return null;
    const booksData = Array.isArray(state.BooksSlice.books) ? state.BooksSlice.books : state.BooksSlice.books?.data;
    if (booksData) {
      const o = booksData.find(o => o.uuid == id);
      if (o) return { active: o.is_timer_status === 1 || o.is_active_timer === 1 };
    }
    return null;
  });

  useEffect(() => {
    const profileId = loginedProfileData?.data?.profile?.id;
    if (!profileId || !id) return;
    dispatch(menuWithCategories(profileId));
    dispatch(menuWithGeneralCategories(profileId));
  }, [dispatch, loginedProfileData?.data?.profile?.id, id]);

  const [onShowSalesTypeModal, setOnShowSalesTypeModal] = useState(false);
  const newOrderBtnRef = useRef(null);


  const { currentOrder, currentHall, currentTable } = useMemo(() => {
    if (!id)
      return { currentOrder: null, currentHall: null, currentTable: null };

    let foundOrder = null;
    let foundHall = null;
    let foundTable = null;

    // Resolve hall/table from tableGroups (for hall/table metadata only)
    if (tableId && tableId !== "null" && tableId !== "0" && tableGroups?.data) {
      for (const hall of tableGroups.data) {
        const table = hall.tables?.find((t) => t.id == tableId);
        if (table) {
          foundHall = hall;
          foundTable = table;
          break;
        }
      }
    }



    // Priority 1: books (full order data with orders_items)
    const booksList = Array.isArray(books) ? books : (Array.isArray(books?.data) ? books.data : []);
    foundOrder = booksList.find((item) => item.uuid == id) || null;

    if (foundOrder) {
      return {
        currentOrder: foundOrder,
        currentHall: foundHall || foundOrder.table?.hall || null,
        currentTable: foundTable || foundOrder.table || null,
      };
    }

    // Priority 2: tableGroups fallback (no orders_items — minimal data)
    if (foundTable) {
      const orderInTable = foundTable.orders?.find((o) => o.uuid == id);
      if (orderInTable) {
        return {
          currentOrder: orderInTable,
          currentHall: foundHall,
          currentTable: foundTable,
        };
      }
    }

    // Default optimistic fallback to prevent UI breaking or flashing 'Yeni Sifariş' when data is slightly delayed
    if (id && (tableId || searchParams.get("sale_type"))) {
       const initialSaleType = searchParams.get("sale_type") || (tableId ? "dine_in" : null);
       return {
         currentOrder: { uuid: id, sale_type: initialSaleType, is_active_timer: 1, table_id: tableId },
         currentHall: foundHall,
         currentTable: foundTable
       };
    }

    return { currentOrder: null, currentHall: null, currentTable: null };

  }, [id, tableId, tableGroups, books, searchParams]);

  const orderEditLocked = useMemo(
    () => isOrderEditLocked(currentOrder),
    [currentOrder?.is_locked, currentOrder?.uuid],
  );

  /** Taymer tarifi: məhsul saatlığı varsa yalnız o, yoxsa masa (cəmlənmir). */
  const effectiveHourlyPrice = useMemo(() => {
    if (!currentOrder) return Number(currentTable?.hourly_price || 0);
    return getEffectiveHourlyPrice({
      ...currentOrder,
      table: {
        ...(currentOrder.table || {}),
        hourly_price: currentOrder?.table?.hourly_price ?? currentTable?.hourly_price,
      },
    });
  }, [currentOrder, currentTable]);

  /** Sidebar taymer ikonu: yalnız masa saatlığı (məhsul saatlığı olanda gizlənir). */
  const showSidebarTableTimerOnly = useMemo(() => {
    if (!currentOrder) return false;
    if (Number(loginedProfileData?.data?.profile?.is_timer || 0) !== 1) return false;
    const merged = {
      ...currentOrder,
      table: {
        ...(currentOrder.table || {}),
        hourly_price: currentOrder?.table?.hourly_price ?? currentTable?.hourly_price,
      },
    };
    return getTableHourlyPrice(merged) > 0 && getProductHourlySum(merged) === 0;
  }, [currentOrder, currentTable, loginedProfileData]);

  const selectedCustomer = useMemo(() => {
    if (currentOrder?.customer_id) {
      if (customers?.length > 0) {
        const customer = customers.find(c => c.id === currentOrder.customer_id);
        if (customer) return customer;
      }

      const fallbackName = currentOrder?.customer_name || currentOrder?.customerName || currentOrder?.customer?.name;
      if (fallbackName) {
        return {
          id: currentOrder.customer_id,
          name: fallbackName
        };
      }
    }
    return null;
  }, [currentOrder?.customer_id, currentOrder?.customer_name, currentOrder?.customerName, currentOrder?.customer?.name, customers]);

  /* Cari masadakı çeklərin sayı (yalnız bu masada neçə çek var) */
  const activeTableCount = useMemo(() => {
    if (!currentTable?.orders) return 0;
    return currentTable.orders.length;
  }, [currentTable]);

  const [openDeleCheckModal, setOpenDeleteCheckModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false); // Add state
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showCourierModal, setShowCourierModal] = useState(false);
  const [showGuestCountModal, setShowGuestCountModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [showProductModal, setShowProductModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const { pendingDeletions } = useSelector((state) => state.OrderSlice);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const isExitingRef = useRef(false);
  const [hadOrderItems, setHadOrderItems] = useState(false);
  const {
    pendingCount: syncCount,
    lastSyncedDelta: syncedCount,
    showSyncedBadge,
    isOnline,
    hasInternet
  } = useSelector((state) => state.SyncSlice);

  const [showClock, setShowClock] = useState(() => {
    return localStorage.getItem("showHeaderClock") === "true";
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (currentOrder?.orders_items?.length > 0 || pendingDeletions?.length > 0) {
      setHadOrderItems(true);
    }
  }, [currentOrder?.orders_items?.length, pendingDeletions?.length]);

  useEffect(() => {
    if (id) dispatch(clearOrders());
  }, [id, dispatch]);

  const goTables = async (skipRefresh = false, replace = false) => {
    // isNew məhsullar varsa — çıxmadan əvvəl avtomatik göndər (yalnız isExiting deyilsə)
    if (!orderEditLocked && !isExitingRef.current && (products.length > 0 || pendingDeletions.length > 0)) {
      try {
        await handleSendOrders();
      } catch (e) {
        console.error("Auto-send on exit failed:", e);
      }
    }

    const opts = replace ? { replace: true } : undefined;

    // Hotel mode: get rooms instead of tables
    if (isHotelMode) {
      if (!skipRefresh) {
        const profileId = loginedProfileData?.data?.profile?.id;
        if (profileId) dispatch(fetchRooms(profileId));
      }
      navigate("/tables", opts);
      return;
    }

    const isPacksOnly = isPacksOnlyWaiter(loginedWaiter?.data);
    if (isPacksOnly || location.state?.from === "/checks") {
      navigate("/checks", opts);
    } else {
      if (!skipRefresh) {
        const profileId = loginedProfileData?.data?.profile?.id;
        if (profileId) dispatch(getTableGroups(profileId));
      }
      navigate("/tables", opts);
    }
  };

  const handleSendOrders = async (itemComments = {}) => {
    try {
      if (isSendingRef.current) return;
      if (orderEditLocked) {
        toast.error(orderEditLockedToast());
        return;
      }

      const waiterName = loginedWaiter?.data?.name || loginedWaiter?.name || loginedProfileData?.data?.profile?.name || currentOrder?.waiter?.name || "Naməlum";

      const getSaleTypeName = (type, typeName) => {
        if (typeName) return typeName;
        if (type == 1 || type === "takeaway") return "Gəl götür";
        if (type == 2 || type === "delivery") return "Çatdırılma";
        return "Restoranda";
      };
      const displaySaleType = getSaleTypeName(currentOrder?.sale_type, currentOrder?.sale_type_name);

      const getAllPrintersForItem = (item) => {
        const menuRef = menu?.find(m => m.id == (item.product_id || item.itemId || item.id));
        const categoryId = menuRef?.category_id || item.category_id;

        const productPrinters = (menuRef?.printer_details && menuRef.printer_details.length > 0)
          ? menuRef.printer_details
          : (item.printer_details || []);

        let categoryPrinters = [];
        if (productPrinters.length === 0 && categoryId && menuDataWithCategories?.data) {
          for (const genCat of menuDataWithCategories.data) {
            if (genCat.is_general && genCat.categories) {
              const subCat = genCat.categories.find(c => c.id === categoryId);
              if (subCat && subCat.printer_details) categoryPrinters = subCat.printer_details;
            } else if (genCat.id === categoryId && genCat.printer_details) {
              categoryPrinters = genCat.printer_details;
            }
          }
        }

        const printers = productPrinters.length > 0 ? productPrinters : categoryPrinters;
        return { printers, categoryId };
      };

      const hasDeletions = pendingDeletions && pendingDeletions.length > 0;
      const hasNewProducts = products && products.length > 0;

      if (!hasDeletions && !hasNewProducts) {
        return;
      }

      isSendingRef.current = true;
      setIsSending(true);

      if (hasDeletions) {
        // Deduplicate by itemId: sum partial qtys, prefer full delete over partial
        const deduplicatedDeletions = Object.values(
          pendingDeletions.reduce((acc, deletion) => {
            const key = String(deletion.itemId);
            if (!acc[key]) {
              acc[key] = { ...deletion };
            } else {
              if (deletion.type === 'full' || acc[key].type === 'full') {
                acc[key].type = 'full';
                acc[key].qty = undefined;
              } else {
                acc[key].qty = (acc[key].qty || 0) + (deletion.qty || 0);
              }
            }
            return acc;
          }, {})
        );

        // Single batch request — all items deleted in ONE backend transaction
        await dispatch(batchDeleteOrderItems({
          orderId: id,
          items: deduplicatedDeletions.map(d => ({
            itemId: d.itemId,
            qty: d.type === 'partial' ? d.qty : undefined,
            reasonId: d.reasonId,
            name: d.name,
            originalQty: d.originalQty,
            waste: d.waste || false,
            wasteComment: d.wasteComment || "",
            product_id: d.product_id,
            price: d.price,
          })),
          waiterName,
        })).unwrap().catch(err => {
          console.error("Batch Delete Error:", err);
        });

        // Refresh to get definitive server state
        const profileId = loginedProfileData?.data?.profile?.id;
        if (profileId) {
          dispatch(getActiveOrders({ profileId, silentRefresh: true }));
          // Hotel mode: refresh rooms to show updated balance on room card
          if (isHotelMode) {
            dispatch(fetchRooms(profileId));
          }
        }

        const deletedItemsForPrint = pendingDeletions.map(d => {
          const { printers, categoryId } = getAllPrintersForItem(d);
          return {
            ...d,
            printer_details: printers,
            category_id: categoryId,
            changeType: 'decrease',
            quantity: d.type === 'partial' ? d.qty : d.originalQty
          };
        });

        try {
          const orderWaiter = currentOrder?.waiter?.name || currentOrder?.waiter_name || waiterName;
          processAndPrintOrders(
            deletedItemsForPrint,
            {
              table: currentTable?.name || currentOrder?.table_name || "Masa",
              waiter: orderWaiter,
              hallName: currentHall?.name || "",
              orderId: currentOrder?.uuid || id,
              terminalInfo: loginedProfileData?.data?.terminal || {},
              typeName: displaySaleType,
              checkData: currentOrder,
              isDecrease: true,
              profileData: loginedProfileData,
            },
            menuDataWithCategories
          ).catch(printError => console.error("Deletion Printing Error:", printError));
        } catch (printError) {
          console.error("Deletion Printing Setup Error:", printError);
        }
      }

      if (hasNewProducts) {
        const productsWithComments = products.flatMap((p, idx) => {
          const { printers, categoryId } = getAllPrintersForItem(p);
          const commentVal = itemComments[idx] !== undefined ? itemComments[idx] : p.comment;
          const qty = p.count || p.quantity || 1;
          const safePrice = Number.isFinite(parseFloat(p.price)) ? parseFloat(p.price) : 0;
          if (Array.isArray(commentVal) && commentVal.length > 1) {
            return commentVal.map((c, i) => ({
              ...p,
              price: safePrice,
              printer_details: printers,
              category_id: categoryId,
              count: 1,
              quantity: 1,
              comment: c || null
            }));
          }
          const singleComment = Array.isArray(commentVal) ? (commentVal[0] ?? p.comment) : commentVal;
          return [{
            ...p,
            price: safePrice,
            printer_details: printers,
            category_id: categoryId,
            comment: singleComment,
            count: qty,
            quantity: qty,
          }];
        });

        await dispatch(sendOrdersItems({
          orderId: id,
          profileId: loginedProfileData?.data?.profile?.id,
          productList: productsWithComments,
          waiterId: loginedWaiter?.data?.id,
          waiterName
        })).unwrap();

        const profileId = loginedProfileData?.data?.profile?.id;
        if (profileId) {
          dispatch(getActiveOrders({ profileId, silentRefresh: true }));
          // Hotel mode: refresh rooms to show updated balance on room card
          if (isHotelMode) {
            dispatch(fetchRooms(profileId));
          }
        }

        const combinedForPrinting = [...productsWithComments];

        // Scan for modifiers that have their own designated printers or category printers
        const standaloneModifiers = [];
        productsWithComments.forEach(p => {
          if (p.modifiers && Array.isArray(p.modifiers)) {
            p.modifiers.forEach(mod => {
              const hasOwnPrinter = mod.printer_details && mod.printer_details.length > 0;
              const hasCategoryPrinter = !!mod.category_id;
              if (hasOwnPrinter || hasCategoryPrinter) {
                standaloneModifiers.push({
                  ...mod,
                  product_name: mod.name,
                  count: mod.count,
                  quantity: mod.count,
                  isModifierStandalone: true,
                  parentName: p.name
                });
              }
            });
          }
        });

        const orderWaiter = currentOrder?.waiter?.name || currentOrder?.waiter_name || waiterName;
        const printContext = {
          table: currentTable?.name || currentOrder?.table_name || "Masa",
          waiter: orderWaiter,
          hallName: currentHall?.name || "",
          orderId: currentOrder?.uuid || id,
          terminalInfo: loginedProfileData?.data?.terminal || {},
          typeName: displaySaleType,
          checkData: currentOrder,
          isDecrease: false,
          profileData: loginedProfileData,
        };

        // 1. Regular items print (Kitchen/Product)
        if (!showKitchenPrintToggle || printToKitchen) {
          processAndPrintOrders(
            combinedForPrinting,
            printContext,
            menuDataWithCategories
          );

          // 2. Standalone Modifier prints (e.g. Bar/Label)
          if (standaloneModifiers.length > 0) {
            processAndPrintOrders(
              standaloneModifiers,
              printContext,
              menuDataWithCategories
            );
          }
        }
      }

    } catch (e) {
      console.error(e);
      toast.error("Xəta baş verdi");
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  // Hər əməliyyatdan əvvəl isNew məhsullar varsa avtomatik göndər
  const autoSendIfNeeded = async () => {
    if (!orderEditLocked && (products.length > 0 || pendingDeletions.length > 0)) {
      await handleSendOrders();
    }
  };

  async function handleAutoSaveAndExit(targetPath) {
    if (isExitingRef.current || isSendingRef.current) return;
    isExitingRef.current = true;
    const hadPendingProducts = products?.length > 0;
    const hadPendingDeletions = pendingDeletions?.length > 0;
    const resultingItemCount = (currentOrder?.orders_items?.length || 0) - (pendingDeletions?.length || 0) + (products?.length || 0);
    const profileHasTimer = Number(loginedProfileData?.data?.profile?.is_timer || 0) === 1;
    const hasTimerOnTable = effectiveHourlyPrice > 0 && profileHasTimer;
    const isTimerActiveOrHasBalance =
      hasTimerOnTable &&
      (currentOrder?.is_timer_status === 1 ||
        Number(currentOrder?.rate_per_minute || 0) > 0 ||
        (currentOrder?.is_timer_clock && currentOrder?.is_timer_clock !== "00:00:00"));

    if (hadPendingProducts || hadPendingDeletions) {
      await handleSendOrders();
    }

    // Əgər indicə məhsul göndərilibsə, orders_items hələ yenilənməyə bilər (slave race condition).
    // Bu halda silmə — server-də artıq məhsullar var.
    const actualResultingItemCount = hadPendingProducts ? Math.max(resultingItemCount, 1) : resultingItemCount;

    if (!isHotelMode && actualResultingItemCount === 0 && currentOrder?.uuid && !isTimerActiveOrHasBalance) {
      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
      const profileId = loginedProfileData?.data?.profile?.id;
      const isMasterSlaveActive = loginedProfileData?.data?.terminal?.is_master_slave_active === 1 || loginedProfileData?.data?.profile?.is_master_slave_active === 1;
      const orderId = currentOrder.uuid;

      // Master-Slave safety: server-dən yoxla ki, çekdə həqiqətən məhsul yoxdur
      // Race condition qarşısını alır — slave göndərib amma UI hələ yenilənməyib
      const tryDelete = async () => {
        try {
          await dispatch(deleteCheck({
            orderId,
            reason: 0,
            reasonText: "Masa boş olduğu üçün silindi",
            waiterName,
            forceDestroy: !hadOrderItems,
          })).unwrap();

          const socket = getSocket();
          if (socket?.connected) socket.emit("order_deleted", { orderId });
          if (profileId) {
            setTimeout(() => {
              dispatch(clearDeletedOrderId(orderId));
              dispatch(clearDeletedOrderIdBooks(orderId));
              dispatch(getTableGroups(profileId));
              dispatch(getActiveOrders({ profileId, silentRefresh: true }));
            }, 600);
          } else {
            setTimeout(() => {
              dispatch(clearDeletedOrderId(orderId));
              dispatch(clearDeletedOrderIdBooks(orderId));
            }, 5000);
          }
        } catch (error) {
          // Server reject etdi (məs. məhsullar var) — silmə baş tutmadı, UI-ı yenilə
          console.error("Auto-delete error:", error);
          dispatch(clearDeletedOrderId(orderId));
          dispatch(clearDeletedOrderIdBooks(orderId));
          if (profileId) {
            dispatch(getTableGroups(profileId));
            dispatch(getActiveOrders({ profileId, silentRefresh: true }));
          }
        }
      };

      const doNavigate = (showDeletedToast = true) => {
        dispatch(removeOrderOptimisticFromTables(orderId));
        dispatch(removeOrderOptimistic(orderId));
        if (targetPath === -1) goTables(true, true);
        else navigate(targetPath, { replace: true });
        if (showDeletedToast) setTimeout(() => toast.info("Masa boş olduğu üçün silindi"), 0);
      };

      if (isMasterSlaveActive) {
        const socket = getSocket();
        if (socket) {
          socket.emit("check_can_delete", { orderId }, (canDelete) => {
            if (canDelete) {
              doNavigate(true);
              tryDelete();
            } else {
              // Başqa terminal bu masada açıqdır — silmə, sadəcə çıx
              doNavigate(false);
            }
          });
          return;
        }
      }

      doNavigate();
      tryDelete();
      return;
    }

    if (targetPath === -1) {
      goTables();
    } else {
      navigate(targetPath);
    }
  }

  const handleShowOperationsTab = useCallback(() => {
    setShowOperationsModal(true);
  }, []);

  const onHideOperations = useCallback(() => {
    setShowOperationsModal(false);
  }, []);

  const clearCheck = useCallback(() => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }

    const hasOrderItems =
      Array.isArray(currentOrder?.orders_items) &&
      currentOrder.orders_items.length > 0;

    const hasLocalProducts = Array.isArray(products) && products.length > 0;

    if (!hasOrderItems && !hasLocalProducts) {
      setShowOperationsModal(false);
      return;
    }

    setShowOperationsModal(false);
    setOnShowClearModal(true);
  }, [currentOrder, products, orderEditLocked]);

  const openCommentModal = useCallback(() => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }

    setShowOperationsModal(false);
    setComment(true);
  }, [currentOrder, orderEditLocked]);

  const openDiscountModal = useCallback(() => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }

    if (products?.length > 0) {
      toast.info("Endirim etmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }

    setShowOperationsModal(false);
    setOnShowDiscount(true);
  }, [currentOrder, products, orderEditLocked]);

  const openServiceFee = useCallback(() => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }

    if (products?.length > 0) {
      toast.info("Xidmət haqqı əlavə etmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }

    setShowOperationsModal(false);
    setOnShowServiceFee(true);
  }, [currentOrder, products, orderEditLocked]);

  const openDepositModal = useCallback(() => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }

    if (products?.length > 0) {
      toast.info("Depozit əlavə etmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }

    setShowOperationsModal(false);
    setOnShowDeposit(true);
  }, [currentOrder, products, orderEditLocked]);

  const openWaitersModal = useCallback(() => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }

    setShowOperationsModal(false);
    setShowWaitersModal(true);
  }, [currentOrder, orderEditLocked]);

  const openACtiveCheck = useCallback(() => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }

    if (products?.length > 0) {
      toast.info("Çeki birləşdirmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }

    setShowOperationsModal(false);
    setOpenActiveChecks(true);
  }, [currentOrder, products, orderEditLocked]);

  const handleOpenChangeSaleType = useCallback(() => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }

    if (products?.length > 0) {
      toast.info("Satış üsulunu dəyişmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }

    setShowOperationsModal(false);
    setOpenChangeSaleType(true);
  }, [currentOrder, products, orderEditLocked]);

  // ChangeTables
  const handleChangeTable = useCallback(() => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }

    if (products?.length > 0) {
      toast.info("Masanı dəyişmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }

    navigate(`/tables/${currentOrder?.uuid}`);
  }, [navigate, currentOrder, products, orderEditLocked]);




  // Master-Slave: çekə giriş qeyd et — hər iki terminal girə bilər, məhsullar table_updated ilə dinamik yenilənir
  useEffect(() => {
    const isMasterSlaveActive = loginedProfileData?.data?.terminal?.is_master_slave_active === 1 || loginedProfileData?.data?.profile?.is_master_slave_active === 1;
    if (!isMasterSlaveActive || !id) return;

    const socket = getSocket();
    if (!socket) return;

    socket.emit("check_opened", { orderId: id });

    return () => {
      socket.emit("check_closed", { orderId: id });
    };
  }, [id, loginedProfileData]);

  // Listen for order_deleted / order_closed / table_updated from other terminals
  const mountTimeRef = useRef(Date.now());
  useEffect(() => {
    mountTimeRef.current = Date.now();
  }, [id]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const isPacksOnly = isPacksOnlyWaiter(loginedWaiter?.data);
    const postOrderTarget = isPacksOnly ? "/checks" : "/tables";

    const handleOrderDeleted = ({ orderId }) => {
      if (orderId && orderId === id) {
        toast.warning("Bu çek başqa terminal tərəfindən silindi.");
        navigate(postOrderTarget, { replace: true });
      }
    };

    const handleOrderClosed = ({ orderId }) => {
      if (orderId && orderId === id) {
        toast.info("Bu çek başqa terminal tərəfindən bağlandı.");
        navigate(postOrderTarget, { replace: true });
      }
    };

    const handleTableUpdated = ({ orderId: updatedOrderId } = {}) => {
      const profileId = loginedProfileData?.data?.profile?.id;
      if (!profileId) return;
      // Only refresh if this event is for the current order or no orderId specified
      if (updatedOrderId && updatedOrderId !== id) return;
      dispatch(getActiveOrders({ profileId, silentRefresh: true }));
    };

    socket.on("order_deleted", handleOrderDeleted);
    socket.on("order_closed", handleOrderClosed);
    socket.on("table_updated", handleTableUpdated);

    return () => {
      socket.off("order_deleted", handleOrderDeleted);
      socket.off("order_closed", handleOrderClosed);
      socket.off("table_updated", handleTableUpdated);
    };
  }, [id, navigate, loginedProfileData, loginedWaiter?.data, dispatch]);

  useEffect(() => {
    if (
      (!tableId || tableId === "null" || tableId === "0") &&
      id &&
      !books?.data
    ) {
      dispatch(
        getActiveOrders({ profileId: loginedProfileData?.data?.profile?.id }),
      );
    }
    // Customer data is now pre-loaded in App.jsx. 
    // We only trigger if it's somehow missing from state.
    if (!customers || customers.length === 0) {
      dispatch(fetchCustomersFromAdmin());
      dispatch(fetchCustomerGroupsFromAdmin());
    }
  }, [id, tableId, books, dispatch, loginedProfileData?.data?.profile?.id, customers?.length]);

  useEffect(() => {
    const updateCount = () => {
      const all = JSON.parse(localStorage.getItem("pos_notifications") || "[]");
      setNotifCount(all.filter(n => n.status === "new").length);
    };
    updateCount();
    window.addEventListener("newNotification", updateCount);

    const clockInt = setInterval(() => setCurrentTime(new Date()), 2000);

    return () => {
      window.removeEventListener("newNotification", updateCount);
      clearInterval(clockInt);
    };
  }, []);


  const [menuViewMode, setMenuViewMode] = useState("ROOT");
  const [selectedGenCat, setSelectedGenCat] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);



  const formatTime = (date) => {
    return date.toLocaleTimeString("az-AZ", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const handleMenuHome = () => {
    if (searchText) {
      setSearchText("");
      return;
    }

    if (menuViewMode === "PRODUCTS") {
      if (selectedGenCat) {
        setMenuViewMode("CATEGORIES");
        setSelectedCat(null);
      } else {
        setMenuViewMode("ROOT");
        setSelectedGenCat(null);
        setSelectedCat(null);
      }
    } else if (menuViewMode === "CATEGORIES") {
      setMenuViewMode("ROOT");
      setSelectedGenCat(null);
      setSelectedCat(null);
    } else {
      setMenuViewMode("ROOT");
      setSelectedGenCat(null);
      setSelectedCat(null);
    }
  };

  const getMenuBreadcrumbTitle = () => {
    if (searchText) return "Axtarış nəticələri";
    if (menuViewMode === "ROOT") return "Kateqoriyalar";
    if (menuViewMode === "CATEGORIES") return selectedGenCat?.name;
    if (menuViewMode === "PRODUCTS") return selectedCat?.name;
    return "";
  };

  const handleOpenSplitModel = useCallback(() => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }

    if (products?.length > 0) {
      toast.info("Çeki bölmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }

    setShowOperationsModal(false);
    setShowProductModal(false);
    setOpenSplitModal(true);
  }, [currentOrder, products, orderEditLocked]);


  const openHistoryModalFunc = useCallback(() => {
    if (products?.length > 0) {
      toast.info("Əməliyyat tarixçəsinə baxmaq üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }
    setShowHistoryModal(true);
    setShowOperationsModal(false);
  }, [products]);

  const openCustomersModalFunc = useCallback(() => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }
    if (products?.length > 0) {
      toast.info("Müştəri seçmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }
    setShowCustomerModal(true);
    setShowOperationsModal(false);
  }, [products, orderEditLocked, currentOrder, loginedWaiter]);

  const openGuestCountModalFunc = useCallback(() => {
    if (products?.length > 0) {
      toast.info("Qonaq sayını dəyişmək üçün əvvəlcə gözləyən məhsulları 'Göndər' düyməsi ilə təsdiqləyin.");
      return;
    }
    setShowGuestCountModal(true);
    setShowOperationsModal(false);
  }, [products]);

  const handleSplitOrder = useCallback(async (splitData) => {
    const hallServiceFee = tableGroups?.data?.find((item) => { return item?.id == splitData?.table?.hall_id })
    try {
      await autoSendIfNeeded();
      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
      // Enrich items with product names for logging
      const itemsWithNames = (splitData.items || []).map(item => {
        const orderItem = currentOrder?.orders_items?.find(oi => String(oi.product_id) === String(item.id));
        const name = orderItem?.product?.name || orderItem?.product_name || orderItem?.name || null;
        return { ...item, name };
      });
      const result = await dispatch(
        splitOrder({
          data: { ...splitData, items: itemsWithNames },
          profileId: loginedProfileData?.data?.profile?.id,
          profile: loginedProfileData?.data?.profile,
          hallData: hallServiceFee,
          waiterName
        })
      ).unwrap();

      setOpenSplitModal(false);

      if (result?.data?.newOrder?.uuid) {
        const profileId = loginedProfileData?.data?.profile?.id;
        dispatch(getTableGroups(profileId));
        dispatch(getActiveOrders({ profileId, silentRefresh: true }));

        if (result.data.newOrder.sale_type === 'dine_in') {
          navigate(`/check/${result.data.newOrder.uuid}?tableId=${result.data.newOrder.table_id || 0}`);
        } else {
          navigate(`/check/${result.data.newOrder.uuid}`);
        }
      }

    } catch (error) {
      console.error("Split order error:", error);
    }
  }, [dispatch, loginedProfileData, tableGroups, navigate]);

  const handleDeleteCheckModal = useCallback(() => {
    if (orderEditLocked) {
      toast.error(orderEditLockedToast());
      return;
    }

    setShowOperationsModal(false);
    setOpenDeleteCheckModal(true);
  }, [currentOrder, orderEditLocked]);


  const handleDeleteCheckFunction = async ({ reason, reasonName, orderId, waste, wasteComment }) => {
    const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
    const profileId = loginedProfileData?.data?.profile?.id;

    // Auto-stop timer if active when deleting check
    if (currentOrder?.is_timer_status === 1) {
      let seconds = 0;
      if (currentOrder.is_timer_clock && String(currentOrder.is_timer_clock).includes(':')) {
        const p = currentOrder.is_timer_clock.split(':').map(Number);
        if (p.length === 3) seconds = p[0] * 3600 + p[1] * 60 + p[2];
      }
      dispatch(stopTimer({ 
        orderId: currentOrder.uuid,
        elapsedSeconds: seconds,
        clockStr: currentOrder.is_timer_clock 
      }));
    }

   console.log(loginedProfileData)

    // 1. Instant navigation + optimistic state removal (UI instantly shows table as empty)
    const isPacksOnly = isPacksOnlyWaiter(loginedWaiter?.data);
    // Hotel mode: localStorage UUID-ni təmizlə ki, otağa təkrar girəndə silinmiş çek açılmasın
    if (isHotelMode && hotelRoomId) {
      localStorage.removeItem(`hotel_room_order_${hotelRoomId}`);
    }
    navigate(isPacksOnly ? "/checks" : "/tables", { replace: true });
    dispatch(removeOrderOptimisticFromTables(orderId));
    dispatch(removeOrderOptimistic(orderId));
    toast.success("Çek silindi");

    // 2. Background execution block
    const performBackgroundDeletion = async () => {
      // a. Kitchen Print + API delete run in PARALLEL
      const printPromise = (async () => {
        if (currentOrder?.orders_items && currentOrder.orders_items.length > 0) {
          const itemsToPrint = currentOrder.orders_items.map(item => {
            const menuRef = menu?.find(m => m.id == (item.product_id || item.id));
            return {
              ...item,
              name: menuRef?.name || item.product?.name || item.name || "Məhsul",
              quantity: Number(item.count || item.quantity || 0),
              printer_details: menuRef?.printer_details || item.printer_details || [],
              category_id: menuRef?.category_id || item.category_id,
              changeType: 'decrease'
            };
          });

          const menuDataWithCategoriesObj = { data: menu || [], categories: categories || [] };

          const getSaleTypeNameTemp = (type, typeName) => {
            if (typeName) return typeName;
            if (type == 1 || type === "takeaway") return "Gəl götür";
            if (type == 2 || type === "delivery") return "Çatdırılma";
            return "Restoranda";
          };

          try {
            const orderWaiter = currentOrder?.waiter?.name || currentOrder?.waiter_name || waiterName;
            await processAndPrintOrders(
              itemsToPrint,
              {
                table: currentOrder?.table_name || currentTable?.name || "Masa",
                waiter: orderWaiter,
                hallName: currentHall?.name || "",
                orderId: currentOrder?.uuid,
                terminalInfo: loginedProfileData?.data?.terminal || {},
                typeName: getSaleTypeNameTemp(currentOrder?.sale_type, currentOrder?.sale_type_name),
                checkData: currentOrder,
                isDecrease: true,
                profileData: loginedProfileData,
              },
              menuDataWithCategories || menuDataWithCategoriesObj
            );
          } catch (printErr) {
            console.error("Delete Check Printing Error:", printErr);
          }
        }
      })();

      const deletePromise = (async () => {
        try {
          await dispatch(deleteCheck({ orderId, reason, reasonText: reasonName, waiterName, waste: waste || false, wasteComment: wasteComment || "" })).unwrap();
          // Notify all other terminals to redirect if they have this order open
          const socket = getSocket();
          if (socket?.connected) {
            socket.emit("order_deleted", { orderId });
          }
          // Skip immediate getTableGroups — optimistic removal already cleared the UI.
          // A delayed refresh ensures the DB commit is fully processed before re-fetching,
          // preventing the table from briefly flashing back to "occupied".
          if (profileId) {
            setTimeout(() => {
              dispatch(clearDeletedOrderId(orderId));
              dispatch(clearDeletedOrderIdBooks(orderId));
              dispatch(getTableGroups(profileId));
              dispatch(getActiveOrders({ profileId, silentRefresh: true }));
            }, 600);
          } else {
            setTimeout(() => {
              dispatch(clearDeletedOrderId(orderId));
              dispatch(clearDeletedOrderIdBooks(orderId));
            }, 5000);
          }
        } catch (error) {
          console.error("Delayed Delete Error:", error);
          toast.error("Silinmə zamanı xəta baş verdi");
        }
      })();

      await Promise.all([printPromise, deletePromise]);
    };

    // Execute background logic without awaiting
    performBackgroundDeletion();
  }

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;

    const toastId = toast.loading("Məhsul silinir...");
    try {
      const profileId = loginedProfileData?.data?.profile?.id;
      await dispatch(deleteProduct({ id: productToDelete.id, profile_id: profileId })).unwrap();

      toast.dismiss(toastId);
      addNotification("Məhsul Silindi", `"${productToDelete.name}" məhsulu menyudan silindi.`, { category: "info" });
      toast.success("Məhsul silindi!");
      setShowDeleteConfirm(false);
      setProductToDelete(null);
    } catch (error) {
      toast.dismiss(toastId);
      console.error(error);
      toast.error("Silinmə zamanı xəta baş verdi");
    }
  };


  const categoryOrderMemo = useMemo(() => {
    if (menuViewMode === "ROOT") return customOrders["ROOT"] || [];
    if (menuViewMode === "CATEGORIES" && selectedGenCat) return customOrders[`GEN_${selectedGenCat.id}`] || [];
    if (menuViewMode === "PRODUCTS" && selectedCat) return customOrders[`CAT_${selectedCat.id}`] || [];
    return [];
  }, [menuViewMode, customOrders, selectedGenCat, selectedCat]);

  const handleCategoryOrderChange = useCallback((newOrder) => {
    let key = null;
    if (menuViewMode === "ROOT") key = "ROOT";
    else if (menuViewMode === "CATEGORIES" && selectedGenCat) key = `GEN_${selectedGenCat.id}`;
    else if (menuViewMode === "PRODUCTS" && selectedCat) key = `CAT_${selectedCat.id}`;

    if (key) {
      const updated = { ...customOrdersRef.current, [key]: newOrder };
      customOrdersRef.current = updated;
      setCustomOrders(updated);
    }
  }, [menuViewMode, selectedGenCat, selectedCat]);



  const handleEditProductMemo = useCallback((product) => {
    setProductToEdit(product);
    setShowProductModal(true);
  }, []);

  const handleDeleteItemMemo = useCallback((product) => {
    setProductToDelete(product);
    setShowDeleteConfirm(true);
  }, []);

  const isMobile = window.innerWidth < 992;

  return (
    <Container fluid className={`p-0 overflow-hidden ${isMobile || isHotelMode ? "d-flex flex-column" : ""} ${isMobile ? "vh-100" : "h-100"}`}>
      <Row className={`g-0 ${isMobile || isHotelMode ? "flex-grow-1" : "h-100"}`} style={isHotelMode ? { minHeight: 0 } : undefined}>
        <Col
          md={12}
          lg={5}
          xl={4}
          xxl={4}
          className={`h-100 ${activeMobileTab !== "check" ? "d-none d-lg-block" : ""}`}
        >
          <div className="check-container h-100 d-flex mobile-content-adjust">
            {/* Sidebar */}
            <div
              className={`check-sidebar flex-column justify-content-between align-items-center ${isSidebarOpen ? "d-flex" : "d-none d-lg-flex"}`}
            >
              <div className="sidebar-top d-flex flex-column align-items-center gap-4">
                <div className="checkBackBtn" onClick={() => handleAutoSaveAndExit(-1)}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="M5.94168 15.2584H12.6083C14.9083 15.2584 16.775 13.3917 16.775 11.0917C16.775 8.79172 14.9083 6.92505 12.6083 6.92505H3.44168"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeMiterlimit="10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M5.35834 9.00837L3.22501 6.87503L5.35834 4.7417"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {Number(loginedWaiter?.data?.can_view_customers) === 1 && Number(loginedWaiter?.data?.can_see_shortcuts) === 1 && (
                  <div className="sidebar-icon"
                    onClick={() => openCustomersModalFunc()}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                        stroke={selectedCustomer ? "#053796" : "#343434"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22"
                        stroke={selectedCustomer ? "#053796" : "#343434"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {selectedCustomer && (
                      <span className="icon-badge" style={{ background: '#053796', fontSize: '7px', width: '14px', height: '14px' }}>✓</span>
                    )}
                  </div>
                )}

                {import.meta.env.DEV && (
                  <div className="sidebar-icon"
                    onClick={() => setShowCourierModal(true)}
                    style={{ cursor: 'pointer' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={currentOrder?.courier_id ? "#053796" : "#343434"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 3H1v13h15V3z"/>
                      <path d="M16 8h4l3 3v5h-7V8z"/>
                      <circle cx="5.5" cy="18.5" r="2.5"/>
                      <circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                    {currentOrder?.courier_id && (
                      <span className="icon-badge" style={{ background: '#053796', fontSize: '7px', width: '14px', height: '14px' }}>✓</span>
                    )}
                  </div>
                )}

                {showSidebarTableTimerOnly && (
                  <div
                    className="sidebar-icon timer-button"
                    onClick={() => setShowTimerModal(true)}
                    style={{ background: '#053796' }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      {/* Alarm Clock (Budlink) SVG */}
                      <circle 
                        cx="12" cy="13" r="8" 
                        stroke="#ffffff" 
                        strokeWidth="1.5" 
                      />
                      <path 
                        d="M12 10V13L14 15" 
                        stroke="#ffffff" 
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                      />
                      <path 
                        d="M5 3L8 6" 
                        stroke="#ffffff" 
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                      />
                      <path 
                        d="M19 3L16 6" 
                        stroke="#ffffff" 
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                      />
                    </svg>
                    <span 
                      className="icon-badge" 
                      style={{ 
                        background: (liveTimerStatus?.active || currentOrder?.is_active_timer) ? '#10b981' : '#ef4444', 
                        border: '2px solid #053796', 
                        width: '10px', 
                        height: '10px', 
                        minWidth: '10px' 
                      }}
                    ></span>
                  </div>
                )}

                {Number(loginedWaiter?.data?.can_add_discount) === 1 && Number(loginedWaiter?.data?.can_see_shortcuts) === 1 && (
                  <div className="sidebar-icon discount" onClick={() => {
                    if (orderEditLocked) {
                      toast.error(orderEditLockedToast());
                      return;
                    }
                    setOnShowDiscount(true);
                  }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M19.5 12.5C19.5 11.12 20.62 10 22 10V9C22 5 21 4 17 4H7C3 4 2 5 2 9V9.5C3.38 9.5 4.5 10.62 4.5 12C4.5 13.38 3.38 14.5 2 14.5V15C2 19 3 20 7 20H17C21 20 22 19 22 15C20.62 15 19.5 13.88 19.5 12.5Z"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 14.75L15 8.75"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14.9945 14.75H15.0035"
                        stroke="#343434"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8.99451 9.25H9.00349"
                        stroke="#343434"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}

                {Number(loginedWaiter?.data?.can_edit_service_fee) === 1 && Number(loginedWaiter?.data?.can_see_shortcuts) === 1 && (
                  <div className="sidebar-icon service_fee" onClick={() => {
                    if (orderEditLocked) {
                      toast.error(orderEditLockedToast());
                      return;
                    }
                    setOnShowServiceFee(true);
                  }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M18.97 22H4.97C1.97 22 1.97 20.65 1.97 19V18C1.97 17.45 2.42 17 2.97 17H20.97C21.52 17 21.97 17.45 21.97 18V19C21.97 20.65 21.97 22 18.97 22Z"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M20.72 13V17H3.26999V13C3.26999 9.16 5.97999 5.95 9.58999 5.18C10.13 5.06 10.69 5 11.27 5H12.72C13.3 5 13.87 5.06 14.41 5.18C18.02 5.96 20.72 9.16 20.72 13Z"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14.5 4.5C14.5 4.74 14.47 4.96 14.41 5.18C13.87 5.06 13.3 5 12.72 5H11.27C10.69 5 10.13 5.06 9.59 5.18C9.53 4.96 9.5 4.74 9.5 4.5C9.5 3.12 10.62 2 12 2C13.38 2 14.5 3.12 14.5 4.5Z"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M15 11H9"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}

                {Number(loginedWaiter?.data?.can_add_check_comment) === 1 && Number(loginedWaiter?.data?.can_see_shortcuts) === 1 && (
                  <div
                    className="sidebar-icon comment-button"
                    onClick={() => {
                      if (orderEditLocked) {
                        toast.error(orderEditLockedToast());
                        return;
                      }
                      setComment(true);
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M8.5 19H8C4 19 2 18 2 13V8C2 4 4 2 8 2H16C20 2 22 4 22 8V13C22 17 20 19 16 19H15.5C15.19 19 14.89 19.15 14.7 19.4L13.2 21.4C12.54 22.28 11.46 22.28 10.8 21.4L9.3 19.4C9.14 19.18 8.77 19 8.5 19Z"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeMiterlimit="10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M15.9965 11H16.0054"
                        stroke="#343434"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M11.9955 11H12.0045"
                        stroke="#343434"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M7.99451 11H8.00349"
                        stroke="#343434"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
                {Number(loginedWaiter?.data?.can_view_logs) === 1 && (
                  <div
                    className={`sidebar-icon history ${showHistoryModal ? 'active-sidebar-icon' : ''}`}
                    onClick={() => setShowHistoryModal(true)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                )}

                {/* Mətbəxə çap toggle */}
                {showKitchenPrintToggle && (
                  <div
                    className="sidebar-icon"
                    onClick={handleKitchenPrintToggle}
                    title={printToKitchen ? "Mətbəxə çap AKTİV (üzərinə klikləyib bloka sala bilərsiniz)" : "Mətbəxə çap BLOKLANIB (üzərinə klikləyib aça bilərsiniz)"}
                  >
                    {/* Kitchen/pot icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#343434" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    {/* Status badge when blocked */}
                    {!printToKitchen && (
                      <span
                        className="icon-badge"
                        style={{
                          background: '#ef4444',
                          width: '14px',
                          height: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: 'bold',
                        }}
                      >!</span>
                    )}
                  </div>
                )}

              </div>

              <div className="sidebar-bottom d-flex flex-column align-items-center gap-4">


                {Number(loginedWaiter?.data?.can_lock_check) === 1 && (
                  <div
                    className="sidebar-icon check-lock"
                    onClick={() => setLockCheck(true)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M6 10V8C6 4.69 7 2 12 2C17 2 18 4.69 18 8V10"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 18.5C13.3807 18.5 14.5 17.3807 14.5 16C14.5 14.6193 13.3807 13.5 12 13.5C10.6193 13.5 9.5 14.6193 9.5 16C9.5 17.3807 10.6193 18.5 12 18.5Z"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M17 22H7C3 22 2 21 2 17V15C2 11 3 10 7 10H17C21 10 22 11 22 15V17C22 21 21 22 17 22Z"
                        stroke="#343434"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}

                {Number(loginedWaiter?.data?.can_print_before_close) === 1 && (
                  <div
                    className={`sidebar-icon position-relative ${isPrintingCheck ? "disabled" : ""}`}
                    title={printerActionTitle}
                    onClick={async () => {
                      if (isDragMode || isPrintingCheck) return;
                      if (orderEditLocked) {
                        toast.error(orderEditLockedToast());
                        return;
                      }

                      if (currentOrder?.uuid) {
                        setIsPrintingCheck(true);
                        const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

                        // Auto-stop timer when printing customer receipt
                        if (currentOrder?.is_timer_status === 1) {
                          let seconds = 0;
                          if (currentOrder.is_timer_clock && String(currentOrder.is_timer_clock).includes(':')) {
                            const p = currentOrder.is_timer_clock.split(':').map(Number);
                            if (p.length === 3) seconds = p[0] * 3600 + p[1] * 60 + p[2];
                          }
                          dispatch(stopTimer({ 
                            orderId: currentOrder.uuid,
                            elapsedSeconds: seconds,
                            clockStr: currentOrder.is_timer_clock 
                          }));
                        }

                        try {
                          // isNew məhsullar varsa — əvvəl göndər tələb et, çap etmə
                          if ((products.length > 0 || pendingDeletions.length > 0) && !orderEditLocked) {
                            toast.warning("Əvvəlcə məhsulları çap üçün göndərin (\"Göndər\" düyməsi).");
                            setIsPrintingCheck(false);
                            return;
                          }
                          const orderWaiter = currentOrder?.waiter?.name || currentOrder?.waiter_name || waiterName;
                          const result = await printCustomerReceipt({
                            items: currentOrder?.orders_items || [],
                            checkData: {
                              ...currentOrder,
                              orderId: currentOrder?.id,
                              startDate: currentOrder?.start_date,
                              endDate: currentOrder?.end_date,
                              customer_name: selectedCustomer?.name || currentOrder?.customer_name || "",
                              customer_phone: selectedCustomer?.phone || currentOrder?.customer_phone || currentOrder?.customer?.phone || "",
                              customer_address: selectedCustomer?.address || currentOrder?.customer_address || currentOrder?.customer?.address || "",
                              waiter_name: orderWaiter,
                              waiter: orderWaiter ? { name: orderWaiter } : currentOrder?.waiter
                            },
                            tableName: currentTable?.name,
                            hallName: currentHall?.name,
                            waiterName,
                            menuCatalog: menu,
                          }, loginedProfileData, { dispatch, loginedWaiter, autoLockCheckAfterPrint: true });

                          if (result.success) {
                            toast.success("Ön çap uğurla tamamlandı");
                            const profileId = loginedProfileData?.data?.profile?.id;
                            dispatch(incrementPrintCount({ orderId: currentOrder.uuid, waiterName }));
                            dispatch(getActiveOrders({ profileId, silentRefresh: true }));
                            if (tableGroups?.data) dispatch(getTableGroups(profileId));
                          }
                        } catch (error) {
                          console.error("Print Check Error:", error);
                        } finally {
                          setIsPrintingCheck(false);
                        }
                      }
                    }}
                  >
                    {isPrintingCheck ? (
                      <div className="spinner-border spinner-border-sm text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M7.25 7H16.75V5C16.75 3 16 2 13.75 2H10.25C8 2 7.25 3 7.25 5V7Z"
                          fill="#EBF2FE"
                          stroke="#343434"
                          strokeWidth="1.5"
                          strokeMiterlimit="10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M16 15V19C16 21 15 22 13 22H11C9 22 8 21 8 19V15H16Z"
                          fill="#EBF2FE"
                          stroke="#343434"
                          strokeWidth="1.5"
                          strokeMiterlimit="10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M21 10V15C21 17 20 18 18 18H16V15H8V18H6C4 18 3 17 3 15V10C3 8 4 7 6 7H18C20 7 21 8 21 10Z"
                          fill="#EBF2FE"
                          stroke="#343434"
                          strokeWidth="1.5"
                          strokeMiterlimit="10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M17 15H15.79H7"
                          stroke="#343434"
                          strokeWidth="1.5"
                          strokeMiterlimit="10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M7 11H10"
                          stroke="#343434"
                          strokeWidth="1.5"
                          strokeMiterlimit="10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                    {!isPrintingCheck && (
                      <span className="icon-badge">{currentOrder?.print_count || 0}</span>
                    )}
                    {!isPrintingCheck && printerDiagnosticSummary.problemCount > 0 && (
                      <span className={`printer-health-badge printer-health-badge--${printerDiagnosticBadgeClass}`}>!</span>
                    )}
                  </div>
                )}

                <div
                  className="sidebar-icon operations"
                  onClick={handleShowOperationsTab}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M5 10C3.9 10 3 10.9 3 12C3 13.1 3.9 14 5 14C6.1 14 7 13.1 7 12C7 10.9 6.1 10 5 10Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M19 10C17.9 10 17 10.9 17 12C17 13.1 17.9 14 19 14C20.1 14 21 13.1 21 12C21 10.9 20.1 10 19 10Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>

              </div>
            </div>

            {/* Main Content of Check */}
            <div
              className="check-content flex-grow-1 d-flex flex-column h-100 position-relative"
              style={{ backgroundColor: "#EBF2FE" }}
            >
              <CheckHeader
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                orders={currentOrder}
                table={currentTable}
                hall={currentHall}
                selectedCustomer={selectedCustomer}
                activeTableCount={activeTableCount}
                onBeforeCreateOrder={autoSendIfNeeded}
                isHotelMode={isHotelMode}
                hotelRoom={hotelRoom}
              />

              <CheckMain orders={currentOrder} table={currentTable} />
              <CheckBottom orders={currentOrder} table={currentTable} hall={currentHall} selectedCustomer={selectedCustomer} handleSendOrders={handleSendOrders} isSending={isSending} clearCheck={clearCheck} />
              <TimerModal show={showTimerModal} onHide={() => setShowTimerModal(false)} order={currentOrder} table={currentTable} />
            </div>
          </div>
        </Col>

        {/* Menu Section */}
        <Col
          md={12}
          lg={7}
          xl={8}
          xxl={8}
          className={`h-100 bg-light ${activeMobileTab !== "menu" ? "d-none d-lg-block" : ""}`}
        >
          <div className="checkRightBox h-100 d-flex flex-column bg-light mobile-content-adjust">
            {/* Top Info Bar (Dark Blue) */}
            <div className="right-top-header right-tools-container d-none d-md-flex justify-content-end align-items-center">
              {Number(loginedWaiter?.data?.can_create_order) === 1 && (
                <>
                  <div className="tools-divider"></div>
                  <button
                    ref={newOrderBtnRef}
                    className="create-order-btn small-btn"
                    onClick={async () => {
                      if (products.length > 0 || pendingDeletions.length > 0) {
                        toast.warning("Əvvəlcə mövcud məhsulları göndərin (\"Göndər\" düyməsi), sonra yeni sifariş yaradın.");
                        return;
                      }
                      const guard = await checkShiftGuard(loginedProfileData);
                      if (guard.blocked) {
                        toast.error(guard.reason || "Növbə açılmayıb. Əvvəlcə növbəni açın.");
                        return;
                      }
                      setOnShowSalesTypeModal(true);
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 5V19M5 12H19"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="d-none d-xl-inline">Yeni sifariş</span>
                  </button>
                </>
              )}

              {Number(loginedWaiter?.data?.can_view_archived_checks) === 1 && (
                <>
                  <div className="tools-divider"></div>
                  {/* Checks */}
                  <div
                    className="header-action-item small-item"
                    style={{ cursor: "pointer" }}
                    onClick={async () => {
                      if (!orderEditLocked && (products.length > 0 || pendingDeletions.length > 0)) {
                        try { await handleSendOrders(); } catch (e) { console.error(e); }
                      }
                      navigate("/checks");
                    }}
                  >
                    <span className="d-none d-xl-inline">Çeklər</span>
                    <svg
                      className="d-xl-none"
                      width="22"
                      height="22"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M1.92.506a.5.5 0 0 1 .434.14L3 1.293l.646-.647a.5.5 0 0 1 .708 0L5 1.293l.646-.647a.5.5 0 0 1 .708 0L7 1.293l.646-.647a.5.5 0 0 1 .708 0L9 1.293l.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .801.13l.5 1A.5.5 0 0 1 15 2v12a.5.5 0 0 1-.053.224l-.5 1a.5.5 0 0 1-.8.13L13 14.707l-.646.647a.5.5 0 0 1-.708 0L11 14.707l-.646.647a.5.5 0 0 1-.708 0L9 14.707l-.646.647a.5.5 0 0 1-.708 0L7 14.707l-.646.647a.5.5 0 0 1-.708 0L5 14.707l-.646.647a.5.5 0 0 1-.708 0L3 14.707l-.646.647a.5.5 0 0 1-.801-.13l-.5-1A.5.5 0 0 1 1 14V2a.5.5 0 0 1 .053-.224l.5-1a.5.5 0 0 1 .367-.27zm.217 1.338L2 2.118v11.764l.137.274.51-.51a.5.5 0 0 1 .707 0l.646.647.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.509.509.137-.274V2.118l-.137-.274-.51.51a.5.5 0 0 1-.707 0L12 1.707l-.646.647a.5.5 0 0 1-.708 0L10 1.707l-.646.647a.5.5 0 0 1-.708 0L8 1.707l-.646.647a.5.5 0 0 1-.708 0L6 1.707l-.646.647a.5.5 0 0 1-.708 0L4 1.707l-.646.647a.5.5 0 0 1-.708 0l-.509-.51z" />
                      <path d="M3 4.5a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5zm8-6a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5z" />
                    </svg>
                    <span className="count-badge text-white" style={{ background: "#A5B4FC" }}>{books?.data?.length || 0}</span>
                  </div>
                </>
              )}

              {/* Clock Display */}
              {showClock && (
                <>
                  <div className="tools-divider"></div>
                  <div className="header-clock">
                    <i className="bi bi-clock"></i>
                    <span>{formatTime(currentTime)}</span>
                  </div>
                </>
              )}

              {Number(loginedWaiter?.data?.can_access_settings) === 1 && (
                <>
                  <div className="tools-divider"></div>
                  {/* Menu Hamburger */}
                  <button
                    className="header-icon-btn small-icon-btn"
                    onClick={async () => { await autoSendIfNeeded(); navigate("/settings"); }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        d="M3 12H21M3 6H21M3 18H21"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </>
              )}

              {/* Waiter */}

              <div className="tools-divider"></div>
              {/* Waiter/Exit Icon */}
              <div
                className="header-icon-btn small-icon-btn waiter-btn"
                style={{ cursor: "pointer" }}
                onClick={() => handleAutoSaveAndExit("/pin")}
              >
                <div className="d-flex align-items-center gap-2">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M16 17L21 12L16 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M21 12H9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="waiter-name-always">{loginedWaiter?.data?.name}</span>
                </div>
              </div>

              {Number(loginedWaiter?.data?.can_see_notif) === 1 && (
                <>
                  <div className="tools-divider"></div>
                  {/* Notification Bell */}
                  <button
                    className="header-icon-btn small-icon-btn position-relative"
                    onClick={() => setShowNotifications(true)}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        d="M18 8A6 6 0 0 0 6 8C6 15 3 21 3 21H21S18 15 18 8Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path d="M13.73 21A2 2 0 0 1 10.27 21" />
                    </svg>
                    {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
                  </button>
                </>
              )}

              <div className="tools-divider"></div>
              <button
                className="header-icon-btn small-icon-btn wifi-icon position-relative"
                onClick={() => { if (Number(loginedWaiter?.data?.can_access_settings) === 1) setShowStatusModal(true); }}
                style={{ cursor: "pointer", border: "none", background: "none", padding: "0 12px" }}
              >
                <div className="wifi-badge-container">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2 8.3601C8.06 3.6801 15.94 3.6801 22 8.3601"
                      stroke={!isOnline || !hasInternet ? "#FFA500" : (syncCount > 0 ? "#F59E0B" : "#00FF6A")}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4.91 11.8401C9.21 8.5201 14.8 8.5201 19.1 11.8401"
                      stroke={!isOnline || !hasInternet ? "#FFA500" : (syncCount > 0 ? "#F59E0B" : "#00FF6A")}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6.79 15.4902C9.94 13.0502 14.05 13.0502 17.2 15.4902"
                      stroke={!isOnline || !hasInternet ? "#FFA500" : (syncCount > 0 ? "#F59E0B" : "#00FF6A")}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9.4 19.1501C10.98 17.9301 13.03 17.9301 14.61 19.1501"
                      stroke={!isOnline || !hasInternet ? "#FFA500" : (syncCount > 0 ? "#F59E0B" : "#00FF6A")}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {showSyncedBadge && syncedCount > 0 && <span className="sync-badge-done">{syncedCount}</span>}
                  {syncCount > 0 && <span className="sync-badge-pending">{syncCount}</span>}
                </div>
              </button>
            </div>

            {/* Bottom Action Bar (White) */}
            <div className="CheckRightboxHeader d-flex justify-content-between align-items-center p-2 border-bottom">
              {/* Header Titles / Breadcrumbs */}
              {(!isMobile || !isSettingsOpen) && (
                <div className="ms-2 header-left d-flex align-items-center gap-3">
                  <div className="breadcrumb-container">
                    <div className="breadcrumb-tab home" onClick={handleMenuHome}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        fill="currentColor"
                        className="bi bi-house-door-fill"
                        viewBox="0 0 16 16"
                      >
                        <path d="M6.5 14.5v-3.505c0-.245.25-.495.5-.495h2c.25 0 .5.25.5.495v3.505a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5" />
                      </svg>
                    </div>

                    {(menuViewMode !== "ROOT" || (searchText && searchText.length > 0)) && (
                      menuViewMode === "PRODUCTS" && selectedGenCat ? (
                        <>
                          <div className="breadcrumb-tab next cursor-pointer" onClick={() => { setMenuViewMode("CATEGORIES"); setSelectedCat(null); }}>
                            <span>{selectedGenCat.name}</span>
                          </div>
                          <div className="breadcrumb-tab next active-breadcrumb">
                            <span>{selectedCat?.name}</span>
                          </div>
                        </>
                      ) : (
                        <div className="breadcrumb-tab next cursor-pointer" onClick={handleMenuHome}>
                          <span>{getMenuBreadcrumbTitle()}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Right Side: Search & Actions */}
              <div className="header-right d-flex align-items-center gap-1">
                {/* Search */}
                {(!isMobile || !isSettingsOpen) && (
                  <div
                    className={`search-wrapper ${isSearchExpanded ? "expanded-modern" : ""}`}
                    onClick={() => !isSearchExpanded && setIsSearchExpanded(true)}
                  >
                    {!isSearchExpanded ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                    ) : (
                      <div className="modern-search-container d-flex align-items-center gap-2">
                        <div className="search-input-group d-flex align-items-center flex-grow-1">
                          <input
                            type="text"
                            className="form-control modern-search-input"
                            placeholder="Axtar..."
                            autoFocus
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                          />
                          <div
                            className="search-btn-clear d-flex align-items-center justify-content-center px-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchText("");
                            }}
                          >
                            Təmizlə
                          </div>
                        </div>

                        <div
                          className="search-btn-close"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSearchExpanded(false);
                            setSearchText("");
                          }}
                        >
                          <i className="bi bi-x-lg"></i>
                        </div>
                      </div>
                    )}
                  </div>
                )}


                {/* Porsiya Button */}
                {/* <div className="btn bg-white border d-flex align-items-center gap-2 text-secondary">
                    <i className="bi bi-cup-hot"></i>
                    <span>Porsiya</span>
                  </div> */}

                {/* History/Logs Toggle */}


                {/* Settings */}
                {/* <div className="header-icon bg-white border rounded p-2 text-secondary cursor-pointer">
                    <i className="bi bi-gear-fill"></i>
                  </div> */}

                {/* Star */}
                {/* <div className="header-icon bg-white border rounded p-2 text-secondary cursor-pointer">
                    <i className="bi bi-star"></i>
                  </div> */}

                {/* List */}
                {/* <div className="header-icon bg-white border rounded p-2 text-secondary cursor-pointer">
                    <i className="bi bi-list-ul"></i>
                  </div> */}

                {/* Settings Toolbar - hidden when search is expanded */}
                {!isSearchExpanded && Number(loginedWaiter?.data?.can_manage_products) === 1 && (
                  <div className="settings-toolbar-wrapper">
                    <div
                      className={`settings-gear-btn ${isSettingsOpen ? 'active' : ''}`}
                      onClick={() => {
                        if (isDragMode) return;
                        setIsSettingsOpen(!isSettingsOpen);
                      }}
                    >
                      <i className="bi bi-gear-fill"></i>
                    </div>

                    {isSettingsOpen && !isDragMode && (
                      <div className="settings-actions">
                        <div
                          className="settings-action-btn"
                          title="Sıranı dəyiş"
                          onClick={() => {
                            if (!navigator.onLine) {
                              toast.error("İnternet bağlantısı yoxdur. Sıranı dəyişmək üçün internet lazımdır.");
                              return;
                            }
                            setIsDragMode(true);
                            setTempCustomOrders(customOrders);
                          }}
                        >
                          <i className="bi bi-arrows-move"></i>
                        </div>
                        <div className="settings-action-btn" title="Əlavə et" onClick={() => setShowProductModal(true)}>
                          <i className="bi bi-plus-lg"></i>
                        </div>
                        <div
                          className={`settings-action-btn ${isEditMode ? 'active-mode' : ''}`}
                          title="Redaktə et"
                          onClick={() => {
                            if (isDragMode) return;
                            const newEditMode = !isEditMode;
                            setIsEditMode(newEditMode);
                            if (newEditMode) {
                              setIsDeleteMode(false);
                              toast.info("Redaktə rejimi aktivdir. Məhsulun üzərinə vurun.");
                            } else {
                              toast.info("Redaktə rejimi deaktiv edildi.");
                            }
                          }}
                        >
                          <i className="bi bi-pencil-fill"></i>
                        </div>
                        <div
                          className={`settings-action-btn ${isDeleteMode ? 'active-mode delete-mode' : ''}`}
                          title="Sil"
                          onClick={() => {
                            if (isDragMode) return;
                            const newDeleteMode = !isDeleteMode;
                            setIsDeleteMode(newDeleteMode);
                            if (newDeleteMode) {
                              setIsEditMode(false);
                              toast.info("Silmə rejimi aktivdir. Məhsulun üzərinə vurun.");
                            } else {
                              toast.info("Silmə rejimi deaktiv edildi.");
                            }
                          }}
                        >
                          <i className="bi bi-trash3-fill"></i>
                        </div>
                      </div>
                    )}

                    {isDragMode && (
                      <div className="drag-mode-actions">
                        <div
                          className="drag-mode-btn cancel"
                          title="Ləğv et"
                          onClick={() => {
                            setIsDragMode(false);
                            setCustomOrders(tempCustomOrders);
                            setTempCustomOrders(null);
                          }}
                        >
                          <i className="bi bi-x-lg"></i>
                        </div>
                        <div
                          className="drag-mode-btn confirm"
                          title="Təsdiqlə"
                          onClick={async () => {
                            const loadingToast = toast.loading("Dəyişikliklər yadda saxlanılır...");

                            try {
                              const profileId = loginedProfileData?.data?.profile?.id;
                              if (!profileId) {
                                toast.dismiss(loadingToast);
                                toast.error("Profil ID tapılmadı");
                                return;
                              }

                              // Determine which order to save based on current view
                              let orderedItems = [];
                              let endpoint = "";
                              let isRootSaved = false;

                              const latestOrders = customOrdersRef.current;

                              if (menuViewMode === "ROOT") {
                                const items = latestOrders["ROOT"] || [];
                                const genCats = menuDataWithGeneralCategories?.data || [];
                                const rootCats = (menuDataWithCategories?.data || []).filter(
                                  (c) => !c.general_categorie_id || c.general_categorie_id === 0
                                );
                                const genCatIds = new Set(genCats.map((g) => g.id));
                                const rootCatIds = new Set(rootCats.map((c) => c.id));
                                const genCatOrdered = items.filter((id) => genCatIds.has(id)).map((id, i) => ({ id, ordering: i + 1 }));
                                const catOrdered = items.filter((id) => rootCatIds.has(id)).map((id, i) => ({ id, ordering: i + 1 }));
                                if (genCatOrdered.length > 0) {
                                  await apiConfig.put("/general-categories/ordering", {
                                    orderedItems: genCatOrdered,
                                    profile_id: profileId
                                  });
                                }
                                if (catOrdered.length > 0) {
                                  await apiConfig.put("/categories/ordering", {
                                    orderedItems: catOrdered,
                                    profile_id: profileId
                                  });
                                }
                                isRootSaved = items.length > 0;
                              } else if (menuViewMode === "CATEGORIES" && selectedGenCat) {
                                const items = latestOrders[`GEN_${selectedGenCat.id}`] || [];
                                orderedItems = items.map((id, index) => ({ id, ordering: index + 1 }));
                                endpoint = "/categories/ordering";
                              } else if (menuViewMode === "PRODUCTS" && selectedCat) {
                                const items = latestOrders[`CAT_${selectedCat.id}`] || [];
                                orderedItems = items.map((id, index) => ({ id, ordering: index + 1 }));
                                endpoint = "/products/ordering";
                              }

                              if (isRootSaved || (orderedItems.length > 0 && endpoint)) {
                                if (!isRootSaved) {
                                  const putPayload = { orderedItems, profile_id: profileId };
                                  if (menuViewMode === "PRODUCTS" && selectedCat) {
                                    putPayload.category_id = selectedCat.id;
                                  }
                                  await apiConfig.put(endpoint, putPayload);
                                }
                                // Redux state-i dərhal güncəllə — yenidən fetch etmə (fetch köhnə data gətirib üzərinə yazar)
                                if (menuViewMode === "PRODUCTS" && selectedCat && orderedItems.length > 0) {
                                  dispatch(applyProductOrdering({
                                    categoryId: selectedCat.id,
                                    orderedIds: orderedItems.map(i => i.id),
                                  }));
                                } else {
                                  dispatch(menuWithGeneralCategories(profileId));
                                  dispatch(menuWithCategories(profileId));
                                }
                                setIsDragMode(false);
                                setTempCustomOrders(null);
                                customOrdersRef.current = {};
                                setCustomOrders({});
                                toast.dismiss(loadingToast);
                                addNotification("Sıralama Dəyişdirildi", "Menyu sıralaması yeniləndi.");
                                toast.success("Sıralama uğurla yadda saxlanıldı!");
                              } else {
                                toast.dismiss(loadingToast);
                                setIsDragMode(false);
                                setTempCustomOrders(null);
                              }
                            } catch (error) {
                              console.error("Save order error:", error);
                              toast.dismiss(loadingToast);
                              toast.error("Xəta baş verdi: " + error.message);
                            }
                          }}
                        >
                          <i className="bi bi-check-lg"></i>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Content placeholder for the rest of the right box */}
            <div className="checkRightBoxContent flex-grow-1 p-3" style={{ minHeight: 0, position: "relative" }}>
              <Menu
                order={currentOrder}
                searchText={searchText}
                menuViewMode={menuViewMode}
                setMenuViewMode={setMenuViewMode}
                selectedGenCat={selectedGenCat}
                setSelectedGenCat={setSelectedGenCat}
                selectedCat={selectedCat}
                setSelectedCat={setSelectedCat}
                isDragMode={isDragMode}
                categoryOrder={categoryOrderMemo}
                onCategoryOrderChange={handleCategoryOrderChange}
                isEditMode={isEditMode}
                isDeleteMode={isDeleteMode}
                onEditProduct={handleEditProductMemo}
                onDeleteItem={handleDeleteItemMemo}
              />
              {isSearchExpanded && posKeyboardEnabled && (
                <VirtualKeyboard
                  onKeyPress={(key) => setSearchText((prev) => prev + key)}
                  onBackspace={() => setSearchText((prev) => prev.slice(0, -1))}
                  onClose={() => {
                    setIsSearchExpanded(false);
                    setSearchText("");
                  }}
                />
              )}
            </div>
          </div>
        </Col>
      </Row>

      {/* Mobile Bottom Nav */}
      <div className="mobile-bottom-nav d-flex d-lg-none">
        <div
          className={`mobile-nav-item ${isSidebarOpen ? "active" : ""}`}
          onClick={() => {
            if (activeMobileTab !== "check") setActiveMobileTab("check");
            setIsSidebarOpen(!isSidebarOpen);
          }}
        >
          <i className="bi bi-list"></i>
        </div>
        <div
          className={`mobile-nav-item ${activeMobileTab === "check" && !isSidebarOpen ? "active" : ""}`}
          onClick={() => {
            setActiveMobileTab("check");
            setIsSidebarOpen(false);
          }}
        >
          <div className="position-relative d-inline-flex">
            <i className="bi bi-receipt"></i>
            {products?.length > 0 && (
              <span
                className="position-absolute top-0 start-100 translate-middle badge rounded-pill"
                style={{ backgroundColor: "#053796" }}
              >
                {products.length}
              </span>
            )}
          </div>
        </div>
        <div
          className={`mobile-nav-item ${activeMobileTab === "menu" ? "active" : ""}`}
          onClick={() => {
            setActiveMobileTab("menu");
            setIsSidebarOpen(false);
          }}
        >
          <i className="bi bi-grid-fill"></i>
        </div>
      </div>
      <OperationsModal
        show={showOpeationsModal}
        onHide={onHideOperations}
        clearCheck={clearCheck}
        openCommentModal={openCommentModal}
        openDiscountModal={openDiscountModal}
        openServiceFee={openServiceFee}
        openWaitersModal={openWaitersModal}
        handleChangeTable={handleChangeTable}
        openACtiveCheck={openACtiveCheck}
        handleOpenChangeSaleType={handleOpenChangeSaleType}
        handleOpenSplitModel={handleOpenSplitModel}
        handleDeleteCheckModal={handleDeleteCheckModal}
        openDepositModal={openDepositModal}
        openHistory={openHistoryModalFunc}
        openCustomersModal={openCustomersModalFunc}
        openGuestCountModal={openGuestCountModalFunc}
        loginedWaiter={loginedWaiter}
      />

      <UpdateGuestCountModal
        show={showGuestCountModal}
        onHide={() => setShowGuestCountModal(false)}
        order={currentOrder}
        onSuccess={() => {
          if (loginedProfileData?.data?.profile?.id) {
            dispatch(getActiveOrders({ profileId: loginedProfileData.data.profile.id, silentRefresh: true }));
          }
        }}
      />

      <CheckLockModal
        show={lockCheck}
        onClose={() => {
          setLockCheck(false);
        }}
        order={currentOrder}
      />
      <CommentModal
        show={comment}
        onClose={() => {
          setComment(false);
        }}
        order={currentOrder}
      />

      <ClearCheck
        show={onShowClearModal}
        onClose={() => setOnShowClearModal(false)}
        order={currentOrder}
      />

      <DiscountModal
        show={onShowDiscount}
        onClose={() => setOnShowDiscount(false)}
        order={currentOrder}
      />

      <ServiceFeeModal
        show={onShowServiceFee}
        onClose={() => setOnShowServiceFee(false)}
        order={currentOrder}
        hall={currentHall}
      />

      <DepositModal
        show={onShowDeposit}
        onClose={() => setOnShowDeposit(false)}
        order={currentOrder}
      />

      <WaitersModal
        show={showWaitersModal}
        onClose={() => setShowWaitersModal(false)}
        order={currentOrder}
      />

      <OtherChecks
        type={"merge"}
        order={currentOrder}
        show={openACtiveChecks}
        onClose={() => setOpenActiveChecks(false)}
        onCreateNew={async () => {
          setOpenActiveChecks(false);
          await autoSendIfNeeded();
          const waiterId = loginedWaiter?.data?.id;
          const terminalId = loginedProfileData?.data?.terminal?.terminal_id;
          const profileId = loginedProfileData?.data?.profile?.id;

          if (!waiterId || !terminalId || !profileId) {
            toast.error("İstifadəçi məlumatları çatışmır");
            return;
          }

          let nextId = null;
          try {
            const nextIdRes = await dispatch(getNextOrderId(profileId)).unwrap();
            nextId = nextIdRes?.data?.nextId;
          } catch (e) {
            console.warn("getNextOrderId failed, using backend-generated id", e);
          }

          const generatedUuid = crypto.randomUUID();
          const sv = currentHall?.service_fee || 0;
          const payload = {
            guestCount: 0,
            tableId: currentTable?.id,
            waiterId,
            terminalId,
            profileId,
            sale_type: "dine_in",
            hallId: currentHall?.id,
            status: 1,
            serviceType: currentHall?.service_fee ? "percent" : null,
            serviceValue: sv,
            is_selected: 1,
            uuid: generatedUuid,
            ...(nextId && { id: nextId }),
          };

          const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
          const optimisticOrder = {
            uuid: generatedUuid,
            id: nextId ?? null,
            waiter_id: waiterId,
            profile_id: profileId,
            terminal_id: terminalId,
            sale_type: "dine_in",
            sale_type_name: "Restoranda",
            table_id: currentTable?.id,
            guest_count: 0,
            status: 1,
            is_selected: 1,
            orders_items: [],
            table: currentTable ? { id: currentTable.id, name: currentTable.name, hall: { name: currentHall?.name } } : null,
            table_name: currentTable?.name,
            hall_name: currentHall?.name,
            amount: 0,
            total: 0,
            start_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
            discount: 0,
            service_value: sv || 0,
            service_type: sv ? "percent" : null,
            waiter: { id: waiterId, name: waiterName },
          };

          dispatch(addOrderOptimistic(optimisticOrder));
          if (currentTable?.id) {
            dispatch(addOrderToTableOptimistic({ order: optimisticOrder, tableId: currentTable.id }));
          }
          dispatch(saveLog({
            orderId: generatedUuid,
            action: "Yeni sifariş yaradıldı (Check View)",
            waiterName,
            details: `Masa: ${currentTable?.name || "Naməlum"}`
          }));
          navigate(`/check/${generatedUuid}?tableId=${currentTable?.id}`);
          toast.success("Yeni çek yaradıldı");

          dispatch(saleNewOrders(payload)).unwrap()
            .then((res) => {
              const serverOrder = res?.data;
              const finalId = serverOrder?.id ?? res?.count;
              if (finalId && finalId !== nextId) {
                dispatch(updateOrderOptimisticId({ uuid: generatedUuid, newOrderData: { id: finalId } }));
              }
              dispatch(getTableGroups(profileId));
              dispatch(getActiveOrders({ profileId, silentRefresh: true }));
            })
            .catch((err) => {
              console.error(err);
              toast.error("Xəta baş verdi");
            });
        }}
      />

      <ChangeSaleTypeModal
        show={openChangeSaleType}
        onClose={(result) => {
          setOpenChangeSaleType(false);
          if (result?.data?.uuid) {
            dispatch({ type: "orders/change-saletype/fulfilled", payload: result });
          }
        }}
        order={currentOrder}
      />

      <SplitOrderModal show={openSplitModal} onClose={() => setOpenSplitModal(false)} order={currentOrder} onSplit={handleSplitOrder} onCloseOtherModals={() => setShowProductModal(false)} />
      <CheckDeleteModal
        show={openDeleCheckModal}
        onConfirm={(data) => handleDeleteCheckFunction(data)}
        onClose={() => setOpenDeleteCheckModal(false)}
        order={currentOrder}
        type={"checks"}
        tagsType={4}
        actionName="Sil"
      />
      <SalesTypesModal
        show={onShowSalesTypeModal}
        target={newOrderBtnRef.current}
        onClose={() => setOnShowSalesTypeModal(false)}
        onSelect={(type) => {
        }}
      />
      <OrderLogsModal
        show={showHistoryModal}
        onHide={() => setShowHistoryModal(false)}
        order={currentOrder}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        show={showDeleteConfirm}
        onHide={() => setShowDeleteConfirm(false)}
        centered
        className="delete-confirm-modal"
        animation={false}
      >
        <div className="delete-confirm-wrapper">
          <div className="delete-confirm-header">
            <div className="delete-confirm-header-content">
              <div className="delete-confirm-icon-circle">
                <i className="bi bi-trash3-fill"></i>
              </div>
              <div className="delete-confirm-title">Məhsulu Silmək</div>
            </div>
            <button className="btn-close-custom" onClick={() => setShowDeleteConfirm(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div className="delete-confirm-body">
            <p>
              "<strong>{productToDelete?.name}</strong>" məhsulu silinəcək.
              <br />
              Bu əməliyyatı geri qaytarmaq mümkün deyil.
            </p>

            <div className="delete-confirm-footer">
              <button className="delete-confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>Ləğv et</button>
              <button className="delete-confirm-save" onClick={handleDeleteProduct}>
                <i className="bi bi-trash3-fill"></i>
                Sil
              </button>
            </div>
          </div>
        </div>
      </Modal>
      <CustomersSourceModal
        show={showCustomerModal}
        onHide={() => setShowCustomerModal(false)}
        onApply={(customer) => {
          setShowCustomerModal(false);

          if (currentOrder?.uuid) {
            const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

            // 1. Assign customer
            dispatch(assignCustomerToOrder({
              orderId: currentOrder.uuid,
              customerId: customer?.id || null,
              customerName: customer?.name || null,
              waiterName,
            }));

            // 3. Apply customer discount (direct or group)
            const groupDiscount = customer?.discount || customer?.group?.discount;
            if (groupDiscount && groupDiscount > 0) {
              dispatch(updateDiscountOnOrders({
                orderId: currentOrder.uuid,
                discountValue: groupDiscount,
                discountType: 'percent',
                oldDiscountValue: currentOrder.discount_value,
                oldDiscountType: currentOrder.discount_type,
                waiterName
              }));
            }
          }
        }}
        selectedCustomer={selectedCustomer}
      />
      {import.meta.env.DEV && (
        <CourierModal
          show={showCourierModal}
          onHide={() => setShowCourierModal(false)}
          onApply={({ courier, deliveryFee }) => {
            setShowCourierModal(false);
            if (currentOrder?.uuid) {
              dispatch(assignCourierToOrder({
                orderId: currentOrder.uuid,
                courierId: courier?.id || null,
                courierName: courier?.name || null,
                deliveryFee: deliveryFee || 0,
              }));
            }
          }}
        currentOrder={currentOrder}
        selectedCustomer={selectedCustomer}
      />
      )}
      <NotificationSidebar
        show={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
      <StatusModal
        show={showStatusModal}
        onHide={() => setShowStatusModal(false)}
      />
      <ProductModal
        show={showProductModal}
        onHide={() => {
          setShowProductModal(false);
          setProductToEdit(null);
        }}
        productToEdit={productToEdit}
      />


      {/* ── Hotel WhatsApp Modal ── */}
      <Modal show={showWhatsAppModal} onHide={() => setShowWhatsAppModal(false)} centered size="lg" dialogClassName="hc-wa-dialog">
        <div className="hc-wa-modal-wrap">
          <div className="hc-wa-header">
            <div className="hc-wa-header-left">
              <div className="hc-wa-header-icon"><i className="bi bi-whatsapp"></i></div>
              <div>
                <div className="hc-wa-header-title">WhatsApp mesajı</div>
                <div className="hc-wa-header-sub">{hotelRoom?.guest_name || "Qonaq"} · {hotelRoom?.guest_phone || "—"}</div>
              </div>
            </div>
            <button className="hc-wa-close" onClick={() => setShowWhatsAppModal(false)}><i className="bi bi-x-lg"></i></button>
          </div>

          <div className="hc-wa-body">
            <div className="hc-wa-recipient-bar">
              <i className="bi bi-person-circle"></i>
              <span><strong>{hotelRoom?.guest_name || "Qonaq"}</strong> — {hotelRoom?.guest_phone || "Nömrə yoxdur"}</span>
              {hotelRoom?.room_number && <span className="hc-wa-room-badge">Otaq {hotelRoom.room_number}</span>}
            </div>
            <div className="hc-wa-templates">
              <button className={`hc-wa-tpl-btn ${waReminderType !== "checkout" ? "active" : ""}`}
                onClick={() => { setWaReminderType("info"); setWaCustomMessage(buildDefaultMessage("info")); }}>
                <i className="bi bi-info-circle"></i> Məlumat
              </button>
              <button className={`hc-wa-tpl-btn ${waReminderType === "checkout" ? "active" : ""}`}
                onClick={() => { setWaReminderType("checkout"); setWaCustomMessage(buildDefaultMessage("checkout")); }}>
                <i className="bi bi-box-arrow-right"></i> Çıxış xatırlatması
              </button>
            </div>
            <div className="hc-wa-editor">
              <div className="hc-wa-editor-label">Mesaj mətni</div>
              <textarea className="hc-wa-editor-area" rows="8" value={waCustomMessage}
                onChange={(e) => setWaCustomMessage(e.target.value)}
                placeholder="Mesaj mətni daxil edin..." />
              <div className="hc-wa-char-count">{waCustomMessage.length} simvol</div>
            </div>
            <div className="hc-wa-delivery">
              <div className="hc-wa-section-title">Göndərmə</div>
              <div className="hc-wa-delivery-options">
                <label className={`hc-wa-radio ${waSendMode === "now" ? "checked" : ""}`}>
                  <input type="radio" name="waMode" checked={waSendMode === "now"} onChange={() => setWaSendMode("now")} />
                  <div className="hc-wa-radio-content">
                    <div className="hc-wa-radio-icon"><i className="bi bi-send-fill"></i></div>
                    <div>
                      <div className="hc-wa-radio-title">Dərhal göndər</div>
                      <div className="hc-wa-radio-desc">Mesaj dərhal WhatsApp olaraq göndəriləcək</div>
                    </div>
                  </div>
                </label>
                <label className={`hc-wa-radio ${waSendMode === "schedule" ? "checked" : ""}`}>
                  <input type="radio" name="waMode" checked={waSendMode === "schedule"}
                    onChange={() => {
                      if (!waScheduleTime) { const d = new Date(Date.now() + 3600000); setWaScheduleTime(d.toISOString().slice(0, 16)); }
                      setWaSendMode("schedule");
                    }} />
                  <div className="hc-wa-radio-content">
                    <div className="hc-wa-radio-icon"><i className="bi bi-calendar-clock"></i></div>
                    <div>
                      <div className="hc-wa-radio-title">Vaxt təyin et</div>
                      <div className="hc-wa-radio-desc">Mesaj müəyyən edilmiş vaxtda göndəriləcək</div>
                    </div>
                  </div>
                </label>
              </div>
              {waSendMode === "schedule" && (
                <div className="hc-wa-schedule-picker">
                  <div className="hc-wa-sp-field">
                    <label className="hc-wa-sp-label">Tarix</label>
                    <input type="date" className="hc-wa-datetime" value={waScheduleTime ? waScheduleTime.slice(0, 10) : ""}
                      onChange={(e) => { const time = waScheduleTime?.slice(11) || "12:00"; setWaScheduleTime(e.target.value + "T" + time); }}
                      min={new Date().toISOString().slice(0, 10)} />
                  </div>
                  <div className="hc-wa-sp-field">
                    <label className="hc-wa-sp-label">Saat</label>
                    <input type="time" className="hc-wa-datetime" value={waScheduleTime ? waScheduleTime.slice(11) || "12:00" : "12:00"}
                      onChange={(e) => { const date = waScheduleTime?.slice(0, 10) || new Date().toISOString().slice(0, 10); setWaScheduleTime(date + "T" + e.target.value); }} />
                  </div>
                </div>
              )}
            </div>
            <div className="hc-wa-auto-card">
              <div className="hc-wa-auto-header">
                <div className="hc-wa-auto-header-left">
                  <i className="bi bi-bell-fill"></i>
                  <div>
                    <div className="hc-wa-auto-title">Avtomatik çıxış xatırlatması</div>
                    <div className="hc-wa-auto-desc">Qonağın çıxış vaxtı yaxınlaşdıqda avtomatik bildiriş göndər</div>
                  </div>
                </div>
                <label className="hc-wa-toggle">
                  <input type="checkbox" checked={waAutoRemind} onChange={(e) => setWaAutoRemind(e.target.checked)} />
                  <span className="hc-wa-toggle-slider"></span>
                </label>
              </div>
              {waAutoRemind && (
                <div className="hc-wa-auto-body">
                  <div className="hc-wa-auto-row">
                    <span className="hc-wa-auto-label">Çıxışa neçə saat qalmış bildiriş göndərilsin?</span>
                    <div className="hc-wa-auto-controls">
                      <select className="hc-wa-select" value={waRemindHours} onChange={(e) => setWaRemindHours(Number(e.target.value))}>
                        <option value={1}>1 saat qalmış</option>
                        <option value={2}>2 saat qalmış</option>
                        <option value={3}>3 saat qalmış</option>
                        <option value={6}>6 saat qalmış</option>
                      </select>
                      <button className="hc-wa-btn-remind" onClick={handleSendCheckoutReminder}
                        disabled={isSendingWhatsapp || !hotelRoom?.guest_phone || waReminderSent}>
                        <i className="bi bi-send"></i>
                        {waReminderSent ? "Göndərildi" : "İndi göndər"}
                      </button>
                    </div>
                  </div>
                  {countdownText && (
                    <div className="hc-wa-auto-countdown">
                      <i className="bi bi-hourglass-split"></i> {countdownText}
                    </div>
                  )}
                  {waReminderSent && (
                    <div className="hc-wa-auto-success">
                      <i className="bi bi-check-circle-fill"></i> Xatırlatma göndərildi
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="hc-wa-footer">
            <button className="hc-wa-footer-btn hc-wa-footer-cancel" onClick={() => setShowWhatsAppModal(false)}>
              <i className="bi bi-x"></i> İmtina
            </button>
            <button className="hc-wa-footer-btn hc-wa-footer-send" onClick={handleWASend}
              disabled={isSendingWhatsapp || !waCustomMessage || (waSendMode === "schedule" && !waScheduleTime)}>
              {isSendingWhatsapp ? (
                <><span className="spinner-border spinner-border-sm"></span> Göndərilir...</>
              ) : waSendMode === "schedule" ? (
                <><i className="bi bi-calendar-check"></i> Təyin et</>
              ) : (
                <><i className="bi bi-send-fill"></i> Göndər</>
              )}
            </button>
          </div>
        </div>
      </Modal>

    </Container >
  );
};

export default Check;
