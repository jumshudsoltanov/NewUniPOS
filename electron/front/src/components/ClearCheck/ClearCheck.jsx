import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import { useDispatch, useSelector } from "react-redux";
import { clearOrders, deleteOrderItems } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";

const ClearCheck = ({ show, onClose, order }) => {
  const dispatch = useDispatch();
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);

  const handleClearCheck = async () => {
    try {
      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
      const profileId = loginedProfileData?.data?.profile?.id;

      await dispatch(
        deleteOrderItems({ orderId: order.uuid, waiterName }),
      ).unwrap();

      if (profileId) {
        await dispatch(getTableGroups(profileId));
        await dispatch(getActiveOrders({ profileId }));
      }
    } catch (error) {
      console.error("Clear Check Error:", error);
    }
  };

  return (
    <Modal show={show} onHide={onClose} size="md">
      <Modal.Header closeButton style={{ backgroundColor: "#0062CC" }}>
        <Modal.Title className="text-white">Xəbərdarlıq</Modal.Title>
      </Modal.Header>
      <Modal.Body className="text-center fw-bold">
        Qəbzi təmizləmək istədiyinizə əminsiniz?
      </Modal.Body>
      <Modal.Footer>
        <Button variant="danger" onClick={onClose}>
          Ləvğ et
        </Button>
        <Button
          style={{ backgroundColor: "#0062CC" }}
          onClick={() => {
            handleClearCheck();
            onClose(true);
          }}
        >
          Təsdiqlə
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ClearCheck;
