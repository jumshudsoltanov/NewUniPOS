import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import "./CheckLockModal.css";
import { Container, Col, Row } from "react-bootstrap";
import { useState } from "react";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateLockChecK } from "../../redux/Slices/OrdersSlice";
import { useCallback } from "react";
import { getTableGroups } from "../../redux/Slices/TablesSlice";

const CheckLockModal = ({ show, onClose, order }) => {
  const [status, setStatus] = useState(0);
  const dispatch = useDispatch();
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);

  useEffect(() => {
    setStatus(order?.is_locked);
  }, [order]);

  const handleUpdateStatus = useCallback(async () => {
    onClose(false);
    const newStatus = status === 0 ? 1 : 0;

    setStatus(newStatus);

    const result = await dispatch(
      updateLockChecK({
        orderId: order?.uuid,
        status: newStatus,
      }),
    ).unwrap();

    await dispatch(getTableGroups(loginedProfileData?.data.profile.id));
  }, [
    status,
    order?.uuid,
    loginedProfileData?.data.profile.id,
    dispatch,
    onClose,
  ]);

  return (
    <Modal
      show={show}
      onHide={onClose}
      backdrop="static"
      keyboard={false}
      centered
    >
      <Modal.Header
        closeButton
        className="text-white"
        style={{ backgroundColor: "#0d6efd" }}
      >
        <Modal.Title>Çeki kilidlə</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Container>
          <Row>
            <Col lg={12} className="d-flex justify-content-center">
              <div className="lockIcon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M12 9V14"
                    stroke="#053796"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12.0004 21.4098H5.94042C2.47042 21.4098 1.02042 18.9298 2.70042 15.8998L5.82042 10.2798L8.76042 4.99979C10.5404 1.78979 13.4604 1.78979 15.2404 4.99979L18.1804 10.2898L21.3004 15.9098C22.9804 18.9398 21.5204 21.4198 18.0604 21.4198H12.0004V21.4098Z"
                    stroke="#053796"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M11.9941 17H12.0031"
                    stroke="#053796"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </Col>
            <Col lg={12}>
              {status == 0 ? (
                <div className="lockTextHeader fw-bold text-center mt-3">
                  Qəbzi kilidləmək istədiyinizə əminsiniz?
                </div>
              ) : (
                <div className="lockTextHeader fw-bold text-center mt-3">
                  Qəbzin kilidini açmaq istədiyinizə əminsiniz?
                </div>
              )}
            </Col>
            <Col>
              {status == 0 ? (
                <div className="lockTextHeader text-center mt-2">
                  "Kilidlənmiş qəbzlərdə dəyişiklik etmək mümkün olmayacaq."
                </div>
              ) : (
                <div className="lockTextHeader text-center mt-2">
                  "Kilidlənmiş qəbzin kilidini açdıqdan sonra dəyişiklik etmək
                  mümkün olacaq."
                </div>
              )}
            </Col>
          </Row>
        </Container>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          className="w-100"
          style={{ backgroundColor: "#0d6efd", height: "45px" }}
          onClick={handleUpdateStatus}
        >
          {status == 0 ? "Qəbzi kilidləyin" : "Qəbzin kilidini açın"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CheckLockModal;
