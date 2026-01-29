import React, { useState } from "react";
import Modal from "react-bootstrap/Modal";
import "./EditModal.css";
import { updateCount } from "../../redux/Slices/OrdersSlice";
import { useDispatch, useSelector } from "react-redux";

const EditModal = ({ show, onClose, product, orders }) => {
  const [activeTab, setActiveTab] = useState("edit");
  const [qty, setQty] = useState(product?.count || 1);
  const [price, setPrice] = useState(product?.price || 0);
  const dispatch = useDispatch();
  const { sentProducts, products } = useSelector((state) => state.OrderSlice);
  const [inputValue, setInputValue] = useState(
    product?.price ? product.price.toString() : "0",
  );

  const handleNumpad = (val) => {
    if (val === "backspace") {
      setInputValue((prev) => prev.slice(0, -1));
    } else {
      setInputValue((prev) => prev + val);
    }
  };


  console.log(orders.orders_items)

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      className="editmodal"
      backdrop="static"
    >
      <Modal.Body>
        <div className="edit-modal-layout">
          {/* Sidebar Navigation */}
          <div className="edit-sidebar">
            <div className="edit-sidebar-nav">
              <button
                className={`sidebar-btn ${activeTab === "edit" ? "active" : ""}`}
                onClick={() => setActiveTab("edit")}
              >
                <i className="bi bi-pencil-fill"></i>
                <span>Dəyişmək</span>
              </button>

              <button
                className={`sidebar-btn ${activeTab === "transfer" ? "active" : ""}`}
                onClick={() => setActiveTab("transfer")}
              >
                <i className="bi bi-arrow-left-right"></i>
                <span>Köçürmə</span>
              </button>

              <button
                className={`sidebar-btn ${activeTab === "gift" ? "active" : ""}`}
                onClick={() => setActiveTab("gift")}
              >
                <i className="bi bi-gift-fill"></i>
                <span>İkram</span>
              </button>

              <button
                className={`sidebar-btn ${activeTab === "discount" ? "active" : ""}`}
                onClick={() => setActiveTab("discount")}
              >
                <i className="bi bi-percent"></i>
                <span>Endirim</span>
              </button>

              <button
                className={`sidebar-btn ${activeTab === "seller" ? "active" : ""}`}
                onClick={() => setActiveTab("seller")}
              >
                <i className="bi bi-person-fill"></i>
                <span>Satıcı</span>
              </button>
            </div>

            <div className="sidebar-bottom">
              <button className="sidebar-btn btn-delete">
                <i className="bi bi-trash3-fill"></i>
                <span>Sil</span>
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="edit-main-content">
            {/* Header */}
            <div className="edit-header">
              <div className="edit-product-title">
                {product?.name || "Məhsul adı"}
              </div>
              <button className="btn-close-custom" onClick={onClose}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {/* Dynamic Content */}
            {activeTab === "edit" ? (
              <>
                <div className="edit-form-wrapper">
                  {/* Price / Input Display */}
                  <div className="input-display-box">
                    <input
                      type="text"
                      className="super-input"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                    />
                    <div className="currency-icon">₼</div>
                    <div className="input-label">
                      Orijinal qiymət: {Number(product?.price || 0).toFixed(2)}{" "}
                      ₼
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="stepper-control">
                    <button
                      className="stepper-btn btn-minus"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                    >
                      <i className="bi bi-dash"></i>
                    </button>
                    <span className="stepper-value">{qty}</span>
                    <button
                      className="stepper-btn btn-plus"
                      onClick={() => setQty((q) => q + 1)}
                    >
                      <i className="bi bi-plus-lg"></i>
                    </button>
                  </div>

                  {/* Numeric Keypad */}
                  <div className="numpad-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, ".", 0].map((num) => (
                      <button
                        key={num}
                        className="num-key"
                        onClick={() => handleNumpad(num)}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      className="num-key"
                      onClick={() => handleNumpad("backspace")}
                    >
                      <i className="bi bi-backspace"></i>
                    </button>
                  </div>
                </div>

                {/* Footer Action Button */}
                <button
                  className="save-action-btn"
                  onClick={() => {
                    const savedQty = product.savedQuantity || 0;
                    const newLocalQty = qty - savedQty;

                    dispatch(
                      updateCount({
                        productId: product.product_id || product.id,
                        count: newLocalQty,
                        price: inputValue,
                        name: product.name,
                      }),
                    );
                    onClose(true);
                  }}
                >
                  <i className="bi bi-check-lg"></i>
                  Saxla
                </button>
              </>
            ) : (
              <div className="empty-tab-content">
                Bu bölmə tezliklə hazır olacaq
              </div>
            )}
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default EditModal;
