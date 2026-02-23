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

const Tables = () => {
  const {
    tableGroups,
    currentHallId,
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
  const [currentHallData, setCurrentHallData] = React.useState(null);

  // Edit Mode & Ordering States (Drag indices kept local as they are transient UI state)
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Custom Layout Interaction State
  const containerRef = useRef(null);
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
    // Only generate layout if we are in edit mode and there are tables
    if (isTableEditMode && currentTables.length > 0) {
      const w = window.innerWidth;
      let cols = 2; // xs
      if (w >= 992) cols = 6; // lg
      else if (w >= 768) cols = 4; // md
      else if (w >= 576) cols = 3; // sm

      const containerW = containerRef.current ? containerRef.current.offsetWidth : w;
      // We can approximate the column width. Container might have padding.
      const colWidth = containerW / cols;

      // First pass: Calculate row heights
      const rowHeights = {};
      currentTables.forEach((table, index) => {
        const row = Math.floor(index / cols);
        const isRect = table.shape_type === "rectangle";
        const h = isRect ? 300 : 200; // 300 for rectangle, 200 for others (from CSS)
        rowHeights[row] = Math.max(rowHeights[row] || 0, h);
      });

      const layout = {};
      currentTables.forEach((table, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const offsetX = Math.max(0, (colWidth - 200) / 2);

        let currentY = 20;
        for (let r = 0; r < row; r++) {
          currentY += (rowHeights[r] || 200) + 20; // Height + Gap
        }

        layout[table.id] = {
          x: col * colWidth + offsetX,
          y: currentY,
          w: undefined,
          h: undefined
        };
      });
      setGeneratedLayout(layout);
    }
  }, [isTableEditMode, currentTables, currentHallId]);

  React.useEffect(() => {
    if (tableGroups?.data && currentHallId) {
      const selectedHall = tableGroups.data.find(hall => hall.id === currentHallId);
      setCurrentHallData(selectedHall);
    } else if (tableGroups?.data) {
      setCurrentHallData(tableGroups.data[0]);
    }
  }, [tableGroups, currentHallId]);

  // Handle Socket.IO Real-Time Table Synchronization
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTableUpdated = (data) => {
      // Re-fetch the tables to reflect updated order states visually
      if (loginedProfileData?.data?.profile?.id) {
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
      const isMyTable = hasOrders && loginedWaiter?.data?.id && (orders[0]?.waiter_id == loginedWaiter.data.id || orders[0]?.waiter?.id == loginedWaiter.data.id);
      const isOtherTable = hasOrders && !isMyTable;

      if (Number(loginedWaiter?.data?.can_access_own_checks_only) === 1 && isOtherTable) {
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
          await dispatch(getTableGroups(loginedProfileData.data.profile.id));
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
    [id, dispatch, currentHallId, loginedProfileData, navigate, tableGroups, currentHallData, isTableEditMode],
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
    e.preventDefault();
    e.stopPropagation();

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
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: layout.x || 0,
      initialTop: layout.y || 0,
      initialWidth: currentW,
      initialHeight: currentH
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!interactionState.type || !isTableEditMode) return;

      if (interactionState.type === 'drag') {
        const dx = e.clientX - interactionState.startX;
        const dy = e.clientY - interactionState.startY;

        const newX = interactionState.initialLeft + dx;
        const newY = interactionState.initialTop + dy;

        // Dispatch Update (throttling would be good in real app)
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
        const dx = e.clientX - interactionState.startX;
        const dy = e.clientY - interactionState.startY;

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

    const handleMouseUp = () => {
      if (interactionState.type) {
        setInteractionState({ type: null, tableId: null });
      }
    };

    if (isTableEditMode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [interactionState, isTableEditMode, currentHallId, dispatch]);


  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (currentTables.length === 0) {
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
                transition: interactionState.tableId === table.id ? 'none' : 'all 0.2s ease'
              };

              return (
                <div
                  key={table.id}
                  style={style}
                  onMouseDown={(e) => handleInteractionStart(e, table, 'drag')}
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
                md={3}
                lg={2}
                xl={2}
                xxl={2}
                key={table.id || table.name}
                className={`mb-3 d-flex justify-content-center ${isTableEditMode ? 'drag-target' : ''}`}
                draggable={isTableEditMode}
                onDragStart={isTableEditMode ? (e) => handleDragStart(e, index) : undefined}
                onDragOver={isTableEditMode ? (e) => handleDragOver(e, index) : undefined}
                onDrop={isTableEditMode ? (e) => handleDrop(e, index) : undefined}
                onDragEnd={isTableEditMode ? handleDragEnd : undefined}
                style={{
                  opacity: isTableEditMode && draggedIndex === index ? 0.4 : 1,
                  transform: isTableEditMode && dragOverIndex === index && draggedIndex !== index ? 'scale(1.05)' : 'none',
                  transition: 'all 0.2s ease',
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
