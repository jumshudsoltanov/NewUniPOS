import React, { useState } from "react";
import { Modal } from "react-bootstrap";
import "./NewItemsModal.css";

const NewItemsModal = ({ show, onClose, items, onDeleteItem, onSend, pendingDeletions }) => {
    const [comments, setComments] = useState({});
    const [openComments, setOpenComments] = useState({});

    // Group items by department/category
    const groupedItems = items.reduce((acc, item, index) => {
        const dept = item.department?.name || item.category?.name || "Digər";
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push({ ...item, originalIndex: index });
        return acc;
    }, {});

    const handleDelete = (index) => {
        if (onDeleteItem) {
            onDeleteItem(index);
        }
    };

    const handleCommentChange = (index, value) => {
        setComments(prev => ({ ...prev, [index]: value }));
    };

    const toggleComment = (index) => {
        setOpenComments(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const handleSendAndClose = () => {
        if (onSend) {
            onSend(comments);
        }
        onClose();
    };

    return (
        <Modal
            show={show}
            onHide={onClose}
            size="lg"
            centered
            className="new-items-modal"
            backdrop="static"
        >
            <div className="new-items-header">
                <span className="new-items-title">Çap oluna bilən şöbələr</span>
                <button className="new-items-close-btn" onClick={onClose}>
                    <i className="bi bi-x-lg"></i>
                </button>
            </div>

            <Modal.Body className="new-items-body">
                {Object.entries(groupedItems).map(([dept, deptItems]) => (
                    <div key={dept} className="new-items-dept-section">
                        <div className="new-items-dept-header">
                            <span className="dept-name">{dept}</span>
                            <span className="dept-action">Şərh yaz</span>
                        </div>

                        <div className="new-items-list">
                            {deptItems.map((item) => (
                                <div key={item.originalIndex} className="new-item-card">
                                    <div className="new-item-row">
                                        <div className="item-count-badge">
                                            {item.count || item.quantity || 1}
                                        </div>

                                        <div className="item-info">
                                            <span className="item-name">{item.name}</span>
                                            <span className="item-portion">(Pors: {item.portion || 1})</span>
                                        </div>

                                        <div className="item-actions">
                                            <button
                                                className={`item-action-btn edit-btn ${openComments[item.originalIndex] ? 'active' : ''}`}
                                                onClick={() => toggleComment(item.originalIndex)}
                                                title="Şərh yaz"
                                            >
                                                <i className="bi bi-pencil"></i>
                                            </button>
                                            <button
                                                className="item-action-btn delete-btn"
                                                onClick={() => handleDelete(item.originalIndex)}
                                            >
                                                <i className="bi bi-x-lg"></i>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Inline Comment Textarea - Toggle */}
                                    {openComments[item.originalIndex] && (
                                        <div className="item-comment-section">
                                            <textarea
                                                className="item-comment-input"
                                                value={comments[item.originalIndex] || item.comment || ""}
                                                onChange={(e) => handleCommentChange(item.originalIndex, e.target.value)}
                                                placeholder="Açıqlama"
                                                rows={3}
                                                autoFocus
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {(items.length === 0 && (!pendingDeletions || pendingDeletions.length === 0)) && (
                    <div className="new-items-empty">
                        <i className="bi bi-inbox"></i>
                        <p>Hazırda yeni məhsul yoxdur</p>
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
                                <span className="dept-name">Silinəcək məhsullar</span>
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
                    <span>Göndər</span>
                </button>
            </div>
        </Modal>
    );
};

export default NewItemsModal;
