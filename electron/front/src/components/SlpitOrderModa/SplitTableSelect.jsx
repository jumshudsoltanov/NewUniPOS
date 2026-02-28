import React, { useState, useEffect } from "react";
import { Modal, Col, Row, Container, Alert } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { getTableGroups } from "../../redux/Slices/TablesSlice";

// Reusing TableGroupsModal styles or defining simple internal styles for now
const SplitTableSelect = ({ show, onClose, onSelect }) => {
    const { tableGroups } = useSelector((state) => state.TablesSlice);
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);
    const [activeTab, setActiveTab] = useState(null);
    const dispatch = useDispatch();

    useEffect(() => {
        if (!show) return;

        if (!tableGroups?.data?.length && loginedProfileData?.data?.profile?.id) {
            dispatch(getTableGroups(loginedProfileData.data.profile.id));
        }

        if (tableGroups?.data?.length > 0 && !activeTab) {
            setActiveTab(tableGroups.data[0].id);
        }
    }, [show, tableGroups, activeTab, loginedProfileData, dispatch]);

    const activeGroup = tableGroups?.data?.find((group) => group.id === activeTab);

    if (!show) return null;

    return (
        <Modal
            show={show}
            onHide={() => onClose()}
            centered
            dialogClassName="split-table-select-modal"
        >
            <Modal.Header style={{ background: "#053796", border: "none" }} closeButton className="text-white">
                <div className="d-flex align-items-center w-100 overflow-auto no-scrollbar" style={{ gap: '10px' }}>
                    {tableGroups?.data?.map((group) => (
                        <div
                            key={group.id}
                            className={`modal-tab ${activeTab === group.id ? "active" : ""}`}
                            onClick={() => setActiveTab(group.id)}
                        >
                            {group.name}
                        </div>
                    ))}
                </div>
            </Modal.Header>
            <Modal.Body className="p-3" style={{ backgroundColor: "#f8f9fa" }}>
                <Container fluid>
                    <div className="tables-grid-container">
                        <Row className="g-3">
                            {activeGroup?.tables?.map((table) => (
                                <Col key={table.id} xs={4} md={3} className="mb-2">
                                    <div
                                        className="table-card"
                                        onClick={() => onSelect({ ...table, hall_id: activeGroup.id, hall_name: activeGroup.name })}
                                        style={{
                                            background: 'white',
                                            borderRadius: '12px',
                                            padding: '12px', // Reduced from 24px
                                            textAlign: 'center',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            color: '#333',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '15px' // Reduced from 18px
                                        }}
                                    >
                                        {table.number || table.name}
                                    </div>
                                </Col>
                            ))}
                            {(!activeGroup?.tables || activeGroup.tables.length === 0) && (
                                <Col xs={12}>
                                    <Alert variant="warning" className="text-center mt-4">
                                        Bu zalda masa yoxdur.
                                    </Alert>
                                </Col>
                            )}
                        </Row>
                    </div>
                </Container>
            </Modal.Body>
        </Modal>
    );
};

export default SplitTableSelect;
