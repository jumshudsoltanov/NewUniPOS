import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import "./Tables.css";
import Table from "../Table/Table";

const Tables = () => {
  // Mock data reflecting the image structure
  const tables = [
    {
      id: 1,
      name: "Masa 1",
      type: "round",
      status: "occupied",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 2,
      name: "Masa 2",
      type: "round",
      status: "pending",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 3,
      name: "Masa 3",
      type: "round",
      status: "free",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 4,
      name: "Masa 4",
      type: "round",
      status: "pending",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 5,
      name: "Masa 5",
      type: "round",
      status: "occupied",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 6,
      name: "Masa 6",
      type: "round",
      status: "free",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 6,
    },
    {
      id: 7,
      name: "Masa 7",
      type: "round",
      status: "pending",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 8,
      name: "Masa 8",
      type: "round",
      status: "occupied",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 9,
      name: "Masa 9",
      type: "round",
      status: "free",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 10,
      name: "Masa 10",
      type: "round",
      status: "pending",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 6,
    },
    {
      id: 11,
      name: "Masa 11",
      type: "round",
      status: "occupied",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 12,
      name: "Masa 12",
      type: "round",
      status: "free",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 6,
    },
    {
      id: 13,
      name: "Masa 13",
      type: "round",
      status: "pending",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 14,
      name: "Masa 14",
      type: "round",
      status: "occupied",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 15,
      name: "Masa 15",
      type: "round",
      status: "pending",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 16,
      name: "Masa 16",
      type: "round",
      status: "free",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 17,
      name: "Masa 17",
      type: "round",
      status: "pending",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 18,
      name: "Masa 18",
      type: "round",
      status: "pending",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 19,
      name: "Masa 19",
      type: "round",
      status: "pending",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
    {
      id: 20,
      name: "Masa 20",
      type: "round",
      status: "pending",
      amount: "23.50",
      currency: "₼",
      waiter: "Nurlan",
      chairs: 4,
    },
  ];

  return (
    <Container fluid className="tables-scroll-container">
      <Row className="g-3">
        {tables.map((table, index) => (
          <Col xs={6} sm={4} md={3} lg={2} key={index} className="mb-3">
            <Table table={table} />
          </Col>
        ))}
      </Row>
    </Container>
  );
};

export default Tables;
