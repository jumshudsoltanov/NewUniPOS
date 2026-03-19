import React, { useCallback, useState, useEffect } from "react";
import { preloadCheck } from "../../utils/preloadCheck";
import { Modal } from "react-bootstrap";
import "./SalesTypesModal.css";
import { useDispatch, useSelector } from "react-redux";
import {
  getNextOrderId,
  saleNewOtherOrders,
} from "../../redux/Slices/SaleSlice";
import { saveLog } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders, addOrderOptimistic, updateOrderOptimisticId } from "../../redux/Slices/BooksSlice";
import { useNavigate } from "react-router-dom";

import { getSalesTypes } from "../../redux/Slices/SalesTypesSlice";

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

  useEffect(() => {
    if (show) preloadCheck();
  }, [show]);

  // Construct sales types list.
  const salesTypes = [
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
      label: "Gəl götür",
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

      let nextId = null;
      try {
        const nextIdRes = await dispatch(getNextOrderId(profileId)).unwrap();
        nextId = nextIdRes?.data?.nextId;
      } catch (e) {
        console.warn("getNextOrderId failed, using backend-generated id", e);
      }

      const generatedUuid = crypto.randomUUID();

      const payload = {
        waiterId,
        terminalId,
        profileId,
        sale_type: saleTypeId,
        status: 1,
        is_selected: 1,
        uuid: generatedUuid,
        ...(nextId && { id: nextId }),
      };

      try {
        // Optimistic State Injection
        const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
        const typeLabel = salesTypes.find(t => t.id === saleTypeId)?.label || saleTypeId;

        const optimisticOrder = {
          uuid: generatedUuid,
          id: nextId ?? null,
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
        dispatch(saleNewOtherOrders(payload)).unwrap().then((res) => {
          const finalId = res?.data?.id || res?.count;
          if (finalId && finalId !== nextId) {
            dispatch(updateOrderOptimisticId({ uuid: generatedUuid, newOrderData: { id: finalId } }));
          }
        }).catch(err => console.error("API Create Error:", err));
        
        dispatch(saveLog({
          orderId: generatedUuid,
          action: "Yeni sifariş yaradıldı",
          waiterName,
          details: `Satış növü: ${typeLabel}`
        }));

        // Instant redirect
        navigate(`/check/${generatedUuid}?sale_type=${saleTypeId}`);
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
    createOrder(type.id);
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
