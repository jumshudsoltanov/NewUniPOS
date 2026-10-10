import React, { useState, useMemo } from "react";
import { Modal } from "react-bootstrap";
import "./NewItemsModal.css";
import ProductCommentTagsModal from "../ProductCommentTagsModal/ProductCommentTagsModal";
import VirtualKeyboard from "../VirtualKeyboard/VirtualKeyboard";
import { t } from "../../utils/translations";

const getMergeKey = (item) => {
    const prodId = item.product_id || item.id;
    const modStr = typeof item.modifiers === 'string' ? item.modifiers : JSON.stringify(item.modifiers || []);
    const price = parseFloat(item.price || 0).toFixed(2);
    const isGift = item.is_gift ? 1 : 0;
    return `${prodId}-${isGift}-${price}-${modStr}`;
};

const NewItemsModal = ({ show, onClose, items, onDeleteItem, onSend, pendingDeletions }) => {
    const [comments, setComments] = useState({});
    const [openComments, setOpenComments] = useState({});
    const [tagsModalItem, setTagsModalItem] = useState(null);
    const [tagsModalPortion, setTagsModalPortion] = useState(0);
    const [separatedItems, setSeparatedItems] = useState({});
    const [activeInput, setActiveInput] = useState(null); // { mergedIndex, portionIndex }
    const [modComments, setModComments] = useState({}); // { "mergedIndex-modId": "comment" }
    const [openModComments, setOpenModComments] = useState({}); // { "mergedIndex-modId": true }
    const [tagsModalMod, setTagsModalMod] = useState(null); // { item, modId, modName }
    const posKeyboardEnabled = useMemo(() => {
        try { return localStorage.getItem("pos_keyboard_enabled") === "1"; } catch { return false; }
    }, []);

    // Merge identical products, then group by department
    const mergedItems = items.reduce((acc, item, index) => {
        const key = getMergeKey(item);
        const qty = item.count || item.quantity || item.portion || 1;
        if (acc.map.has(key)) {
            const m = acc.map.get(key);
            m.count += Number(qty);
            m.originalIndices.push(index);
            return acc;
        }
        const merged = {
            ...item,
            count: Number(qty),
            quantity: Number(qty),
            portion: Number(qty),
            originalIndices: [index]
        };
        acc.map.set(key, merged);
        acc.list.push(merged);
        return acc;
    }, { map: new Map(), list: [] }).list;

    const groupedItems = mergedItems.reduce((acc, item, mergedIndex) => {
        const dept = item.department?.name || item.category?.name || "Digər";
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push({ ...item, mergedIndex });
        return acc;
    }, {});

    const handleDelete = (mergedItem) => {
        if (!onDeleteItem) return;
        const indices = Array.isArray(mergedItem.originalIndices) ? [...mergedItem.originalIndices] : [0];
        indices.sort((a, b) => b - a).forEach(i => onDeleteItem(i));
    };

    const handleCommentChange = (mergedIndex, value, portionIndex = 0) => {
        setComments(prev => {
            const next = { ...prev };
            const item = mergedItems[mergedIndex];
            const qty = item?.count || item?.quantity || item?.portion || 1;
            const isSep = separatedItems[mergedIndex];
            if (qty > 1 && isSep) {
                const groups = getGroups(prev[mergedIndex], qty);
                if (groups[portionIndex]) groups[portionIndex].comment = value;
                next[mergedIndex] = groups;
            } else {
                next[mergedIndex] = value;
            }
            return next;
        });
    };

    const toggleComment = (mergedIndex, portionIndex = 0) => {
        const key = portionIndex >= 0 ? `${mergedIndex}-${portionIndex}` : mergedIndex;
        setOpenComments(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const getGroups = (val, totalQty) => {
        if (Array.isArray(val) && val.length > 0) {
            if (val[0]?.qty !== undefined) return val;
            return val.map(c => ({ qty: 1, comment: c || "" }));
        }
        if (typeof val === 'string') return [{ qty: totalQty, comment: val }];
        return [{ qty: totalQty, comment: "" }];
    };

    const setGroupQty = (mergedIndex, groupIdx, delta) => {
        setComments(prev => {
            const item = mergedItems[mergedIndex];
            const total = item?.count || item?.quantity || item?.portion || 1;
            const groups = getGroups(prev[mergedIndex], total).map(g => ({ ...g, qty: g.qty || 1 }));
            const g = groups[groupIdx];
            if (!g) return prev;
            const newVal = g.qty + delta;
            if (delta > 0) {
                const donor = groups.find((x, i) => i !== groupIdx && (x.qty || 1) > 1);
                if (!donor || newVal > total) return prev;
                donor.qty--;
                g.qty++;
            } else {
                const receiver = groups.find((x, i) => i !== groupIdx);
                if (!receiver || newVal < 1) return prev;
                g.qty--;
                receiver.qty++;
            }
            return { ...prev, [mergedIndex]: [...groups] };
        });
    };

    const addGroup = (mergedIndex) => {
        setComments(prev => {
            const item = mergedItems[mergedIndex];
            const total = item?.count || item?.quantity || item?.portion || 1;
            const groups = getGroups(prev[mergedIndex], total);
            const sum = groups.reduce((s, g) => s + (g.qty || 1), 0);
            if (sum <= 1 || groups.length >= total) return prev;
            const first = groups.find(g => (g.qty || 1) > 1);
            if (first) {
                first.qty = (first.qty || 1) - 1;
                groups.push({ qty: 1, comment: "" });
            }
            return { ...prev, [mergedIndex]: [...groups] };
        });
    };

    const removeGroup = (mergedIndex, groupIdx) => {
        setComments(prev => {
            const item = mergedItems[mergedIndex];
            const total = item?.count || item?.quantity || item?.portion || 1;
            const groups = getGroups(prev[mergedIndex], total);
            if (groups.length <= 1) return prev;
            const removed = groups.splice(groupIdx, 1)[0];
            const first = groups[0];
            if (first) first.qty = (first.qty || 1) + (removed.qty || 1);
            return { ...prev, [mergedIndex]: [...groups] };
        });
        setOpenComments(prev => {
            const next = { ...prev };
            delete next[`${mergedIndex}-${groupIdx}`];
            return next;
        });
    };

    const _getCommentForPortion = (item, portionIndex) => {
        const val = comments[item.mergedIndex];
        const groups = getGroups(val, item.count || item.quantity || item.portion || 1);
        return groups[portionIndex]?.comment ?? "";
    };

    const getCommentForItem = (item) => {
        const val = comments[item.mergedIndex];
        const groups = getGroups(val, item.count || item.quantity || item.portion || 1);
        return groups[0]?.comment ?? (typeof val === 'string' ? val : item.comment ?? "");
    };

    const toggleSeparated = (mergedIndex) => {
        setSeparatedItems(prev => ({ ...prev, [mergedIndex]: !prev[mergedIndex] }));
        setOpenComments(prev => {
            const next = { ...prev };
            const item = mergedItems[mergedIndex];
            const qty = item?.count || item?.quantity || item?.portion || 1;
            if (qty > 1) {
                for (let p = 0; p < qty; p++) delete next[`${mergedIndex}-${p}`];
                delete next[mergedIndex];
            }
            return next;
        });
        setComments(prev => {
            const item = mergedItems[mergedIndex];
            const qty = item?.count || item?.quantity || item?.portion || 1;
            if (prev[mergedIndex]?.qty !== undefined || (Array.isArray(prev[mergedIndex]) && prev[mergedIndex][0]?.qty !== undefined)) return prev;
            const arr = Array.isArray(prev[mergedIndex]) ? prev[mergedIndex] : [];
            if (arr.length > 0 && typeof arr[0] === 'string') {
                return { ...prev, [mergedIndex]: arr.map((c, _i) => ({ qty: 1, comment: c })) };
            }
            return { ...prev, [mergedIndex]: [{ qty: qty, comment: "" }] };
        });
    };

    const handleCommentTagSave = (item, tagName, portionIndex = 0) => {
        if (item?.mergedIndex === undefined) return;
        const qty = item.count || item.quantity || item.portion || 1;
        const isSep = separatedItems[item.mergedIndex];
        setComments(prev => {
            const next = { ...prev };
            const groups = getGroups(prev[item.mergedIndex], qty);
            if (qty > 1 && isSep && groups[portionIndex]) {
                groups[portionIndex].comment = tagName;
                next[item.mergedIndex] = groups;
            } else {
                next[item.mergedIndex] = tagName;
            }
            return next;
        });
        setTagsModalItem(null);
    };

    const groupsToCommentsArray = (groups, _total) => {
        if (!Array.isArray(groups) || groups.length === 0) return [];
        if (groups[0]?.qty !== undefined) {
            return groups.flatMap(g => Array(g.qty || 1).fill(g.comment || ""));
        }
        return groups;
    };

    const buildCommentsForSend = () => {
        const fullComments = {};
        mergedItems.forEach((item, mergedIndex) => {
            const val = comments[mergedIndex];
            const origIndices = item.originalIndices || [];
            const total = item.count || item.quantity || item.portion || 1;
            const isSep = separatedItems[mergedIndex];
            let arr = [];
            if (isSep && Array.isArray(val) && val.length > 0 && val[0]?.qty !== undefined) {
                arr = groupsToCommentsArray(val, total);
            } else if (Array.isArray(val) && val.length > 0) {
                arr = val;
            }
            if (arr.length > 0) {
                if (origIndices.length === 1 && arr.length > 1) {
                    fullComments[origIndices[0]] = arr;
                } else {
                    origIndices.forEach((origIdx, i) => {
                        fullComments[origIdx] = arr[i] ?? arr[0] ?? "";
                    });
                }
            } else {
                const single = Array.isArray(val) ? (val[0]?.comment ?? val[0] ?? "") : (val ?? "");
                origIndices.forEach(origIdx => { fullComments[origIdx] = single; });
            }
        });
        return fullComments;
    };

    const handleSendAndClose = () => {
        if (onSend) {
            // Build modifier comments map: { origIndex: { modId: comment } }
            const modCommentsMap = {};
            Object.entries(modComments).forEach(([key, comment]) => {
                if (!comment) return;
                // key format: "mergedIndex-mod-modId"
                const parts = key.split('-mod-');
                if (parts.length !== 2) return;
                const mergedIndex = parseInt(parts[0]);
                const modId = parts[1];
                const item = mergedItems[mergedIndex];
                if (!item) return;
                const origIndices = item.originalIndices || [];
                origIndices.forEach(origIdx => {
                    if (!modCommentsMap[origIdx]) modCommentsMap[origIdx] = {};
                    modCommentsMap[origIdx][modId] = comment;
                });
            });
            onSend(buildCommentsForSend(), modCommentsMap);
        }
        setComments({});
        setOpenComments({});
        setSeparatedItems({});
        setTagsModalItem(null);
        setModComments({});
        setOpenModComments({});
        setTagsModalMod(null);
        onClose();
    };

    const handleModTagSave = (tagName) => {
        if (!tagsModalMod) return;
        setModComments(prev => ({ ...prev, [tagsModalMod.modKey]: tagName }));
        setTagsModalMod(null);
    };

    return (
        <>
        <Modal
            show={show}
            onHide={onClose}
            size="lg"
            centered
            className="new-items-modal"
            backdrop="static"
        >
            <div className="new-items-header">
                <span className="new-items-title">{t("cap_oluna_bilen_sobeler")}</span>
                <button className="new-items-close-btn" onClick={onClose}>
                    <i className="bi bi-x-lg"></i>
                </button>
            </div>

            <Modal.Body className="new-items-body">
                {Object.entries(groupedItems).map(([dept, deptItems]) => (
                    <div key={dept} className="new-items-dept-section">
                        <div className="new-items-dept-header">
                            <span className="dept-name">{dept}</span>
                            <span className="dept-action">{t("serh_yaz")}</span>
                        </div>

                        <div className="new-items-list">
                            {deptItems.map((item) => {
                                const qty = item.count || item.quantity || item.portion || 1;
                                const portions = Math.max(1, Number(qty));
                                const isSeparated = separatedItems[item.mergedIndex];
                                const showPortionRows = portions > 1 && isSeparated;
                                return (
                                <div key={item.mergedIndex} className="new-item-card">
                                    <div className="new-item-row">
                                        <div className="item-count-badge">
                                            {qty}
                                        </div>

                                        <div className="item-info">
                                            <span className="item-name">{item.name}</span>
                                            <span className="item-portion">(Pors: {item.portion || 1})</span>
                                        </div>

                                        <div className="item-actions">
                                            {portions > 1 && (
                                                <button
                                                    className={`item-action-btn split-btn ${isSeparated ? 'active' : ''}`}
                                                    onClick={() => toggleSeparated(item.mergedIndex)}
                                                    title={isSeparated ? "Birləşdir" : "Ayır"}
                                                >
                                                    <i className="bi bi-columns-gap"></i>
                                                </button>
                                            )}
                                            {!showPortionRows ? (
                                                <>
                                                    <button
                                                        className="item-action-btn tag-btn"
                                                        onClick={() => { setTagsModalItem(item); setTagsModalPortion(0); }}
                                                        title={t("serh_sec")}
                                                    >
                                                        <i className="bi bi-tag-fill"></i>
                                                    </button>
                                                    <button
                                                        className={`item-action-btn edit-btn ${openComments[item.mergedIndex] ? 'active' : ''}`}
                                                        onClick={() => toggleComment(item.mergedIndex, -1)}
                                                        title={t("serh_yaz")}
                                                    >
                                                        <i className="bi bi-pencil"></i>
                                                    </button>
                                                </>
                                            ) : null}
                                            <button
                                                className="item-action-btn delete-btn"
                                                onClick={() => handleDelete(item)}
                                            >
                                                <i className="bi bi-x-lg"></i>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Modifier sub-items */}
                                    {(() => {
                                        let mods = item.modifiers || [];
                                        if (typeof mods === 'string') {
                                            try { mods = JSON.parse(mods || '[]'); } catch { mods = []; }
                                        }
                                        if (!Array.isArray(mods) || mods.length === 0) return null;
                                        return (
                                            <div className="modifier-sub-items">
                                                {mods.map((mod, modIdx) => {
                                                    const modKey = `${item.mergedIndex}-mod-${mod.id || modIdx}`;
                                                    const modComment = modComments[modKey] || "";
                                                    const _isModEditing = openModComments[modKey];
                                                    const hasModComment = modComment !== "";
                                                    return (
                                                        <div key={modKey} className="modifier-sub-row">
                                                            <div className="modifier-sub-info">
                                                                <span className="modifier-sub-dot"></span>
                                                                <span className="modifier-sub-name">{mod.name}</span>
                                                                <span className="modifier-sub-qty">x{mod.count || 1}</span>
                                                                <div className="modifier-sub-actions">
                                                                    <button
                                                                        className="item-action-btn tag-btn mod-action-btn"
                                                                        onClick={() => setTagsModalMod({ item, modId: mod.id || modIdx, modName: mod.name, modKey })}
                                                                        title={t("serh_sec") || "Şərh"}
                                                                    >
                                                                        <i className="bi bi-chat-dots-fill"></i>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {hasModComment && (
                                                                <div
                                                                    className="item-comment-display mod-comment-display"
                                                                    onClick={() => setTagsModalMod({ item, modId: mod.id || modIdx, modName: mod.name, modKey })}
                                                                >
                                                                    {modComment}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}

                                    {/* Single comment row (not separated or qty=1) */}
                                    {!showPortionRows && (() => {
                                        const editKey = item.mergedIndex;
                                        const isEditing = openComments[editKey];
                                        const commentVal = getCommentForItem(item);
                                        const hasComment = commentVal !== "" && commentVal != null;
                                        if (!hasComment && !isEditing) return null;
                                        return (
                                            <div key="single" className="item-comment-row">
                                                <div className="item-comment-inner">
                                                    {isEditing ? (
                                                        <input
                                                            className="item-comment-input"
                                                            type="text"
                                                            autoFocus
                                                            placeholder={t("serh_yaz") || "Şərh yazın..."}
                                                            value={commentVal || ""}
                                                            onChange={(e) => handleCommentChange(item.mergedIndex, e.target.value, 0)}
                                                            onFocus={() => setActiveInput({ mergedIndex: item.mergedIndex, portionIndex: 0 })}
                                                            onBlur={() => {
                                                                if (!posKeyboardEnabled) toggleComment(item.mergedIndex, -1);
                                                            }}
                                                        />
                                                    ) : hasComment ? (
                                                        <div
                                                            className="item-comment-display"
                                                            onClick={() => toggleComment(item.mergedIndex, -1)}
                                                        >
                                                            {commentVal}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Counter groups - only when separated */}
                                    {showPortionRows && (() => {
                                        const groups = getGroups(comments[item.mergedIndex], portions);
                                        const sum = groups.reduce((s, g) => s + (g.qty || 1), 0);
                                        const canAdd = sum > 1 && groups.length < portions;
                                        return (
                                            <div className="portion-groups">
                                                {groups.map((g, gIdx) => {
                                                    const editKey = `${item.mergedIndex}-${gIdx}`;
                                                    const _isEditing = openComments[editKey];
                                                    const dispVal = g.comment ?? "";
                                                    const hasComment = dispVal !== "" && dispVal != null;
                                                    return (
                                                        <div key={gIdx} className="item-comment-row portion-row portion-group">
                                                            <div className="portion-group-header">
                                                                <div className="portion-counter">
                                                                    <button type="button" className="counter-btn" onClick={() => setGroupQty(item.mergedIndex, gIdx, -1)} disabled={g.qty <= 1}>−</button>
                                                                    <span className="counter-val">{g.qty}</span>
                                                                    <button type="button" className="counter-btn" onClick={() => setGroupQty(item.mergedIndex, gIdx, 1)} disabled={(g.qty || 1) >= portions - (groups.length - 1)}>+</button>
                                                                </div>
                                                                <div className="portion-actions">
                                                                    <button className="item-action-btn tag-btn" onClick={() => { setTagsModalItem(item); setTagsModalPortion(gIdx); }} title={t("serh_sec") || "Şərh"}><i className="bi bi-chat-dots-fill"></i></button>
                                                                    {groups.length > 1 && <button className="item-action-btn delete-btn" onClick={() => removeGroup(item.mergedIndex, gIdx)} title="Sil"><i className="bi bi-x-lg"></i></button>}
                                                                </div>
                                                            </div>
                                                            {hasComment ? (
                                                                <div className="item-comment-display" onClick={() => { setTagsModalItem(item); setTagsModalPortion(gIdx); }}>{dispVal}</div>
                                                            ) : null}
                                                        </div>
                                                    );
                                                })}
                                                {canAdd && (
                                                    <button type="button" className="add-group-btn" onClick={() => addGroup(item.mergedIndex)}>
                                                        <i className="bi bi-plus-lg"></i>{t("bol")}</button>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {(items.length === 0 && (!pendingDeletions || pendingDeletions.length === 0)) && (
                    <div className="new-items-empty">
                        <i className="bi bi-inbox"></i>
                        <p>{t("hazirda_yeni_mehsul_yoxdur")}</p>
                    </div>
                )}

                {/* Pending Deletions Section */}
                {pendingDeletions && pendingDeletions.length > 0 && (() => {
                    // Group by itemId, sum quantities
                    const grouped = pendingDeletions.reduce((acc, item) => {
                        const key = String(item.product_id || item.itemId || item.name);
                        if (!acc[key]) {
                            acc[key] = { ...item, totalQty: 0 };
                        }
                        acc[key].totalQty += item.type === 'partial' ? (item.qty || 1) : (item.originalQty || 1);
                        return acc;
                    }, {});
                    const groupedList = Object.values(grouped);
                    return (
                        <div className="new-items-dept-section mt-4">
                            <div className="new-items-dept-header">
                                <span className="dept-name">{t("silinecek_mehsullar")}</span>
                            </div>
                            <div className="new-items-list">
                                {groupedList.map((item, idx) => (
                                    <div key={`del-${idx}`} className="new-item-card">
                                        <div className="new-item-row">
                                            <div className="item-count-badge">
                                                {item.totalQty}
                                            </div>
                                            <div className="item-info">
                                                <span className="item-name text-decoration-line-through">{item.name}</span>
                                                <span className="item-portion text-danger small">
                                                    {item.type === 'partial' ? '(Qismən silinir)' : '(Tam silinir)'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}
            </Modal.Body>

            <div className="new-items-footer">
                <button className="send-all-btn" onClick={handleSendAndClose}>
                    <i className="bi bi-send"></i>
                    <span>{t("send")}</span>
                </button>
            </div>
        </Modal>

        {posKeyboardEnabled && activeInput && (
            <VirtualKeyboard
                onKeyPress={(key) => handleCommentChange(activeInput.mergedIndex, ((() => {
                    const item = mergedItems[activeInput.mergedIndex];
                    const qty = item?.count || item?.quantity || item?.portion || 1;
                    const isSep = separatedItems[activeInput.mergedIndex];
                    if (qty > 1 && isSep) {
                        const groups = Array.isArray(comments[activeInput.mergedIndex]) ? comments[activeInput.mergedIndex] : [{ qty, comment: "" }];
                        return (groups[activeInput.portionIndex]?.comment ?? "") + key;
                    }
                    const val = comments[activeInput.mergedIndex];
                    return (typeof val === 'string' ? val : (Array.isArray(val) && val[0]?.comment) || "") + key;
                })()), activeInput.portionIndex)}
                onBackspace={() => handleCommentChange(activeInput.mergedIndex, ((() => {
                    const item = mergedItems[activeInput.mergedIndex];
                    const qty = item?.count || item?.quantity || item?.portion || 1;
                    const isSep = separatedItems[activeInput.mergedIndex];
                    if (qty > 1 && isSep) {
                        const groups = Array.isArray(comments[activeInput.mergedIndex]) ? comments[activeInput.mergedIndex] : [{ qty, comment: "" }];
                        return (groups[activeInput.portionIndex]?.comment ?? "").slice(0, -1);
                    }
                    const val = comments[activeInput.mergedIndex];
                    return (typeof val === 'string' ? val : (Array.isArray(val) && val[0]?.comment) || "").slice(0, -1);
                })()), activeInput.portionIndex)}
                onClose={() => {
                    if (activeInput) {
                        toggleComment(activeInput.mergedIndex, -1);
                    }
                    setActiveInput(null);
                }}
            />
        )}

        <ProductCommentTagsModal
            show={!!tagsModalItem}
            onClose={() => setTagsModalItem(null)}
            item={tagsModalItem}
            portionIndex={tagsModalPortion}
            initialComment={(() => {
                if (!tagsModalItem) return "";
                const qty = tagsModalItem.count || tagsModalItem.quantity || tagsModalItem.portion || 1;
                const isSep = separatedItems[tagsModalItem.mergedIndex];
                if (qty > 1 && isSep) {
                    const groups = Array.isArray(comments[tagsModalItem.mergedIndex]) ? comments[tagsModalItem.mergedIndex] : [{ qty, comment: "" }];
                    return groups[tagsModalPortion]?.comment || "";
                }
                const val = comments[tagsModalItem.mergedIndex];
                return (typeof val === 'string' ? val : (Array.isArray(val) && val[0]?.comment) || "");
            })()}
            onSave={handleCommentTagSave}
        />
        <ProductCommentTagsModal
            show={!!tagsModalMod}
            onClose={() => setTagsModalMod(null)}
            item={tagsModalMod?.item}
            portionIndex={0}
            initialComment={tagsModalMod ? (modComments[tagsModalMod.modKey] || "") : ""}
            onSave={(item, tagName) => handleModTagSave(tagName)}
        />
        </>
    );
};

export default NewItemsModal;
