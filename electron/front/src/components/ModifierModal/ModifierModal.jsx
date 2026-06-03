import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "react-bootstrap";
import { toast } from "sonner";
import "./ModifierModal.css";

const ModifierModal = ({ show, onHide, product, onConfirm, onDelete }) => {
    // state: { groupId: { modifierId: quantity } }
    const [selections, setSelections] = useState({});
    const [errors, setErrors] = useState([]);
    const [activeGroupId, setActiveGroupId] = useState(null);
    const [activeItemId, setActiveItemId] = useState(null);
    const [qtyStr, setQtyStr] = useState("0");

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
        const groups = prod?.modifier_groups;
        if (!groups) return [];
        if (Array.isArray(groups)) return groups;
        if (typeof groups === 'string') {
            try { return JSON.parse(groups) || []; } catch { return []; }
        }
        if (typeof groups === 'object') {
            return Object.values(groups);
        }
        return [];
    };

    const modifierGroups = useMemo(() => getModifierGroups(product), [product]);

    const activeGroup = useMemo(() => {
        if (!activeGroupId) return null;
        return modifierGroups.find(g => g.id === activeGroupId);
    }, [modifierGroups, activeGroupId]);

    useEffect(() => {
        if (show && modifierGroups.length > 0) {
            // Set first group as active
            const firstGroup = normalizeGroup(modifierGroups[0]);
            setActiveGroupId(firstGroup.id);
            setActiveItemId(null);
            setQtyStr("0");

            // Parse existing modifiers if any
            let existingModifiers = [];
            try {
                if (Array.isArray(product.modifiers)) {
                    existingModifiers = product.modifiers;
                } else if (typeof product.modifiers === "string") {
                    existingModifiers = JSON.parse(product.modifiers || '[]');
                }
            } catch (e) { /* ignore */ }

            // Initialize default selections
            const initialSelections = {};
            modifierGroups.forEach(rawGroup => {
                const group = normalizeGroup(rawGroup);
                initialSelections[group.id] = {};
                if (group.items) {
                    group.items.forEach(item => {
                        if (product.isFromCheck) {
                            const existing = existingModifiers.find(m => m.id === item.id);
                            if (existing && existing.count > 0) {
                                initialSelections[group.id][item.id] = parseInt(existing.count);
                            }
                        } else {
                            if (item.is_default) {
                                initialSelections[group.id][item.id] = parseInt(item.quantity || 1);
                            }
                        }
                    });
                }
            });
            setSelections(initialSelections);
            setErrors([]);
        }
    }, [show, product, modifierGroups]);

    // Update active item when group changes
    useEffect(() => {
        if (activeGroupId) {
            const groupSel = selections[activeGroupId] || {};
            const selectedIds = Object.keys(groupSel);
            if (selectedIds.length > 0) {
                const firstId = selectedIds[0];
                setActiveItemId(firstId);
                setQtyStr(String(groupSel[firstId]));
            } else {
                setActiveItemId(null);
                setQtyStr("0");
            }
        }
    }, [activeGroupId, selections]);

    // Sync selections changes to active item qtyStr
    useEffect(() => {
        if (activeGroupId && activeItemId) {
            const currentQty = (selections[activeGroupId] || {})[activeItemId] || 0;
            setQtyStr(String(currentQty));
        }
    }, [selections, activeGroupId, activeItemId]);

    // Sync quantity updates back to selections state
    const updateQuantity = (itemId, value) => {
        if (!activeGroupId) return;
        setSelections(prev => {
            const groupSel = { ...(prev[activeGroupId] || {}) };
            if (value <= 0) {
                delete groupSel[itemId];
            } else {
                groupSel[itemId] = value;
            }
            return { ...prev, [activeGroupId]: groupSel };
        });
    };

    const handleItemClick = (item) => {
        const group = normalizeGroup(activeGroup);
        const currentQty = (selections[activeGroupId] || {})[item.id] || 0;

        setActiveItemId(item.id);

        if (group.selection_type === "single") {
            // Single selection: clear others and set this one
            setSelections(prev => ({
                ...prev,
                [activeGroupId]: { [item.id]: 1 }
            }));
            setQtyStr("1");
        } else {
            if (currentQty > 0) {
                // Already selected, just make active to edit quantity
                setQtyStr(String(currentQty));
            } else {
                // Check max selection limit
                if (group.max_selection > 0) {
                    const currentGroupSelections = selections[activeGroupId] || {};
                    const totalSelected = Object.values(currentGroupSelections).reduce((a, b) => a + b, 0);
                    if (totalSelected + 1 > group.max_selection) {
                        toast.error(`Maksimum ${group.max_selection} seçim edə bilərsiniz.`);
                        return;
                    }
                }
                // Select with quantity 1
                setSelections(prev => ({
                    ...prev,
                    [activeGroupId]: {
                        ...(prev[activeGroupId] || {}),
                        [item.id]: 1
                    }
                }));
                setQtyStr("1");
            }
        }
    };

    const handleItemRemove = (e, item) => {
        e.stopPropagation();
        setSelections(prev => {
            const groupSel = { ...(prev[activeGroupId] || {}) };
            delete groupSel[item.id];
            return { ...prev, [activeGroupId]: groupSel };
        });
        if (activeItemId === item.id) {
            setActiveItemId(null);
            setQtyStr("0");
        }
    };

    const handleStepperChange = (delta) => {
        if (!activeItemId || !activeGroup) return;
        const currentVal = parseFloat(qtyStr) || 0;
        const newVal = Math.max(0, currentVal + delta);

        const group = normalizeGroup(activeGroup);
        if (delta > 0 && group.max_selection > 0 && group.selection_type !== 'single') {
            const currentGroupSelections = selections[activeGroupId] || {};
            const otherSelectedQty = Object.entries(currentGroupSelections)
                .filter(([id]) => id !== activeItemId)
                .reduce((sum, [_, q]) => sum + q, 0);
            if (otherSelectedQty + newVal > group.max_selection) {
                toast.error(`Maksimum ${group.max_selection} seçim edə bilərsiniz.`);
                return;
            }
        }

        setQtyStr(String(newVal));
        updateQuantity(activeItemId, newVal);
    };

    const handleKeypadPress = (val) => {
        if (!activeItemId || !activeGroup) {
            toast.error("Zəhmət olmasa əvvəlcə bir modifier seçin.");
            return;
        }

        let next;
        if (val === "backspace") {
            next = qtyStr.slice(0, -1);
            if (next === "" || next === "-") next = "0";
        } else if (val === ".") {
            next = qtyStr.includes(".") ? qtyStr : qtyStr + ".";
        } else {
            next = qtyStr === "0" ? String(val) : qtyStr + val;
        }

        const numVal = parseFloat(next) || 0;
        const group = normalizeGroup(activeGroup);
        if (group.max_selection > 0 && group.selection_type !== 'single') {
            const currentGroupSelections = selections[activeGroupId] || {};
            const otherSelectedQty = Object.entries(currentGroupSelections)
                .filter(([id]) => id !== activeItemId)
                .reduce((sum, [_, q]) => sum + q, 0);
            if (otherSelectedQty + numVal > group.max_selection) {
                toast.error(`Maksimum ${group.max_selection} seçim edə bilərsiniz.`);
                return;
            }
        }

        setQtyStr(next);
        updateQuantity(activeItemId, numVal);
    };

    const validateSelections = () => {
        const newErrors = [];
        if (modifierGroups.length > 0) {
            modifierGroups.forEach(rawGroup => {
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
            const formattedModifiers = [];

            modifierGroups.forEach(group => {
                const groupSel = selections[group.id] || {};
                (group.items || []).forEach(item => {
                    const qty = groupSel[item.id];
                    if (qty && qty > 0) {
                        formattedModifiers.push({
                            id: item.id,
                            name: item.name,
                            price: parseFloat(item.price || 0),
                            count: qty,
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
            toast.error("Zəhmət olmasa məcburi seçimləri tamamlayın.");
        }
    };

    const calculateTotal = () => {
        let total = parseFloat(product?.price || 0);
        modifierGroups.forEach(group => {
            const groupSel = selections[group.id] || {};
            (group.items || []).forEach(item => {
                const qty = groupSel[item.id] || 0;
                total += qty * parseFloat(item.price || 0);
            });
        });
        return total.toFixed(2);
    };

    if (!product) return null;

    const normActiveGroup = normalizeGroup(activeGroup);

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            backdrop="static"
            keyboard={false}
            className="modifier-modal-v2-modal-wrapper"
            dialogClassName="modifier-modal-v2-dialog"
        >
            <div className="modifier-modal-v2-header">
                <span className="modal-title">{product.name}</span>
                <button className="close-btn" onClick={onHide}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <div className="modifier-modal-v2-body">
                {/* Left Sidebar with Groups and Clear button */}
                <div className="modifier-v2-sidebar">
                    <div className="sidebar-nav">
                        {(modifierGroups || []).map(rawGroup => {
                            const group = normalizeGroup(rawGroup);
                            const isActive = group.id === activeGroupId;
                            const hasError = errors.includes(group.id);
                            
                            // Check if selected
                            const groupSel = selections[group.id] || {};
                            const hasSelection = Object.values(groupSel).some(qty => qty > 0);

                            return (
                                <button
                                    key={group.id}
                                    className={`sidebar-btn-v2 ${isActive ? "active" : ""} ${hasError ? "has-error" : ""}`}
                                    onClick={() => setActiveGroupId(group.id)}
                                >
                                    <i className="bi bi-sliders"></i>
                                    <span>{group.name}</span>
                                    {group.is_required && !hasSelection && (
                                        <span className="required-indicator">*</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="sidebar-bottom">
                        <button
                            className="sidebar-btn-v2 btn-delete-v2"
                            onClick={() => {
                                if (product?.isFromCheck && onDelete) {
                                    onDelete('qty_select');
                                } else {
                                    const cleared = {};
                                    modifierGroups.forEach(g => { cleared[g.id] = {}; });
                                    setSelections(cleared);
                                    setActiveItemId(null);
                                    setQtyStr("0");
                                }
                            }}
                        >
                            <i className="bi bi-trash3-fill"></i>
                            <span>Sil</span>
                        </button>
                    </div>
                </div>

                {/* Middle Content */}
                <div className="modifier-v2-main-content">
                    <div className="main-content-header">
                        <div className="d-flex align-items-center justify-content-between">
                            <h4 className="group-title">{activeGroup?.name || "Modifikator"}</h4>
                            {activeGroup && (
                                <div className="group-badges">
                                    <span className={`group-badge ${normActiveGroup.is_required ? 'required' : 'optional'}`}>
                                        {normActiveGroup.is_required ? "Məcburi" : "İstəyə bağlı"}
                                    </span>
                                    <span className="group-badge type-badge">
                                        {normActiveGroup.selection_type === 'single' ? "Tək seçim" : "Çoxlu seçim"}
                                    </span>
                                    {normActiveGroup.max_selection > 0 && (
                                        <span className="group-badge type-badge">
                                            Limit: {normActiveGroup.max_selection}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="modifier-items-v2-grid">
                        {activeGroup?.items?.map(item => {
                            const qty = (selections[activeGroupId] || {})[item.id] || 0;
                            const isSelected = qty > 0;
                            const isActive = item.id === activeItemId;
                            const price = parseFloat(item.price || 0);

                            return (
                                <div
                                    key={item.id}
                                    className={`modifier-item-v2-card ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
                                    onClick={() => handleItemClick(item)}
                                >
                                    {isSelected && (
                                        <>
                                            <div className="item-qty-badge-v2">x{qty}</div>
                                            <button 
                                                className="item-remove-v2-btn"
                                                onClick={(e) => handleItemRemove(e, item)}
                                            >
                                                <i className="bi bi-dash"></i>
                                            </button>
                                        </>
                                    )}
                                    <div className="item-v2-name">{item.name}</div>
                                    {price > 0 && (
                                        <div className="item-v2-price">+{price.toFixed(2)} ₼</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="modifier-v2-total-bar">
                        Cəm: {calculateTotal()} ₼
                    </div>
                </div>

                {/* Right Keypad/Calculator Area */}
                <div className="modifier-v2-keypad-area">
                    <div className="stepper-box-v2">
                        <button 
                            className="stepper-btn-v2 btn-minus"
                            onClick={() => handleStepperChange(-1)}
                            disabled={!activeItemId}
                        >
                            <i className="bi bi-dash"></i>
                        </button>
                        <input
                            type="text"
                            className="qty-v2-input"
                            value={qtyStr}
                            readOnly
                        />
                        <button 
                            className="stepper-btn-v2 btn-plus"
                            onClick={() => handleStepperChange(1)}
                            disabled={!activeItemId}
                        >
                            <i className="bi bi-plus-lg"></i>
                        </button>
                    </div>

                    <div className="numpad-v2-grid">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, ".", 0].map(num => (
                            <button
                                key={num}
                                className="num-v2-key"
                                onClick={() => handleKeypadPress(num)}
                                disabled={!activeItemId}
                            >
                                {num}
                            </button>
                        ))}
                        <button
                            className="num-v2-key btn-backspace"
                            onClick={() => handleKeypadPress("backspace")}
                            disabled={!activeItemId}
                        >
                            <i className="bi bi-backspace"></i>
                        </button>
                    </div>

                    <button 
                        className="save-action-v2-btn"
                        onClick={handleConfirm}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="me-2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Saxla
                    </button>
                </div>
            </div>

        </Modal>
    );
};

export default ModifierModal;
