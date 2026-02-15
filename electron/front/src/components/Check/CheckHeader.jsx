import React, { useEffect, useState } from "react";
import "./Check.css";
import TagModal from "../Modals/TagModal";
import OtherChecks from "../OtherChecks/OtherChecks";
import { useDispatch, useSelector } from "react-redux";
import { getTableGroups } from "../../redux/Slices/TablesSlice";

const CheckHeader = ({ orders, hall, table, selectedCustomer }) => {
  const [openTagModal, setOpenTagModal] = useState(false);
  const [openOtherCheckModal, setOpenOtherCheckModal] = useState(false);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const dispatch = useDispatch();

  useEffect(() => {
    if (loginedProfileData?.data?.profile?.id) {
      dispatch(getTableGroups(loginedProfileData.data.profile.id));
    }
  }, [dispatch, loginedProfileData]);

  const getTimeDifference = (startDate) => {
    if (!startDate) return { hours: "00", minutes: "00" };

    const start = new Date(startDate);
    if (isNaN(start.getTime())) return { hours: "00", minutes: "00" }; // Prevent NaN from invalid date

    const now = new Date();

    const diffMs = now - start;
    if (diffMs < 0) return { hours: "00", minutes: "00" }; // Prevent negative time if clocks skew

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
      <div className="check-header-bar">
        {/* Left Section: Edit + Info */}
        <div className="header-left-section">
          <div
            className="header-edit-btn"
            onClick={() => setOpenTagModal(true)}
          >
            <i className="bi bi-pencil-fill"></i>
          </div>
          <div className="header-info-text">
            {orders?.sale_type == "dine_in" ? (
              <span className="header-order-id">
                {hall?.name} / {table?.name}
              </span>
            ) : (
              <span className="header-order-id">
                {(() => {
                  const type = orders?.sale_type;
                  if (!type) return "";
                  if (type === "delivery") return "Çatdırılma";
                  if (type === "takeaway") return "Takeaway";
                  return type.charAt(0).toUpperCase() + type.slice(1);
                })()}
              </span>
            )}
            <div className="header-subtitle-container">
              {orders && orders?.tags && (
                <span className="header-subtitle">{orders.tags}</span>
              )}
            </div>
          </div>
        </div>

        {/* Center Section: Time */}
        <div className="header-center-section">
          <span className="header-time">{`${getTimeDifference(orders?.start_date).hours ?? 0}:${getTimeDifference(orders?.start_date).minutes ?? 0}`}</span>
        </div>

        {/* Right Section: Order IDs + Toggle */}
        <div className="header-right-section">
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
      />
    </>
  );
};

export default CheckHeader;
