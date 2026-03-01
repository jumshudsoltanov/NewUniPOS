import React, { useEffect, useState } from "react";
import "./Check.css";
import TagModal from "../Modals/TagModal";
import OtherChecks from "../OtherChecks/OtherChecks";
import { useDispatch, useSelector } from "react-redux";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { saleNewOrders } from "../../redux/Slices/SaleSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { saveLog } from "../../redux/Slices/OrdersSlice";
import { useNavigate } from "react-router-dom";

const CheckHeader = ({ orders, hall, table, selectedCustomer }) => {
  const [openTagModal, setOpenTagModal] = useState(false);
  const [openOtherCheckModal, setOpenOtherCheckModal] = useState(false);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    // Only fetch if data is missing
    if (loginedProfileData?.data?.profile?.id) {
      // dispatch(getTableGroups(loginedProfileData.data.profile.id)); // TableGroups are pre-fetched
    }
  }, [dispatch, loginedProfileData]);

  const handleCreateOrder = async () => {
    setOpenOtherCheckModal(false);
    const waiterId = loginedWaiter?.data?.id;
    const terminalId = loginedProfileData?.data?.terminal?.terminal_id;
    const profileId = loginedProfileData?.data?.profile?.id;

    if (!waiterId || !terminalId || !profileId) {
      console.error("Missing required user data");
      return;
    }

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
      serviceValue: hall?.service_fee || 0,
      is_selected: 1,
    };

    try {
      const result = await dispatch(saleNewOrders(payload)).unwrap();
      if (result?.message === "success") {
        const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
        dispatch(saveLog({
          orderId: result.data.uuid,
          action: "Yeni sifariş yaradıldı (Header)",
          waiterName,
          details: `Masa: ${table?.name || "Naməlum"}`
        }));
        await dispatch(getTableGroups(profileId));
        await dispatch(getActiveOrders({ profileId }));
        navigate(`/check/${result?.data?.uuid}?tableId=${table?.id}`);
      }
    } catch (error) {
      console.error(error);
    }
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
      <div className="check-header-bar" style={{ position: "relative" }}>
        {/* Left Section: Edit + Info */}
        <div className="header-left-section" style={{ flex: 1, maxWidth: "42%", display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <div
            className="header-edit-btn"
            onClick={() => setOpenTagModal(true)}
          >
            <i className="bi bi-pencil-fill"></i>
          </div>
          <div className="header-info-text" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 0, minWidth: 0, overflow: "hidden" }}>
            {orders?.sale_type == "dine_in" ? (
              <span className="header-order-id" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                {hall?.name} / {table?.name}
              </span>
            ) : (
              <span className="header-order-id" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                {(() => {
                  const type = orders?.sale_type;
                  if (!type) return "";
                  if (type === "delivery") return "Çatdırılma";
                  if (type === "takeaway") return "Takeaway";
                  return type.charAt(0).toUpperCase() + type.slice(1);
                })()}
              </span>
            )}
            <div className="header-subtitle-container" style={{ minWidth: 0 }}>
              {orders && orders?.tags && (
                <span className="header-subtitle" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{orders.tags}</span>
              )}
            </div>
          </div>
        </div>

        {/* Center Section: Time */}
        <div className="header-center-section" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", zIndex: 5 }}>
          <span className="header-time">{`${getTimeDifference(orders?.start_date).hours ?? 0}:${getTimeDifference(orders?.start_date).minutes ?? 0}`}</span>
        </div>

        {/* Right Section: Order IDs + Toggle */}
        <div className="header-right-section" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px", marginLeft: "auto" }}>
          <span className="header-order-id">
            #{orders?.id} / #{orders?.id}
          </span>
          <div
            className="header-toggle-btn"
            onClick={() => setOpenOtherCheckModal(true)}
          >
            <i className="bi bi-chevron-down"></i>
          </div>
        </div>
      </div >
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
