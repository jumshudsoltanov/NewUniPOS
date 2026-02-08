import React, { useState } from "react";
import { Modal, Button, Col, Row, Container } from "react-bootstrap";
import "./ChangeSaleTypeModal.css";
import { changeSaleType } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { useDispatch, useSelector } from "react-redux";
import TableGroupsModal from "../TableGroupsModal/TableGroupsModal";
const ChangeSaleTypeModal = ({ show, onClose, order }) => {
  const dispatch = useDispatch();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const [showTableModal, setShowTableModal] = useState(false);
  const { tableGroups } = useSelector((state) => state.TablesSlice);

  const saleType = [
    { id: "dine_in", name: "Yerində" },
    { id: "delivery", name: "Çatdırılma" },
    { id: "takeaway", name: "Takeaway" },
  ];

  const filteredSaleType = saleType.filter((item) => {
    return item.id !== order?.sale_type;
  });

  const handleChnageSaleType = async (
    selectedTypeId,
    tableId = null,
    hallId = null,
  ) => {
    try {
      if (selectedTypeId == "dine_in" && !tableId) {
        setShowTableModal(true);
        return;
      }
      onClose(true);

      const oldTypeName = saleType.find(t => t.id === order?.sale_type)?.name || 'Naməlum';
      const newTypeName = saleType.find(t => t.id === selectedTypeId)?.name || 'Naməlum';
      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

      const result = await dispatch(
        changeSaleType({
          orderId: order.uuid,
          saleType: selectedTypeId,
          tableId,
          hallId,
          oldTypeName,
          newTypeName,
          waiterName
        }),
      ).unwrap();

      if (result) {
        await dispatch(getTableGroups(loginedProfileData?.data?.profile?.id));
        await dispatch(
          getActiveOrders({ profileId: loginedProfileData?.data?.profile?.id }),
        );
      }
    } catch (error) {
      console.log("Sale Type Change Error", error);
    }
  };

  return (
    <>
      <Modal show={show && !showTableModal} onHide={onClose} size="md">
        <Modal.Header
          closeButton
          className="text-white"
          style={{ backgroundColor: "#5D99FF", border: "none" }}
        >
          <Modal.Title className="fs-5">Satış üsulu</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          <div className="d-flex flex-column">
            {filteredSaleType?.map((item, index) => (
              <div
                key={item.id}
                className="saleTypeModalBtn text-center"
                onClick={() => {
                  handleChnageSaleType(item.id);
                }}
              >
                {item.name}
              </div>
            ))}
          </div>
        </Modal.Body>
      </Modal>

      <TableGroupsModal
        show={showTableModal}
        onClose={(selectedTable) => {
          setShowTableModal(false);
          if (selectedTable && selectedTable.id) {
            handleChnageSaleType(
              "dine_in",
              selectedTable.id,
              selectedTable.hall_id,
            );
          }
        }}
        tableGroups={tableGroups}
      />
    </>
  );
};

export default ChangeSaleTypeModal;
