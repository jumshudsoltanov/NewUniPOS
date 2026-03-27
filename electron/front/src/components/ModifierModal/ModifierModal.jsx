import React, { useState, useEffect } from "react";
import { Modal } from "react-bootstrap";
import { toast } from "sonner";
import "./ModifierModal.css";

const ModifierModal = ({ show, onHide, product, onConfirm }) => {
    // state: { groupId: { modifierId: quantity } }
    const [selections, setSelections] = useState({});
    const [errors, setErrors] = useState([]);

    // Helper to normalize group properties as they might vary from API/DB
    const normalizeGroup = (group) => {
        if (!group) return {};
        return {
            ...group,
            selection_type: group.selection_type || group.type || 'multiple',
            is_required: group.is_required === 1 || group.required === 1 || group.required === true,
            max_selection: parseInt(group.max_selection || group.max_count || 0)
        };
    };

    const getModifierGroups = (prod) => {
        if (!prod?.modifier_groups) return [];
        if (Array.isArray(prod.modifier_groups)) return prod.modifier_groups;
        if (typeof prod.modifier_groups === 'string') {
            try { return JSON.parse(prod.modifier_groups) || []; } catch { return []; }
        }
        return [];
    };

    useEffect(() => {
        const groups = getModifierGroups(product);
        if (show && groups.length > 0) {
            // Initialize default selections
            const initialSelections = {};
            groups.forEach(group => {
                initialSelections[group.id] = {};
                if (group.items) {
                    group.items.forEach(item => {
                        if (item.is_default) {
                            initialSelections[group.id][item.id] = parseInt(item.quantity || 1);
                        }
                    });
                }
            });
            setSelections(initialSelections);
            setErrors([]);
        }
    }, [show, product]);

    const handleSelect = (groupId, item) => {
        const rawGroup = getModifierGroups(product).find(g => g.id === groupId);
        const group = normalizeGroup(rawGroup);
        const maxSelection = group.max_selection;
        const itemFixedQty = parseInt(item.quantity || 1);

        setSelections(prev => {
            const groupSelections = { ...(prev[groupId] || {}) };
            const currentQty = groupSelections[item.id] || 0;

            if (group.selection_type === "single") {
                // If it's a single selection, clear others in the group and toggle this one
                if (currentQty > 0) {
                    return { ...prev, [groupId]: {} }; // Deselect
                } else {
                    return { ...prev, [groupId]: { [item.id]: itemFixedQty } }; // Select
                }
            } else {
                // Multiple selection toggle
                if (currentQty > 0) {
                    delete groupSelections[item.id];
                } else {
                    // Check max_selection limit if set
                    if (maxSelection > 0) {
                        const totalSelectedInGroup = Object.values(groupSelections).reduce((a, b) => a + b, 0);
                        if (totalSelectedInGroup + itemFixedQty > maxSelection) {
                            toast.error(`Maksimum ${maxSelection} seçim edə bilərsiniz.`);
                            return prev; // Limit reached
                        }
                    }
                    groupSelections[item.id] = itemFixedQty;
                }
                return { ...prev, [groupId]: groupSelections };
            }
        });

        // Clear error for this group if exists
        setErrors(prev => prev.filter(id => id !== groupId));
    };

    // handleQtyChange removed as per user request (quantity comes from API)

    const validateSelections = () => {
        const newErrors = [];
        const modGroups = getModifierGroups(product);
        if (modGroups.length > 0) {
            modGroups.forEach(rawGroup => {
                const group = normalizeGroup(rawGroup);
                if (group.is_required) {
                    const groupSel = selections[group.id] || {};
                    const hasSelection = Object.values(groupSel).some(qty => qty > 0);
                    if (!hasSelection) {
                        newErrors.push(group.id);
                    }
                }
            });
        }
        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const handleConfirm = () => {
        if (validateSelections()) {
            // Format selections into array: [{ id, name, price, count }]
            const formattedModifiers = [];

            getModifierGroups(product).forEach(group => {
                const groupSel = selections[group.id] || {};
                group.items.forEach(item => {
                    const qty = groupSel[item.id];
                    if (qty && qty > 0) {
                        formattedModifiers.push({
                            id: item.id,
                            name: item.name,
                            price: parseFloat(item.price || 0),
                            count: qty,
                            // Preserve printer/category info for standalone printing
                            printer_id: item.printer_id,
                            category_id: item.category_id,
                            printer_details: item.printer_details || []
                        });
                    }
                });
            });

            onConfirm({
                ...product,
                modifiers: formattedModifiers,
            });
            onHide();
        } else {
            // Optional: visual feedback for errors is already handled by className={`modifier-group ${hasError ? 'has-error' : ''}`}
            toast.error("Zəhmət olmasa məcburi seçimləri tamamlayın.");
        }
    };

    const calculateTotal = () => {
        let total = parseFloat(product?.price || 0);
        getModifierGroups(product).forEach(group => {
            const groupSel = selections[group.id] || {};
            group.items.forEach(item => {
                const qty = groupSel[item.id] || 0;
                total += qty * parseFloat(item.price || 0);
            });
        });
        return total.toFixed(2);
    };

    if (!product) return null;

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            backdrop="static"
            keyboard={false}
            dialogClassName="modifier-modal"
        >
            <div className="modifier-modal-header">
                <div className="header-left">
                    <div className="header-icon-circle">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                            <polyline points="2 17 12 22 22 17"></polyline>
                            <polyline points="2 12 12 17 22 12"></polyline>
                        </svg>
                    </div>
                    <h5 className="modal-title">{product.name}</h5>
                </div>
                <div className="product-price-badge">
                    {parseFloat(product.price || 0).toFixed(2)} ₼
                </div>
                <button className="close-btn" onClick={onHide}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <Modal.Body className="modifier-modal-body">
                {getModifierGroups(product).map(rawGroup => {
                    const group = normalizeGroup(rawGroup);
                    const hasError = errors.includes(group.id);
                    return (
                        <div key={group.id} className={`modifier-group ${hasError ? 'has-error' : ''}`}>
                            <div className="modifier-group-header">
                                <div className="group-title">{group.name}</div>
                                <div className="d-flex gap-2">
                                    <span className={`group-badge ${group.is_required ? 'required' : 'optional'}`}>
                                        {group.is_required ? "Məcburi" : "İstəyə bağlı"}
                                    </span>
                                    <span className="group-badge type-badge">
                                        {group.selection_type === 'single' ? "Tək seçim" : "Çoxlu seçim"}
                                    </span>
                                    {group.max_selection > 0 && (
                                        <span className="group-badge type-badge">
                                            Limit: {group.max_selection}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="modifier-items-list">
                                {group.items?.map(item => {
                                    const qty = (selections[group.id] || {})[item.id] || 0;
                                    const isSelected = qty > 0;
                                    const price = parseFloat(item.price || 0);

                                    return (
                                        <div
                                            key={item.id}
                                            className={`modifier-item ${isSelected ? 'selected' : ''}`}
                                            onClick={() => handleSelect(group.id, item)}
                                        >
                                            <div className={`item-check ${group.selection_type === 'single' ? 'radio' : ''}`}>
                                                {isSelected && (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12"></polyline>
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="item-info">
                                                <div className="item-name">
                                                    {item.name}
                                                    {parseInt(item.quantity) > 1 && (
                                                        <span className="ms-2 text-primary" style={{ fontSize: '0.85rem' }}>
                                                            ({item.quantity} ədəd)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className={`item-price ${price === 0 ? 'free' : ''}`}>
                                                {price === 0 ? "Pulsuz" : `+${price.toFixed(2)} ₼`}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </Modal.Body>

            <div className="modifier-modal-footer">
                <button className="modifier-cancel-btn" onClick={onHide}>
                    Ləğv et
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="modifier-total">
                        Cəm: <span className="total-amount">{calculateTotal()} ₼</span>
                    </div>
                    <button className="modifier-add-btn" onClick={handleConfirm}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Əlavə et
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ModifierModal;
