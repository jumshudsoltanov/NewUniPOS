import React, { useState } from "react";
import Modal from "react-bootstrap/Modal";
import "./EditModal.css";
import { splitOrder, giftItem, updateItemDiscount, updateCount } from "../../redux/Slices/OrdersSlice";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SplitTableSelect from "../SlpitOrderModa/SplitTableSelect";
import SplitWaiterSelect from "../SlpitOrderModa/SplitWaiterSelect";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";

const EditModal = ({ show, onClose, product, orders }) => {
  const [activeTab, setActiveTab] = useState("edit");
  const [qty, setQty] = useState(product?.count || 1);
  const [price, setPrice] = useState(product?.price || 0);
  const dispatch = useDispatch();
  const { sentProducts, products } = useSelector((state) => state.OrderSlice);
  const [inputValue, setInputValue] = useState(
    product?.price ? product.price.toString() : "0",
  );

  // Discount States
  const [discountValue, setDiscountValue] = useState("0");
  const [discountType, setDiscountType] = useState("percent"); // percent | amount

  // Transfer States
  const [transferQty, setTransferQty] = useState(1);
  const [showTableSelect, setShowTableSelect] = useState(false);
  const [showWaiterSelect, setShowWaiterSelect] = useState(false);
  const [showSalesTypeSelect, setShowSalesTypeSelect] = useState(false);
  const [selectedSalesType, setSelectedSalesType] = useState('dine_in');
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedWaiter, setSelectedWaiter] = useState(null);
  const [createNewOrder, setCreateNewOrder] = useState(false);

  const navigate = useNavigate();
  const { tableGroups } = useSelector((state) => state.TablesSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);

  const salesTypes = [
    { id: "dine_in", label: "Yerində" },
    { id: "takeaway", label: "Takeaway" },
    { id: "delivery", label: "Çatdırılma" }
  ];

  const handleTransfer = async () => {
    const hallServiceFee = tableGroups?.data?.find(item => item?.id == selectedTable?.hall_id);

    // Validate
    if (selectedSalesType === 'dine_in' && !selectedTable) {
      alert("Please select a table");
      return;
    }

    const payload = {
      orderId: orders.uuid,
      items: [{ id: product.product_id || product.id, qty: transferQty }],
      salesType: selectedSalesType,
      table: selectedTable,
      waiter: selectedWaiter,
      createNewOrder: createNewOrder // Pass the flag
    };

    try {
      const result = await dispatch(
        splitOrder({
          data: payload,
          profileId: loginedProfileData?.data?.profile?.id,
          profile: loginedProfileData?.data?.profile,
          hallData: hallServiceFee
        })
      ).unwrap();

      if (result?.data?.newOrder?.uuid) {
        await dispatch(getTableGroups(loginedProfileData?.data?.profile?.id));
        await dispatch(getActiveOrders({ profileId: loginedProfileData?.data?.profile?.id }));

        if (result.data.status === 'merged') {
          // Stay on check page if merged might be better? Or navigate to the merged check?
          // Assuming result.data.newOrder is the merged order
          if (result.data.newOrder.sale_type === 'dine_in') {
            navigate(`/check/${result.data.newOrder.uuid}?tableId=${result.data.newOrder.table_id || 0}`);
          } else {
            navigate(`/check/${result.data.newOrder.uuid}`);
          }
        } else {
          if (result.data.newOrder.sale_type === 'dine_in') {
            navigate(`/check/${result.data.newOrder.uuid}?tableId=${result.data.newOrder.table_id || 0}`);
          } else {
            navigate(`/check/${result.data.newOrder.uuid}`);
          }
        }
        onClose();
      }
    } catch (error) {
      console.error("Transfer error:", error);
    }
  };

  const handleNumpad = (val) => {
    if (val === "backspace") {
      setInputValue((prev) => prev.slice(0, -1));
    } else {
      setInputValue((prev) => prev + val);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      className="editmodal"
      backdrop="static"
      animation={false}
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
                <div className="edit-form-wrapper-flush">
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
                        orderItemId: product.isNew ? undefined : product.id, // Only send if it exists in DB
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
            ) : activeTab === "transfer" ? (
              <>
                <div className="edit-form-wrapper">
                  {/* Quantity Selector for Transfer */}
                  <div className="stepper-control mb-2">
                    <button className="stepper-btn btn-minus" onClick={() => setTransferQty(q => Math.max(1, q - 1))}>
                      <i className="bi bi-dash"></i>
                    </button>
                    <span className="stepper-value">{transferQty}</span>
                    <button className="stepper-btn btn-plus" onClick={() => setTransferQty(q => Math.min(product?.count || 1, q + 1))}>
                      <i className="bi bi-plus-lg"></i>
                    </button>
                  </div>

                  {/* Sales Type */}
                  <div className="custom-select-box" onClick={() => setShowSalesTypeSelect(!showSalesTypeSelect)}>
                    <span>Satış üsulu : {salesTypes.find(t => t.id === selectedSalesType)?.label}</span>
                    <i className="bi bi-chevron-down"></i>
                    {showSalesTypeSelect && (
                      <div className="custom-dropdown-menu">
                        {salesTypes.map(type => (
                          <div key={type.id} className="dropdown-item-custom" onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSalesType(type.id);
                            setShowSalesTypeSelect(false);
                          }}>
                            {type.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Table Select */}
                  {selectedSalesType === "dine_in" && (
                    <div className="custom-select-box" onClick={() => setShowTableSelect(true)}>
                      <span>{selectedTable ? `${selectedTable.hall_name || ''} - ${selectedTable.number || selectedTable.name}` : "Masa seç"}</span>
                      <i className="bi bi-grid-3x3-gap-fill"></i>
                    </div>
                  )}

                  {/* Waiter Select */}
                  <div className="custom-select-box" onClick={() => setShowWaiterSelect(true)}>
                    <span className={selectedWaiter ? "text-primary fw-bold" : ""}>{selectedWaiter ? selectedWaiter.name : "Əməkdaş seç"}</span>
                    <i className="bi bi-person-badge-fill"></i>
                  </div>

                  {/* New Order Toggle - Only show if Table/Dine-in is selected */}
                  {selectedSalesType === 'dine_in' && selectedTable && (
                    <div className="d-flex align-items-center justify-content-between px-2 mt-2" onClick={() => setCreateNewOrder(!createNewOrder)} style={{ cursor: 'pointer' }}>
                      <span className="text-secondary fw-500">Yeni sifariş yarat</span>
                      <div className={`toggle-switch ${createNewOrder ? 'active' : ''}`}>
                        <div className="toggle-knob"></div>
                      </div>
                    </div>
                  )}
                </div>

                <button className="save-action-btn" onClick={handleTransfer}>
                  <i className="bi bi-arrow-left-right me-2"></i> Köçür
                </button>
              </>
            ) : activeTab === "gift" ? (
              <>
                <div className="d-flex flex-column h-100">
                  <div className="content-with-padding d-flex flex-column">
                    <div className="stepper-control mb-4">
                      <button
                        className="stepper-btn btn-minus"
                        onClick={() => setTransferQty(Math.max(1, transferQty - 1))}
                      >
                        <i className="bi bi-dash"></i>
                      </button>
                      <div className="stepper-value">
                        {transferQty}
                      </div>
                      <button
                        className="stepper-btn btn-plus"
                        onClick={() => setTransferQty(Math.min(product?.count || 1, transferQty + 1))}
                      >
                        <i className="bi bi-plus"></i>
                      </button>
                    </div>

                    <div className="text-center text-muted mb-4 fs-6">
                      <i className="bi bi-info-circle me-2"></i>
                      {product?.is_gift === 1
                        ? "Seçilən miqdar ikramdan çıxarılacaq"
                        : "Seçilən miqdar ikram olunacaq"}
                    </div>
                  </div>

                  <div className="d-flex flex-column gap-2 mt-auto">
                    {product?.is_gift === 1 ? (
                      <button
                        className="save-action-btn red"
                        onClick={() => {
                          dispatch(giftItem({
                            orderId: orders.uuid,
                            itemId: product.product_id || product.id,
                            qty: transferQty,
                            isGift: false // Remove gift status
                          })).then((res) => {
                            if (res.type.endsWith('fulfilled')) {
                              onClose();
                              toast.success("İkram ləğv edildi");
                            } else {
                              toast.error("Xəta baş verdi");
                            }
                          });
                        }}
                      >
                        <i className="bi bi-x-circle me-2"></i>
                        İkramı Ləğv Et
                      </button>
                    ) : (
                      <button
                        className="save-action-btn"
                        onClick={() => {
                          dispatch(giftItem({
                            orderId: orders.uuid,
                            itemId: product.product_id || product.id,
                            qty: transferQty,
                            isGift: true // Add gift status
                          })).then((res) => {
                            if (res.type.endsWith('fulfilled')) {
                              // getActiveOrders remove - handled by reducer
                              onClose();
                              toast.success("Məhsul ikram edildi");
                            } else {
                              toast.error("Xəta baş verdi");
                            }
                          });
                        }}
                      >
                        <i className="bi bi-gift-fill me-2"></i>
                        İkram Et
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : activeTab === "discount" ? (
              <>
                <div className="discount-wrapper">
                  <div className="discount-content">
                    <div className="discount-input-container">
                      <div className="discount-display">
                        {discountValue || "0"}
                      </div>
                      <div className="discount-type-toggles">
                        <button
                          className={`discount-type-btn ${discountType === 'percent' ? 'active' : ''}`}
                          onClick={() => setDiscountType('percent')}
                        >%</button>
                        <button
                          className={`discount-type-btn ${discountType === 'amount' ? 'active' : ''}`}
                          onClick={() => setDiscountType('amount')}
                        >₼</button>
                      </div>
                    </div>

                    <div className="numpad-grid">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'back'].map((key) => (
                        <button
                          key={key}
                          className={`numpad-btn ${key === 'back' ? 'numpad-back' : ''}`}
                          onClick={() => {
                            if (key === 'back') {
                              setDiscountValue(prev => prev.length > 1 ? prev.slice(0, -1) : "0");
                            } else {
                              // If currently 0, replace. Else append. Avoid multiple dots.
                              if (key === '.') {
                                if (!discountValue.includes('.')) setDiscountValue(prev => prev + key);
                              } else {
                                setDiscountValue(prev => prev === "0" ? String(key) : prev + String(key));
                              }
                            }
                          }}
                        >
                          {key === 'back' ? <i className="bi bi-backspace"></i> : key}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    className="save-action-btn mt-3"
                    onClick={() => {
                      dispatch(updateItemDiscount({
                        orderId: orders.uuid,
                        itemId: product.product_id || product.id,
                        discountValue: discountValue,
                        discountType: discountType
                      })).then((res) => {
                        if (res.type.endsWith('fulfilled')) {
                          onClose();
                          toast.success("Endirim tətbiq edildi");
                        } else {
                          toast.error("Xəta baş verdi");
                        }
                      });
                    }}
                  >
                    Tətbiq et
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-tab-content p-4 text-center text-muted">
                <i className="bi bi-cone-striped fs-1 d-block mb-3"></i>
                Bu bölmə tezliklə hazır olacaq
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        <SplitTableSelect
          show={showTableSelect}
          onClose={() => setShowTableSelect(false)}
          onSelect={(table) => { setSelectedTable(table); setShowTableSelect(false); }}
        />
        <SplitWaiterSelect
          show={showWaiterSelect}
          onClose={() => setShowWaiterSelect(false)}
          onSelect={(waiter) => { setSelectedWaiter(waiter); setShowWaiterSelect(false); }}
        />
      </Modal.Body>
    </Modal >
  );
};

export default EditModal;
