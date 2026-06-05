import React, { useMemo, useState, useEffect, useRef } from "react";
import { Container, Row, Col, Alert } from "react-bootstrap";
import "./Tables.css";
import Table from "../Table/Table";
import TableShapeModal from "../TableShapeModal/TableShapeModal";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import CustomersModal from "../Customers-Modal/CustomersModal";
import OtherChecks from "../OtherChecks/OtherChecks";
import { updateTableOrders } from "../../redux/Slices/OrdersSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import {
  getTableGroups,
  setTempTableOrder,
  startEditMode,
  cancelEditMode,
  saveEditMode,
  setTempTableLayout,
  clearHallLayout,
  loadLayoutsFromAdmin,
  loadLocalLayouts,
  saveTableLayouts,
  updateLocalLayoutsFromServer,
} from "../../redux/Slices/TablesSlice";
import { toast } from "sonner";
import { getSocket } from "../../utils/apiConfig";
import { isPacksOnlyWaiter } from "../../utils/waiterPermissions";
import { checkShiftGuard } from "../../utils/shiftGuard";
import { normalizeTableShape } from "../../utils/tableShape";
import axios from "../../utils/apiConfig";

/** Kanvas (layout) üçün forma əsaslı default en/hünd. — bilyar eni geniş, alçaq */
const defaultSizeForTableShape = (rawShape) => {
  const s = normalizeTableShape(rawShape);
  if (s === "rectangle") return { w: 200, h: 300 };
  if (s === "billiard") return { w: 280, h: 180 };
  return { w: 200, h: 200 };
};

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

  // Edit Mode & Ordering States (Drag indices kept local as they are transient UI state)
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Bulk edit panel state (stored as strings so user can freely type/clear)
  const [bulkW, setBulkW] = useState("200");
  const [bulkH, setBulkH] = useState("200");

  // Single table selection state
  const dragMoveRef = useRef(false);
  const [selectedEditTableId, setSelectedEditTableId] = useState(null);
  const [singleW, setSingleW] = useState("200");
  const [singleH, setSingleH] = useState("200");

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

  // Sync singleW/singleH when a table is selected in edit mode
  useEffect(() => {
    if (!selectedEditTableId) return;
    const hallLayouts = tempTableLayouts[String(currentHallId)] || tableLayouts[String(currentHallId)] || {};
    const tbl = currentTables.find((t) => t.id === selectedEditTableId);
    const defLayout = generatedLayout[selectedEditTableId] || { x: 20, y: 20 };
    const existing = hallLayouts[String(selectedEditTableId)] || defLayout;
    const defSz = defaultSizeForTableShape(tbl?.shape_type);
    const rawW = existing.w;
    const rawH = existing.h;
    setSingleW(String(rawW && rawW >= 150 ? rawW : defSz.w));
    setSingleH(String(rawH && rawH >= 150 ? rawH : defSz.h));
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

    const w = window.innerWidth;
    let cols = 2; // xs
    if (w >= 1200)
      cols = 5; // xl
    else if (w >= 992)
      cols = 4; // lg
    else if (w >= 768)
      cols = 3; // md
    else if (w >= 576) cols = 3; // sm

    const containerW = containerRef.current?.offsetWidth || w;
    const colWidth = containerW / cols;

    const layout = {};
    let currentRow = 0;
    let currentY = 20;
    let rowMaxH = 0;

    currentTables.forEach((table, index) => {
      const col = index % cols;
      const h = defaultSizeForTableShape(table.shape_type).h;

      if (col === 0 && index !== 0) {
        currentY += rowMaxH + 20;
        rowMaxH = 0;
      }

      rowMaxH = Math.max(rowMaxH, h);
      const offsetX = Math.max(0, (colWidth - 200) / 2);

      layout[table.id] = {
        x: col * colWidth + offsetX,
        y: currentY,
        w: undefined,
        h: undefined,
      };
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

  // Debug logging for mobile white-screen investigation
  useEffect(() => {
    if (!tableGroups?.data) {
      console.warn("[TABLES] No tableGroups data available yet.");
    }
  }, [tableGroups]);

  // Handle Socket.IO Real-Time Table Synchronization
  const lastSyncRef = useRef(0);
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTableUpdated = (data) => {
      const now = Date.now();
      if (now - lastSyncRef.current < 400) return;

      if (loginedProfileData?.data?.profile?.id) {
        lastSyncRef.current = now;
        // Kiçik gecikmə — DB yazma əməliyyatı tamamlansın (Master-Slave: print_count, status dəyişikliyi)
        setTimeout(() => {
          dispatch(getTableGroups(loginedProfileData.data.profile.id));
          dispatch(
            getActiveOrders({
              profileId: loginedProfileData.data.profile.id,
              silentRefresh: true,
            }),
          );
        }, 150);
      }
    };

    const handleLocalLayoutsUpdated = (layouts) => {
      dispatch(updateLocalLayoutsFromServer(layouts));
    };

    socket.on("table_updated", handleTableUpdated);
    socket.on("local_layouts_updated", handleLocalLayoutsUpdated);

    return () => {
      socket.off("table_updated", handleTableUpdated);
      socket.off("local_layouts_updated", handleLocalLayoutsUpdated);
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
        toast.error("İcazəniz yoxdur: Bu masa başqa ofisianta aiddir.");
        return;
      }

      if (id) {
        try {
          const waiterName =
            loginedWaiter?.data?.name ||
            loginedProfileData?.data?.profile?.name ||
            "Naməlum";

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
            targetHall?.name || currentHallData?.name || "Naməlum";

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

          toast.success("Masa uğurla dəyişdirildi");
          dispatch(getTableGroups(loginedProfileData.data.profile.id));
          navigate(`/check/${id}?tableId=${table?.id}`);
        } catch (error) {
          toast.error("Xəta baş verdi");
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
          toast.error(guard.reason || "Növbə açılmayıb. Əvvəlcə növbəni açın.");
          return;
        }
        setSelectedTable(table);
        setShowModal(true);
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
    const currentW = layout.w && layout.w >= 150 ? layout.w : defaultW;
    const currentH = layout.h && layout.h >= 150 ? layout.h : defaultH;

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
    const hallLayouts = tempTableLayouts[String(currentHallId)] || {};
    const defLayout = generatedLayout[selectedEditTableId] || { x: 20, y: 20 };
    const existing = hallLayouts[String(selectedEditTableId)] || defLayout;
    dispatch(
      setTempTableLayout({
        hallId: currentHallId,
        layout: {
          [String(selectedEditTableId)]: {
            x: existing.x ?? defLayout.x,
            y: existing.y ?? defLayout.y,
            rotation: existing.rotation || 0,
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
    const vw = window.innerWidth;
    let cols = 2;
    if (vw >= 1200) cols = 5;
    else if (vw >= 992) cols = 4;
    else if (vw >= 768) cols = 3;
    else if (vw >= 576) cols = 3;

    const colWidth = containerW / cols;
    const layoutUpdates = {};
    let currentY = 20;
    let rowMaxH = 0;

    currentTables.forEach((table, index) => {
      const col = index % cols;
      const { w: tW, h: tH } = defaultSizeForTableShape(table.shape_type);

      if (col === 0 && index !== 0) {
        currentY += rowMaxH + 20;
        rowMaxH = 0;
      }
      rowMaxH = Math.max(rowMaxH, tH);

      const offsetX = Math.max(0, (colWidth - tW) / 2);
      layoutUpdates[String(table.id)] = {
        x: col * colWidth + offsetX,
        y: currentY,
        w: tW,
        h: tH,
        rotation: 0,
      };
    });

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
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Daxil etdiyiniz zalda aktiv masa tapılmadı. Zəhmət olmasa başqa zal
          seçin və ya admin panelindən masalar əlavə edin.
        </Alert>
      </Container>
    );
  }

  if (isPacksOnly) return null;

  return (
    <>
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
              const posW = rawW && rawW >= 150 ? rawW : defaultW;
              const posH = rawH && rawH >= 150 ? rawH : defaultH;

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

        {/* Bulk Edit Panel */}
        {isTableEditMode && (
          <div
            style={{
              position: "fixed",
              bottom: "20px",
              left: "20px",
              zIndex: 1000,
              background: "white",
              borderRadius: "14px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              minWidth: "210px",
            }}
          >
            {selectedEditTableId ? (
              <>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#374151" }}>
                  <i className="bi bi-cursor-fill me-1" style={{ color: "#053796" }}></i>
                  {currentTables.find((t) => t.id === selectedEditTableId)?.name || "Seçilmiş masa"}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "3px" }}>En (px)</div>
                    <input
                      type="number"
                      value={singleW}
                      onChange={(e) => setSingleW(e.target.value)}
                      min={100}
                      max={600}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        width: "100%",
                        padding: "5px 8px",
                        borderRadius: "8px",
                        border: "1px solid #053796",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "3px" }}>Hündürlük (px)</div>
                    <input
                      type="number"
                      value={singleH}
                      onChange={(e) => setSingleH(e.target.value)}
                      min={100}
                      max={600}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        width: "100%",
                        padding: "5px 8px",
                        borderRadius: "8px",
                        border: "1px solid #053796",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
                <button
                  className="btn btn-sm"
                  onClick={handleApplySingleSize}
                  style={{
                    background: "#053796",
                    color: "white",
                    borderRadius: "8px",
                    fontSize: "13px",
                    padding: "6px 10px",
                  }}
                >
                  <i className="bi bi-check-lg me-1"></i>
                  Tətbiq et
                </button>
                <div style={{ borderTop: "1px solid #e5e7eb", margin: "2px 0" }} />
              </>
            ) : (
              <div style={{ fontSize: "12px", color: "#9ca3af", textAlign: "center" }}>
                Masanı seçmək üçün tıklayın
              </div>
            )}
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#053796" }}>
              <i className="bi bi-grid-3x3-gap-fill me-1"></i>
              Toplu tənzimləmə
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "3px" }}>En (px)</div>
                <input
                  type="number"
                  value={bulkW}
                  onChange={(e) => setBulkW(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    padding: "5px 8px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "3px" }}>Hündürlük (px)</div>
                <input
                  type="number"
                  value={bulkH}
                  onChange={(e) => setBulkH(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    padding: "5px 8px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>
            </div>
            <button
              className="btn btn-sm"
              onClick={handleApplyBulkSize}
              style={{
                background: "#053796",
                color: "white",
                borderRadius: "8px",
                fontSize: "13px",
                padding: "6px 10px",
              }}
            >
              <i className="bi bi-arrows-fullscreen me-1"></i>
              Hamısına tətbiq et
            </button>
            <button
              className="btn btn-sm"
              onClick={handleAutoArrange}
              style={{
                background: "#059669",
                color: "white",
                borderRadius: "8px",
                fontSize: "13px",
                padding: "6px 10px",
              }}
            >
              <i className="bi bi-layout-wtf me-1"></i>
              Avtomatik sırala
            </button>
            <button
              className="btn btn-sm"
              onClick={() => dispatch(clearHallLayout(currentHallId))}
              style={{
                background: "#dc2626",
                color: "white",
                borderRadius: "8px",
                fontSize: "13px",
                padding: "6px 10px",
              }}
            >
              <i className="bi bi-arrow-counterclockwise me-1"></i>
              Hamısını sıfırla
            </button>
          </div>
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
              <button
                className="btn btn-danger d-flex align-items-center gap-2 shadow-lg"
                onClick={() => dispatch(cancelEditMode())}
                style={{ borderRadius: "50px", padding: "10px 20px" }}
              >
                <i className="bi bi-x-lg"></i>
                <span className="d-none d-md-inline">Ləğv et</span>
              </button>
              <button
                className="btn btn-success d-flex align-items-center gap-2 shadow-lg"
                onClick={() => dispatch(saveTableLayouts())}
                style={{ borderRadius: "50px", padding: "10px 20px" }}
              >
                <i className="bi bi-check-lg"></i>
                <span className="d-none d-md-inline">Yadda saxla</span>
              </button>
            </>
          ) : (
            Number(loginedWaiter?.data?.can_edit_table_design) === 1 && (
              <button
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
                <span className="d-none d-md-inline">Düzəliş et</span>
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
            toast.success("Masa forması dəyişdirildi");
            dispatch(getTableGroups(loginedProfileData?.data?.profile?.id));
            setShowShapeModal(false);
            setSelectedTableForShape(null);
          } catch (error) {
            toast.error("Masa forması dəyişdirilmədi");
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
              guard.reason || "Növbə açılmayıb. Əvvəlcə növbəni açın.",
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
