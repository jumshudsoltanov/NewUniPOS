import React, { useCallback, useState } from "react";
import { Modal } from "react-bootstrap";
import "./SalesTypesModal.css";
import { useDispatch, useSelector } from "react-redux";
import {
  saleNewOrders,
  saleNewOtherOrders,
} from "../../redux/Slices/SaleSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { useNavigate, useParams } from "react-router-dom";

export const SalesTypesModal = ({ show, onClose, onSelect }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const [saleType, setSaleType] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const salesTypes = [
    {
      id: "dine_in",
      label: "Yerində",
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

      const payload = {
        waiterId,
        terminalId,
        profileId,
        sale_type: saleTypeId,
        status: 1,
        is_selected: 1,
      };

      try {
        const result = await dispatch(saleNewOtherOrders(payload)).unwrap();
        if (result?.message === "success") {
          await dispatch(getTableGroups(payload.profileId));
          await dispatch(getActiveOrders({ profileId: payload.profileId }));
          navigate(`/check/${result?.data?.uuid}`);
          onClose(false);
        }
      } catch (err) {
        console.error("Check created error:", err);
      } finally {
        setIsCreating(false);
      }
    },
    [
      dispatch,
      loginedWaiter,
      loginedProfileData,
      navigate,
      isCreating,
      onClose
    ],
  );

  const handleSelect = (type) => {
    setSaleType(type.id);
    if (type.id !== "dine_in") {
      createOrder(type.id);
    }
    onClose(true);
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="sales-type-modal"
      backdrop={true}
      dialogClassName="sales-type-dialog"
      animation={false}
    >
      <Modal.Body className="sales-type-modal-body">
        <div className="sales-type-options">
          {salesTypes.map((type) => (
            <button
              key={type.id}
              className="sales-type-option"
              onClick={() => handleSelect(type)}
            >
              <div className="sales-type-icon">{type.icon}</div>
              <span className="sales-type-label">{type.label}</span>
            </button>
          ))}
        </div>
      </Modal.Body>
    </Modal>
  );
};
