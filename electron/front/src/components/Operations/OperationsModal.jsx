import React from "react";
import { Modal, Row, Col } from "react-bootstrap";
import "./OperationsModal.css";
import OtherChecks from "../OtherChecks/OtherChecks";

export const OperationsModal = ({
  show,
  onHide,
  clearCheck,
  openCommentModal,
  openDiscountModal,
  openServiceFee,
  openWaitersModal,
  handleChangeTable,
  openACtiveCheck,
  handleOpenChangeSaleType,
  handleOpenSplitModel,
  handleDeleteCheckModal,
  openDepositModal,
  openHistory,
  openCustomersModal,
  openGuestCountModal,
  loginedWaiter
}) => {


  const operations = [
    { icon: "bi-arrows-angle-expand", text: "Çeki böl", functions: handleOpenSplitModel, permissions: loginedWaiter?.data?.can_split_receipt },
    { icon: "bi-clock-history", text: "Əməliyyat Tarixçəsi", functions: openHistory, permissions: loginedWaiter?.data?.can_view_logs },
    {
      icon: "bi-chat-left-text",
      text: "Çekə şərh yaz",
      functions: openCommentModal,
      permissions: loginedWaiter?.data?.can_add_check_comment
    },
    { icon: "bi-person-plus", text: "Müştəri bazası", functions: openCustomersModal, permissions: loginedWaiter?.data?.can_view_customers },
    { icon: "bi-journal-x", text: "Çeki təmizləmə", functions: clearCheck, permissions: loginedWaiter?.data?.can_clear_check },
    { icon: "bi-percent", text: "Endirim", functions: openDiscountModal, permissions: loginedWaiter?.data?.can_add_discount },
    {
      icon: "bi-collection",
      text: "Çeki birləşdir",
      functions: openACtiveCheck,
      permissions: loginedWaiter?.data?.can_merge_checks
    },
    {
      icon: "bi-arrow-left-right",
      text: "Satış üsulunu dəyiş",
      functions: handleOpenChangeSaleType,
      permissions: loginedWaiter?.data?.can_change_sale_type
    },
    { icon: "bi-people", text: "Əməkdaş dəyiş", functions: openWaitersModal, permissions: loginedWaiter?.data?.can_change_waiter },
    {
      icon: "bi-bell",
      text: "Xidmət haqqı əlavə et",
      functions: openServiceFee,
      permissions: loginedWaiter?.data?.can_edit_service_fee
    },
    { icon: "bi-table", text: "Masanı dəyiş", functions: handleChangeTable, permissions: loginedWaiter?.data?.can_change_table },
    { icon: "bi-trash", text: "Çeki sil", functions: handleDeleteCheckModal, permissions: loginedWaiter?.data?.can_delete_check },
    { icon: "bi-cash-coin", text: "Depozit", functions: openDepositModal, permissions: loginedWaiter?.data?.can_give_deposit },
    { icon: "bi-people-fill", text: "Qonaq sayını dəyiş", functions: openGuestCountModal, permissions: 1 },
  ];

  return (
    <>
      <Modal
        show={show}
        onHide={onHide}
        centered
        size="lg"
        className="operations-modal"
      >
        {false && (
          <Modal.Header className="bg-primary text-white border-0 py-3 px-4 d-flex align-items-center justify-content-between">
            <h5 className="m-0"></h5>
            {/* Close X Button for Desktop */}
            <div
              className="close-btn cursor-pointer d-none d-lg-flex align-items-center justify-content-center p-1 rounded-circle"
              onClick={onHide}
              style={{
                width: "32px",
                height: "32px",
                background: "rgba(255,255,255,0.2)",
              }}
            >
              <i
                className="bi bi-x-lg text-white"
                style={{ fontSize: "16px" }}
              ></i>
            </div>
          </Modal.Header>
        )}
        <Modal.Body className="p-3 position-relative">
          <Row className="g-2">
            {operations.filter(op => op.permissions).map((op, index) => (
              <Col xs={12} md={6} key={index}>
                <div
                  className="operation-item d-flex align-items-center gap-2 py-2 px-2 rounded cursor-pointer"
                  onClick={op.functions}
                >
                  <i className={`bi ${op.icon} fs-5 operation-icon`}></i>
                  <span className="text-dark fw-medium fs-6">{op.text}</span>
                </div>
              </Col>
            ))}
          </Row>
        </Modal.Body>
        <div className="p-3 d-md-none" style={{ borderTop: '1px solid #eee' }}>
          <button
            className="btn w-100 close-operation-btn"
            onClick={onHide}
          >
            Bağla
          </button>
        </div>
      </Modal>
    </>
  );
};

export default OperationsModal;
