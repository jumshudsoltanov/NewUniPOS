import React, { useCallback, useEffect, useState } from "react";
import { Container, Col, Row } from "react-bootstrap";
import "./Check.css";
import Menu from "../Menu/Menu";
import CheckHeader from "./CheckHeader";
import CheckMain from "./CheckMain";
import CheckBottom from "./CheckBottom";
import OperationsModal from "../Operations/OperationsModal";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import CheckLockModal from "../Check-Lock/CheckLockModal";
import CommentModal from "../CommentModal/CommentModal";
import ClearCheck from "../ClearCheck/ClearCheck";
import DiscountModal from "../DiscountModal/DiscountModal";
import ServiceFeeModal from "../ServiceFeeModal/ServiceFeeModal";
import WaitersModal from "../Waiters/WaitersModal";

const Check = () => {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeMobileTab, setActiveMobileTab] = useState("menu");
  const [showOpeationsModal, setShowOperationsModal] = useState(false);
  const [lockCheck, setLockCheck] = useState(false);
  const [comment, setComment] = useState(false);
  const [onShowClearModal, setOnShowClearModal] = useState(false);
  const [onShowDiscount, setOnShowDiscount] = useState(false);
  const [onShowServiceFee, setOnShowServiceFee] = useState(false);
  const [showWaitersModal, setShowWaitersModal] = useState(false);
  const navigate = useNavigate();
  const { products } = useSelector((state) => state.OrderSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const { tableGroups, currentHallId } = useSelector(
    (state) => state.TablesSlice,
  );
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get("tableId");
  const [currentOrder, setCurrentOrder] = useState(null);
  const [currentHall, setCurrentHall] = useState(null);
  const [currentTable, setCurrentTable] = useState(null);

  const goTables = () => {
    navigate("/tables");
  };

  const handleShowOperationsTab = () => {
    setShowOperationsModal(true);
  };

  const clearCheck = () => {
    if (products.length == 0) {
      setShowOperationsModal(false);
      return;
    }
    setShowOperationsModal(false);
    setOnShowClearModal(true);
  };

  const openCommentModal = () => {
    setShowOperationsModal(false);
    setComment(true);
  };

  const openDiscountModal = () => {
    setShowOperationsModal(false);
    setOnShowDiscount(true);
  };

  const openServiceFee = () => {
    setShowOperationsModal(false);
    setOnShowServiceFee(true);
  };

  const openWaitersModal = () => {
    setShowOperationsModal(false);
    setShowWaitersModal(true);
  };

  // Load check Data

  const initialOrderOnTable = useCallback(() => {
    if (!tableGroups?.data) return;

    const hall = tableGroups.data.find((item) => item.id == currentHallId);
    setCurrentHall(hall);
    if (!hall) return;

    const tableObj = hall.tables.find((t) => t.id == tableId);
    setCurrentTable(tableObj);
    if (!tableObj) return;

    const orders = tableObj.orders.find((o) => o.uuid == id);

    setCurrentOrder(orders);
  }, [tableGroups, currentHallId, tableId, id]);

  useEffect(() => {
    initialOrderOnTable();
  }, [initialOrderOnTable]);

  return (
    <Container fluid className="p-0 vh-100 overflow-hidden">
      <Row className="h-100 g-0">
        <Col
          md={12}
          lg={5}
          xl={4}
          className={`h-100 ${activeMobileTab !== "check" ? "d-none d-lg-block" : ""}`}
        >
          <div className="check-container h-100 d-flex mobile-content-adjust">
            {/* Sidebar */}
            <div
              className={`check-sidebar flex-column justify-content-between align-items-center ${isSidebarOpen ? "d-flex" : "d-none d-lg-flex"}`}
            >
              <div className="sidebar-top d-flex flex-column align-items-center gap-4">
                <div className="checkBackBtn" onClick={goTables}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="M5.94168 15.2584H12.6083C14.9083 15.2584 16.775 13.3917 16.775 11.0917C16.775 8.79172 14.9083 6.92505 12.6083 6.92505H3.44168"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeMiterlimit="10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M5.35834 9.00837L3.22501 6.87503L5.35834 4.7417"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="sidebar-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="sidebar-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M19.5 12.5C19.5 11.12 20.62 10 22 10V9C22 5 21 4 17 4H7C3 4 2 5 2 9V9.5C3.38 9.5 4.5 10.62 4.5 12C4.5 13.38 3.38 14.5 2 14.5V15C2 19 3 20 7 20H17C21 20 22 19 22 15C20.62 15 19.5 13.88 19.5 12.5Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9 14.75L15 8.75"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14.9945 14.75H15.0035"
                      stroke="#343434"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8.99451 9.25H9.00349"
                      stroke="#343434"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="sidebar-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M18.97 22H4.97C1.97 22 1.97 20.65 1.97 19V18C1.97 17.45 2.42 17 2.97 17H20.97C21.52 17 21.97 17.45 21.97 18V19C21.97 20.65 21.97 22 18.97 22Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M20.72 13V17H3.26999V13C3.26999 9.16 5.97999 5.95 9.58999 5.18C10.13 5.06 10.69 5 11.27 5H12.72C13.3 5 13.87 5.06 14.41 5.18C18.02 5.96 20.72 9.16 20.72 13Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14.5 4.5C14.5 4.74 14.47 4.96 14.41 5.18C13.87 5.06 13.3 5 12.72 5H11.27C10.69 5 10.13 5.06 9.59 5.18C9.53 4.96 9.5 4.74 9.5 4.5C9.5 3.12 10.62 2 12 2C13.38 2 14.5 3.12 14.5 4.5Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M15 11H9"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div
                  className="sidebar-icon comment-button"
                  onClick={() => setComment(true)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M8.5 19H8C4 19 2 18 2 13V8C2 4 4 2 8 2H16C20 2 22 4 22 8V13C22 17 20 19 16 19H15.5C15.19 19 14.89 19.15 14.7 19.4L13.2 21.4C12.54 22.28 11.46 22.28 10.8 21.4L9.3 19.4C9.14 19.18 8.77 19 8.5 19Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeMiterlimit="10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M15.9965 11H16.0054"
                      stroke="#343434"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M11.9955 11H12.0045"
                      stroke="#343434"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M7.99451 11H8.00349"
                      stroke="#343434"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="sidebar-bottom d-flex flex-column align-items-center gap-4">
                <div
                  className="sidebar-icon check-lock"
                  onClick={() => {
                    setLockCheck(true);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M6 10V8C6 4.69 7 2 12 2C17 2 18 4.69 18 8V10"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 18.5C13.3807 18.5 14.5 17.3807 14.5 16C14.5 14.6193 13.3807 13.5 12 13.5C10.6193 13.5 9.5 14.6193 9.5 16C9.5 17.3807 10.6193 18.5 12 18.5Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M17 22H7C3 22 2 21 2 17V15C2 11 3 10 7 10H17C21 10 22 11 22 15V17C22 21 21 22 17 22Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="sidebar-icon position-relative">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M7.25 7H16.75V5C16.75 3 16 2 13.75 2H10.25C8 2 7.25 3 7.25 5V7Z"
                      fill="#EBF2FE"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeMiterlimit="10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M16 15V19C16 21 15 22 13 22H11C9 22 8 21 8 19V15H16Z"
                      fill="#EBF2FE"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeMiterlimit="10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M21 10V15C21 17 20 18 18 18H16V15H8V18H6C4 18 3 17 3 15V10C3 8 4 7 6 7H18C20 7 21 8 21 10Z"
                      fill="#EBF2FE"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeMiterlimit="10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M17 15H15.79H7"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeMiterlimit="10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M7 11H10"
                      stroke="#343434"
                      strokeWidth="1.5"
                      strokeMiterlimit="10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="icon-badge">8</span>
                </div>

                <div
                  className="sidebar-icon operations"
                  onClick={handleShowOperationsTab}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M5 10C3.9 10 3 10.9 3 12C3 13.1 3.9 14 5 14C6.1 14 7 13.1 7 12C7 10.9 6.1 10 5 10Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M19 10C17.9 10 17 10.9 17 12C17 13.1 17.9 14 19 14C20.1 14 21 13.1 21 12C21 10.9 20.1 10 19 10Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z"
                      stroke="#343434"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Main Content of Check */}
            <div
              className="check-content flex-grow-1 d-flex flex-column h-100 position-relative"
              style={{ backgroundColor: "#EBF2FE" }}
            >
              <CheckHeader
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                orders={currentOrder}
                table={currentTable}
                hall={currentHall}
              />
              <CheckMain orders={currentOrder} />
              <CheckBottom orders={currentOrder} />
            </div>
          </div>
        </Col>

        {/* Menu Section */}
        <Col
          md={12}
          lg={7}
          xl={8}
          className={`h-100 bg-light ${activeMobileTab !== "menu" ? "d-none d-lg-block" : ""}`}
        >
          <div className="checkRightBox h-100 d-flex flex-column bg-light mobile-content-adjust">
            {/* Top Info Bar (Dark Blue) */}
            <div className="right-top-header d-none d-md-flex justify-content-end align-items-center px-3 py-2 text-white">
              <button className="create-order-btn small-btn">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 5V19M5 12H19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="d-none d-xl-inline">Yeni sifariş</span>
              </button>

              {/* Checks */}
              <div className="header-action-item small-item">
                <span className="d-none d-xl-inline">Çeklər</span>
                <svg
                  className="d-xl-none"
                  width="22"
                  height="22"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M1.92.506a.5.5 0 0 1 .434.14L3 1.293l.646-.647a.5.5 0 0 1 .708 0L5 1.293l.646-.647a.5.5 0 0 1 .708 0L7 1.293l.646-.647a.5.5 0 0 1 .708 0L9 1.293l.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .801.13l.5 1A.5.5 0 0 1 15 2v12a.5.5 0 0 1-.053.224l-.5 1a.5.5 0 0 1-.8.13L13 14.707l-.646.647a.5.5 0 0 1-.708 0L11 14.707l-.646.647a.5.5 0 0 1-.708 0L9 14.707l-.646.647a.5.5 0 0 1-.708 0L7 14.707l-.646.647a.5.5 0 0 1-.708 0L5 14.707l-.646.647a.5.5 0 0 1-.708 0L3 14.707l-.646.647a.5.5 0 0 1-.801-.13l-.5-1A.5.5 0 0 1 1 14V2a.5.5 0 0 1 .053-.224l.5-1a.5.5 0 0 1 .367-.27zm.217 1.338L2 2.118v11.764l.137.274.51-.51a.5.5 0 0 1 .707 0l.646.647.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.509.509.137-.274V2.118l-.137-.274-.51.51a.5.5 0 0 1-.707 0L12 1.707l-.646.647a.5.5 0 0 1-.708 0L10 1.707l-.646.647a.5.5 0 0 1-.708 0L8 1.707l-.646.647a.5.5 0 0 1-.708 0L6 1.707l-.646.647a.5.5 0 0 1-.708 0L4 1.707l-.646.647a.5.5 0 0 1-.708 0l-.509-.51z" />
                  <path d="M3 4.5a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5zm8-6a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5z" />
                </svg>
                <span className="count-badge">4</span>
              </div>

              <div className="tools-divider"></div>

              {/* Menu Hamburger */}
              <button className="header-icon-btn small-icon-btn">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    d="M3 12H21M3 6H21M3 18H21"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {/* Waiter */}
              <div className="tools-divider"></div>

              {/* Waiter/Exit Icon */}
              <Link
                className="header-icon-btn small-icon-btn waiter-btn"
                to="/"
              >
                <div className="d-flex align-items-center gap-2">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M16 17L21 12L16 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M21 12H9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="d-none d-xl-inline">Ofisiant</span>
                </div>
              </Link>

              <div className="tools-divider"></div>

              {/* Notification Bell */}
              <button className="header-icon-btn small-icon-btn">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    d="M18 8A6 6 0 0 0 6 8C6 15 3 21 3 21H21S18 15 18 8Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M13.73 21A2 2 0 0 1 10.27 21" />
                </svg>
              </button>

              <div className="tools-divider"></div>

              {/* Wifi Icon */}
              <div className="header-icon-btn small-icon-btn wifi-icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2 8.3601C8.06 3.6801 15.94 3.6801 22 8.3601"
                    stroke="#00FF6A"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4.91 11.8401C9.21 8.5201 14.8 8.5201 19.1 11.8401"
                    stroke="#00FF6A"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6.79 15.4902C9.94 13.0502 14.05 13.0502 17.2 15.4902"
                    stroke="#00FF6A"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.4 19.1501C10.98 17.9301 13.03 17.9301 14.61 19.1501"
                    stroke="#00FF6A"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Bottom Action Bar (White) */}
            <div className="CheckRightboxHeader d-flex justify-content-between align-items-center p-2 bg-white border-bottom">
              {/* Left Side: Home Button */}
              <div className="ms-2 header-left d-flex align-items-center gap-3">
                <div
                  className="home-btn btn-primary d-flex align-items-center justify-content-center"
                  style={{ width: "50px" }}
                >
                  {" "}
                  {/* Styled like image */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="M10 15V12.5"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8.39166 2.35004L2.61666 6.97504C1.96666 7.4917 1.55 8.58337 1.69166 9.40004L2.8 16.0334C3 17.2167 4.13333 18.175 5.33333 18.175H14.6667C15.8583 18.175 17 17.2084 17.2 16.0334L18.3083 9.40004C18.4417 8.58337 18.025 7.4917 17.3833 6.97504L11.6083 2.35837C10.7167 1.6417 9.275 1.6417 8.39166 2.35004Z"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Right Side: Search & Actions */}
              <div className="header-right d-flex align-items-center gap-2">
                {/* Search */}
                <div
                  className={`search-wrapper ${isSearchExpanded ? "expanded" : ""}`}
                  onClick={() => setIsSearchExpanded(true)}
                >
                  {!isSearchExpanded ? (
                    <div className="header-icon bg-light text-primary rounded p-2">
                      <i className="bi bi-search"></i>
                    </div>
                  ) : (
                    <>
                      <i className="bi bi-search text-primary"></i>
                      <input
                        type="text"
                        className="search-input mx-2"
                        placeholder="Axtarış..."
                        autoFocus
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                      />
                      <span
                        className="clear-btn fw-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSearchExpanded(false);
                          setSearchText("");
                        }}
                      >
                        Təmizlə
                      </span>
                    </>
                  )}
                </div>

                {/* Porsiya Button */}
                {/* <div className="btn bg-white border d-flex align-items-center gap-2 text-secondary">
                  <i className="bi bi-cup-hot"></i>
                  <span>Porsiya</span>
                </div> */}

                {/* Settings */}
                {/* <div className="header-icon bg-white border rounded p-2 text-secondary cursor-pointer">
                  <i className="bi bi-gear-fill"></i>
                </div> */}

                {/* Star */}
                {/* <div className="header-icon bg-white border rounded p-2 text-secondary cursor-pointer">
                  <i className="bi bi-star"></i>
                </div> */}

                {/* List */}
                {/* <div className="header-icon bg-white border rounded p-2 text-secondary cursor-pointer">
                  <i className="bi bi-list-ul"></i>
                </div> */}
              </div>
            </div>

            {/* Content placeholder for the rest of the right box */}
            <div className="checkRightBoxContent flex-grow-1 p-3">
              <Menu />
            </div>
          </div>
        </Col>
      </Row>

      {/* Mobile Bottom Nav */}
      <div className="mobile-bottom-nav d-flex d-lg-none">
        <div
          className={`mobile-nav-item ${isSidebarOpen ? "active" : ""}`}
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <i className="bi bi-list"></i>
        </div>
        <div
          className={`mobile-nav-item ${activeMobileTab === "check" && !isSidebarOpen ? "active" : ""}`}
          onClick={() => {
            setActiveMobileTab("check");
            setIsSidebarOpen(false);
          }}
        >
          <div className="position-relative d-inline-flex">
            <i className="bi bi-receipt"></i>
            {products?.length > 0 && (
              <span
                className="position-absolute top-0 start-100 translate-middle badge rounded-pill"
                style={{ backgroundColor: "#053796" }}
              >
                {products.length}
              </span>
            )}
          </div>
        </div>
        <div
          className={`mobile-nav-item ${activeMobileTab === "menu" ? "active" : ""}`}
          onClick={() => {
            setActiveMobileTab("menu");
            setIsSidebarOpen(false);
          }}
        >
          <i className="bi bi-grid-fill"></i>
        </div>
      </div>
      <OperationsModal
        show={showOpeationsModal}
        onHide={() => setShowOperationsModal(false)}
        clearCheck={clearCheck}
        openCommentModal={openCommentModal}
        openDiscountModal={openDiscountModal}
        openServiceFee={openServiceFee}
        openWaitersModal={openWaitersModal}
      />

      <CheckLockModal
        show={lockCheck}
        onClose={() => {
          setLockCheck(false);
        }}
      />
      <CommentModal
        show={comment}
        onClose={() => {
          setComment(false);
        }}
      />

      <ClearCheck
        show={onShowClearModal}
        onClose={() => setOnShowClearModal(false)}
      />

      <DiscountModal
        show={onShowDiscount}
        onClose={() => setOnShowDiscount(false)}
      />

      <ServiceFeeModal
        show={onShowServiceFee}
        onClose={() => setOnShowServiceFee(false)}
      />

      <WaitersModal
        show={showWaitersModal}
        onClose={() => setShowWaitersModal(false)}
      />
    </Container>
  );
};

export default Check;
