import React, { useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import "./CheckDeleteModal.css";
import { useDispatch, useSelector } from "react-redux"
import { getTagsList } from "../../redux/Slices/TagsSlice";
const CheckDeleteModal = ({ show, onClose, onConfirm, type, order, tagsType }) => {
    let headerName = type == "checks" ? "Çeki sil" : "Məhsulu sil"
    const [selectedReason, setSelectedReason] = useState(null);
    const [isWaste, setIsWaste] = useState(false);
    const [tagsListData, setTagsListData] = useState([])
    const dispatch = useDispatch()
    const { loginedProfileData } = useSelector((state) => state.LoginSlice)

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
            onConfirm({ reason: selectedReason, orderId: order.uuid });
            onClose(false);
        }
    };

    return (
        <Modal
            show={show}
            onHide={onClose}
            centered
            className="check-delete-modal"
            backdrop="static"
        >
            <div className="delete-modal-header">
                <span className="header-title">{headerName}</span>
                <button className="close-btn" onClick={onClose}>
                    <i className="bi bi-x-lg"></i>
                </button>
            </div>

            <Modal.Body className="delete-modal-body">
                <div className="reasons-list">
                    {reasons.map((reason, index) => (
                        <div
                            key={index}
                            className={`reason-item ${selectedReason === reason.id ? "selected" : ""}`}
                            onClick={() => setSelectedReason(reason.id)}
                        >
                            <span className="reason-text">{reason.name}</span>
                            {selectedReason === reason.id && (
                                <i className="bi bi-check-lg check-icon"></i>
                            )}
                        </div>
                    ))}
                </div>
            </Modal.Body>

            <div className="delete-modal-footer">
                {/* <div
                    className="waste-toggle"
                    onClick={() => setIsWaste(!isWaste)}
                >
                    <div className="waste-icon-wrapper">
                        <i className="bi bi-trash3-fill"></i>
                    </div>
                    <span className="waste-label">Tullantıya at</span>
                    <div className={`custom-checkbox ${isWaste ? "checked" : ""}`}>
                        {isWaste && <i className="bi bi-check-lg"></i>}
                    </div>
                </div> */}

                <button
                    className="save-btn w-100"
                    onClick={handleConfirm}
                    disabled={!selectedReason}
                >
                    <i className="bi bi-check-lg"></i>
                    Saxla
                </button>
            </div>
        </Modal>
    );
};

export default CheckDeleteModal;
