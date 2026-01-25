import { useState } from "react";
import "./Header.css";
import { Col, Row, Container } from "react-bootstrap";
import { Link } from "react-router-dom";

const Header = () => {
  const halls = ["Zal", "Əsas Zal", "Teras", "zal 5", "zal 10"];
  const [activeHall, setActiveHall] = useState(0);

  return (
    <>
      <Container fluid className="header d-flex align-items-center p-0">
        <Row className="w-100 m-0">
          {/* DESKTOP HALL TABS (Hidden on mobile) */}
          <Col lg={6} md={6} className="p-0 m-o d-none d-md-block">
            <ul className="hallsTab">
              {halls.map((hall, index) => (
                <li
                  key={index}
                  className={`hall-btn ${activeHall === index ? "active" : ""}`}
                  onClick={() => setActiveHall(index)}
                >
                  {hall}
                </li>
              ))}
            </ul>
          </Col>

          {/* MOBILE TOP HEADER (Visible only on mobile) */}
          <Col
            xs={12}
            className="p-0 d-md-none d-flex align-items-center justify-content-between px-3 h-100"
          >
            <div className="mobile-header-title">Ofisiant</div>
            <div className="d-flex align-items-center gap-2">
              <Link className="header-icon-btn"  to="/">
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

          <Col
            lg={6}
            md={6}
            className="headerLeftBox h-100 d-none d-md-block"
          >
            <div className="right-tools-container h-100 d-flex align-items-center justify-content-end  pe-2">
              {/* New Order Button */}
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
                <span>Yeni sifariş</span>
              </button>

              {/* Checks */}
              <div className="header-action-item small-item">
                <span>Çeklər</span>
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

              <div className="tools-divider"></div>

              {/* Waiter/Exit Icon */}
              <Link className="header-icon-btn small-icon-btn waiter-btn" to="/">
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
                  <span>Ofisiant</span>
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
        {halls.map((hall, index) => (
          <button
            key={index}
            className={`mobile-tab-btn ${activeHall === index ? "active" : ""}`}
            onClick={() => setActiveHall(index)}
          >
            {hall}
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
    </>
  );
};

export default Header;
