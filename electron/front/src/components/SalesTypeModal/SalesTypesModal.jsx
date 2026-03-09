import React, { useCallback, useState } from "react";
import { Modal } from "react-bootstrap";
import "./SalesTypesModal.css";
import { useDispatch, useSelector } from "react-redux";
import {
  saleNewOtherOrders,
} from "../../redux/Slices/SaleSlice";
import { saveLog } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders, addOrderOptimistic } from "../../redux/Slices/BooksSlice";
import { useNavigate } from "react-router-dom";

import { getSalesTypes } from "../../redux/Slices/SalesTypesSlice";
import { useEffect } from "react";

export const SalesTypesModal = ({ show, onClose, onSelect, target }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { salesTypes: fetchedSalesTypes } = useSelector((state) => state.SalesTypesSlice);
  const [saleType, setSaleType] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingType, setCreatingType] = useState(null);

  useEffect(() => {
    if (loginedProfileData?.data?.profile?.id) {
      dispatch(getSalesTypes(loginedProfileData.data.profile.id));
    }
  }, [dispatch, loginedProfileData]);

  // Construct sales types list. Always include Dine In.
  const salesTypes = [
    {
      id: "dine_in",
      label: "Yerində",
      // You can keep the icon here or dynamically assign icons
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
        </svg>
      ),
    },
    {
      id: "delivery",
      label: "Çatdırılma",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 18.5a1.5 1.5 0 0 1-1.5-1.5a1.5 1.5 0 0 1 1.5-1.5a1.5 1.5 0 0 1 1.5 1.5a1.5 1.5 0 0 1-1.5 1.5m1.5-9l1.96 2.5V14h-1.5c0 1.11-.89 2-2 2s-2-.89-2-2H9c0 1.11-.89 2-2 2s-2-.89-2-2H3V6c0-1.11.89-2 2-2h12v5.5M7 18.5A1.5 1.5 0 0 1 5.5 17A1.5 1.5 0 0 1 7 15.5A1.5 1.5 0 0 1 8.5 17A1.5 1.5 0 0 1 7 18.5z" />
        </svg>
      ),
    },
    {
      id: "takeaway",
      label: "Takeaway",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z" />
        </svg>
      ),
    },
    ...(fetchedSalesTypes || []).map(type => ({
      id: type.name,
      label: type.name,
      // Default icon for dynamic types
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z" />
        </svg>
      )
    }))
  ];

  const createOrder = useCallback(
    async (saleTypeId) => {
      if (isCreating) return;

      const waiterId = loginedWaiter?.data?.id;
      const terminalId = loginedProfileData?.data?.terminal?.terminal_id;
      const profileId = loginedProfileData?.data?.profile?.id;

      if (!waiterId || !terminalId || !profileId) {
        console.error("Missing required user data for creating order");
        return;
      }

      setIsCreating(true);
      setCreatingType(saleTypeId);

      const generatedUuid = crypto.randomUUID();

      const payload = {
        waiterId,
        terminalId,
        profileId,
        sale_type: saleTypeId,
        status: 1,
        is_selected: 1,
        uuid: generatedUuid,
      };

      try {
        // Optimistic State Injection
        const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
        const typeLabel = salesTypes.find(t => t.id === saleTypeId)?.label || saleTypeId;

        const optimisticOrder = {
          uuid: generatedUuid,
          id: null,
          waiter_id: waiterId,
          profile_id: profileId,
          terminal_id: terminalId,
          sale_type: saleTypeId,
          sale_type_name: typeLabel,
          status: 1,
          is_selected: 1,
          orders_items: [],
          table: null,
          table_name: null,
          amount: 0,
          total: 0,
          discount: 0,
          service_value: 0,
          waiter: { id: waiterId, name: waiterName }
        };

        dispatch(addOrderOptimistic(optimisticOrder));

        // Background APIs (Don't Await)
        dispatch(saleNewOtherOrders(payload));
        
        dispatch(saveLog({
          orderId: generatedUuid,
          action: "Yeni sifariş yaradıldı",
          waiterName,
          details: `Satış növü: ${typeLabel}`
        }));

        // Instant redirect
        navigate(`/check/${generatedUuid}`);
        onClose(false);
      } catch (err) {
        console.error("Check created error:", err);
      } finally {
        setIsCreating(false);
        setCreatingType(null);
      }
    },
    [
      dispatch,
      loginedWaiter,
      loginedProfileData,
      navigate,
      isCreating,
      onClose,
      salesTypes
    ],
  );

  const handleSelect = (type) => {
    setSaleType(type.id);
    if (type.id !== "dine_in") {
      createOrder(type.id);
    } else {
      navigate("/tables");
      onClose(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={() => onClose()}
      className="sales-type-modal product-modal"
    >
      <div className="product-modal-header">
        <div className="header-left">
          <div className="header-icon-circle">
            <i className="bi bi-cart3"></i>
          </div>
          <h5 className="modal-title">Satış üsulu</h5>
        </div>
        <button className="close-btn" onClick={() => onClose()}>
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      <div className="product-modal-body p-0">
        <div className="sales-type-list">
          {salesTypes.map((type) => (
            <button
              key={type.id}
              className="sales-type-list-item"
              onClick={() => handleSelect(type)}
              disabled={isCreating}
            >
              <div className="d-flex align-items-center gap-2">
                {creatingType === type.id && (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                )}
                <span className="sales-type-label">{type.label}</span>
              </div>
              <i className="bi bi-chevron-right text-muted" style={{ fontSize: '14px' }}></i>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
};
