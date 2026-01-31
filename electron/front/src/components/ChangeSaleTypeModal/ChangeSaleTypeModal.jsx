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
  const [showTableModal, setShowTableModal] = useState(false);
  const { tableGroups } = useSelector((state) => state.TablesSlice);
  const saleType = [
    { id: "dine_in", name: "Yerində" },
    { id: "delivery", name: "Çatdırılma" },
    { id: "takeaway", name: "Takeaway" },
  ];

  const filteredSaleType = saleType.filter((item) => {
    return item.id !== order.sale_type;
  });

  const handleChnageSaleType = async (
    saleType,
    tableId = null,
    hallId = null,
  ) => {
    try {
      if (saleType == "dine_in") {
        setShowTableModal(true);
        return;
      }
      //   onClose(true);
      const result = await dispatch(
        changeSaleType({ orderId: order.uuid, saleType, tableId, hallId }),
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
      <Modal show={show} onHide={onClose} size="md">
        <Modal.Header
          closeButton
          className="text-white"
          style={{ backgroundColor: "#0062CC", border: "none" }}
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
        onClose={() => setShowTableModal(false)}
        tableGroups={tableGroups}
      />
    </>
  );
};

export default ChangeSaleTypeModal;
