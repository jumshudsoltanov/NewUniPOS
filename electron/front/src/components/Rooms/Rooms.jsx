import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Container, Row, Col, Alert } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { fetchRooms } from "../../redux/Slices/HotelSlice";
import { addOrderOptimistic } from "../../redux/Slices/BooksSlice";
import { saleNewOtherOrders } from "../../redux/Slices/SaleSlice";
import { saveLog } from "../../redux/Slices/OrdersSlice";
import RoomCard from "./RoomCard";
import ReservationModal from "./ReservationModal";
import "./Rooms.css";

const Rooms = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { rooms, isLoadingRooms, selectedFloor, selectedRoomType, selectedRoomGroupId, searchText } =
    useSelector((state) => state.HotelSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);

  const profileId = loginedProfileData?.data?.profile?.id;
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [preselectedRoom, setPreselectedRoom] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const isVisibleRef = useRef(true);

  // Məlumatları yenilə
  const doFetchRooms = useCallback(() => {
    if (profileId) dispatch(fetchRooms(profileId));
  }, [profileId, dispatch]);

  // Komponent yüklənəndə və refreshKey dəyişəndə yenilə
  useEffect(() => {
    if (!profileId) return;
    doFetchRooms();
  }, [profileId, doFetchRooms, refreshKey]);

  // 30 saniyədə bir avtomatik yenilə
  useEffect(() => {
    if (!profileId) return;
    const interval = setInterval(doFetchRooms, 30000);
    return () => clearInterval(interval);
  }, [profileId, doFetchRooms]);

  // Səhifə görünən olanda yenilə (tab keçidi)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !isVisibleRef.current) {
        isVisibleRef.current = true;
        doFetchRooms();
      } else if (document.visibilityState === "hidden") {
        isVisibleRef.current = false;
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [doFetchRooms]);

  // Filtrlənmiş otaqlar
  const filteredRooms = useMemo(() => {
    let list = rooms;

    if (selectedFloor !== null) {
      list = list.filter((r) => Number(r.floor) === Number(selectedFloor));
    }
    if (selectedRoomType) {
      list = list.filter((r) => r.room_type === selectedRoomType);
    }
    if (selectedRoomGroupId !== null) {
      list = list.filter((r) => Number(r.room_group_id) === Number(selectedRoomGroupId));
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(
        (r) =>
          String(r.room_number).toLowerCase().includes(q) ||
          (r.guest_name || "").toLowerCase().includes(q)
      );
    }

    // Sırala: boş, dolu, bron, təmizlənir, təmirdə
    const statusOrder = { available: 0, occupied: 1, reserved: 2, cleaning: 3, maintenance: 4 };
    const sorted = [...list].sort((a, b) => {
      const orderA = statusOrder[a.status] ?? 99;
      const orderB = statusOrder[b.status] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.room_number || "").localeCompare(String(b.room_number || ""), undefined, { numeric: true });
    });

    return sorted;
  }, [rooms, selectedFloor, selectedRoomType, selectedRoomGroupId, searchText]);

  const handleHotelOrderCreate = useCallback(
    (room, guestNameOverride, depositAmount) => {
      const waiterId = loginedWaiter?.data?.id;
      const terminalId = loginedProfileData?.data?.terminal?.terminal_id;
      const profileIdVal = loginedProfileData?.data?.profile?.id;
      if (!waiterId || !terminalId || !profileIdVal) {
        toast.error("İstifadəçi məlumatları tapılmadı");
        return null;
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
        guest_name: guestNameOverride || room.guest_name,
        folio_balance: depositAmount || room.folio_balance || 0,
        amount: 0,
        total: 0,
        start_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        discount: 0,
        service_value: 0,
        waiter: { id: waiterId, name: waiterName },
      };

      dispatch(addOrderOptimistic(optimisticOrder));

      dispatch(saveLog({
        orderId: generatedUuid,
        action: "Yeni otaq sifarişi yaradıldı",
        waiterName,
        details: `Otaq: ${room.room_number || ""}, Qonaq: ${room.guest_name || "—"}`,
      }));

      dispatch(saleNewOtherOrders({
        waiterId,
        terminalId,
        profileId: profileIdVal,
        sale_type: "dine_in",
        status: 1,
        is_selected: 1,
        uuid: generatedUuid,
      }));

      return generatedUuid;
    },
    [loginedWaiter, loginedProfileData, dispatch]
  );

  const handleRoomClick = useCallback(
    (room) => {
      if (!room) return;

      if (room.status === "occupied") {
        const uuid = handleHotelOrderCreate(room);
        if (uuid) {
          navigate(`/check/${uuid}?hotel=${room.id}`);
        }
        return;
      }

      if (room.status === "available" || room.status === "reserved") {
        const waiterCanOrder = Number(loginedWaiter?.data?.can_create_order) === 1;
        if (!waiterCanOrder) {
          toast.error("İcazəniz yoxdur");
          return;
        }
        setPreselectedRoom(room);
        setShowReservationModal(true);
        return;
      }

      const statusLabels = {
        cleaning: "Bu otaq təmizlənir",
        reserved: "Bu otaq bron edilib",
        maintenance: "Bu otaq təmirdədir",
      };
      toast.info(statusLabels[room.status] || "Bu otaq mövcud deyil");
    },
    [loginedWaiter, loginedProfileData, navigate, dispatch, handleHotelOrderCreate]
  );

  const handleReservationCreated = (booking, actionType) => {
    setShowReservationModal(false);
    setPreselectedRoom(null);
    doFetchRooms();

    if (actionType === "checkin" && booking?.room_id) {
      const room = rooms.find((r) => Number(r.id) === Number(booking.room_id));
      if (room) {
        const guestName = booking.guest_name || room.guest_name;
        const depositAmount = booking.deposit ? parseFloat(booking.deposit) : 0;
        const uuid = handleHotelOrderCreate(room, guestName, depositAmount);
        if (uuid) {
          navigate(`/check/${uuid}?hotel=${room.id}`);
        }
      }
    }
  };

  // Yüklənir
  if (isLoadingRooms && rooms.length === 0) {
    return (
      <Container className="mt-4">
        <div className="rooms-loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Yüklənir...</span>
          </div>
          <p style={{ color: "#6B7280", marginTop: "12px" }}>Otaqlar yüklənir...</p>
        </div>
      </Container>
    );
  }

  // Boş
  if (!isLoadingRooms && rooms.length === 0) {
    return (
      <Container className="mt-4">
        <Alert variant="warning" className="text-center shadow-sm border-0">
          <i className="bi bi-building me-2"></i>
          Heç bir otaq tapılmadı. Admin panelindən otaqları əlavə edin.
        </Alert>
      </Container>
    );
  }

  return (
    <>
      <Container
        fluid
        className="rooms-scroll-container position-relative"
        style={{ paddingTop: "24px", paddingBottom: "20px" }}
      >
        {filteredRooms.length === 0 ? (
          <div className="rooms-empty">
            <i className="bi bi-search" style={{ fontSize: "32px", color: "#D1D5DB" }}></i>
            <p style={{ color: "#9CA3AF", marginTop: "8px" }}>
              Axtarışa uyğun otaq tapılmadı
            </p>
          </div>
        ) : (
          <Row className="g-3">
            {filteredRooms.map((room) => (
              <Col
                xs={6}
                sm={4}
                md={4}
                lg={3}
                xl={2}
                xxl={2}
                key={room.id}
                className="mb-3 d-flex justify-content-center"
              >
                <RoomCard room={room} onRoomClick={handleRoomClick} />
              </Col>
            ))}
          </Row>
        )}
      </Container>

      <button
        className="rooms-fab"
        onClick={() => {
          setPreselectedRoom(null);
          setShowReservationModal(true);
        }}
        title="Yeni rezervasiya"
      >
        <i className="bi bi-plus-lg"></i>
      </button>

      <ReservationModal
        show={showReservationModal}
        onHide={() => {
          setShowReservationModal(false);
          setPreselectedRoom(null);
        }}
        preselectedRoom={preselectedRoom}
        onSuccess={handleReservationCreated}
      />
    </>
  );
};

export default Rooms;
