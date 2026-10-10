import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "react-bootstrap";
import { toast } from "sonner";
import { t } from "../../utils/translations";
import { formatPrice, getCurrencySymbol } from "../../utils/formatPrice";
import "./ModifierModal.css";

const ModifierModal = ({
    show,
    onHide,
    product,
    onConfirm,
    _onDelete,
    onOpenEditAction,
    permissions = {},
}) => {
    // state: { groupId: { modifierId: quantity } }
    const [selections, setSelections] = useState({});
    const [errors, setErrors] = useState([]);
    const [activeGroupId, setActiveGroupId] = useState(null);
    const [activeItemId, setActiveItemId] = useState(null);
    const [qtyStr, setQtyStr] = useState("0");

    const parseExistingModifiers = (modifiers) => {
        try {
            if (Array.isArray(modifiers)) return modifiers;
            if (typeof modifiers === "string") return JSON.parse(modifiers || "[]");
        } catch {
            return [];
        }
        return [];
    };

    // Helper to normalize group properties as they might vary from API/DB
    const normalizeGroup = (group) => {
        if (!group) return {};
        
        let rawItems = 
            group.items || 
            group.modifiers || 
            group.modifier_items || 
            group.products ||
            null;

        if (typeof rawItems === 'string') {
            try { rawItems = JSON.parse(rawItems); } catch { rawItems = null; }
        }

        if (!rawItems || (Array.isArray(rawItems) && rawItems.length === 0)) {
            for (const key of Object.keys(group)) {
                if (['id','name','group_name','title','selection_type','type','is_required','required','max_selection','max_count','max'].includes(key)) continue;
                const val = group[key];
                if (typeof val === 'string' && val.length > 2) {
                    try {
                        const parsed = JSON.parse(val);
                        if (Array.isArray(parsed) && parsed.length > 0) { rawItems = parsed; break; }
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) { rawItems = Object.values(parsed); break; }
                    } catch { /* not JSON */ }
                }
                if (Array.isArray(val) && val.length > 0) { rawItems = val; break; }
                if (val && typeof val === 'object' && !Array.isArray(val)) {
                    const vals = Object.values(val);
                    if (vals.length > 0 && typeof vals[0] === 'object') { rawItems = vals; break; }
                }
            }
        }

        if (!rawItems) rawItems = [];
        if (typeof rawItems === 'object' && !Array.isArray(rawItems)) {
            rawItems = Object.values(rawItems);
        }
        if (!Array.isArray(rawItems)) rawItems = [];

        return {
            ...group,
            name: group.name || group.group_name || group.title || "Modifikator",
            items: rawItems,
            selection_type: group.selection_type || group.type || 'multiple',
            is_required: group.is_required === 1 || group.required === 1 || group.required === true,
            max_selection: parseInt(group.max_selection || group.max_count || 0)
        };
    };

    const getModifierGroups = (prod) => {
        const groups = prod?.modifier_groups;
        let parsedGroups = [];
        
        if (Array.isArray(groups)) {
            parsedGroups = groups;
        } else if (typeof groups === 'string') {
            try { 
                let parsed = JSON.parse(groups);
                if (typeof parsed === 'string') {
                    try { parsed = JSON.parse(parsed); } catch { /* ignore */ }
                }
                if (Array.isArray(parsed)) {
                    parsedGroups = parsed;
                } else if (parsed && typeof parsed === 'object') {
                    parsedGroups = Object.values(parsed);
                } else if (typeof parsed === 'string' && parsed.length > 5 && parsed !== '[]') {
                    parsedGroups = [parsed];
                }
            } catch { 
                if (groups.length > 5 && groups !== '[]' && groups !== 'null') {
                    parsedGroups = [groups];
                } else {
                    parsedGroups = []; 
                }
            }
        } else if (groups && typeof groups === 'object') {
            parsedGroups = Object.values(groups);
        }

        if (Array.isArray(parsedGroups) && parsedGroups.length > 0) {
            // Ensure at least one group looks valid (has a name or items/modifiers)
            const isValid = parsedGroups.some(g => g && (
                g.name || g.group_name || g.title ||
                (g.items && g.items.length > 0) || 
                (g.modifiers && g.modifiers.length > 0) || 
                (g.modifier_items && g.modifier_items.length > 0) ||
                (g.products && g.products.length > 0) ||
                (typeof g === 'string' && g.length > 5) ||
                (typeof g === 'object' && Object.keys(g).some(k => typeof g[k] === 'object' || Array.isArray(g[k])))
            ));
            if (isValid) {
                return parsedGroups;
            }
        }

        let existingModifiers = [];
        try {
            if (Array.isArray(prod?.modifiers)) {
                existingModifiers = prod.modifiers;
            } else if (typeof prod?.modifiers === "string") {
                existingModifiers = JSON.parse(prod.modifiers || "[]");
            }
        } catch {
            existingModifiers = [];
        }
        if (!existingModifiers.length) return [];
        return [{
            id: "__existing_modifiers__",
            name: "Modifikatorlar",
            selection_type: "multiple",
            is_required: false,
            items: existingModifiers.map((modifier) => ({
                ...modifier,
                id: modifier.id,
                name: modifier.name,
                price: modifier.price || 0,
                quantity: modifier.count || modifier.quantity || 1,
                is_existing_modifier: true,
            })),
        }];
    };

    const modifierGroups = useMemo(() => getModifierGroups(product), [product]);

    const activeGroup = useMemo(() => {
        if (!activeGroupId) return null;
        return modifierGroups.find(g => g.id === activeGroupId);
    }, [modifierGroups, activeGroupId]);

    useEffect(() => {
        if (show) {
            // Set first group as active
            const safeGroups = Array.isArray(modifierGroups) ? modifierGroups : [];
            const firstGroup = safeGroups.length > 0 ? normalizeGroup(safeGroups[0]) : null;
            setActiveGroupId(firstGroup?.id || null);
            setActiveItemId(null);
            setQtyStr(String(product?.count || product?.quantity || 1));

            // Parse existing modifiers if any
            let existingModifiers = [];
            try {
                if (Array.isArray(product.modifiers)) {
                    existingModifiers = product.modifiers;
                } else if (typeof product.modifiers === "string") {
                    existingModifiers = JSON.parse(product.modifiers || '[]');
                }
            } catch { /* ignore */ }

            // Initialize default selections
            const initialSelections = {};
            modifierGroups.forEach(rawGroup => {
                const group = normalizeGroup(rawGroup);
                initialSelections[group.id] = {};
                if (group.items) {
                    group.items.forEach(item => {
                        if (product.isFromCheck) {
                            const existing = existingModifiers.find(m => String(m.id) === String(item.id));
                            if (existing && existing.count > 0) {
                                initialSelections[group.id][item.id] = parseInt(existing.count || existing.quantity || 1);
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
            } else {
                setActiveItemId(null);
            }
        }
    }, [activeGroupId, selections]);

    // Sync quantity updates back to selections state
    const _updateQuantity = (itemId, value) => {
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

        setActiveItemId(item.id);

        if (group.selection_type === "single") {
            // Single selection: clear others, but if clicking the same item, increment
            setSelections(prev => {
                const groupSel = prev[activeGroupId] || {};
                const actualQty = groupSel[item.id] || 0;
                if (actualQty >= 1) {
                    return {
                        ...prev,
                        [activeGroupId]: { [item.id]: actualQty + 1 }
                    };
                } else {
                    return {
                        ...prev,
                        [activeGroupId]: { [item.id]: 1 }
                    };
                }
            });
        } else {
            setSelections(prev => {
                const currentGroupSelections = prev[activeGroupId] || {};
                const actualQty = currentGroupSelections[item.id] || 0;
                const newQty = actualQty + 1;
                
                // Check max selection limit
                if (group.max_selection > 0) {
                    const totalSelected = Object.values(currentGroupSelections).reduce((a, b) => a + b, 0);
                    if (totalSelected + 1 > group.max_selection) {
                        toast.error(`Maksimum ${group.max_selection} seçim edə bilərsiniz.`);
                        return prev; // Return unchanged
                    }
                }
                
                return {
                    ...prev,
                    [activeGroupId]: {
                        ...currentGroupSelections,
                        [item.id]: newQty
                    }
                };
            });
        }
    };

    const handleItemRemove = (e, item) => {
        e.stopPropagation();
        
        setSelections(prev => {
            const groupSel = { ...(prev[activeGroupId] || {}) };
            const actualQty = groupSel[item.id] || 0;
            
            if (actualQty > 1) {
                groupSel[item.id] = actualQty - 1;
            } else {
                delete groupSel[item.id];
            }
            return { ...prev, [activeGroupId]: groupSel };
        });
        
        const currentQty = (selections[activeGroupId] || {})[item.id] || 0;
        if (activeItemId === item.id && currentQty <= 1) {
            setActiveItemId(null);
        }
    };

    const handleStepperChange = (delta) => {
        const currentVal = Number.isFinite(parseFloat(qtyStr)) ? parseFloat(qtyStr) : 0;
        const newVal = Math.max(0, currentVal + delta);
        setQtyStr(String(newVal));
    };

    const handleKeypadPress = (val) => {
        let next;
        if (val === "backspace") {
            next = qtyStr.slice(0, -1);
            if (next === "" || next === "-") next = "0";
        } else if (val === ".") {
            next = qtyStr.includes(".") ? qtyStr : qtyStr + ".";
        } else {
            next = qtyStr === "0" ? String(val) : qtyStr + val;
        }
        setQtyStr(next);
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
        const mainQty = Number.isFinite(parseFloat(qtyStr)) ? Math.max(0, parseFloat(qtyStr)) : 1;
        if (mainQty <= 0) {
            onConfirm({
                ...product,
                quantity: 0,
                modifiers: parseExistingModifiers(product.modifiers),
            });
            onHide();
            return;
        }

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
                quantity: mainQty,
                modifiers: formattedModifiers,
            });
            onHide();
        } else {
            toast.error(t("zehmet_olmasa_mecburi_secimleri_tamamlayin"));
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
        const mainQty = Number.isFinite(parseFloat(qtyStr)) ? Math.max(0, parseFloat(qtyStr)) : 1;
        return (total * mainQty).toFixed(2);
    };

    if (!product) return null;

    const normActiveGroup = normalizeGroup(activeGroup);
    const hasQuickActions = Boolean(permissions.canTransfer || permissions.canGift || permissions.canDiscount);

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
                        {(Array.isArray(modifierGroups) ? modifierGroups : []).map(rawGroup => {
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

                </div>

                {hasQuickActions && (
                    <div className="modifier-v2-side-actions">
                        {permissions.canTransfer && (
                            <button
                                className="modifier-v2-side-action-btn"
                                onClick={() => onOpenEditAction?.("transfer")}
                            >
                                <i className="bi bi-arrow-left-right"></i>
                                <span>{t("kocurme")}</span>
                            </button>
                        )}
                        {permissions.canGift && (
                            <button
                                className="modifier-v2-side-action-btn modifier-v2-side-action-btn--gift"
                                onClick={() => onOpenEditAction?.("gift")}
                            >
                                <i className="bi bi-gift-fill"></i>
                                <span>{t("i̇kram")}</span>
                            </button>
                        )}
                        {permissions.canDiscount && (
                            <button
                                className="modifier-v2-side-action-btn modifier-v2-side-action-btn--discount"
                                onClick={() => onOpenEditAction?.("discount")}
                            >
                                <i className="bi bi-percent"></i>
                                <span>Endirim</span>
                            </button>
                        )}
                    </div>
                )}

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
                                        <div className="item-v2-price">+{formatPrice(price)}</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="modifier-v2-total-bar">
                        Cəm: {calculateTotal()} {getCurrencySymbol()}
                    </div>
                </div>

                {/* Right Keypad/Calculator Area */}
                <div className="modifier-v2-keypad-area">
                    <div className="stepper-box-v2">
                        <button 
                            className="stepper-btn-v2 btn-minus"
                            onClick={() => handleStepperChange(-1)}
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
                            >
                                {num}
                            </button>
                        ))}
                        <button
                            className="num-v2-key btn-backspace"
                            onClick={() => handleKeypadPress("backspace")}
                        >
                            <i className="bi bi-backspace"></i>
                        </button>
                    </div>

                    <button 
                        className={`save-action-v2-btn ${(parseFloat(qtyStr) || 0) <= 0 ? "save-action-v2-btn--danger" : ""}`}
                        onClick={handleConfirm}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="me-2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        {(parseFloat(qtyStr) || 0) <= 0 ? "Sil" : t("saxla")}
                    </button>
                </div>
            </div>

        </Modal>
    );
};

export default ModifierModal;
