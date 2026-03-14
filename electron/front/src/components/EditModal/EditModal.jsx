import React, { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import "./EditModal.css";
import {
  changeSaleType,
  deleteOrderItem,
  giftItem,
  mergeChecks,
  reopenOrder,
  updateGuestCountOrder,
  updateItemCount,
  updateItemDiscount,
  updateItemPrice,
  updateTableOrders,
  removeAllProductsById,
  removeLocalProductByFirstId,
  replaceProductQuantity,
  updateCount,
  saveLog,
  splitOrder,
  addPendingDeletion
} from "../../redux/Slices/OrdersSlice";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import SplitTableSelect from "../SlpitOrderModa/SplitTableSelect";
import SplitWaiterSelect from "../SlpitOrderModa/SplitWaiterSelect";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import CheckDeleteModal from "../CheckDeleteModal/CheckDeleteModal";


const EditModal = ({ show, onClose, product, orders, onOpenDeleteModal }) => {
  const [activeTab, setActiveTab] = useState("edit");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 576);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 576);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [qty, setQty] = useState(product?.count || 1);
  const [price, setPrice] = useState(product?.price || 0);
  const dispatch = useDispatch();
  const { sentProducts, products, menu } = useSelector((state) => state.OrderSlice);
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

  const { id: orderUuidFromUrl } = useParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { tableGroups } = useSelector((state) => state.TablesSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { isOnline, hasInternet } = useSelector((state) => state.SyncSlice);
  const isOffline = !isOnline || !hasInternet;
  const navigate = useNavigate();

  // Lookup product info from menu to ensure we have flags
  const productInfo = menu?.find(m => m.id === (product?.product_id || product?.id));
  const isNoDiscount = (product?.no_discount === 1 || product?.product?.no_discount === 1 || productInfo?.no_discount === 1);

  const salesTypes = [
    { id: "dine_in", label: "Yerində" },
    { id: "takeaway", label: "Takeaway" },
    { id: "delivery", label: "Çatdırılma" }
  ];

  const handleTransfer = async () => {
    if (product?.isNew) {
      toast.info("Gözləyən məhsulu köçürmək üçün əvvəlcə 'Göndər' düyməsini sıxın.");
      return;
    }

    const hallServiceFee = tableGroups?.data?.find(item => item?.id == selectedTable?.hall_id);

    if (isSubmitting) return;
    setIsSubmitting(true);
    if (selectedSalesType === 'dine_in' && !selectedTable) {
      console.error("Please select a table");
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
        const profileId = loginedProfileData?.data?.profile?.id;
        await Promise.all([
          dispatch(getTableGroups(profileId)),
          dispatch(getActiveOrders({ profileId }))
        ]);

        if (result.data.newOrder.sale_type === 'dine_in') {
          navigate(`/check/${result.data.newOrder.uuid}?tableId=${result.data.newOrder.table_id || 0}`);
        } else {
          navigate(`/check/${result.data.newOrder.uuid}`);
        }
        onClose();
      }
    } catch (error) {
      console.error("Transfer error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNumpad = (val) => {
    if (val === "backspace") {
      setInputValue((prev) => prev.slice(0, -1));
    } else {
      setInputValue((prev) => prev + val);
    }
  };

  const handleApplyDiscount = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
      const orderId = orders?.uuid || orderUuidFromUrl;
      const itemId = product?.id || product?.firstId;

      if (!orderId) {
        toast.error("Sifariş ID-si tapılmadı");
        return;
      }

      if (product.isNew) {
        toast.info("Gözləyən məhsula endirim tətbiq etmək üçün əvvəlcə 'Göndər' düyməsini sıxın.");
        return;
      }

      const payload = {
        orderId: orderId,
        itemId: itemId,
        productId: product?.product_id || product?.id,
        discountValue: discountValue,
        discountType: discountType,
        productName: product.name,
        waiterName
      };

      await dispatch(updateItemDiscount(payload)).unwrap();
      toast.success("Endirim tətbiq edildi");

      onClose();
    } catch (error) {
      console.error("Discount error detail:", error);
      const errorMsg = error?.error || error?.message || "Xəta baş verdi";
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
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
        {/* Header moved to top level */}
        <div className="edit-header">
          <div className="edit-product-title">
            {product?.name || "Məhsul adı"}
          </div>
          <button className="btn-close-custom" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="edit-modal-layout">
          {isOffline && (
            <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#92400E' }}>
              <i className="bi bi-wifi-off" />
              İnternet bağlantısı yoxdur — redaktə əməliyyatları məhdudlaşdırılıb
            </div>
          )}
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

              {Number(loginedWaiter?.data?.can_transfer_product) === 1 && (
                <button
                  className={`sidebar-btn ${activeTab === "transfer" ? "active" : ""}`}
                  onClick={() => setActiveTab("transfer")}
                >
                  <i className="bi bi-arrow-left-right"></i>
                  <span>Köçürmə</span>
                </button>
              )}

              {Number(loginedWaiter?.data?.can_give_treats) === 1 && (
                <button
                  className={`sidebar-btn ${activeTab === "gift" ? "active" : ""}`}
                  onClick={() => setActiveTab("gift")}
                >
                  <i className="bi bi-gift-fill"></i>
                  <span>İkram</span>
                </button>
              )}

              {Number(loginedWaiter?.data?.can_give_product_discount) === 1 && (
                <button
                  className={`sidebar-btn ${activeTab === "discount" ? "active" : ""}`}
                  onClick={() => setActiveTab("discount")}
                >
                  <i className="bi bi-percent"></i>
                  <span>Endirim</span>
                </button>
              )}

              <button
                className={`d-none sidebar-btn ${activeTab === "seller" ? "active" : ""}`}
                onClick={() => setActiveTab("seller")}
              >
                <i className="bi bi-person-fill"></i>
                <span>Satıcı</span>
              </button>
            </div>

            <div className="sidebar-bottom">
              {(product?.isNew || Number(loginedWaiter?.data?.can_delete_product) === 1) && (
                <button
                  className="sidebar-btn btn-delete"
                  disabled={isOffline && !product?.isNew}
                  style={isOffline && !product?.isNew ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                  onClick={() => {
                    if (isOffline && !product?.isNew) return;
                    const productId = Number(product.product_id || product.id);
                    if (product.isNew && product.localQuantity > 0) {
                      // Remove the local (unsaved) portion immediately — no reason needed
                      dispatch(removeAllProductsById(productId));
                      if (!product.savedQuantity || product.savedQuantity <= 0) {
                        // No DB items at all — just close
                        onClose();
                      } else {
                        // DB items still remain — open reason modal for those
                        onOpenDeleteModal('full', { ...product, localQuantity: 0, isNew: false, count: product.savedQuantity });
                      }
                    } else {
                      // DB-only item — reason required
                      onOpenDeleteModal('full', product);
                    }
                  }}
                >
                  <i className="bi bi-trash3-fill"></i>
                  <span>Sil</span>
                </button>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="edit-main-content">
            {/* Dynamic Content */}
            {activeTab === "edit" ? (
              <>
                <div className="edit-form-wrapper">
                  {/* Price / Input Display */}
                  <div className="input-display-box" onClick={() => {
                    if (Number(loginedWaiter?.data?.can_change_product_price) !== 1) {
                      toast.error("Sizin qiymət dəyişmək icazəniz yoxdur!");
                    }
                  }}>
                    <input
                      type="text"
                      className="super-input"
                      value={inputValue}
                      disabled={Number(loginedWaiter?.data?.can_change_product_price) !== 1}
                      onChange={(e) => {
                        if (Number(loginedWaiter?.data?.can_change_product_price) !== 1) return;
                        setInputValue(e.target.value);
                      }}

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
                      onClick={() => {
                        const newQty = Math.max(0, qty - 1);
                        const savedQty = product.savedQuantity || 0;
                        if (newQty < savedQty && Number(loginedWaiter?.data?.can_delete_product) !== 1) {
                          toast.error("Sizin məhsul silmək icazəniz yoxdur!");
                          return;
                        }
                        setQty(newQty);
                      }}
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
                  disabled={isSubmitting || (isOffline && !product?.isNew)}
                  style={{ opacity: (isSubmitting || (isOffline && !product?.isNew)) ? 0.4 : 1, cursor: (isOffline && !product?.isNew) ? 'not-allowed' : undefined }}
                  onClick={async () => {
                    if (isSubmitting || (isOffline && !product?.isNew)) return;
                    setIsSubmitting(true);
                    try {
                      // If qty is 0, trigger full delete
                      if (qty === 0) {
                        const productId = Number(product.product_id || product.id);
                        if (product.isNew && product.localQuantity > 0) {
                          dispatch(removeAllProductsById(productId));
                          if (!product.savedQuantity || product.savedQuantity <= 0) {
                            onClose();
                          } else {
                            if (Number(loginedWaiter?.data?.can_delete_product) !== 1) {
                              toast.error("Sizin məhsul silmək icazəniz yoxdur!");
                              return;
                            }
                            onOpenDeleteModal('full', { ...product, localQuantity: 0, isNew: false, count: product.savedQuantity });
                          }
                        } else {
                          if (Number(loginedWaiter?.data?.can_delete_product) !== 1) {
                            toast.error("Sizin məhsul silmək icazəniz yoxdur!");
                            return;
                          }
                          onOpenDeleteModal('full', product);
                        }
                        return;
                      }

                      const savedQty = product.savedQuantity || 0;
                      const newLocalQty = qty - savedQty;

                      if (newLocalQty < 0) {
                        if (Number(loginedWaiter?.data?.can_delete_product) !== 1) {
                          toast.error("Sizin məhsul silmək icazəniz yoxdur!");
                          setQty(savedQty);
                          return;
                        }
                        if (product.isNew && product.localQuantity > 0) {
                          dispatch(removeAllProductsById(Number(product.product_id || product.id)));
                        }
                        const dbReduction = Math.abs(newLocalQty);
                        onOpenDeleteModal('partial', { ...product, localQuantity: 0, isNew: false, count: savedQty }, dbReduction);
                        return;
                      }

                      if (product.isNew && !product.savedQuantity) {
                        // Pure local item — remove ALL copies and add ONE with the correct qty
                        if (qty === 0) {
                          dispatch(removeAllProductsById(Number(product.product_id || product.id)));
                        } else {
                          dispatch(replaceProductQuantity({
                            productId: Number(product.product_id || product.id),
                            newQty: qty,
                            price: inputValue,
                            // No firstId: replaces ALL entries for this product
                          }));
                        }
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
                        onClose(true);
                        return;
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
                          dispatch(updateCount({
                            productId: Number(product.product_id || product.id),
                            count: newLocalQty,
                            price: inputValue,
                            name: product.name,
                          }));
                        } else {
                          dispatch(removeAllProductsById(Number(product.product_id || product.id)));
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
                    } catch (error) {
                      console.error("Save error:", error);
                      toast.error("Xəta baş verdi");
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                      <span>Gözləyin...</span>
                    </>
                  ) : (
                    <>
                      <i className={`bi ${qty === 0 ? 'bi-trash3-fill' : 'bi-check-lg'}`}></i>
                      {qty === 0 ? 'Sil' : 'Saxla'}
                    </>
                  )}
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

                <button
                  className="save-action-btn"
                  disabled={isSubmitting}
                  style={{ opacity: isSubmitting ? 0.7 : 1 }}
                  onClick={() => {
                    if (!Number(loginedWaiter?.data?.can_transfer_product)) return;
                    handleTransfer();
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                      <span>Köçürülür...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-left-right"></i> Köçür
                    </>
                  )}
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
                    disabled={isSubmitting}
                    style={{ opacity: isSubmitting ? 0.7 : 1 }}
                    onClick={() => {
                      if (product?.isNew) {
                        toast.info("Gözləyən məhsulun ikramını ləğv etmək üçün əvvəlcə 'Göndər' düyməsini sıxın.");
                        return;
                      }
                      if (isSubmitting) return;
                      setIsSubmitting(true);
                      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
                      dispatch(giftItem({
                        orderId: orders.uuid,
                        itemId: product?.id || product?.firstId,
                        qty: transferQty,
                        isGift: false, // Remove gift status
                        productName: product.name || product.product?.name,
                        waiterName
                      })).then((res) => {
                        setIsSubmitting(false);
                        if (res.type.endsWith('fulfilled')) {
                          onClose();
                          toast.success("İkram ləğv edildi");
                        } else {
                          toast.error("Xəta baş verdi");
                        }
                      });
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                        <span>Ləğv edilir...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-x-circle"></i>
                        İkramı Ləğv Et
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    className="save-action-btn"
                    disabled={isSubmitting}
                    style={{ opacity: isSubmitting ? 0.7 : 1 }}
                    onClick={() => {
                      if (product?.isNew) {
                        toast.info("Gözləyən məhsulu ikram etmək üçün əvvəlcə 'Göndər' düyməsini sıxın.");
                        return;
                      }
                      if (isSubmitting) return;
                      setIsSubmitting(true);
                      const waiterName = loginedWaiter?.data?.name || loginedProfileData?.data?.profile?.name || "Naməlum";
                      dispatch(giftItem({
                        orderId: orders.uuid,
                        itemId: product?.id || product?.firstId,
                        qty: transferQty,
                        isGift: true, // Add gift status
                        productName: product.name || product.product?.name,
                        waiterName
                      })).then((res) => {
                        setIsSubmitting(false);
                        if (res.type.endsWith('fulfilled')) {
                          onClose();
                          toast.success("Məhsul ikram edildi");
                        } else {
                          toast.error("Xəta baş verdi");
                        }
                      });
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                        <span>İkram edilir...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-gift-fill"></i>
                        İkram Et
                      </>
                    )}
                  </button>
                )}
              </>
            ) : activeTab === "discount" ? (
              isNoDiscount ? (
                <div className="empty-tab-content p-4 text-center text-muted">
                  <i className="bi bi-slash-circle fs-1 d-block mb-3 text-danger"></i>
                  <h5 className="text-danger">Endirim qadağandır</h5>
                  <p>Bu məhsula endirim tətbiq edilə bilməz</p>
                </div>
              ) : (
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
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, ".", 0].map((num) => (
                        <button
                          key={num}
                          className="num-key"
                          onClick={() => {
                            if (num === '.') {
                              if (!discountValue.includes('.')) setDiscountValue(prev => prev + num);
                            } else {
                              setDiscountValue(prev => prev === "0" ? String(num) : prev + String(num));
                            }
                          }}
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        className="num-key"
                        onClick={() => setDiscountValue(prev => prev.length > 1 ? prev.slice(0, -1) : "0")}
                      >
                        <i className="bi bi-backspace"></i>
                      </button>
                    </div>
                  </div>

                  <button
                    className="save-action-btn"
                    onClick={handleApplyDiscount}
                    disabled={isSubmitting}
                    style={{ opacity: isSubmitting ? 0.7 : 1 }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                        <span>Tətbiq edilir...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-percent"></i>
                        <span>Tətbiq et</span>
                      </>
                    )}
                  </button>
                </>
              )
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
