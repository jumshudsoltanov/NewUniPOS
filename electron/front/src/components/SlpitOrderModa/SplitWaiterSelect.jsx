import React, { useState, useEffect } from "react";
import { Modal } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { getWaitersList } from "../../redux/Slices/WaitersSlice";
import "../Waiters/Waiters.css"; // Reuse existing styles

const SplitWaiterSelect = ({ show, onClose, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);
    const { waitersLists } = useSelector((state) => state.WaitersSlice);
    const [selectedId, setSelectedId] = useState(null);
    const dispatch = useDispatch();

    useEffect(() => {
        if (!show) return;
        if (!waitersLists?.data?.length && loginedProfileData?.data?.profile?.id) {
            dispatch(getWaitersList(loginedProfileData.data.profile.id));
        }
    }, [show, waitersLists, loginedProfileData, dispatch]);

    const filteredWaiters = Array.isArray(waitersLists?.data)
        ? waitersLists.data.filter((waiter) =>
            waiter?.name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : [];

    // Auto-select helper for UX
    const handleSelect = (waiter) => {
        setSelectedId(waiter.id);
        // We can either auto-close on selection OR use a "Tətbiq et" button.
        // User image shows Apply button, but for a simple split modal, quick selection is usually better.
        // However, I will stick to the 'Apply' pattern to match the image precisely.
    };

    const handleApply = () => {
        if (selectedId) {
            const waiter = filteredWaiters.find(w => w.id === selectedId);
            if (waiter) onSelect(waiter);
        }
    };

    return (
        <Modal
            show={show}
            onHide={onClose}
            animation={false}
            dialogClassName="waiters-modal-dialog"
            contentClassName="waiters-modal-content"
        >
            <div className="waiters-modal-container">
                {/* Header */}
                <div className="waiters-header">
                    <div className="header-left">
                        <div className="header-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                        </div>
                        <span className="header-title">Əməkdaş seç</span>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="waiters-body">
                    {/* Search Input */}
                    <div className="search-container">
                        <input
                            type="text"
                            className="waiters-search-input"
                            placeholder="Əməkdaş axtar"
                            value={searchTerm || ""}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Waiters List */}
                    <div className="waiters-list">
                        {filteredWaiters.map((waiter) => (
                            <div key={waiter.id} className="waiter-card">
                                <div className="waiter-avatar">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="12" cy="7" r="4"></circle>
                                    </svg>
                                </div>
                                <div className="waiter-info">
                                    <span className="waiter-name">{waiter.name}</span>
                                </div>
                                <div className="waiter-actions">
                                    <button
                                        onClick={() => handleSelect(waiter)}
                                        className={`select-btn ${selectedId === waiter.id ? "selected" : ""}`}
                                    >
                                        {selectedId === waiter.id ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        ) : "Seç"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Apply Button */}
                    <button className="waiter-apply-btn" onClick={handleApply}>Tətbiq et</button>
                </div>
            </div>
        </Modal>
    );
};

export default SplitWaiterSelect;
