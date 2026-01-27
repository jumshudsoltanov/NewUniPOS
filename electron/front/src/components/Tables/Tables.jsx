import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import "./Tables.css";
import Table from "../Table/Table";
import { useDispatch, useSelector } from "react-redux";

const Tables = () => {
  const { tables } = useSelector((state) => state.TablesSlice);

  return (
    <Container fluid className="tables-scroll-container">
      <Row className="g-3">
        {tables[0]?.tables.map((table, index) => (
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
