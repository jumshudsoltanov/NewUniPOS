import React, { useEffect, useState } from "react";
import "./Check.css";
import TagModal from "../Modals/TagModal";
import OtherChecks from "../OtherChecks/OtherChecks";
import { useDispatch, useSelector } from "react-redux";
import {
  getTableGroups,
  addOrderToTableOptimistic,
} from "../../redux/Slices/TablesSlice";
import { getNextOrderId, saleNewOrders } from "../../redux/Slices/SaleSlice";
import {
  getActiveOrders,
  addOrderOptimistic,
  updateOrderOptimisticId,
} from "../../redux/Slices/BooksSlice";
import { saveLog } from "../../redux/Slices/OrdersSlice";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { checkShiftGuard } from "../../utils/shiftGuard";
const CheckHeader = ({
  orders,
  hall,
  table,
  selectedCustomer,
  activeTableCount = 0,
  onBeforeCreateOrder,
}) => {
  const [openTagModal, setOpenTagModal] = useState(false);
  const [openOtherCheckModal, setOpenOtherCheckModal] = useState(false);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { id: currentId } = useParams();
  const liveOrder = useSelector((state) => {
    if (!currentId) return null;
    const booksData = Array.isArray(state.BooksSlice.books)
      ? state.BooksSlice.books
      : state.BooksSlice.books?.data;
    return booksData?.find((o) => String(o.uuid) === String(currentId)) ?? null;
  });
  const liveSaleType = liveOrder?.sale_type ?? null;
  const liveTableName = liveOrder?.table?.name ?? liveOrder?.table_name ?? null;
  const liveHallName =
    liveOrder?.table?.hall?.name ?? liveOrder?.hall_name ?? null;
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const _profileId = loginedProfileData?.data?.profile?.id;

  useEffect(() => {
    // Only fetch if data is missing
    if (loginedProfileData?.data?.profile?.id) {
      // dispatch(getTableGroups(loginedProfileData.data.profile.id)); // TableGroups are pre-fetched
    }
  }, [dispatch, loginedProfileData]);

  const handleCreateOrder = async () => {
    setOpenOtherCheckModal(false);
    if (onBeforeCreateOrder) await onBeforeCreateOrder();
    const guard = await checkShiftGuard(loginedProfileData);
    if (guard.blocked) {
      toast.error(guard.reason || "Növbə açılmayıb. Əvvəlcə növbəni açın.");
      return;
    }
    const waiterId = loginedWaiter?.data?.id;
    const terminalId = loginedProfileData?.data?.terminal?.terminal_id;
    const profileId = loginedProfileData?.data?.profile?.id;

    if (!waiterId || !terminalId || !profileId) {
      console.error("Missing required user data");
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
    const sv = hall?.service_fee || 0;
    const payload = {
      guestCount: 0,
      tableId: table?.id,
      waiterId,
      terminalId,
      profileId,
      sale_type: "dine_in",
      hallId: hall?.id,
      status: 1,
      serviceType: hall?.service_fee ? "percent" : null,
      serviceValue: sv,
      is_selected: 1,
      uuid: generatedUuid,
      ...(nextId && { id: nextId }),
    };

    const waiterName =
      loginedWaiter?.data?.name ||
      loginedProfileData?.data?.profile?.name ||
      "Naməlum";
    const optimisticOrder = {
      uuid: generatedUuid,
      id: nextId ?? null,
      waiter_id: waiterId,
      profile_id: profileId,
      terminal_id: terminalId,
      sale_type: "dine_in",
      sale_type_name: "Restoranda",
      table_id: table?.id,
      guest_count: 0,
      status: 1,
      is_selected: 1,
      orders_items: [],
      table: table
        ? { id: table.id, name: table.name, hall: { name: hall?.name } }
        : null,
      table_name: table?.name,
      hall_name: hall?.name,
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
    if (table?.id) {
      dispatch(
        addOrderToTableOptimistic({
          order: optimisticOrder,
          tableId: table.id,
        }),
      );
    }
    dispatch(
      saveLog({
        orderId: generatedUuid,
        action: "Yeni sifariş yaradıldı (Header)",
        waiterName,
        details: `Masa: ${table?.name || "Naməlum"}`,
      }),
    );
    navigate(`/check/${generatedUuid}?tableId=${table?.id}`);

    dispatch(saleNewOrders(payload))
      .unwrap()
      .then((res) => {
        const serverOrder = res?.data;
        const finalId = serverOrder?.id ?? res?.count;
        if (finalId && finalId !== nextId) {
          dispatch(
            updateOrderOptimisticId({
              uuid: generatedUuid,
              newOrderData: { id: finalId },
            }),
          );
        }
        dispatch(getTableGroups(profileId));
        dispatch(getActiveOrders({ profileId, silentRefresh: true }));
      })
      .catch((err) => console.error("Create order error:", err));
  };

  const getTimeDifference = (startDate) => {
    if (!startDate) return { hours: "00", minutes: "00" };

    const start = new Date(startDate);
    if (isNaN(start.getTime())) return { hours: "00", minutes: "00" };

    const now = new Date();
    const diffMs = now - start;
    if (diffMs < 0) return { hours: "00", minutes: "00" };

    const diffMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    return {
      hours: String(hours).padStart(2, "0"),
      minutes: String(minutes).padStart(2, "0"),
    };
  };

  return (
    <>
      <div
        className="check-header-bar check-header-bar-no-overlap"
        style={{ position: "relative" }}
      >
        {/* Left Section: Edit + Info */}
        <div className="header-left-section">
          <div
            className="header-edit-btn"
            onClick={() => setOpenTagModal(true)}
          >
            <i className="bi bi-pencil-fill"></i>
          </div>
          <div className="header-info-text">
            {(() => {
              const effectiveSaleType = liveSaleType ?? orders?.sale_type;
              const isDineIn =
                !effectiveSaleType || effectiveSaleType === "dine_in";
              const effectiveHallName =
                liveHallName || hall?.name || orders?.hall_name;
              const effectiveTableName =
                liveTableName ||
                table?.name ||
                orders?.table_name ||
                orders?.table?.name;
              if (
                isDineIn &&
                (effectiveTableName || effectiveHallName || orders?.table_id)
              ) {
                return (
                  <span
                    className="header-order-id"
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "block",
                    }}
                  >
                    {effectiveTableName || "Masa"}
                  </span>
                );
              }
              return (
                <span
                  className="header-order-id"
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "block",
                  }}
                >
                  {effectiveSaleType === "delivery"
                    ? "Çatdırılma"
                    : effectiveSaleType === "takeaway"
                      ? "Gəl götür"
                      : "Yeni Sifariş"}
                </span>
              );
            })()}
          </div>
        </div>

        <div className="header-center-section">
          <span className="header-time">
            {`${getTimeDifference(orders?.start_date).hours ?? "00"}:${getTimeDifference(orders?.start_date).minutes ?? "00"}`}
          </span>
        </div>

        {/* Right Section: Çek ID + Toggle */}
        <div className="header-right-section">
          <span className="header-check-id">
            {orders?.id
              ? `#${orders.id} / #${orders.id}`
              : orders?.uuid
                ? "Yeni sifariş"
                : "Yüklənir..."}
          </span>
          <div
            className="header-toggle-btn"
            onClick={() => setOpenOtherCheckModal(true)}
          >
            <i className="bi bi-chevron-down"></i>
          </div>
        </div>
      </div>
      <TagModal
        show={openTagModal}
        onClose={() => setOpenTagModal(false)}
        order={orders}
      />
      <OtherChecks
        show={openOtherCheckModal}
        onClose={() => setOpenOtherCheckModal(false)}
        table={table}
        showAll={true}
        onCreateNew={handleCreateOrder}
      />
    </>
  );
};

const CheckHeaderWithMemo = React.memo(CheckHeader);
export default CheckHeaderWithMemo;
