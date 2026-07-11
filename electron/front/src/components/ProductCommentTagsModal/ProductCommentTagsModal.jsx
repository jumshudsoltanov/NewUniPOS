import React, { useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import "./ProductCommentTagsModal.css";
import { useDispatch, useSelector } from "react-redux";
import { getTagsList } from "../../redux/Slices/TagsSlice";
import { t } from "../../utils/translations";

const ProductCommentTagsModal = ({ show, onClose, item, portionIndex = 0, initialComment = "", onSave }) => {
    const [selectedTags, setSelectedTags] = useState([]);
    const [manualComment, setManualComment] = useState("");
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
    }, [loginedProfileData, dispatch]);

    const tags = tagsListData?.filter((t) => Number(t.type) === 2) ?? [];

    useEffect(() => {
        if (!show) {
            setSelectedTags([]);
            setManualComment("");
        } else {
            if (initialComment) {
                const parts = initialComment.split(",").map(s => s.trim());
                const foundTags = [];
                const remaining = [];
                parts.forEach(part => {
                    const matchedTag = tags.find(t => t.name.trim().toLowerCase() === part.toLowerCase());
                    if (matchedTag) {
                        foundTags.push(matchedTag.id);
                    } else if (part) {
                        remaining.push(part);
                    }
                });
                setSelectedTags(foundTags);
                setManualComment(remaining.join(", "));
            } else {
                setSelectedTags([]);
                setManualComment("");
            }
        }
    }, [show, initialComment, item, tagsListData]);

    const toggleTag = (tagId) => {
        setSelectedTags(prev =>
            prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
        );
    };

    const handleSave = () => {
        const tagNames = selectedTags
            .map((id) => {
                const tagObj = tags.find((t) => t.id === id);
                return tagObj?.name || tagObj?.text || "";
            })
            .filter(Boolean);
            
        let finalArr = [...tagNames];
        if (manualComment.trim()) {
            finalArr.push(manualComment.trim());
        }
        
        const tagNameStr = finalArr.join(", ");
        onSave?.(item, tagNameStr, portionIndex);
        onClose?.();
    };

    return (
        <Modal
            show={show}
            onHide={() => onClose?.()}
            centered
            className="product-comment-tags-modal"
            backdrop="static"
            animation={false}
        >
            <div className="modal-content-wrapper">
                <div className="product-comment-tags-modal-header">
                    <div className="product-comment-tags-header-content">
                        <div className="product-comment-tags-icon-circle">
                            <i className="bi bi-tag-fill"></i>
                        </div>
                        <div className="product-comment-tags-modal-title">{t("serh_sec")}</div>
                    </div>
                    <button className="btn-close-custom" onClick={() => onClose?.()}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div className="product-comment-tags-modal-body">
                    {item && (
                        <div className="product-comment-tags-item-preview">
                            <span className="preview-name">{item.name}</span>
                            <span className="preview-portion">
                                (Pors: {item.portion || item.count || 1}
                                {portionIndex > 0 ? ` — Porsiya ${portionIndex + 1}` : ""})
                            </span>
                        </div>
                    )}
                    <div className="product-comment-tags-list">
                        {tags.map((tag) => (
                            <div
                                key={tag.id}
                                className={`product-comment-tag-item ${selectedTags.includes(tag.id) ? "selected" : ""}`}
                                onClick={() => toggleTag(tag.id)}
                            >
                                <span className="tag-text">{tag.name || tag.text}</span>
                                <div className="tag-check-container">
                                    <i className="bi bi-check-lg"></i>
                                </div>
                            </div>
                        ))}
                    </div>
                    {tags.length === 0 && (
                        <div className="product-comment-tags-empty">
                            <span>{t("serh_taglari_tapilmadi")}</span>
                        </div>
                    )}
                    
                    <div className="product-comment-manual-input mt-3 px-3 pb-3">
                        <textarea
                            className="form-control"
                            rows="2"
                            placeholder={t("serh_yaz") || "Şərh yazın..."}
                            value={manualComment}
                            onChange={(e) => setManualComment(e.target.value)}
                            style={{ resize: "none", fontSize: "1.05rem", borderRadius: "10px", padding: "12px", border: "2px solid #ebf2fe" }}
                        />
                    </div>
                </div>

                <div className="product-comment-tags-modal-footer">
                    <button
                        className="product-comment-tags-save-btn"
                        onClick={handleSave}
                    >
                        <i className="bi bi-check2 me-2" style={{ fontSize: "1.5rem" }}></i>{t("save")}</button>
                </div>
            </div>
        </Modal>
    );
};

export default ProductCommentTagsModal;
