import React, { useState } from "react";
import Modal from "react-bootstrap/Modal";
import "./EditModal.css";
import { splitOrder, giftItem, updateItemDiscount, updateCount, removeProduct, deleteOrderItem, addPendingDeletion, updateItemPrice, updateItemCount, saveLog } from "../../redux/Slices/OrdersSlice";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SplitTableSelect from "../SlpitOrderModa/SplitTableSelect";
import SplitWaiterSelect from "../SlpitOrderModa/SplitWaiterSelect";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import CheckDeleteModal from "../CheckDeleteModal/CheckDeleteModal";

const EditModal = ({ show, onClose, product, orders, onOpenDeleteModal }) => {
  console.log("EditModal render:", { show, product, orders });
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
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);

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

    const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
    try {
      const result = await dispatch(
        splitOrder({
          data: payload,
          profileId: loginedProfileData?.data?.profile?.id,
          profile: loginedProfileData?.data?.profile,
          hallData: hallServiceFee,
          waiterName
        })
      ).unwrap();

      if (result?.data?.newOrder?.uuid) {
        await dispatch(getTableGroups(loginedProfileData?.data?.profile?.id));
        await dispatch(getActiveOrders({ profileId: loginedProfileData?.data?.profile?.id }));

        if (result.data.status === 'merged') {

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
              <button
                className="sidebar-btn btn-delete"
                onClick={() => {
                  if (product.isNew) {
                    // Find index in products array. 
                    // Since product prop is constructed in CheckMain, we rely on product_id matches.
                    // But duplicates might exist if we added same product twice?
                    // CheckMain merges them: "Process New (Local) ... combinedLocal.forEach..."
                    // A local product in `products` array has `id` (productId).
                    // `updateCount` handles finding by productId.
                    // So we can just find index by productId.

                    const index = products.findIndex(p => p.id === (product.product_id || product.id));
                    if (index !== -1) {
                      dispatch(removeProduct(index));
                    }
                    onClose();
                  } else {
                    onOpenDeleteModal('full', product);
                  }
                }}
              >
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
                      onClick={() => setQty((q) => Math.max(0, q - 1))}
                    >
                      <i className="bi bi-dash"></i>
                    </button>
                    <span className="stepper-value" style={qty === 0 ? { color: '#FF4D4D', fontWeight: 800 } : {}}>{qty}</span>
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
                  className={`save-action-btn ${qty === 0 ? 'red' : ''}`}
                  onClick={async () => {
                    // If qty is 0, trigger full delete
                    if (qty === 0) {
                      if (product.isNew) {
                        const index = products.findIndex(p => p.id === (product.product_id || product.id));
                        if (index !== -1) {
                          dispatch(removeProduct(index));
                        }
                        onClose();
                      } else {
                        onOpenDeleteModal('full', product);
                      }
                      return;
                    }

                    const savedQty = product.savedQuantity || 0;
                    const newLocalQty = qty - savedQty;

                    if (newLocalQty < 0) {
                      onOpenDeleteModal('partial', product, Math.abs(newLocalQty));
                      return;
                    }

                    if (product.isNew) {
                      dispatch(
                        updateCount({
                          productId: product.product_id || product.id,
                          orderItemId: product.isNew ? undefined : product.id,
                          count: newLocalQty,
                          price: inputValue,
                          name: product.name,
                        }),
                      );
                      // Log quantity change for new items too
                      if (qty !== (product.count || 0)) {
                        const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
                        dispatch(saveLog({
                          orderId: orders.uuid,
                          action: "Miqdar dəyişdirildi",
                          waiterName,
                          details: `${product.name || 'Məhsul'}: ${product.count || 0}-dən ${qty}-ə dəyişdi`
                        }));
                      }
                    } else {
                      // For existing items, handle price change immediately
                      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";

                      // Check if price changed - only price goes to backend immediately
                      if (parseFloat(inputValue) !== parseFloat(product.price)) {
                        await dispatch(updateItemPrice({
                          orderId: orders.uuid,
                          itemId: product.id,
                          newPrice: inputValue,
                          oldPrice: product.price,
                          productName: product.name,
                          waiterName
                        })).unwrap();
                      }

                      // Quantity change stays local - will be sent via "Göndər" button
                      if (newLocalQty > 0) {
                        dispatch(
                          updateCount({
                            productId: product.product_id || product.id,
                            count: newLocalQty,
                            price: inputValue,
                            name: product.name,
                          }),
                        );
                      }
                      // Log quantity change
                      if (qty !== (product.count || 0)) {
                        dispatch(saveLog({
                          orderId: orders.uuid,
                          action: "Miqdar dəyişdirildi",
                          waiterName,
                          details: `${product.name || 'Məhsul'}: ${product.count || 0}-dən ${qty}-ə dəyişdi`
                        }));
                      }
                    }
                    onClose(true);
                  }}
                >
                  <i className={`bi ${qty === 0 ? 'bi-trash3-fill' : 'bi-check-lg'}`}></i>
                  {qty === 0 ? 'Sil' : 'Saxla'}
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
                  <i className="bi bi-arrow-left-right"></i> Köçür
                </button>
              </>
            ) : activeTab === "gift" ? (
              <>
                <div className="edit-form-wrapper">
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

                  <div className="text-center text-muted mb-4 fs-6 mt-2">
                    <i className="bi bi-info-circle me-2"></i>
                    {product?.is_gift === 1
                      ? "Seçilən miqdar ikramdan çıxarılacaq"
                      : "Seçilən miqdar ikram olunacaq"}
                  </div>
                </div>

                {product?.is_gift === 1 ? (
                  <button
                    className="save-action-btn red"
                    onClick={() => {
                      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
                      dispatch(giftItem({
                        orderId: orders.uuid,
                        itemId: product.product_id || product.id,
                        qty: transferQty,
                        isGift: false, // Remove gift status
                        productName: product.name || product.product?.name,
                        waiterName
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
                    <i className="bi bi-x-circle"></i>
                    İkramı Ləğv Et
                  </button>
                ) : (
                  <button
                    className="save-action-btn"
                    onClick={() => {
                      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
                      dispatch(giftItem({
                        orderId: orders.uuid,
                        itemId: product.product_id || product.id,
                        qty: transferQty,
                        isGift: true, // Add gift status
                        productName: product.name || product.product?.name,
                        waiterName
                      })).then((res) => {
                        if (res.type.endsWith('fulfilled')) {
                          onClose();
                          toast.success("Məhsul ikram edildi");
                        } else {
                          toast.error("Xəta baş verdi");
                        }
                      });
                    }}
                  >
                    <i className="bi bi-gift-fill"></i>
                    İkram Et
                  </button>
                )}
              </>
            ) : activeTab === "discount" ? (
              <>
                <div className="edit-form-wrapper">
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
                  className="save-action-btn"
                  onClick={() => {
                    const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
                    dispatch(updateItemDiscount({
                      orderId: orders.uuid,
                      itemId: product.product_id || product.id,
                      discountValue: discountValue,
                      discountType: discountType,
                      productName: product.name || product.product?.name,
                      waiterName
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
                  <i className="bi bi-percent"></i>
                  Tətbiq et
                </button>
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
