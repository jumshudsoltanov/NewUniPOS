import React, { useCallback, useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Container, Row, Col, Button } from "react-bootstrap";
import "./CustomersModal.css";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { saleNewOrders } from "../../redux/Slices/SaleSlice";
import {
  getTableGroups,
  currentTableList,
} from "../../redux/Slices/TablesSlice";

const CustomersModal = ({ show, onHide, table }) => {
  const [guestCount, setGuestCount] = useState("0");
  const dispatch = useDispatch();
  // const { newSale } = useSelector((state) => state.SaleSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { currentHallId } = useSelector((state) => state.TablesSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);

  const navigate = useNavigate();

  const handleNumberClick = (num) => {
    if (guestCount === "0") {
      setGuestCount(num.toString());
    } else {
      setGuestCount((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    setGuestCount((prev) => {
      if (prev.length <= 1) return "0";
      return prev.slice(0, -1);
    });
  };

  const handleClear = () => {
    setGuestCount("0");
  };

  const [isCreating, setIsCreating] = useState(false);

  const createOrder = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);

    const payload = {
      guestCount,
      tableId: table.id,
      waiterId: loginedWaiter.data.id,
      terminalId: loginedProfileData.data.terminal.terminal_id,
      profileId: loginedProfileData.data.profile.id,
      sale_type: 0,
      hallId: currentHallId,
      status: 1,
      is_selected: 1,
    };

    try {
      const result = await dispatch(saleNewOrders(payload)).unwrap();
      if (result.message === "success") {
        navigate(`/check/${result.data.id}`);
      }
      console.log(result);
    } catch (err) {
      console.log("Cek yaradilmadi:", err);
    } finally {
      setIsCreating(false);
    }
  }, [
    dispatch,
    guestCount,
    table?.id,
    loginedWaiter.data.id,
    loginedProfileData.data.terminal.terminal_id,
    loginedProfileData.data.profile.id,
    currentHallId,
    navigate,
    isCreating,
  ]);

  // useEffect(() => {
  //   dispatch(currentTableList(currentHallId));
  // }, [dispatch, currentHallId]);

  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <Modal show={show} onHide={onHide} centered className="customers-modal">
      <Modal.Header closeButton className="modal-header-custom">
        <div className="header-content">
          <div className="icon-circle">
            <i className="bi bi-people"></i>
          </div>
          <Modal.Title>Qonaq sayı</Modal.Title>
        </div>
      </Modal.Header>

      <Modal.Body className="p-0">
        <div className="display-area text-center py-2">
          <h1 className="guest-count-display">{guestCount}</h1>
          <p className="text-muted mb-1">Qonaq sayını seçin</p>
        </div>

        <Container className="keypad-container pb-3 px-3">
          <Row className="g-2 justify-content-center">
            {numbers.map((num) => (
              <Col xs={4} key={num} className="d-flex justify-content-center">
                <Button
                  variant="light"
                  className="keypad-btn"
                  onClick={() => handleNumberClick(num)}
                  disabled={isCreating}
                >
                  {num}
                </Button>
              </Col>
            ))}
            <Col xs={4} className="d-flex justify-content-center">
              <Button
                variant="light"
                className="keypad-btn"
                onClick={() => handleNumberClick(".")}
                disabled={isCreating}
              >
                .
              </Button>
            </Col>
            <Col xs={4} className="d-flex justify-content-center">
              <Button
                variant="light"
                className="keypad-btn"
                onClick={() => handleNumberClick(0)}
                disabled={isCreating}
              >
                0
              </Button>
            </Col>
            <Col xs={4} className="d-flex justify-content-center">
              <Button
                variant="light"
                className="keypad-btn backspace-btn"
                onClick={handleBackspace}
                disabled={isCreating}
              >
                <i className="bi bi-backspace"></i>
              </Button>
            </Col>
          </Row>
        </Container>
      </Modal.Body>

      <Modal.Footer className="justify-content-center p-2 border-0">
        <Button
          className="w-100 save-btn"
          disabled={isCreating}
          onClick={() => {
            createOrder();
          }}
        >
          {isCreating ? (
            <>
              <span
                className="spinner-border spinner-border-sm me-2"
                role="status"
                aria-hidden="true"
              ></span>
              Yaradılır...
            </>
          ) : (
            "Yadda saxla"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CustomersModal;
