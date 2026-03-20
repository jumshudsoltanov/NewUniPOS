import React, { useMemo, useState, useEffect, useRef } from "react";
import { Container, Row, Col, Alert } from "react-bootstrap";
import "./Tables.css";
import Table from "../Table/Table";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import CustomersModal from "../Customers-Modal/CustomersModal";
import OtherChecks from "../OtherChecks/OtherChecks";
import { updateTableOrders } from "../../redux/Slices/OrdersSlice";
import {
  getTableGroups,
  setTempTableOrder,
  startEditMode,
  cancelEditMode,
  saveEditMode,
  setTempTableLayout
} from "../../redux/Slices/TablesSlice";
import { toast } from "sonner";
import { getSocket } from "../../utils/apiConfig";
import { isPacksOnlyWaiter } from "../../utils/waiterPermissions";

const Tables = () => {
  const {
    tableGroups,
    currentHallId,
    isTablesLoading,
    isTableEditMode,
    tableOrder,
    tempTableOrder,
    tableLayouts,
    tempTableLayouts
  } = useSelector((state) => state.TablesSlice);
  const [selectedTable, setSelectedTable] = React.useState(null);
  const [showModal, setShowModal] = React.useState(false);
  const [showOtherChecks, setShowOtherChecks] = React.useState(false);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams();


  // Edit Mode & Ordering States (Drag indices kept local as they are transient UI state)
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Custom Layout Interaction State
  const containerRef = useRef(null);
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);

  useEffect(() => {
    setTransitionsEnabled(false);
    const timer = setTimeout(() => setTransitionsEnabled(true), 100);
    return () => clearTimeout(timer);
  }, [currentHallId]);

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
    initialHeight: 0
  });


  const activeLayouts = isTableEditMode ? tempTableLayouts[currentHallId] : tableLayouts[currentHallId];
  const hasCustomLayout = activeLayouts && Object.keys(activeLayouts).length > 0;

  // Use Canvas Mode if active layouts or edit mode active
  const isCanvasMode = hasCustomLayout || isTableEditMode;




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
      activeOrder.forEach((id, index) => { orderMap[id] = index; });
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

  useEffect(() => {
    // Generate layout whenever tables or hall change
    if (currentTables.length > 0) {
      const w = window.innerWidth;
      let cols = 2; // xs
      if (w >= 1200) cols = 5; // xl
      else if (w >= 992) cols = 4; // lg
      else if (w >= 768) cols = 3; // md
      else if (w >= 576) cols = 3; // sm

      // Use a consistent width calculation
      const containerW = containerRef.current?.offsetWidth || w;
      const colWidth = containerW / cols;

      const layout = {};
      let currentRow = 0;
      let currentY = 20;
      let rowMaxH = 0;

      currentTables.forEach((table, index) => {
        const col = index % cols;
        const isRect = table.shape_type === "rectangle";
        const h = isRect ? 300 : 200;

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
          h: undefined
        };
      });

      setGeneratedLayout(layout);
    }
  }, [currentTables, currentHallId]);

  const currentHallData = useMemo(() => {
    if (!tableGroups?.data) return null;
    return tableGroups.data.find(hall => hall.id === currentHallId) || tableGroups.data[0];
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
      if (now - lastSyncRef.current < 300) return;

      if (loginedProfileData?.data?.profile?.id) {
        lastSyncRef.current = now;
        dispatch(getTableGroups(loginedProfileData.data.profile.id));
      }
    };

    socket.on("table_updated", handleTableUpdated);

    return () => {
      socket.off("table_updated", handleTableUpdated);
    };
  }, [dispatch, loginedProfileData]);

  
  const handleTableClick = React.useCallback(
    async (table) => {
      if (isTableEditMode) return;

      const { orders } = table || {};

      const hasOrders = orders && orders.length > 0;
      const waiterId = orders?.[0]?.waiter_id || orders?.[0]?.waiter?.id;
      const isMyTable = hasOrders && loginedWaiter?.data?.id && waiterId == loginedWaiter.data.id;
      const isOtherTable = hasOrders && !isMyTable;

      if (isPacksOnlyWaiter(loginedWaiter?.data)) {
        toast.error("İcazəniz yoxdur: Masada sifariş yarada və ya aça bilməzsiniz.");
        return;
      }

      if (Number(loginedWaiter?.data?.can_access_own_checks_only) === 0 && isOtherTable) {
        toast.error("İcazəniz yoxdur: Bu masa başqa ofisianta aiddir.");
        return;
      }

      if (id) {
        try {
          const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

          // Find old table and hall name
          let oldTableName = "Naməlum";
          let oldHallName = "Naməlum";
          if (tableGroups?.data) {
            for (const hall of tableGroups.data) {
              const tableWithOrder = hall.tables.find(t => t.orders?.some(o => o.uuid === id));
              if (tableWithOrder) {
                oldTableName = tableWithOrder.name;
                oldHallName = hall.name;
                break;
              }
            }
          }

          // Derive new hall name directly
          const targetHall = tableGroups?.data?.find(h => h.id === currentHallId);
          const newHallName = targetHall?.name || currentHallData?.name || "Naməlum";

          await dispatch(
            updateTableOrders({
              orderId: id,
              newTableId: table?.id,
              currentHallId,
              oldTableName,
              newTableName: table?.name,
              oldHallName,
              newHallName,
              waiterName
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
        navigate(`/check/${orders[0].uuid}?tableId=${table.id}`);
      } else {
        setSelectedTable(table);
        setShowModal(true);
      }
    },
    [id, dispatch, currentHallId, loginedProfileData, navigate, tableGroups, currentHallData, isTableEditMode, loginedWaiter],
  );

  // Drag Handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
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

    const newOrderIds = newTables.map(t => t.id);

    dispatch(setTempTableOrder({
      hallId: currentHallId,
      order: newOrderIds
    }));

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Canvas Interaction Handlers
  const handleInteractionStart = (e, table, type) => {
    if (!isTableEditMode) return;
    e.stopPropagation();

    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

    const defaultLayout = generatedLayout[table.id] || { x: 0, y: 0 };
    const layout = activeLayouts?.[table.id] || defaultLayout;

    // If layout doesn't have width/height, default to 200 or 300 based on type
    const isRect = table.shape_type === "rectangle";
    const defaultW = 200;
    const defaultH = isRect ? 300 : 200;

    const currentW = layout.w || defaultW;
    const currentH = layout.h || defaultH;

    setInteractionState({
      type,
      tableId: table.id,
      startX: clientX,
      startY: clientY,
      initialLeft: layout.x || 0,
      initialTop: layout.y || 0,
      initialWidth: currentW,
      initialHeight: currentH
    });
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (!interactionState.type || !isTableEditMode) return;

      const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

      if (interactionState.type === 'drag') {
        const dx = clientX - interactionState.startX;
        const dy = clientY - interactionState.startY;

        const newX = interactionState.initialLeft + dx;
        const newY = interactionState.initialTop + dy;

        dispatch(setTempTableLayout({
          hallId: currentHallId,
          layout: {
            [interactionState.tableId]: {
              x: newX,
              y: newY,
              w: interactionState.initialWidth,
              h: interactionState.initialHeight
            }
          }
        }));
      } else if (interactionState.type === 'resize') {
        const dx = clientX - interactionState.startX;
        const dy = clientY - interactionState.startY;

        const newW = Math.max(100, interactionState.initialWidth + dx);
        const newH = Math.max(100, interactionState.initialHeight + dy);

        dispatch(setTempTableLayout({
          hallId: currentHallId,
          layout: {
            [interactionState.tableId]: {
              x: interactionState.initialLeft,
              y: interactionState.initialTop,
              w: newW,
              h: newH
            }
          }
        }));
      }
    };

    const handleEnd = () => {
      if (interactionState.type) {
        setInteractionState({ type: null, tableId: null });
      }
    };

    if (isTableEditMode) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
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
      const col = el.closest('.drag-target');
      if (col) {
        const allItems = Array.from(col.parentElement.children).filter(c => c.classList.contains('drag-target'));
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
    if (startIndex !== null && currentIndex !== null && startIndex !== currentIndex) {
      const newTables = [...currentTables];
      const [movedItem] = newTables.splice(startIndex, 1);
      newTables.splice(currentIndex, 0, movedItem);
      const newOrderIds = newTables.map(t => t.id);
      dispatch(setTempTableOrder({ hallId: currentHallId, order: newOrderIds }));
    }
    tableTouchRef.current = { startIndex: null, currentIndex: null };
    setDraggedIndex(null);
    setDragOverIndex(null);
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
      <Container fluid className="tables-scroll-container position-relative" ref={containerRef}>
        {isCanvasMode && currentTables.length > 0 ? (
          <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '80vh' }}>
            {currentTables.map((table) => {
              const defaultLayout = generatedLayout[table.id] || { x: 20, y: 20 };
              const layout = activeLayouts?.[table.id] || defaultLayout;

              const isResized = layout.w !== undefined || layout.h !== undefined;
              const isRect = table.shape_type === "rectangle";
              const defaultH = isRect ? 300 : 200;

              const style = {
                position: 'absolute',
                left: layout.x,
                top: layout.y,
                width: layout.w || 200, // Default to CSS wrapper size if not set
                height: layout.h || defaultH,
                zIndex: interactionState.tableId === table.id ? 100 : 1,
                cursor: isTableEditMode ? 'move' : 'default',
                transition: (!transitionsEnabled || interactionState.tableId === table.id) ? 'none' : 'all 0.2s ease'
              };

              return (
                <div
                  key={table.id}
                  style={style}
                  onMouseDown={(e) => handleInteractionStart(e, table, 'drag')}
                  onTouchStart={(e) => handleInteractionStart(e, table, 'drag')}
                >
                  <Table
                    table={table}
                    onTableClick={handleTableClick}
                    loginedWaiter={loginedWaiter}
                    // Only pass dimensions to customStyle if they are explicitly set in layout (resized)
                    customStyle={isResized ? {
                      width: '100%',
                      height: '100%',
                      transform: 'none'
                    } : undefined}
                  />    {isTableEditMode && (
                    <div
                      className="resize-handle"
                      onMouseDown={(e) => handleInteractionStart(e, table, 'resize')}
                      onTouchStart={(e) => handleInteractionStart(e, table, 'resize')}
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: '20px',
                        height: '20px',
                        background: '#053796',
                        borderRadius: '50% 0 50% 0',
                        cursor: 'nwse-resize',
                        zIndex: 101
                      }}
                    >
                      <i className="bi bi-arrows-angle-expand text-white" style={{ fontSize: '10px', position: 'absolute', right: '3px', bottom: '3px' }}></i>
                    </div>
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
                className={`mb-3 d-flex justify-content-center ${isTableEditMode ? 'drag-target' : ''}`}
                draggable={isTableEditMode}
                onDragStart={isTableEditMode ? (e) => handleDragStart(e, index) : undefined}
                onDragOver={isTableEditMode ? (e) => handleDragOver(e, index) : undefined}
                onDrop={isTableEditMode ? (e) => handleDrop(e, index) : undefined}
                onDragEnd={isTableEditMode ? handleDragEnd : undefined}
                onTouchStart={isTableEditMode ? () => handleTableTouchStart(index) : undefined}
                onTouchMove={isTableEditMode ? handleTableTouchMove : undefined}
                onTouchEnd={isTableEditMode ? handleTableTouchEnd : undefined}
                style={{
                  opacity: isTableEditMode && draggedIndex === index ? 0.4 : 1,
                  transform: isTableEditMode && dragOverIndex === index && draggedIndex !== index ? 'scale(1.05)' : 'none',
                  transition: 'none',
                  cursor: isTableEditMode ? 'grab' : 'default'
                }}
              >
                <div style={{ pointerEvents: isTableEditMode ? 'none' : 'auto', width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <Table table={table} onTableClick={handleTableClick} loginedWaiter={loginedWaiter} />
                </div>
              </Col>
            ))}
          </Row>
        )}

        {/* Floating Edit Button / Save Bar */}
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          display: 'flex',
          gap: '10px'
        }}>
          {isTableEditMode ? (
            <>
              <button
                className="btn btn-danger d-flex align-items-center gap-2 shadow-lg"
                onClick={() => dispatch(cancelEditMode())}
                style={{ borderRadius: '50px', padding: '10px 20px' }}
              >
                <i className="bi bi-x-lg"></i>
                <span className="d-none d-md-inline">Ləğv et</span>
              </button>
              <button
                className="btn btn-success d-flex align-items-center gap-2 shadow-lg"
                onClick={() => dispatch(saveEditMode())}
                style={{ borderRadius: '50px', padding: '10px 20px' }}
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
                  backgroundColor: '#053796',
                  border: 'none',
                  borderRadius: '50px',
                  padding: '12px 24px',
                  fontSize: '16px'
                }}
              >
                <i className="bi bi-pencil-fill"></i>
                <span className="d-none d-md-inline">Düzəliş et</span>
              </button>
            )
          )}
        </div>

      </Container>

      {/* Global Modals */}
      <CustomersModal
        show={showModal}
        onHide={() => setShowModal(false)}
        table={selectedTable}
        selectedHall={currentHallData}
      />

      <OtherChecks
        show={showOtherChecks}
        onClose={() => setShowOtherChecks(false)}
        table={selectedTable}
        onCreateNew={() => {
          setShowOtherChecks(false);
          setShowModal(true);
        }}
      />
    </>
  );
};

export default Tables;
