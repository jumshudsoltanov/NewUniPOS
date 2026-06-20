import React, { useState } from "react";
import "./Waiters.css";
import Modal from "react-bootstrap/Modal";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { getWaitersList } from "../../redux/Slices/WaitersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders, updateOrderOptimisticId } from "../../redux/Slices/BooksSlice";
import { changeWaiter } from "../../redux/Slices/OrdersSlice";
import { t } from "../../utils/translations";

const WaitersModal = ({ show, onClose, order }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { waitersLists, loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const [selectedWaiterId, setSelectedWaiterId] = useState(null);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!show) return;

    if (waitersLists?.data?.length) return;

    const getWaiters = async () => {
      try {
        await dispatch(getWaitersList(loginedProfileData.data.profile.id));
      } catch (error) {
        console.error("Error waiters list", error);
      }
    };

    getWaiters();
  }, [show]);

  const filteredWaiters = Array.isArray(waitersLists?.data)
    ? waitersLists.data.filter((waiter) =>
      waiter?.name?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    : [];


  const handleClickUpdateWaiter = async () => {
    if (!selectedWaiterId) return;
    try {
      const newWaiter = filteredWaiters.find(w => w.id === selectedWaiterId);
      const oldWaiterName = order?.waiter?.name || 'Naməlum';
      const newWaiterName = newWaiter?.name || 'Naməlum';
      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

      // Optimistic update: UI-ni dərhal yenilə
      dispatch(updateOrderOptimisticId({
        uuid: order.uuid,
        newOrderData: {
          waiter_id: selectedWaiterId,
          waiter: { id: selectedWaiterId, name: newWaiterName },
        },
      }));

      onClose(false);
      setSelectedWaiterId(null);

      await dispatch(changeWaiter({
        orderId: order.uuid,
        waiterId: selectedWaiterId,
        oldWaiterName,
        newWaiterName,
        waiterName,
      })).unwrap();

      const profileId = loginedProfileData?.data?.profile?.id;
      dispatch(getTableGroups(profileId));
      dispatch(getActiveOrders({ profileId, silentRefresh: true }));
    } catch (error) {
      console.error("ChangeWaiter", error);
    }
  }

  return (
    <Modal
      show={show}
      onHide={onClose}
      animation={false}
      dialogClassName="waiters-modal-dialog"
      contentClassName="waiters-modal-content"
    >
      <div className="waiters-modal-container">
        {/* Header */}
        <div className="waiters-header">
          <div className="header-left">
            <div className="header-icon">
              {/* Group Users Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#053796"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <span className="header-title">{t("emekdas_sec")}</span>
          </div>
          <button className="close-btn" onClick={onClose}>
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

        {/* Body */}
        <div className="waiters-body">
          {/* Search Input */}
          <div className="search-container">
            <input
              type="text"
              className="waiters-search-input"
              placeholder={t("emekdas_axtar")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Waiters List */}
          <div className="waiters-list">
            {filteredWaiters.map((waiter) => (
              <div key={waiter.id} className="waiter-card">
                <div className="waiter-avatar">
                  {/* Single User with refresh/cycle hint */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                    <path
                      d="M18 10a2 2 0 0 0 2-2M22 10a2 2 0 0 0-2-2"
                      opacity="0.5"
                    />
                    {/* Simplified user icon with a subtle hint, or just user */}
                  </svg>
                </div>
                <div className="waiter-info">
                  <span className="waiter-name">{waiter.name}</span>
                  {order?.waiter?.id === waiter.id && (
                    <span className="current-waiter-badge">
                      {t("cari_ofisiant")}
                    </span>
                  )}
                </div>
                <div className="waiter-actions">
                  <button
                    onClick={() =>
                      setSelectedWaiterId(
                        selectedWaiterId === waiter.id ? null : waiter.id
                      )
                    }
                    className={`select-btn ${selectedWaiterId === waiter.id ? "selected" : ""
                      }`}
                  >
                    {selectedWaiterId === waiter.id ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      "Seç"
                    )}
                  </button>

                </div>
              </div>
            ))}
          </div>

          {/* Apply Button */}
          <button className="waiter-apply-btn" onClick={handleClickUpdateWaiter}>{t("apply")}</button>
        </div>
      </div>
    </Modal>
  );
};

export default WaitersModal;
