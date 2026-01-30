import { useEffect, useState, useRef } from "react";
import "./Header.css";
import { Col, Row, Container } from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  getTableGroups,
  currentTableList,
} from "../../redux/Slices/TablesSlice";
import { SalesTypesModal } from "../SalesTypeModal/SalesTypesModal";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";

const Header = () => {
  const { loginedWaiter } = useSelector((state) => state.WaitersSlice);
  const { tableGroups } = useSelector((state) => state.TablesSlice);
  const { loginedProfileData } = useSelector((state) => state.LoginSlice);
  const [activeHall, setActiveHall] = useState(null);
  const [onShowSalesTypeModal, setOnShowSalesTypeModal] = useState(false);
  const newOrderBtnRef = useRef(null);
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [checkCount, setCheckCount] = useState(0);

  const isChecksPage = location.pathname === "/checks";

  useEffect(() => {
    const getTable = async () => {
      if (tableGroups?.data) return;
      try {
        await dispatch(
          getTableGroups(loginedProfileData.data.profile.id),
        ).unwrap();
      } catch (err) {
        console.error("Error fetching table groups:", err);
      }
    };

    getTable();
  }, []);

  useEffect(() => {
    if (tableGroups?.data?.length && !activeHall) {
      setActiveHall(tableGroups.data[0].id);
    }
  }, [tableGroups, activeHall]);

  useEffect(() => {
    if (activeHall) {
      dispatch(currentTableList({ hallId: activeHall }));
    }
  }, [activeHall]);

  useEffect(() => {
    const handleGetCount = async () => {
      await dispatch(
        getTableGroups(loginedProfileData?.data?.profile?.id),
      ).unwrap();
      const count = await dispatch(
        getActiveOrders({ profileId: loginedProfileData?.data?.profile?.id }),
      ).unwrap();

      setCheckCount(count.data);
    };

    handleGetCount();
  }, []);

  return (
    <>
      <Container fluid className="header d-flex align-items-center p-0">
        <Row className="w-100 m-0">
          {/* DESKTOP HALL TABS OR BACK BUTTON (Hidden on mobile) */}
          <Col lg={6} md={6} className="p-0 m-o d-none d-md-block">
            {isChecksPage ? (
              <div className="checks-header-left">
                <button
                  className="back-button"
                  onClick={() => navigate("/tables")}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="M19 12H5M12 19L5 12L12 5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span className="checks-page-title">Çeklər</span>
              </div>
            ) : (
              <ul className="hallsTab">
                {tableGroups &&
                  tableGroups?.data?.map((hall, index) => (
                    <li
                      key={index}
                      className={`hall-btn ${activeHall === hall.id ? "active" : ""}`}
                      onClick={() => setActiveHall(hall.id)}
                    >
                      {hall.name}
                    </li>
                  ))}
              </ul>
            )}
          </Col>

          {/* MOBILE TOP HEADER (Visible only on mobile) */}
          <Col
            xs={12}
            className="p-0 d-md-none d-flex align-items-center justify-content-between px-3 h-100"
          >
            <div className="mobile-header-title">
              {loginedWaiter?.data?.name}
            </div>
            <div className="d-flex align-items-center gap-2">
              <Link className="header-icon-btn" to="/pin">
                <svg
                  width="24"
                  height="24"
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
              </Link>
              <button className="header-icon-btn">
                <svg
                  width="24"
                  height="24"
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
            </div>
          </Col>

          <Col lg={6} md={6} className="headerLeftBox h-100 d-none d-md-block">
            <div className="right-tools-container h-100 d-flex align-items-center justify-content-end">
              {/* New Order Button */}
              <button
                ref={newOrderBtnRef}
                className="create-order-btn small-btn"
                onClick={() => setOnShowSalesTypeModal(true)}
              >
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
              <Link to="/checks" className="header-action-item small-item">
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
                <span className="count-badge text-white" style={{ background: "#A5B4FC" }}>{checkCount.length}</span>
              </Link>

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

              <div className="tools-divider"></div>

              {/* Waiter/Exit Icon */}
              <Link
                className="header-icon-btn small-icon-btn waiter-btn"
                to="/pin"
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
                  <span className="d-none d-xl-inline">
                    {loginedWaiter?.data?.name}
                  </span>
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
          </Col>
        </Row>
      </Container>

      {/* MOBILE FOOTER (Visible only on mobile) */}
      <div className="mobile-footer d-flex d-md-none">
        {tableGroups &&
          tableGroups?.data?.map((hall, index) => (
            <button
              key={index}
              className={`mobile-tab-btn ${activeHall === hall.id ? "active" : ""}`}
              onClick={() => setActiveHall(hall.id)}
            >
              {hall.name}
            </button>
          ))}
        <button className="mobile-add-btn">
          <svg
            width="24"
            height="24"
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
        </button>
      </div>

      <SalesTypesModal
        show={onShowSalesTypeModal}
        onClose={() => setOnShowSalesTypeModal(false)}
        onSelect={(type) => {
          console.log("Seçilən satış tipi:", type);
          // TODO: Burada seçilən tipə görə əməliyyat aparın
        }}
      />
    </>
  );
};

export default Header;
