import React from "react";
import { Container, Row, Col, Alert } from "react-bootstrap";
import "./Tables.css";
import Table from "../Table/Table";
import { useDispatch, useSelector } from "react-redux";

const Tables = () => {
  const { tables } = useSelector((state) => state.TablesSlice);
  const currentTables = tables[0]?.tables || [];

  if (currentTables.length === 0) {
    return (
      <Container className="mt-4">
        <Alert variant="warning" className="text-center shadow-sm border-0">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Daxil etdiyiniz zalda aktiv masa tapılmadı. Zəhmət olmasa başqa zal seçin və ya admin panelindən masalar əlavə edin.
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="tables-scroll-container">
      <Row className="g-3">
        {currentTables.map((table, index) => (
          <Col
            xs={6}
            sm={4}
            md={3}
            lg={2}
            xl={2}
            xxl={2}
            key={index}
            className="mb-3 d-flex justify-content-center"
          >
            <Table table={table} />
          </Col>
        ))}
      </Row>
    </Container>
  );
};

export default Tables;
