import React, { useMemo } from "react";
import { Modal, Row, Col } from "react-bootstrap";
import { t } from "../../utils/translations";
import "./OperationsModal.css";

const DEFAULT_OPERATION_NAMES = {
  "split": "Çeki böl",
  "history": "Əməliyyat Tarixçəsi",
  "comment": "Çekə şərh yaz",
  "customers": "Müştəri bazası",
  "clear": "Çeki təmizləmə",
  "discount": "Endirim",
  "merge": "Çeki birləşdir",
  "saleType": "Satış üsulunu dəyiş",
  "waiter": "Əməkdaş dəyiş",
  "serviceFee": "Xidmət haqqı əlavə et",
  "table": "Masanı dəyiş",
  "delete": "Çeki sil",
  "deposit": "Depozit",
  "guestCount": "Qonaq sayını dəyiş",
};

export { DEFAULT_OPERATION_NAMES };

const OperationsModal = React.memo(({
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
  loginedWaiter,
}) => {
  const customNames = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("pos_operation_names") || "{}");
    } catch { return {}; }
  }, [show]);

  const n = (key) => customNames[key] || DEFAULT_OPERATION_NAMES[key];

  const operations = useMemo(() => [
    { icon: "bi-arrows-angle-expand", text: n("split"), functions: handleOpenSplitModel, permissions: loginedWaiter?.data?.can_split_receipt },
    { icon: "bi-clock-history", text: n("history"), functions: openHistory, permissions: loginedWaiter?.data?.can_view_logs },
    {
      icon: "bi-chat-left-text",
      text: n("comment"),
      functions: openCommentModal,
      permissions: loginedWaiter?.data?.can_add_check_comment
    },
    { icon: "bi-person-plus", text: n("customers"), functions: openCustomersModal, permissions: loginedWaiter?.data?.can_view_customers },
    { icon: "bi-journal-x", text: n("clear"), functions: clearCheck, permissions: loginedWaiter?.data?.can_clear_check },
    { icon: "bi-percent", text: n("discount"), functions: openDiscountModal, permissions: loginedWaiter?.data?.can_add_discount },
    {
      icon: "bi-collection",
      text: n("merge"),
      functions: openACtiveCheck,
      permissions: loginedWaiter?.data?.can_merge_checks
    },
    {
      icon: "bi-arrow-left-right",
      text: n("saleType"),
      functions: handleOpenChangeSaleType,
      permissions: loginedWaiter?.data?.can_change_sale_type
    },
    { icon: "bi-people", text: n("waiter"), functions: openWaitersModal, permissions: loginedWaiter?.data?.can_change_waiter },
    {
      icon: "bi-bell",
      text: n("serviceFee"),
      functions: openServiceFee,
      permissions: loginedWaiter?.data?.can_edit_service_fee
    },
    { icon: "bi-table", text: n("table"), functions: handleChangeTable, permissions: loginedWaiter?.data?.can_change_table },
    { icon: "bi-trash", text: n("delete"), functions: handleDeleteCheckModal, permissions: loginedWaiter?.data?.can_delete_check },
    { icon: "bi-cash-coin", text: n("deposit"), functions: openDepositModal, permissions: loginedWaiter?.data?.can_give_deposit },
    { icon: "bi-people-fill", text: n("guestCount"), functions: openGuestCountModal, permissions: loginedWaiter?.data?.can_edit_guest_count },
  ], [
    handleOpenSplitModel, openHistory, openCommentModal, openCustomersModal,
    clearCheck, openDiscountModal, openACtiveCheck, handleOpenChangeSaleType,
    openWaitersModal, openServiceFee, handleChangeTable, handleDeleteCheckModal,
    openDepositModal, openGuestCountModal, loginedWaiter, customNames
  ]);

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      animation={false}
      className="operations-modal"
    >
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
        >{t("bagla")}</button>
      </div>
    </Modal>
  );
});

export default OperationsModal;
