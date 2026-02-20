import React, { useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import "./CheckDeleteModal.css";
import { useDispatch, useSelector } from "react-redux"
import { getTagsList } from "../../redux/Slices/TagsSlice";

const CheckDeleteModal = ({ show, onClose, onConfirm, type, order, tagsType, actionName }) => {
    let headerName = type === "checks" ? "Çeki sil" : "Məhsulu sil";
    const [selectedReason, setSelectedReason] = useState(null);
    const [tagsListData, setTagsListData] = useState([]);
    const dispatch = useDispatch();
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);

    useEffect(() => {
        const getTagsData = async () => {
            const profileId = loginedProfileData?.data?.profile?.id;
            if (!profileId) return;

            try {
                const res = await dispatch(getTagsList(profileId)).unwrap();
                setTagsListData(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error("tags fetch error:", err);
                setTagsListData([]);
            }
        };

        getTagsData();
    }, [show, order, loginedProfileData]);

    const reasons = tagsListData?.filter((item) => Number(item.type) === tagsType) ?? [];

    const handleConfirm = () => {
        if (selectedReason) {
            const reasonObj = reasons.find(r => r.id === selectedReason);
            onConfirm({
                reason: selectedReason,
                reasonName: reasonObj?.name,
                orderId: order.uuid
            });
            onClose(false);
        }
    };

    return (
        <Modal
            show={show}
            onHide={() => onClose(false)}
            centered
            className="check-delete-modal"
            backdrop="static"
            animation={false}
        >
            <div className="modal-content-wrapper">
                <div className="check-delete-modal-header">
                    <div className="check-delete-header-content">
                        <div className="check-delete-icon-circle">
                            <i className="bi bi-trash3-fill"></i>
                        </div>
                        <div className="check-delete-modal-title">{headerName}</div>
                    </div>
                    <button className="btn-close-custom" onClick={() => onClose(false)}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div className="check-delete-modal-body">
                    <div className="reasons-list">
                        {reasons.map((reason, index) => (
                            <div
                                key={index}
                                className={`reason-item ${selectedReason === reason.id ? "selected" : ""}`}
                                onClick={() => setSelectedReason(reason.id)}
                            >
                                <span className="reason-text">{reason.name}</span>
                                <div className="check-icon-container">
                                    <i className="bi bi-check-lg"></i>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        className="check-delete-save-btn"
                        disabled={!selectedReason}
                        onClick={handleConfirm}
                    >
                        <i className="bi bi-check2 me-2" style={{ fontSize: '1.5rem' }}></i>
                        {actionName || "Təsdiqlə"}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default CheckDeleteModal;
