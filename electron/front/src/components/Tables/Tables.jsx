import React, { useMemo } from "react";
import { Container, Row, Col, Alert } from "react-bootstrap";
import "./Tables.css";
import Table from "../Table/Table";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import CustomersModal from "../Customers-Modal/CustomersModal";
import OtherChecks from "../OtherChecks/OtherChecks";

const Tables = () => {
  const { tableGroups, currentHallId } = useSelector((state) => state.TablesSlice);
  const [selectedTable, setSelectedTable] = React.useState(null);
  const [showModal, setShowModal] = React.useState(false);
  const [showOtherChecks, setShowOtherChecks] = React.useState(false);
  const navigate = useNavigate();

  const currentTables = useMemo(() => {
    if (!tableGroups?.data || !currentHallId) {
      return tableGroups?.data?.[0]?.tables || []; //
    }
    const selectedHall = tableGroups.data.find((hall) => hall.id === currentHallId);
    return selectedHall?.tables || [];
  }, [tableGroups, currentHallId]);

  const handleTableClick = (table) => {
    const { orders } = table || {};

    if (orders?.length > 1) {
      setSelectedTable(table);
      setShowOtherChecks(true);
    } else if (orders?.length === 1) {
      // Birbasa check-e yonləndir
      navigate(`/check/${orders[0].uuid}?tableId=${table.id}`);
    } else {
      setSelectedTable(table);
      setShowModal(true);
    }
  };

  // Data yoxdursa boş massiv göstər - loading Pin səhifəsində olur
  // Tables-a gələndə data artıq yüklənmiş olmalıdır

  if (currentTables.length === 0) {
    return (
      <Container className="mt-4">
        <Alert variant="warning" className="text-center shadow-sm border-0">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Daxil etdiyiniz zalda aktiv masa tapılmadı. Zəhmət olmasa başqa zal
          seçin və ya admin panelindən masalar əlavə edin.
        </Alert>
      </Container>
    );
  }

  return (
    <>
      <Container fluid className="tables-scroll-container">
        <Row className="g-3">
          {currentTables.map((table) => (
            <Col
              xs={6}
              sm={4}
              md={3}
              lg={2}
              xl={2}
              xxl={2}
              key={table.id || table.name}
              className="mb-3 d-flex justify-content-center"
            >
              <Table table={table} onTableClick={handleTableClick} />
            </Col>
          ))}
        </Row>
      </Container>

      {/* Global Modals */}
      <CustomersModal
        show={showModal}
        onHide={() => setShowModal(false)}
        table={selectedTable}
      />

      <OtherChecks
        show={showOtherChecks}
        onClose={() => setShowOtherChecks(false)}
        table={selectedTable}
      />
    </>
  );
};

export default Tables;
