import React, { useMemo } from "react";
import { Container, Row, Col, Alert } from "react-bootstrap";
import "./Tables.css";
import Table from "../Table/Table";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import CustomersModal from "../Customers-Modal/CustomersModal";
import OtherChecks from "../OtherChecks/OtherChecks";
import { updateTableOrders } from "../../redux/Slices/OrdersSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { toast } from "sonner";

const Tables = () => {
  const { tableGroups, currentHallId } = useSelector(
    (state) => state.TablesSlice,
  );
  const [selectedTable, setSelectedTable] = React.useState(null);
  const [showModal, setShowModal] = React.useState(false);
  const [showOtherChecks, setShowOtherChecks] = React.useState(false);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams();

  const currentTables = useMemo(() => {
    if (!tableGroups?.data || !currentHallId) {
      return tableGroups?.data?.[0]?.tables || []; //
    }
    const selectedHall = tableGroups.data.find(
      (hall) => hall.id === currentHallId,
    );
    // Sort tables by ID to keep them stable
    const tables = selectedHall?.tables || [];
    return [...tables].sort((a, b) => a.id - b.id);
  }, [tableGroups, currentHallId]);

  const handleTableClick = React.useCallback(
    async (table) => {
      const { orders } = table || {};
      if (id) {
        try {
          await dispatch(
            updateTableOrders({
              orderId: id,
              newTableId: table?.id,
              currentHallId,
            }),
          ).unwrap();

          toast.success("Masa uğurla dəyişdirildi");
          await dispatch(getTableGroups(loginedProfileData.data.profile.id));
          navigate(`/check/${id}?tableId=${table?.id}`);
        } catch (error) {
          toast.error("Xəta baş verdi");
          console.error(error);
        }
        return;
      }

      if (orders?.length > 1) {
        setSelectedTable(table);
        setShowOtherChecks(true);
      } else if (orders?.length === 1) {
        navigate(`/check/${orders[0].uuid}?tableId=${table.id}`);
      } else {
        setSelectedTable(table);
        setShowModal(true);
      }
    },
    [id, dispatch, currentHallId, loginedProfileData, navigate],
  );

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
