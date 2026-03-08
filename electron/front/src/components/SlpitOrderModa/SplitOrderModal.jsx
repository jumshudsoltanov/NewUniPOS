import React, { useState, useEffect } from "react";
import { Modal } from "react-bootstrap";
import "./SplitOrderModal.css";

// Icons
const PlusIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12h14" />
    </svg>
);

const MinusIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14" />
    </svg>
);

const CloseIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

import SplitTableSelect from "./SplitTableSelect";
import SplitWaiterSelect from "./SplitWaiterSelect";

export const SplitOrderModal = ({ show, onClose, orderItems = [], order, onSplit }) => {
    const [splitQuantities, setSplitQuantities] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Selection States
    const [showTableSelect, setShowTableSelect] = useState(false);
    const [showWaiterSelect, setShowWaiterSelect] = useState(false);
    const [showSalesTypeSelect, setShowSalesTypeSelect] = useState(false);

    const [selectedSalesType, setSelectedSalesType] = useState('dine_in'); // Default 'dine_in' (Yerində)
    const [selectedTable, setSelectedTable] = useState(null);
    const [selectedWaiter, setSelectedWaiter] = useState(null);





    // Merge items with same product_id + same price into one row
    const getMergedItems = (items) => {
        const groups = {};
        (items || []).forEach(item => {
            const price = item.price ?? item.sell_price ?? item.unit_price ?? 0;
            const key = `${item.product_id}_${price}`;
            if (!groups[key]) {
                groups[key] = { ...item, count: 0, _key: key, _price: price };
            }
            groups[key].count += (item.count || 1);
        });
        return Object.values(groups);
    };

    // Reset state when modal opens
    useEffect(() => {
        if (show) {
            const initialqs = {};
            const merged = getMergedItems(order?.orders_items);
            merged.forEach(item => {
                initialqs[item._key] = 0;
            });
            setSplitQuantities(initialqs);
            setSelectedSalesType('dine_in');
            setSelectedTable(null);
            setSelectedWaiter(null);
        }
    }, [show, order]);

    const handleIncrement = (key, maxQty) => {
        setSplitQuantities(prev => {
            const current = prev[key] || 0;
            if (current < maxQty) {
                return { ...prev, [key]: current + 1 };
            }
            return prev;
        });
    };

    const handleDecrement = (key) => {
        setSplitQuantities(prev => {
            const current = prev[key] || 0;
            if (current > 0) {
                return { ...prev, [key]: current - 1 };
            }
            return prev;
        });
    };

    const handleSplitAction = async () => {
        const itemsToSplit = Object.entries(splitQuantities)
            .filter(([_, qty]) => qty > 0)
            .map(([key, qty]) => {
                const product_id = key.split('_')[0];
                return { id: product_id, qty };
            });

        if (itemsToSplit.length > 0 && !isSubmitting) {
            setIsSubmitting(true);
            try {
                await onSplit({
                    orderId: order.uuid,
                    items: itemsToSplit,
                    salesType: selectedSalesType,
                    table: selectedTable,
                    waiter: selectedWaiter
                });
            } catch (error) {
                console.error("Split error:", error);
                setIsSubmitting(false);
            }
        }
    };

    const displayItems = getMergedItems(order?.orders_items);

    const salesTypes = [
        { id: "dine_in", label: "Yerində" },
        { id: "takeaway", label: "Takeaway" },
        { id: "delivery", label: "Çatdırılma" }
    ];

    // Find label for current sales type
    const currentSalesTypeLabel = salesTypes.find(t => t.id === selectedSalesType)?.label || "Yerində";

    return (
        <>
            <Modal
                show={show}
                onClose={onClose}
                centered
                dialogClassName="split-order-modal-dialog"
                backdropClassName="split-order-modal-backdrop"
                style={{ borderRadius: '1px' }}
            >
                <div className="split-order-container">
                    {/* Header */}
                    <div className="split-header">
                        <h2 className="split-title">Çeki böl</h2>
                        <button className="split-close-btn" onClick={onClose}>
                            <CloseIcon />
                        </button>
                    </div>

                    {/* Column Headers */}
                    <div className="split-list-header">
                        <div className="col-product">Məhsullar</div>
                        <div className="col-qty">Miqdar</div>
                        <div className="col-action">Bölmək</div>
                    </div>

                    {/* Product List */}
                    <div className="split-body">
                        {displayItems.map((item) => {
                            const splitQty = splitQuantities[item._key] || 0;
                            const remaining = item.count - splitQty;

                            return (
                                <div key={item._key} className="split-item-row">
                                    <div className="col-product">
                                        <span className="product-name">{item.product?.name || item.product_name || item.name || "Məhsul"}</span>
                                    </div>
                                    <div className="col-qty">
                                        <span className="product-qty">{item.count}</span>
                                    </div>
                                    <div className="col-action control-group">
                                        <button
                                            className={`btn-control btn-minus ${splitQty === 0 ? 'disabled' : ''}`}
                                            onClick={() => handleDecrement(item._key)}
                                            disabled={splitQty === 0}
                                        >
                                            <MinusIcon />
                                        </button>

                                        <div className="split-value-display">
                                            {splitQty}
                                        </div>

                                        <button
                                            className={`btn-control btn-plus ${remaining === 0 ? 'disabled' : ''}`}
                                            onClick={() => handleIncrement(item._key, item.count)}
                                            disabled={remaining === 0}
                                        >
                                            <PlusIcon />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="split-footer">
                        <div className="footer-left-actions">

                            {/* Sales Type Selector */}
                            <div className="mock-selector" onClick={() => setShowSalesTypeSelect(!showSalesTypeSelect)} style={{ position: 'relative' }}>
                                <span>Satış üsulu : {currentSalesTypeLabel}</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>

                                {showSalesTypeSelect && (
                                    <div className="sales-type-popover" style={{ bottom: '100%', left: 0, marginBottom: '8px', zIndex: 100 }}>
                                        <div className="sales-type-options">
                                            {salesTypes.map(type => (
                                                <div
                                                    key={type.id}
                                                    className="sales-type-option"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedSalesType(type.id);
                                                        setShowSalesTypeSelect(false);
                                                    }}
                                                >
                                                    <span className="sales-type-label">{type.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Table Selector (Only for Dine-in) */}
                            {selectedSalesType === 'dine_in' && (
                                <button className="btn-secondary-action" onClick={() => setShowTableSelect(true)}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3zM9 3v18M15 3v18" /></svg>
                                    {selectedTable ? `${selectedTable.hall_name || ''} - ${selectedTable.number || selectedTable.name}` : "Masa seç"}
                                </button>
                            )}

                            {/* Waiter Selector */}
                            <button
                                className="btn-secondary-action icon-only"
                                style={{
                                    paddingLeft: selectedWaiter ? "12px" : "10px",
                                    paddingRight: selectedWaiter ? "12px" : "10px",
                                    gap: '8px'
                                }}
                                onClick={() => setShowWaiterSelect(true)}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: selectedWaiter ? '#5D99FF' : 'inherit' }}>
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                                {selectedWaiter && <span style={{ fontSize: '14px', fontWeight: '500' }}>{selectedWaiter.name}</span>}
                            </button>
                        </div>

                        <button
                            className="btn-primary-split"
                            onClick={handleSplitAction}
                            disabled={isSubmitting}
                            style={{ opacity: isSubmitting ? 0.7 : 1 }}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                                    Bölünür...
                                </>
                            ) : (
                                <>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
                                        <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M9 21H4v-5" />
                                    </svg>
                                    Bölmək
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Sub-Modals */}
            <SplitTableSelect
                show={showTableSelect}
                onClose={() => setShowTableSelect(false)}
                onSelect={(table) => {
                    setSelectedTable(table);
                    setShowTableSelect(false);
                }}
            />

            <SplitWaiterSelect
                show={showWaiterSelect}
                onClose={() => setShowWaiterSelect(false)}
                onSelect={(waiter) => {
                    setSelectedWaiter(waiter);
                    setShowWaiterSelect(false);
                }}
            />
        </>
    );
};

export default SplitOrderModal;