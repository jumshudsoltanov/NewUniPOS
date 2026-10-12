import React, { useMemo, useState, useEffect, useRef } from "react";
import { Container, Row, Col, Alert } from "react-bootstrap";
import "./Tables.css";
import Table from "../Table/Table";
import TableShapeModal from "../TableShapeModal/TableShapeModal";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import CustomersModal from "../Customers-Modal/CustomersModal";
import OtherChecks from "../OtherChecks/OtherChecks";
import { updateTableOrders, saveLog } from "../../redux/Slices/OrdersSlice";
import { getActiveOrders, addOrderOptimistic, updateOrderOptimisticId } from "../../redux/Slices/BooksSlice";
import { saleNewOrders, getNextOrderId } from "../../redux/Slices/SaleSlice";
import {
  getTableGroups,
  setTempTableOrder,
  startEditMode,
  cancelEditMode,
  setTempTableLayout,
  clearHallLayout,
  loadLayoutsFromAdmin,
  loadLocalLayouts,
  saveTableLayouts,
  updateLocalLayoutsFromServer,
  addOrderToTableOptimistic,
} from "../../redux/Slices/TablesSlice";
import { toast } from "sonner";
import { getSocket } from "../../utils/apiConfig";
import { isPacksOnlyWaiter } from "../../utils/waiterPermissions";
import { checkShiftGuard } from "../../utils/shiftGuard";
import { normalizeTableShape } from "../../utils/tableShape";
import axios from "../../utils/apiConfig";
import { t } from "../../utils/translations";

/** Kanvas (layout) üçün forma əsaslı default en/hünd. — bilyar eni geniş, alçaq */
const defaultSizeForTableShape = (rawShape) => {
  const s = normalizeTableShape(rawShape);
  if (s === "rectangle") return { w: 200, h: 300 };
  if (s === "billiard") return { w: 280, h: 180 };
  return { w: 200, h: 200 };
};

// Layout-da saxlanan en/hündürlük bu qədərdən kiçikdirsə etibarsız sayılır
// (məs. köhnə/xarab sync verisi) və şəkilə uyğun default ölçüyə keçilir.
// Əvvəllər 150px idi — istifadəçi masaları daha kiçik (məs. 100px) etmək
// istəyəndə bu, "Hamısına tətbiq et" ilə verilən dəyəri sussuzca ləğv edirdi.
const MIN_VALID_TABLE_SIZE = 40;

const Tables = () => {
  const {
    tableGroups,
    currentHallId,
    isTablesLoading,
    isTableEditMode,
    tableOrder,
    tempTableOrder,
    tableLayouts,
    tempTableLayouts,
  } = useSelector((state) => state.TablesSlice);
  const [selectedTable, setSelectedTable] = React.useState(null);
  const [showModal, setShowModal] = React.useState(false);
  const [showOtherChecks, setShowOtherChecks] = React.useState(false);
  const [showShapeModal, setShowShapeModal] = React.useState(false);
  const [selectedTableForShape, setSelectedTableForShape] =
    React.useState(null);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams();

  const _tProfileId = loginedProfileData?.data?.profile?.id;

  // Qonaq sayı xülasə zolağı — DevicesModal-dakı açar ilə aç/bağla.
  // Defolt SÖNÜLÜDÜR: yalnız açıq seçilibsə ("true") görünür.
  const [showGuestCountBar, setShowGuestCountBar] = useState(() => {
    try { return localStorage.getItem("pos_show_guest_count_bar") === "true"; } catch { return false; }
  });
  useEffect(() => {
    const handleGuestBarSetting = (e) => setShowGuestCountBar(!!e.detail);
    window.addEventListener("guestCountBarSettingChanged", handleGuestBarSetting);
    return () => window.removeEventListener("guestCountBarSettingChanged", handleGuestBarSetting);
  }, []);

  // Edit Mode & Ordering States (Drag indices kept local as they are transient UI state)
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Bulk edit panel state (stored as strings so user can freely type/clear)
  const [bulkW, setBulkW] = useState("200");
  const [bulkH, setBulkH] = useState("200");

  // Avtomatik düzülüş: masalar az olanda blok üfüqi/şaquli harada dursun
  // (Yuxarı — default, Ortada, Aşağı) + hər kənardan boşluq
  const [arrangePosition, setArrangePosition] = useState(
    () => localStorage.getItem("pos_tables_arrange_position") || "top",
  );
  // Diqqət: dəyərlər STRING kimi saxlanılır (bulkW/bulkH kimi) — ədəd kimi
  // saxlasaydıq, sahəni silib boş qoymaq mümkün olmurdu (boş → 0-a çevrilib
  // dərhal geri qayıdırdı, istifadəçi yeni rəqəm yaza bilmirdi)
  const [arrangePadding, setArrangePadding] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("pos_tables_arrange_padding") || "null");
      if (saved && typeof saved === "object") {
        return {
          top: String(saved.top ?? 20),
          bottom: String(saved.bottom ?? 20),
          left: String(saved.left ?? 20),
          right: String(saved.right ?? 20),
        };
      }
    } catch { /* ignore */ }
    return { top: "20", bottom: "20", left: "20", right: "20" };
  });

  const updateArrangePosition = (pos) => {
    setArrangePosition(pos);
    try { localStorage.setItem("pos_tables_arrange_position", pos); } catch { /* ignore */ }
  };

  const updateArrangePadding = (side, rawValue) => {
    // Yalnız rəqəmlərə icazə ver, amma boş sahəyə (silinmə zamanı) icazə ver
    const value = rawValue.replace(/[^0-9]/g, "");
    setArrangePadding((prev) => {
      const next = { ...prev, [side]: value };
      try { localStorage.setItem("pos_tables_arrange_padding", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Single table selection state
  const dragMoveRef = useRef(false);
  const [selectedEditTableId, setSelectedEditTableId] = useState(null);
  const [singleW, setSingleW] = useState("200");
  const [singleH, setSingleH] = useState("200");
  const [singleX, setSingleX] = useState("0");
  const [singleY, setSingleY] = useState("0");
  const [singleRotation, setSingleRotation] = useState(0);

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Theme color states — localStorage-dan yüklə
  const [themeHeaderColor, setThemeHeaderColor] = useState(
    () => localStorage.getItem("unipos_theme_header") || "#053796"
  );
  const [themeBgColor, setThemeBgColor] = useState(
    () => localStorage.getItem("unipos_theme_bg") || "#E2E5EB"
  );
  const [themeTableColor, setThemeTableColor] = useState(
    () => localStorage.getItem("unipos_theme_table") || "#ffffff"
  );
  const [themeFabColor, setThemeFabColor] = useState(
    () => localStorage.getItem("unipos_theme_fab") || "#053796"
  );

  // Apply theme colors via CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--Surface-Default", themeHeaderColor);
    root.style.setProperty("--unipos-bg-color", themeBgColor);
    root.style.setProperty("--unipos-table-surface", themeTableColor);
    root.style.setProperty("--unipos-fab-color", themeFabColor);
  }, [themeHeaderColor, themeBgColor, themeTableColor, themeFabColor]);

  const handleSaveTheme = () => {
    localStorage.setItem("unipos_theme_header", themeHeaderColor);
    localStorage.setItem("unipos_theme_bg", themeBgColor);
    localStorage.setItem("unipos_theme_table", themeTableColor);
    localStorage.setItem("unipos_theme_fab", themeFabColor);
    toast.success(t("rengler_saxlanildi"));
  };

  const handleResetTheme = () => {
    setThemeHeaderColor("#053796");
    setThemeBgColor("#E2E5EB");
    setThemeTableColor("#ffffff");
    setThemeFabColor("#053796");
    localStorage.removeItem("unipos_theme_header");
    localStorage.removeItem("unipos_theme_bg");
    localStorage.removeItem("unipos_theme_table");
    localStorage.removeItem("unipos_theme_fab");
    const root = document.documentElement;
    root.style.setProperty("--Surface-Default", "#053796");
    root.style.setProperty("--unipos-bg-color", "#E2E5EB");
    root.style.setProperty("--unipos-table-surface", "#ffffff");
    root.style.setProperty("--unipos-fab-color", "#053796");
    toast.success(t("rengler_sifirlandi"));
  };

  // Custom Layout Interaction State
  const containerRef = useRef(null);
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => window.innerWidth <= 767.98,
  );

  useEffect(() => {
    const handleResize = () => setIsMobileViewport(window.innerWidth <= 767.98);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setTransitionsEnabled(false);
    const timer = setTimeout(() => setTransitionsEnabled(true), 100);
    return () => clearTimeout(timer);
  }, [currentHallId]);

  // Clear single selection when edit mode ends
  useEffect(() => {
    if (!isTableEditMode) setSelectedEditTableId(null);
  }, [isTableEditMode]);

  // Sync singleW/singleH/singleX/singleY/singleRotation when a table is selected in edit mode
  useEffect(() => {
    if (!selectedEditTableId) return;
    const hallLayouts = tempTableLayouts[String(currentHallId)] || tableLayouts[String(currentHallId)] || {};
    const tbl = currentTables.find((t) => t.id === selectedEditTableId);
    const defLayout = generatedLayout[selectedEditTableId] || { x: 20, y: 20 };
    const existing = hallLayouts[String(selectedEditTableId)] || defLayout;
    const defSz = defaultSizeForTableShape(tbl?.shape_type);
    const rawW = existing.w;
    const rawH = existing.h;
    setSingleW(String(rawW && rawW >= MIN_VALID_TABLE_SIZE ? rawW : defSz.w));
    setSingleH(String(rawH && rawH >= MIN_VALID_TABLE_SIZE ? rawH : defSz.h));
    setSingleX(String(Math.round(existing.x || 0)));
    setSingleY(String(Math.round(existing.y || 0)));
    setSingleRotation(existing.rotation || 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEditTableId]);

  // Load layouts from admin API once on mount, then refresh table groups to get latest shape_type
  useEffect(() => {
    if (_tProfileId) {
      dispatch(loadLocalLayouts());
      dispatch(loadLayoutsFromAdmin(_tProfileId)).then(() => {
        dispatch(getTableGroups(_tProfileId));
      });
    }
  }, [_tProfileId, dispatch]);

  // can_manage_packs: zalları və masaları görməsin — Checks-ə yönləndir (dərhal, UI göstərmədən)
  const isPacksOnly = isPacksOnlyWaiter(loginedWaiter?.data);
  useEffect(() => {
    if (isPacksOnly) {
      navigate("/checks", { replace: true });
    }
  }, [isPacksOnly, navigate]);

  const [interactionState, setInteractionState] = useState({
    type: null, // 'drag' | 'resize'
    tableId: null,
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0,
    initialWidth: 0,
    initialHeight: 0,
  });

  const activeLayouts = isTableEditMode
    ? tempTableLayouts[String(currentHallId)]
    : tableLayouts[String(currentHallId)];
  const hasCustomLayout =
    activeLayouts && Object.keys(activeLayouts).length > 0;

  // Use Canvas Mode if active layouts or edit mode active
  const isCanvasMode = hasCustomLayout || isTableEditMode;
  const useCanvasMode = isCanvasMode && !isMobileViewport;

  const currentTables = useMemo(() => {
    if (!tableGroups?.data || !currentHallId) {
      return tableGroups?.data?.[0]?.tables || [];
    }
    const selectedHall = tableGroups.data.find(
      (hall) => hall.id === currentHallId,
    );
    const tables = selectedHall?.tables || [];

    // Apply sorting
    let sortedTables = [...tables];
    const orderKey = currentHallId;

    const activeOrderObj = isTableEditMode ? tempTableOrder : tableOrder;
    const activeOrder = activeOrderObj[orderKey] || [];

    if (activeOrder && activeOrder.length > 0) {
      const orderMap = {};
      activeOrder.forEach((id, index) => {
        orderMap[id] = index;
      });
      sortedTables.sort((a, b) => {
        const aIdx = orderMap[a.id] !== undefined ? orderMap[a.id] : 9999;
        const bIdx = orderMap[b.id] !== undefined ? orderMap[b.id] : 9999;
        return aIdx - bIdx;
      });
    } else {
      sortedTables.sort((a, b) => a.id - b.id);
    }

    return sortedTables;
  }, [tableGroups, currentHallId, tableOrder, tempTableOrder, isTableEditMode]);

  const [generatedLayout, setGeneratedLayout] = useState({});
  /**
   * Avtomatik şəbəkə: yalnız zal, masaların sırası və ya shape_type dəyişəndə mövqelər yenidən hesablanır.
   * Socket/getTableGroups ilə yalnız çek/sifariş məlumatı yenilənəndə imza eyni qalır — masa yerləri dəyişmir (tərpənmə olmur).
   */
  const prevAutoLayoutSigRef = useRef("");

  useEffect(() => {
    if (currentTables.length === 0) {
      return;
    }
    const layoutSig = `${currentHallId}|${currentTables.map((t) => t.id).join(",")}|${currentTables.map((t) => t.shape_type || "").join(",")}`;
    if (layoutSig === prevAutoLayoutSigRef.current) {
      return;
    }
    prevAutoLayoutSigRef.current = layoutSig;

    // Diqqət: əvvəllər ekran eni sabit sütun sayına (məs. 1920px-də 5 sütun)
    // bölünürdü — masa özü 200px olsa belə, sütun 380px+ olduğu üçün aralarda
    // süni, çox böyük boşluq yaranırdı. İndi masalar öz enlərinə görə, sabit
    // kiçik boşluqla (16px) sıra ilə düzülür — "Avto düzləş" düyməsindəki
    // məntiqin eynisi.
    const containerW = containerRef.current?.offsetWidth || window.innerWidth;
    const GAP = 16;
    const PADDING = 20;

    const layout = {};
    let currentX = PADDING;
    let currentY = PADDING;
    let rowMaxH = 0;

    currentTables.forEach((table) => {
      const { w: tW, h: tH } = defaultSizeForTableShape(table.shape_type);

      if (currentX > PADDING && currentX + tW > containerW - PADDING) {
        currentX = PADDING;
        currentY += rowMaxH + GAP;
        rowMaxH = 0;
      }

      layout[table.id] = {
        x: currentX,
        y: currentY,
        w: undefined,
        h: undefined,
      };

      currentX += tW + GAP;
      rowMaxH = Math.max(rowMaxH, tH);
    });

    setGeneratedLayout(layout);
  }, [currentTables, currentHallId]);

  const currentHallData = useMemo(() => {
    if (!tableGroups?.data) return null;
    return (
      tableGroups.data.find((hall) => hall.id === currentHallId) ||
      tableGroups.data[0]
    );
  }, [tableGroups, currentHallId]);

  // Cari zalın masalarındakı qonaq sayı — açıq (open) və kilidli (locked) çeklər ayrı cəmlənir
  const guestCountSummary = useMemo(() => {
    let open = 0;
    let locked = 0;
    currentTables.forEach((table) => {
      (table.orders || []).forEach((order) => {
        const gc = Number(order?.guest_count || 0);
        if (!gc) return;
        if (Number(order?.is_locked) === 1) locked += gc;
        else open += gc;
      });
    });
    return { open, locked, total: open + locked };
  }, [currentTables]);

  // Debug logging for mobile white-screen investigation
  useEffect(() => {
    if (!tableGroups?.data) {
      console.warn("[TABLES] No tableGroups data available yet.");
    }
  }, [tableGroups]);

  // Handle Socket.IO Real-Time Table Synchronization
  /**
   * `table_updated` hadisələrini birləşdirmək üçün taymer.
   *
   * Əvvəl burada "leading throttle" vardı: 400 ms içində gələn hadisələr
   * ATILIRDI. Çox terminallı quruluşda bir-birinin ardınca gələn dəyişikliklərdə
   * SON hadisə atıla bilirdi və masa lövhəsi növbəti hadisəyə qədər köhnə
   * məlumatla qalırdı. İndi "trailing debounce" işləyir: hadisə seli bitdikdən
   * sonra BİR dəfə sorğu gedir — nə sorğu sayı artır, nə də son vəziyyət itir.
   */
  const refreshTimerRef = useRef(null);
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTableUpdated = () => {
      const profileId = loginedProfileData?.data?.profile?.id;
      if (!profileId) return;

      // Sel davam edirsə gözləməni yenidən başlat — yalnız sonuncudan sonra sorğu gedir.
      // Gecikmə həm hadisələri birləşdirir, həm də DB yazmasının tamamlanmasını
      // gözləyir (Master-Slave: print_count, status dəyişikliyi).
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        dispatch(getTableGroups(profileId));
        dispatch(
          getActiveOrders({
            profileId,
            silentRefresh: true,
          }),
        );
      }, 300);
    };

    const handleLocalLayoutsUpdated = (layouts) => {
      dispatch(updateLocalLayoutsFromServer(layouts));
    };

    socket.on("table_updated", handleTableUpdated);
    socket.on("local_layouts_updated", handleLocalLayoutsUpdated);

    return () => {
      socket.off("table_updated", handleTableUpdated);
      socket.off("local_layouts_updated", handleLocalLayoutsUpdated);
      // Komponent sökülürsə gözləyən sorğunu da ləğv edirik
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [dispatch, loginedProfileData]);

  const handleTableClick = React.useCallback(
    async (table) => {
      if (isTableEditMode) return;

      const { orders } = table || {};

      const hasOrders = orders && orders.length > 0;
      const waiterId = orders?.[0]?.waiter_id || orders?.[0]?.waiter?.id;
      const isMyTable =
        hasOrders &&
        loginedWaiter?.data?.id &&
        waiterId == loginedWaiter.data.id;
      const isOtherTable = hasOrders && !isMyTable;

      if (isPacksOnlyWaiter(loginedWaiter?.data)) {
        toast.error(
          "İcazəniz yoxdur: Masada sifariş yarada və ya aça bilməzsiniz.",
        );
        return;
      }

      if (
        Number(loginedWaiter?.data?.can_access_own_checks_only) === 0 &&
        isOtherTable
      ) {
        toast.error(t("no_permission_other_waiter"));
        return;
      }

      if (id) {
        try {
          const waiterName =
            loginedWaiter?.data?.name ||
            loginedProfileData?.data?.profile?.name || t("unknown");

          // Find old table and hall name
          let oldTableName = "Naməlum";
          let oldHallName = "Naməlum";
          if (tableGroups?.data) {
            for (const hall of tableGroups.data) {
              const tableWithOrder = hall.tables.find((t) =>
                t.orders?.some((o) => o.uuid === id),
              );
              if (tableWithOrder) {
                oldTableName = tableWithOrder.name;
                oldHallName = hall.name;
                break;
              }
            }
          }

          // Derive new hall name directly
          const targetHall = tableGroups?.data?.find(
            (h) => h.id === currentHallId,
          );
          const newHallName =
            targetHall?.name || currentHallData?.name || t("unknown");

          await dispatch(
            updateTableOrders({
              orderId: id,
              newTableId: table?.id,
              currentHallId,
              oldTableName,
              newTableName: table?.name,
              oldHallName,
              newHallName,
              waiterName,
            }),
          ).unwrap();

          toast.success(t("table_changed_success"));
          dispatch(getTableGroups(loginedProfileData.data.profile.id));
          navigate(`/check/${id}?tableId=${table?.id}`);
        } catch (error) {
          toast.error(t("error_occurred"));
          console.error(error);
        }
        return;
      }

      if (orders?.length > 1) {
        setSelectedTable(table);
        setShowOtherChecks(true);
      } else if (orders?.length === 1) {
        const isMasterSlaveActive =
          loginedProfileData?.data?.terminal?.is_master_slave_active === 1 ||
          loginedProfileData?.data?.profile?.is_master_slave_active === 1;
        const socket = getSocket();
        if (isMasterSlaveActive && socket?.connected) {
          socket.emit(
            "check_is_open_by_other",
            { orderId: orders[0].uuid },
            (isOpenByOther) => {
              if (isOpenByOther) {
                toast.warning(
                  "Bu masa hal-hazırda başqa terminaldadır. Əvvəlcə o terminal çıxsın.",
                );
              } else {
                navigate(`/check/${orders[0].uuid}?tableId=${table.id}`);
              }
            },
          );
        } else {
          navigate(`/check/${orders[0].uuid}?tableId=${table.id}`);
        }
      } else {
        const guard = await checkShiftGuard(loginedProfileData);
        if (guard.blocked) {
          toast.error(guard.reason || t("shift_not_open"));
          return;
        }
        const skipGuest = localStorage.getItem("unipos_skip_guest_count") === "1";
        if (skipGuest) {
          const waiterId = loginedWaiter?.data?.id;
          const terminalId = loginedProfileData?.data?.terminal?.terminal_id;
          const profileId = loginedProfileData?.data?.profile?.id;
          if (waiterId && terminalId && profileId && table?.id) {
            const generatedUuid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || t("unknown");
            const hallObj = currentHallData || {};
            const sv = Number(hallObj.service_fee || loginedProfileData?.data?.profile?.service_fee || 0);
            const optimisticOrder = {
              uuid: generatedUuid, id: null, waiter_id: waiterId, profile_id: profileId,
              terminal_id: terminalId, sale_type: "dine_in", sale_type_name: t("dine_in"),
              table_id: table.id, guest_count: 0, status: 1, is_selected: 1,
              orders_items: [],
              table: { id: table.id, name: table.name, hall: { name: hallObj.name || "" } },
              table_name: table.name, hall_name: hallObj.name || "",
              amount: 0, total: 0, start_date: new Date().toISOString(),
              created_at: new Date().toISOString(), discount: 0,
              service_value: sv, service_type: sv ? "percent" : null,
              waiter: { id: waiterId, name: waiterName }
            };
            try {
              dispatch(addOrderOptimistic(optimisticOrder));
              dispatch(addOrderToTableOptimistic({ order: optimisticOrder, tableId: table.id }));
              dispatch(saveLog({
                orderId: generatedUuid,
                action: "Yeni sifariş yaradıldı",
                waiterName,
                details: `Masa: ${table?.name || t("unknown")}, Qonaq sayı: 0`
              }));
              navigate(`/check/${generatedUuid}?tableId=${table.id}`);

              // Background-da API çağır — order DB-də yaransın və ID alsın
              (async () => {
                const recoveryPayload = {
                  guestCount: 0,
                  tableId: table.id,
                  waiterId,
                  terminalId,
                  profileId,
                  sale_type: "dine_in",
                  hallId: currentHallId,
                  serviceType: sv ? "percent" : null,
                  serviceValue: sv,
                  status: 1,
                  is_selected: 1,
                };

                // Melumatlari localStorage-a yaz ki, sehife yenilense de itmesin
                try {
                  const pending = JSON.parse(localStorage.getItem("pending_order_uuids") || "[]");
                  if (!pending.includes(generatedUuid)) {
                    pending.push(generatedUuid);
                    localStorage.setItem("pending_order_uuids", JSON.stringify(pending));
                    localStorage.setItem(`pending_payload_${generatedUuid}`, JSON.stringify(recoveryPayload));
                  }
                } catch { /* nəzərə alınmır */ }

                const retryCreateOrder = async (attempt = 0) => {
                  try {
                    let nextId = null;
                    try {
                      const nextIdRes = await dispatch(getNextOrderId(profileId)).unwrap();
                      nextId = nextIdRes?.data?.nextId;
                    } catch (e) {
                      console.warn("getNextOrderId failed, using backend-generated id", e);
                    }

                    const payload = {
                      ...recoveryPayload,
                      uuid: generatedUuid,
                      ...(nextId && { id: nextId }),
                    };

                    const res = await dispatch(saleNewOrders(payload)).unwrap();
                    const serverOrder = res?.data;
                    const finalId = serverOrder?.id ?? res?.count;
                    if (finalId) {
                      dispatch(updateOrderOptimisticId({ uuid: generatedUuid, newOrderData: { id: finalId } }));
                    }

                    // Uğurlu oldu — localStorage-dan təmizlə
                    try {
                      const pending = JSON.parse(localStorage.getItem("pending_order_uuids") || "[]");
                      const idx = pending.indexOf(generatedUuid);
                      if (idx !== -1) {
                        pending.splice(idx, 1);
                        localStorage.setItem("pending_order_uuids", JSON.stringify(pending));
                        localStorage.removeItem(`pending_payload_${generatedUuid}`);
                      }
                    } catch { /* nəzərə alınmır */ }
                  } catch (err) {
                    console.error(`API Create Error (attempt ${attempt + 1}):`, err);
                    // 3 dəfəyə qədər retry (1s, 2s, 4s gözlə)
                    if (attempt < 2) {
                      const delay = Math.pow(2, attempt) * 1000;
                      await new Promise(r => setTimeout(r, delay));
                      return retryCreateOrder(attempt + 1);
                    }
                  }
                };

                retryCreateOrder();
              })();
            } catch (e) {
              console.error("Order yaratma xetasi:", e);
              toast.error(t("order_create_failed"));
            }
          } else {
            toast.error(t("data_missing_refresh"));
          }
        } else {
          setSelectedTable(table);
          setShowModal(true);
        }
      }
    },
    [
      id,
      dispatch,
      currentHallId,
      loginedProfileData,
      navigate,
      tableGroups,
      currentHallData,
      isTableEditMode,
      loginedWaiter,
    ],
  );

  // Drag Handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Optional: Set ghost image
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newTables = [...currentTables];
    const [movedItem] = newTables.splice(draggedIndex, 1);
    newTables.splice(dropIndex, 0, movedItem);

    const newOrderIds = newTables.map((t) => t.id);

    dispatch(
      setTempTableOrder({
        hallId: currentHallId,
        order: newOrderIds,
      }),
    );

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Canvas Interaction Handlers
  const handleInteractionStart = (e, table, type) => {
    if (!isTableEditMode) return;
    e.stopPropagation();

    const clientX = e.type.startsWith("touch")
      ? e.touches[0].clientX
      : e.clientX;
    const clientY = e.type.startsWith("touch")
      ? e.touches[0].clientY
      : e.clientY;

    const defaultLayout = generatedLayout[table.id] || { x: 0, y: 0 };
    const layout = activeLayouts?.[String(table.id)] || defaultLayout;

    const { w: defaultW, h: defaultH } = defaultSizeForTableShape(table.shape_type);

    // Ignore admin small sizes (< 150px), use POS defaults
    const currentW = layout.w && layout.w >= MIN_VALID_TABLE_SIZE ? layout.w : defaultW;
    const currentH = layout.h && layout.h >= MIN_VALID_TABLE_SIZE ? layout.h : defaultH;

    setInteractionState({
      type,
      tableId: table.id,
      startX: clientX,
      startY: clientY,
      initialLeft: layout.x || 0,
      initialTop: layout.y || 0,
      initialWidth: currentW,
      initialHeight: currentH,
      rotation: layout.rotation || 0,
    });
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (!interactionState.type || !isTableEditMode) return;

      const clientX = e.type.startsWith("touch")
        ? e.touches[0].clientX
        : e.clientX;
      const clientY = e.type.startsWith("touch")
        ? e.touches[0].clientY
        : e.clientY;

      if (interactionState.type === "drag") {
        const dx = clientX - interactionState.startX;
        const dy = clientY - interactionState.startY;

        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          dragMoveRef.current = true;
        }

        const newX = interactionState.initialLeft + dx;
        const newY = interactionState.initialTop + dy;

        dispatch(
          setTempTableLayout({
            hallId: currentHallId,
            layout: {
              [interactionState.tableId]: {
                x: newX,
                y: newY,
                w: interactionState.initialWidth,
                h: interactionState.initialHeight,
                rotation: interactionState.rotation,
              },
            },
          }),
        );
      } else if (interactionState.type === "resize") {
        const dx = clientX - interactionState.startX;
        const dy = clientY - interactionState.startY;

        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          dragMoveRef.current = true;
        }

        const newW = Math.max(100, interactionState.initialWidth + dx);
        const newH = Math.max(100, interactionState.initialHeight + dy);

        dispatch(
          setTempTableLayout({
            hallId: currentHallId,
            layout: {
              [interactionState.tableId]: {
                x: interactionState.initialLeft,
                y: interactionState.initialTop,
                w: newW,
                h: newH,
                rotation: interactionState.rotation,
              },
            },
          }),
        );
      }
    };

    const handleEnd = () => {
      if (interactionState.type) {
        if (!dragMoveRef.current && interactionState.type === "drag" && interactionState.tableId) {
          setSelectedEditTableId(interactionState.tableId);
        }
        // Re-sync singleX/singleY/singleW/singleH after drag/resize
        if (dragMoveRef.current && interactionState.tableId) {
          const tid = String(interactionState.tableId);
          const updatedLayouts = { ...(tempTableLayouts[String(currentHallId)] || {}), ...(activeLayouts || {}) };
          const latest = updatedLayouts[tid];
          if (latest && selectedEditTableId === interactionState.tableId) {
            setSingleX(String(Math.round(latest.x || 0)));
            setSingleY(String(Math.round(latest.y || 0)));
            if (latest.w && latest.w >= MIN_VALID_TABLE_SIZE) setSingleW(String(latest.w));
            if (latest.h && latest.h >= MIN_VALID_TABLE_SIZE) setSingleH(String(latest.h));
            setSingleRotation(latest.rotation || 0);
          }
        }
        dragMoveRef.current = false;
        setInteractionState({ type: null, tableId: null });
      }
    };

    if (isTableEditMode) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleMove, { passive: false });
      window.addEventListener("touchend", handleEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [interactionState, isTableEditMode, currentHallId, dispatch]);

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const tableTouchRef = useRef({ startIndex: null, currentIndex: null });

  const handleTableTouchStart = (index) => {
    if (!isTableEditMode) return;
    tableTouchRef.current.startIndex = index;
    setDraggedIndex(index);
  };

  const handleTableTouchMove = (e) => {
    if (!isTableEditMode || tableTouchRef.current.startIndex === null) return;
    if (e.cancelable) e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el) {
      const col = el.closest(".drag-target");
      if (col) {
        const allItems = Array.from(col.parentElement.children).filter((c) =>
          c.classList.contains("drag-target"),
        );
        const idx = allItems.indexOf(col);
        if (idx !== -1) {
          tableTouchRef.current.currentIndex = idx;
          setDragOverIndex(idx);
        }
      }
    }
  };

  const handleTableTouchEnd = () => {
    if (!isTableEditMode) return;
    const { startIndex, currentIndex } = tableTouchRef.current;
    if (
      startIndex !== null &&
      currentIndex !== null &&
      startIndex !== currentIndex
    ) {
      const newTables = [...currentTables];
      const [movedItem] = newTables.splice(startIndex, 1);
      newTables.splice(currentIndex, 0, movedItem);
      const newOrderIds = newTables.map((t) => t.id);
      dispatch(
        setTempTableOrder({ hallId: currentHallId, order: newOrderIds }),
      );
    }
    tableTouchRef.current = { startIndex: null, currentIndex: null };
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleApplySingleSize = () => {
    if (!selectedEditTableId) return;
    const w = parseInt(singleW, 10) || 200;
    const h = parseInt(singleH, 10) || 200;
    const x = parseInt(singleX, 10) || 0;
    const y = parseInt(singleY, 10) || 0;
    dispatch(
      setTempTableLayout({
        hallId: currentHallId,
        layout: {
          [String(selectedEditTableId)]: {
            x,
            y,
            rotation: singleRotation,
            w,
            h,
          },
        },
      }),
    );
  };

  const handleApplyBulkSize = () => {
    const w = parseInt(bulkW, 10) || 200;
    const h = parseInt(bulkH, 10) || 200;
    const hallLayouts = tempTableLayouts[String(currentHallId)] || {};
    const layoutUpdates = {};
    currentTables.forEach((table) => {
      const defaultLayout = generatedLayout[table.id] || { x: 20, y: 20 };
      const existing = hallLayouts[String(table.id)] || defaultLayout;
      layoutUpdates[String(table.id)] = {
        x: existing.x ?? defaultLayout.x,
        y: existing.y ?? defaultLayout.y,
        rotation: existing.rotation || 0,
        w,
        h,
      };
    });
    dispatch(setTempTableLayout({ hallId: currentHallId, layout: layoutUpdates }));
  };

  const handleAutoArrange = () => {
    const containerW = containerRef.current?.offsetWidth || window.innerWidth;
    const containerH = containerRef.current?.offsetHeight || window.innerHeight;
    // Masalar arası sabit, kiçik boşluq — sütunu tam enə bölmək əvəzinə,
    // masaların öz eninə görə sıx düzülür (əvvəlki üsul böyük boş sahə
    // yaradırdı, xüsusən masa ölçüsü sütun enindən kiçik olanda)
    const GAP = 16;
    // arrangePadding string kimi saxlanılır (input boş qala bilsin deyə) — burada ədədə çeviririk
    const padTop = parseInt(arrangePadding.top, 10) || 0;
    const padBottom = parseInt(arrangePadding.bottom, 10) || 0;
    const padLeft = parseInt(arrangePadding.left, 10) || 0;
    const padRight = parseInt(arrangePadding.right, 10) || 0;

    const layoutUpdates = {};
    let currentX = padLeft;
    let currentY = padTop;
    let rowMaxH = 0;

    currentTables.forEach((table) => {
      const defaultLayout = generatedLayout[table.id] || { x: 0, y: 0 };
      const existingLayout = activeLayouts?.[String(table.id)] || defaultLayout;
      const { w: defaultW, h: defaultH } = defaultSizeForTableShape(table.shape_type);
      // İstifadəçinin özü verdiyi ölçü saxlanılır — avto düzləş yenidən
      // böyütmür/kiçiltmir, yalnız yerini dəyişir
      const tW = existingLayout.w && existingLayout.w >= MIN_VALID_TABLE_SIZE ? existingLayout.w : defaultW;
      const tH = existingLayout.h && existingLayout.h >= MIN_VALID_TABLE_SIZE ? existingLayout.h : defaultH;

      if (currentX > padLeft && currentX + tW > containerW - padRight) {
        currentX = padLeft;
        currentY += rowMaxH + GAP;
        rowMaxH = 0;
      }

      layoutUpdates[String(table.id)] = {
        x: currentX,
        y: currentY,
        w: tW,
        h: tH,
        rotation: 0,
      };

      currentX += tW + GAP;
      rowMaxH = Math.max(rowMaxH, tH);
    });

    // Bütün blokun şaquli mövqeyi: Yuxarı (default, heç bir sürüşmə yoxdur),
    // Ortada və ya Aşağı — hər kənardan verilən boşluqlar nəzərə alınır
    if (arrangePosition !== "top") {
      const contentBottom = currentY + rowMaxH;
      const contentHeight = contentBottom - padTop;
      const availableHeight = Math.max(0, containerH - padTop - padBottom);
      const extraSpace = availableHeight - contentHeight;
      if (extraSpace > 0) {
        const offsetY = arrangePosition === "center" ? extraSpace / 2 : extraSpace; // "bottom"
        Object.values(layoutUpdates).forEach((layout) => {
          layout.y += offsetY;
        });
      }
    }

    dispatch(setTempTableLayout({ hallId: currentHallId, layout: layoutUpdates }));
    dispatch(setTempTableOrder({ hallId: currentHallId, order: currentTables.map((t) => t.id) }));
  };

  if (currentTables.length === 0) {
    if (isTablesLoading) {
      return <Container className="mt-4" />;
    }
    return (
      <Container className="mt-4">
        <Alert variant="warning" className="text-center shadow-sm border-0">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>{t("daxil_etdiyiniz_zalda_aktiv_masa_tapilmadi_zehmet_olmasa_basqa_zal_secin_ve_ya_admin_panelinden_masalar_elave_edin")}</Alert>
      </Container>
    );
  }

  if (isPacksOnly) return null;

  return (
    <>
      {showGuestCountBar && guestCountSummary.total > 0 && (
        <div className="guest-count-summary-bar">
          <span className="gcs-hall-name">
            <i className="bi bi-door-open-fill"></i>
            {currentHallData?.name || t("zal")}
          </span>
          <span className="gcs-divider" />
          <span className="gcs-item">
            <i className="bi bi-people-fill"></i>
            {guestCountSummary.open} {t("qonaq")}
          </span>
          {guestCountSummary.locked > 0 && (
            <span className="gcs-item gcs-locked">
              <i className="bi bi-lock-fill"></i>
              {guestCountSummary.locked} {t("qonaq")}
            </span>
          )}
        </div>
      )}
      <Container
        fluid
        className="tables-scroll-container position-relative"
        style={useCanvasMode ? { paddingLeft: 0, paddingRight: 0 } : {}}
        ref={containerRef}
      >
        {useCanvasMode && currentTables.length > 0 ? (
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              minHeight: "80vh",
            }}
          >
            {/* Distance Lines SVG Overlay */}
            {isTableEditMode && selectedEditTableId && (() => {
              const selLayout = activeLayouts?.[String(selectedEditTableId)] || generatedLayout[selectedEditTableId] || { x: 0, y: 0 };
              const selTbl = currentTables.find((t) => t.id === selectedEditTableId);
              const selDefSz = defaultSizeForTableShape(selTbl?.shape_type);
              const selW = (selLayout.w && selLayout.w >= MIN_VALID_TABLE_SIZE) ? selLayout.w : selDefSz.w;
              const selH = (selLayout.h && selLayout.h >= MIN_VALID_TABLE_SIZE) ? selLayout.h : selDefSz.h;
              const selCX = (selLayout.x || 0) + selW / 2;
              const selCY = (selLayout.y || 0) + selH / 2;

              // Calculate distances to all other tables
              const distances = currentTables
                .filter((t) => t.id !== selectedEditTableId)
                .map((t) => {
                  const tLayout = activeLayouts?.[String(t.id)] || generatedLayout[t.id] || { x: 0, y: 0 };
                  const tDefSz = defaultSizeForTableShape(t.shape_type);
                  const tW = (tLayout.w && tLayout.w >= MIN_VALID_TABLE_SIZE) ? tLayout.w : tDefSz.w;
                  const tH = (tLayout.h && tLayout.h >= MIN_VALID_TABLE_SIZE) ? tLayout.h : tDefSz.h;
                  const tCX = (tLayout.x || 0) + tW / 2;
                  const tCY = (tLayout.y || 0) + tH / 2;
                  const dist = Math.round(Math.sqrt(Math.pow(selCX - tCX, 2) + Math.pow(selCY - tCY, 2)));
                  return { id: t.id, cx: tCX, cy: tCY, dist, name: t.name };
                })
                .sort((a, b) => a.dist - b.dist)
                .slice(0, 4);

              return (
                <svg className="distance-lines-overlay">
                  {distances.map((d) => {
                    const midX = (selCX + d.cx) / 2;
                    const midY = (selCY + d.cy) / 2;
                    const label = `${d.dist}px`;
                    const labelWidth = label.length * 7 + 12;
                    return (
                      <g key={d.id}>
                        <line
                          x1={selCX} y1={selCY}
                          x2={d.cx} y2={d.cy}
                          stroke="#053796"
                          strokeWidth="1.5"
                          strokeDasharray="6 4"
                          opacity="0.6"
                        />
                        <rect
                          className="distance-label-bg"
                          x={midX - labelWidth / 2}
                          y={midY - 10}
                          width={labelWidth}
                          height={20}
                          rx="6"
                          ry="6"
                          opacity="0.9"
                        />
                        <text
                          className="distance-label-text"
                          x={midX}
                          y={midY + 4}
                          textAnchor="middle"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              );
            })()}

            {currentTables.map((table) => {
              const defaultLayout = generatedLayout[table.id] || {
                x: 20,
                y: 20,
              };
              const layout = activeLayouts?.[String(table.id)] || defaultLayout;

              const { w: defaultW, h: defaultH } = defaultSizeForTableShape(
                table.shape_type,
              );
              const rotation = layout.rotation || 0;

              // Ignore admin small sizes (< 150px), use POS shape-based defaults
              const rawW = layout.w;
              const rawH = layout.h;
              const posW = rawW && rawW >= MIN_VALID_TABLE_SIZE ? rawW : defaultW;
              const posH = rawH && rawH >= MIN_VALID_TABLE_SIZE ? rawH : defaultH;

              const isSelected = isTableEditMode && selectedEditTableId === table.id;
              const style = {
                position: "absolute",
                left: layout.x,
                top: layout.y,
                width: posW,
                height: posH,
                zIndex: interactionState.tableId === table.id ? 100 : isSelected ? 50 : 1,
                cursor: isTableEditMode ? "move" : "default",
                transform: rotation ? `rotate(${rotation}deg)` : undefined,
                transformOrigin: "center center",
                transition:
                  !transitionsEnabled || interactionState.tableId === table.id
                    ? "none"
                    : "all 0.2s ease",
                outline: isSelected ? "3px solid #053796" : undefined,
                borderRadius: isSelected ? "10px" : undefined,
              };

              return (
                <div
                  key={table.id}
                  style={style}
                  onMouseDown={(e) => handleInteractionStart(e, table, "drag")}
                  onTouchStart={(e) => handleInteractionStart(e, table, "drag")}
                >
                  <Table
                    table={table}
                    onTableClick={handleTableClick}
                    loginedWaiter={loginedWaiter}
                    rotation={rotation}
                    customStyle={{
                      width: posW + "px",
                      height: posH + "px",
                      transform: "none",
                      margin: 0,
                    }}
                  />
                  {isTableEditMode && (
                    <>
                      {/* Fırlatma düyməsi — yuxarı sol */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const newRotation = (rotation + 90) % 360;
                          dispatch(
                            setTempTableLayout({
                              hallId: currentHallId,
                              layout: {
                                [table.id]: {
                                  ...layout,
                                  rotation: newRotation,
                                },
                              },
                            }),
                          );
                        }}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "24px",
                          height: "24px",
                          background: "#053796",
                          borderRadius: "0 0 50% 0",
                          cursor: "pointer",
                          zIndex: 102,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <i
                          className="bi bi-arrow-clockwise text-white"
                          style={{ fontSize: "12px" }}
                        ></i>
                      </div>
                      {/* Forma dəyişdirmə düyməsi — yuxarı sağ */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTableForShape(table);
                          setShowShapeModal(true);
                        }}
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          width: "24px",
                          height: "24px",
                          background: "#059669",
                          borderRadius: "0 0 0 50%",
                          cursor: "pointer",
                          zIndex: 102,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <i
                          className="bi bi-shuffle text-white"
                          style={{ fontSize: "12px" }}
                        ></i>
                      </div>
                      {/* Ölçü dəyişdirmə düyməsi — aşağı sağ */}
                      <div
                        className="resize-handle"
                        onMouseDown={(e) =>
                          handleInteractionStart(e, table, "resize")
                        }
                        onTouchStart={(e) =>
                          handleInteractionStart(e, table, "resize")
                        }
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          width: "20px",
                          height: "20px",
                          background: "#053796",
                          borderRadius: "50% 0 50% 0",
                          cursor: "nwse-resize",
                          zIndex: 101,
                        }}
                      >
                        <i
                          className="bi bi-arrows-angle-expand text-white"
                          style={{
                            fontSize: "10px",
                            position: "absolute",
                            right: "3px",
                            bottom: "3px",
                          }}
                        ></i>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Row className="g-3">
            {currentTables.map((table, index) => (
              <Col
                xs={6}
                sm={4}
                md={4}
                lg={3}
                xl={2}
                xxl={2}
                key={table.id || table.name}
                className={`mb-3 d-flex justify-content-center ${isTableEditMode ? "drag-target" : ""}`}
                draggable={isTableEditMode}
                onDragStart={
                  isTableEditMode ? (e) => handleDragStart(e, index) : undefined
                }
                onDragOver={
                  isTableEditMode ? (e) => handleDragOver(e, index) : undefined
                }
                onDrop={
                  isTableEditMode ? (e) => handleDrop(e, index) : undefined
                }
                onDragEnd={isTableEditMode ? handleDragEnd : undefined}
                onTouchStart={
                  isTableEditMode
                    ? () => handleTableTouchStart(index)
                    : undefined
                }
                onTouchMove={isTableEditMode ? handleTableTouchMove : undefined}
                onTouchEnd={isTableEditMode ? handleTableTouchEnd : undefined}
                style={{
                  opacity: isTableEditMode && draggedIndex === index ? 0.4 : 1,
                  transform:
                    isTableEditMode &&
                    dragOverIndex === index &&
                    draggedIndex !== index
                      ? "scale(1.05)"
                      : "none",
                  transition: "none",
                  cursor: isTableEditMode ? "grab" : "default",
                }}
              >
                <div
                  style={{
                    pointerEvents: isTableEditMode ? "none" : "auto",
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <Table
                    table={table}
                    onTableClick={handleTableClick}
                    loginedWaiter={loginedWaiter}
                  />
                </div>
              </Col>
            ))}
          </Row>
        )}

        {/* Settings FAB & Modal */}
        {isTableEditMode && (
          <>
            {/* Settings FAB Button */}
            <button
              className="tsm-settings-fab"
              onClick={() => setShowSettingsModal(true)}
              title={t("tenzimlemeler")}
              style={{ background: themeFabColor }}
            >
              <i className="bi bi-sliders"></i>
            </button>

            {/* Settings Modal */}
            {showSettingsModal && (
              <div
                className="table-settings-modal-overlay"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowSettingsModal(false);
                }}
              >
                <div className="table-settings-modal">
                  {/* Header */}
                  <div className="tsm-modal-header">
                    <div className="tsm-modal-header-left">
                      <div className="tsm-modal-header-icon">
                        <i className="bi bi-sliders"></i>
                      </div>
                      <span className="tsm-modal-title">{t("masa_tenzimlemeleri")}</span>
                    </div>
                    <button
                      className="tsm-modal-close"
                      onClick={() => setShowSettingsModal(false)}
                    >
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>

                  {/* Body */}
                  <div className="tsm-modal-body">
                    {/* Selected Table Section */}
                    <div className="tsm-section">
                      <div className="tsm-section-title">
                        <i className="bi bi-cursor-fill"></i>
                        {t("selected_table")}
                      </div>

                      {selectedEditTableId ? (
                        <>
                          <div className="tsm-selected-name">
                            <span className="name-badge">
                              {currentTables.find((t) => t.id === selectedEditTableId)?.name || t("selected_table")}
                            </span>
                          </div>

                          {/* Position Inputs */}
                          <div className="tsm-input-grid">
                            <div className="tsm-input-group">
                              <span className="tsm-input-label">X (px)</span>
                              <input
                                type="number"
                                className="tsm-input primary"
                                value={singleX}
                                onChange={(e) => setSingleX(e.target.value)}
                              />
                            </div>
                            <div className="tsm-input-group">
                              <span className="tsm-input-label">Y (px)</span>
                              <input
                                type="number"
                                className="tsm-input primary"
                                value={singleY}
                                onChange={(e) => setSingleY(e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Size Inputs */}
                          <div className="tsm-input-grid" style={{ marginTop: "10px" }}>
                            <div className="tsm-input-group">
                              <span className="tsm-input-label">{t("width_px")}</span>
                              <input
                                type="number"
                                className="tsm-input"
                                value={singleW}
                                onChange={(e) => setSingleW(e.target.value)}
                                min={100}
                                max={600}
                              />
                            </div>
                            <div className="tsm-input-group">
                              <span className="tsm-input-label">{t("height_px_short")}</span>
                              <input
                                type="number"
                                className="tsm-input"
                                value={singleH}
                                onChange={(e) => setSingleH(e.target.value)}
                                min={100}
                                max={600}
                              />
                            </div>
                          </div>

                          {/* Rotation */}
                          <div style={{ marginTop: "10px" }}>
                            <span className="tsm-input-label">{t("firlanma")}</span>
                            <div className="tsm-rotation-row">
                              <button
                                className="tsm-rotation-btn"
                                onClick={() => setSingleRotation((prev) => (prev - 90 + 360) % 360)}
                              >
                                <i className="bi bi-arrow-counterclockwise"></i>
                              </button>
                              <span className="tsm-rotation-value">{singleRotation}°</span>
                              <button
                                className="tsm-rotation-btn"
                                onClick={() => setSingleRotation((prev) => (prev + 90) % 360)}
                              >
                                <i className="bi bi-arrow-clockwise"></i>
                              </button>
                            </div>
                          </div>

                          <button
                            className="tsm-btn tsm-btn-primary"
                            onClick={handleApplySingleSize}
                            style={{ marginTop: "12px" }}
                          >
                            <i className="bi bi-check-lg"></i>
                            {t("apply")}
                          </button>
                        </>
                      ) : (
                        <div className="tsm-empty-state">
                          <i className="bi bi-hand-index-thumb"></i>
                          {t("masa_secin")}
                        </div>
                      )}
                    </div>

                    <div className="tsm-divider" />

                    {/* Bulk Adjust Section */}
                    <div className="tsm-section">
                      <div className="tsm-section-title">
                        <i className="bi bi-grid-3x3-gap-fill"></i>
                        {t("bulk_adjust")}
                      </div>

                      <div className="tsm-input-grid">
                        <div className="tsm-input-group">
                          <span className="tsm-input-label">{t("width_px")}</span>
                          <input
                            type="number"
                            className="tsm-input"
                            value={bulkW}
                            onChange={(e) => setBulkW(e.target.value)}
                          />
                        </div>
                        <div className="tsm-input-group">
                          <span className="tsm-input-label">{t("height_px_short")}</span>
                          <input
                            type="number"
                            className="tsm-input"
                            value={bulkH}
                            onChange={(e) => setBulkH(e.target.value)}
                          />
                        </div>
                      </div>

                      <button
                        className="tsm-btn tsm-btn-primary"
                        onClick={handleApplyBulkSize}
                        style={{ marginTop: "10px" }}
                      >
                        <i className="bi bi-arrows-fullscreen"></i>
                        {t("apply_all")}
                      </button>
                    </div>

                    {/* Auto-arrange: position + edge padding */}
                    <div className="tsm-section">
                      <div className="tsm-section-title">
                        <i className="bi bi-align-center"></i>
                        {t("movqe_avtomatik_duzulus")}
                      </div>

                      <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                        {[
                          { key: "top", label: t("yuxari") },
                          { key: "center", label: t("ortada") },
                          { key: "bottom", label: t("asagi") },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            className={`tsm-btn ${arrangePosition === opt.key ? "tsm-btn-primary" : "tsm-btn-outline"}`}
                            style={{ flex: 1, padding: "8px 6px" }}
                            onClick={() => updateArrangePosition(opt.key)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      <div className="tsm-input-label" style={{ marginBottom: "6px" }}>
                        {t("kenarlardan_bosluq_px")}
                      </div>
                      <div className="tsm-input-grid">
                        <div className="tsm-input-group">
                          <span className="tsm-input-label">{t("yuxari")}</span>
                          <input
                            type="number"
                            className="tsm-input"
                            value={arrangePadding.top}
                            onChange={(e) => updateArrangePadding("top", e.target.value)}
                          />
                        </div>
                        <div className="tsm-input-group">
                          <span className="tsm-input-label">{t("asagi")}</span>
                          <input
                            type="number"
                            className="tsm-input"
                            value={arrangePadding.bottom}
                            onChange={(e) => updateArrangePadding("bottom", e.target.value)}
                          />
                        </div>
                        <div className="tsm-input-group">
                          <span className="tsm-input-label">{t("sol")}</span>
                          <input
                            type="number"
                            className="tsm-input"
                            value={arrangePadding.left}
                            onChange={(e) => updateArrangePadding("left", e.target.value)}
                          />
                        </div>
                        <div className="tsm-input-group">
                          <span className="tsm-input-label">{t("sag")}</span>
                          <input
                            type="number"
                            className="tsm-input"
                            value={arrangePadding.right}
                            onChange={(e) => updateArrangePadding("right", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <button
                        className="tsm-btn tsm-btn-green"
                        onClick={handleAutoArrange}
                      >
                        <i className="bi bi-layout-wtf"></i>
                        {t("avtomatik_duzulus")}
                      </button>
                      <button
                        className="tsm-btn tsm-btn-red"
                        onClick={() => dispatch(clearHallLayout(currentHallId))}
                      >
                        <i className="bi bi-arrow-counterclockwise"></i>
                        {t("sifirla")}
                      </button>
                    </div>

                    <div className="tsm-divider" />

                    {/* Color Customization Section */}
                    <div className="tsm-section">
                      <div className="tsm-section-title">
                        <i className="bi bi-palette-fill"></i>
                        {t("reng_tenzimleme")}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {/* Header Color */}
                        <div className="tsm-color-row">
                          <span className="tsm-input-label">{t("header_rengi")}</span>
                          <div className="tsm-color-picker-wrap">
                            <input
                              type="color"
                              className="tsm-color-input"
                              value={themeHeaderColor}
                              onChange={(e) => setThemeHeaderColor(e.target.value)}
                            />
                            <span className="tsm-color-hex">{themeHeaderColor}</span>
                          </div>
                        </div>

                        {/* Background Color */}
                        <div className="tsm-color-row">
                          <span className="tsm-input-label">{t("arxa_plan_rengi")}</span>
                          <div className="tsm-color-picker-wrap">
                            <input
                              type="color"
                              className="tsm-color-input"
                              value={themeBgColor}
                              onChange={(e) => setThemeBgColor(e.target.value)}
                            />
                            <span className="tsm-color-hex">{themeBgColor}</span>
                          </div>
                        </div>

                        {/* Table Surface Color */}
                        <div className="tsm-color-row">
                          <span className="tsm-input-label">{t("masa_rengi")}</span>
                          <div className="tsm-color-picker-wrap">
                            <input
                              type="color"
                              className="tsm-color-input"
                              value={themeTableColor}
                              onChange={(e) => setThemeTableColor(e.target.value)}
                            />
                            <span className="tsm-color-hex">{themeTableColor}</span>
                          </div>
                        </div>

                        {/* FAB Button Color */}
                        <div className="tsm-color-row">
                          <span className="tsm-input-label">{t("duyme_rengi")}</span>
                          <div className="tsm-color-picker-wrap">
                            <input
                              type="color"
                              className="tsm-color-input"
                              value={themeFabColor}
                              onChange={(e) => setThemeFabColor(e.target.value)}
                            />
                            <span className="tsm-color-hex">{themeFabColor}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                        <button
                          className="tsm-btn tsm-btn-primary"
                          onClick={handleSaveTheme}
                          style={{ flex: 1 }}
                        >
                          <i className="bi bi-check-lg"></i>
                          Saxla
                        </button>
                        <button
                          className="tsm-btn tsm-btn-outline"
                          onClick={handleResetTheme}
                          style={{ flex: 1 }}
                        >
                          <i className="bi bi-arrow-counterclockwise"></i>
                          Defolt
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Floating Edit Button / Save Bar */}
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: 1000,
            display: "flex",
            gap: "10px",
          }}
        >
          {isTableEditMode ? (
            <>
              {/* Rənglər proqramın öz palitrasındandır: əsas əməliyyat brend
                  mavisi (#053796 — "Redaktə et" düyməsi ilə eyni), ləğv isə
                  ikinci dərəcəli ağ düymədir. Əvvəl qırmızı/yaşıl idi və
                  başlıqla, masa kartları ilə uyuşmurdu.

                  `key` MƏCBURİDİR: açarsız React "Düzəliş et" düyməsinin DOM
                  elementini təkrar işlədir və yalnız rəngini dəyişir. Bootstrap
                  `.btn`-də 0.15s `background-color` keçidi olduğu üçün düymə
                  mavidən ağa "axırdı". Ayrı açar → köhnə element silinir,
                  yenisi yaranır, keçid baş vermir. */}
              <button
                key="table-design-cancel"
                className="btn d-flex align-items-center gap-2 shadow-lg"
                onClick={() => dispatch(cancelEditMode())}
                style={{
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  borderRadius: "50px",
                  padding: "10px 20px",
                }}
              >
                <i className="bi bi-x-lg"></i>
                <span className="d-none d-md-inline">{t("cancel")}</span>
              </button>
              <button
                key="table-design-save"
                className="btn d-flex align-items-center gap-2 shadow-lg"
                onClick={() => dispatch(saveTableLayouts())}
                style={{
                  backgroundColor: "#053796",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "50px",
                  padding: "10px 20px",
                }}
              >
                <i className="bi bi-check-lg"></i>
                <span className="d-none d-md-inline">{t("save")}</span>
              </button>
            </>
          ) : (
            Number(loginedWaiter?.data?.can_edit_table_design) === 1 && (
              <button
                key="table-design-edit"
                className="btn btn-primary d-flex align-items-center gap-2 shadow-lg"
                onClick={() => dispatch(startEditMode())}
                style={{
                  backgroundColor: "#053796",
                  border: "none",
                  borderRadius: "50px",
                  padding: "12px 24px",
                  fontSize: "16px",
                }}
              >
                <i className="bi bi-pencil-fill"></i>
                <span className="d-none d-md-inline">{t("edit")}</span>
              </button>
            )
          )}
        </div>
      </Container>

      {/* Table Shape Modal */}
      <TableShapeModal
        show={showShapeModal}
        onHide={() => {
          setShowShapeModal(false);
          setSelectedTableForShape(null);
        }}
        currentShape={selectedTableForShape?.shape_type || "square"}
        onSelect={async (newShape) => {
          if (!selectedTableForShape) return;
          try {
            await axios.put(`/tables/${selectedTableForShape.id}`, {
              shape_type: newShape,
            });
            toast.success(t("table_shape_changed"));
            dispatch(getTableGroups(loginedProfileData?.data?.profile?.id));
            setShowShapeModal(false);
            setSelectedTableForShape(null);
          } catch (error) {
            toast.error(t("table_shape_error"));
            console.error(error);
          }
        }}
      />

      {/* Global Modals */}
      <CustomersModal
        show={showModal}
        onHide={() => setShowModal(false)}
        table={selectedTable}
        selectedHall={currentHallData}
        autoCreate={localStorage.getItem("unipos_skip_guest_count") === "1"}
      />

      <OtherChecks
        show={showOtherChecks}
        onClose={() => setShowOtherChecks(false)}
        table={selectedTable}
        onCreateNew={async () => {
          setShowOtherChecks(false);
          const guard = await checkShiftGuard(loginedProfileData);
          if (guard.blocked) {
            toast.error(
              guard.reason || t("shift_not_open"),
            );
            return;
          }
          setShowModal(true);
        }}
      />
    </>
  );
};

export default Tables;
