import React, { useState } from "react";
import Modal from "react-bootstrap/Modal";
import { useDispatch, useSelector } from "react-redux";
import { deleteOrderItems } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { processAndPrintOrders } from "../../utils/printerHelpers";
import { getSocket } from "../../utils/apiConfig";
import { t } from "../../utils/translations";
import "./ClearCheck.css";

const ClearCheck = ({ show, onClose, order }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dispatch = useDispatch();
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { menu, categories } = useSelector((state) => state.OrderSlice);
  const { tableGroups } = useSelector((state) => state.TablesSlice);

  const getSaleTypeName = (type, typeName) => {
    if (typeName) return typeName;
    if (type == 1 || type === "takeaway") return "Gəl götür";
    if (type == 2 || type === "delivery") return "Çatdırılma";
    return "Restoranda";
  };

  const handleClearCheck = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const waiterName =
        loginedWaiter?.data?.name ||
        loginedProfileData?.data?.profile?.name ||
        "Naməlum";
      const profileId = loginedProfileData?.data?.profile?.id;

      // 1. Kitchen Print for all confirmed items
      if (order?.orders_items && order.orders_items.length > 0) {
        const itemsToPrint = order.orders_items.map((item) => {
          const menuRef = menu?.find(
            (m) => m.id == (item.product_id || item.id),
          );
          return {
            ...item,
            name: menuRef?.name || item.product?.name || item.name || "Məhsul",
            quantity: Number(item.count || item.quantity || 0),
            printer_details:
              menuRef?.printer_details || item.printer_details || [],
            category_id: menuRef?.category_id || item.category_id,
            changeType: "decrease", // Mark as deleted
          };
        });

        const menuDataWithCategories = {
          data: menu || [],
          categories: categories || [],
        };

        const displaySaleType = getSaleTypeName(
          order?.sale_type,
          order?.sale_type_name,
        );
        const hall = tableGroups?.data?.find((h) => h.id == order.hall_id);

        try {
          const orderWaiter =
            order?.waiter?.name || order?.waiter_name || waiterName;
          await processAndPrintOrders(
            itemsToPrint,
            {
              table: order?.table_name || "Masa",
              waiter: orderWaiter,
              hallName: hall?.name || "",
              orderId: order?.uuid,
              terminalInfo: loginedProfileData?.data?.terminal || {},
              typeName: displaySaleType,
              checkData: order,
              isDecrease: true,
              profileData: loginedProfileData,
            },
            menuDataWithCategories,
          );
        } catch (printErr) {
          console.error("Clear Check Printing Error:", printErr);
        }
      }

      // 2. Clear on Server
      await dispatch(
        deleteOrderItems({ orderId: order.uuid, waiterName }),
      ).unwrap();

      // Notify other terminals to refresh this check, but do not mark it as deleted.
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit("table_updated", { orderId: order.uuid });
      }
      if (profileId) {
        dispatch(getTableGroups(profileId));
        dispatch(getActiveOrders({ profileId, silentRefresh: true }));
      }
      onClose(true);
    } catch (error) {
      console.error("Clear Check Error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      className="clear-check-modal"
      backdrop="static"
      animation={false}
    >
      <div className="modal-content-wrapper">
        <div className="clear-check-modal-header">
          <div className="clear-check-header-content">
            <div className="clear-check-icon-circle">
              <i className="bi bi-exclamation-triangle"></i>
            </div>
            <div className="clear-check-modal-title">{t("qebzi_temizlemek")}</div>
          </div>
          <button className="btn-close-custom" onClick={onClose}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="clear-check-modal-body">
          <div className="clear-check-message">
            <p className="clear-check-question">{t("qebzi_temizlemek_istediyinize_eminsiniz")}</p>
            <p className="clear-check-warning">{t("bu_emeliyyat_butun_secilmis_mehsullari_silecek")}</p>
          </div>

          <div className="clear-check-footer-buttons">
            <button className="clear-check-cancel-btn" onClick={onClose}>{t("cancel")}</button>
            <button
              className="clear-check-confirm-btn"
              onClick={handleClearCheck}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
              ) : (
                <i
                  className="bi bi-check2 me-2"
                  style={{ fontSize: "1.2rem" }}
                ></i>
              )}
              Təsdiqlə
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ClearCheck;
