import React, { useState } from "react";
import { Modal } from "react-bootstrap";
import "./ChangeSaleTypeModal.css";
import { changeSaleType } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { useDispatch, useSelector } from "react-redux";
import TableGroupsModal from "../TableGroupsModal/TableGroupsModal";

const saleTypes = [
  { id: "dine_in",   name: "Yerində",    icon: "bi bi-house-door" },
  { id: "delivery",  name: "Çatdırılma", icon: "bi bi-bicycle" },
  { id: "takeaway",  name: "Takeaway",   icon: "bi bi-bag" },
];

const ChangeSaleTypeModal = ({ show, onClose, order }) => {
  const dispatch = useDispatch();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const [showTableModal, setShowTableModal] = useState(false);
  const { tableGroups } = useSelector((state) => state.TablesSlice);

  const filteredSaleType = saleTypes.filter((item) => item.id !== order?.sale_type);

  const handleChangeSaleType = async (selectedTypeId, tableId = null, hallId = null) => {
    try {
      if (selectedTypeId === "dine_in" && !tableId) {
        setShowTableModal(true);
        return;
      }
      onClose(true);

      const oldTypeName = saleTypes.find(t => t.id === order?.sale_type)?.name || "Naməlum";
      const newTypeName = saleTypes.find(t => t.id === selectedTypeId)?.name || "Naməlum";
      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

      const result = await dispatch(
        changeSaleType({ orderId: order.uuid, saleType: selectedTypeId, tableId, hallId, oldTypeName, newTypeName, waiterName }),
      ).unwrap();

      if (result) {
        const profileId = loginedProfileData?.data?.profile?.id;
        Promise.all([
          dispatch(getTableGroups(profileId)),
          dispatch(getActiveOrders({ profileId }))
        ]);
      }
    } catch (error) {
      console.log("Sale Type Change Error", error);
    }
  };

  return (
    <>
      <Modal show={show && !showTableModal} onHide={onClose} centered dialogClassName="sale-type-modal">
        <Modal.Header style={{ background: "#4F85F4", border: "none", padding: "16px 20px" }}>
          <div className="d-flex align-items-center gap-2">
            <div className="st-icon-box">
              <i className="bi bi-cart3"></i>
            </div>
            <Modal.Title style={{ fontSize: "18px", fontWeight: 600, color: "#fff", margin: 0 }}>
              Satış üsulu
            </Modal.Title>
          </div>
          <button className="st-close-btn" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </Modal.Header>
        <Modal.Body className="p-0">
          <div className="st-list">
            {filteredSaleType.map((item) => (
              <button
                key={item.id}
                className="st-item"
                onClick={() => handleChangeSaleType(item.id)}
              >
                <div className="d-flex align-items-center gap-3">
                  <i className={`${item.icon} st-item-icon`}></i>
                  <span className="st-item-name">{item.name}</span>
                </div>
                <i className="bi bi-chevron-right st-chevron"></i>
              </button>
            ))}
          </div>
        </Modal.Body>
      </Modal>

      <TableGroupsModal
        show={showTableModal}
        onClose={(selectedTable) => {
          setShowTableModal(false);
          if (selectedTable && selectedTable.id) {
            handleChangeSaleType("dine_in", selectedTable.id, selectedTable.hall_id);
          }
        }}
        tableGroups={tableGroups}
      />
    </>
  );
};

export default ChangeSaleTypeModal;
