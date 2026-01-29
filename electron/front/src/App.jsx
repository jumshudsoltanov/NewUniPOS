import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./App.css";
import Pin from "./components/Pin/Pin";
import Header from "./components/Header/Header";
import Tables from "./components/Tables/Tables";
import CustomerModal from "./components/Customers-Modal/CustomersModal";
import Check from "./components/Check/Check";
import { useDispatch } from "react-redux";
import { useEffect, useRef, useState } from "react";
import { authPos, setLoginData } from "./redux/Slices/LoginSlice";
import { HashRouter, Routes, Route, useNavigate } from "react-router-dom";
import Login from "./components/Login/Login";
import PinBackground from "./assets/images/PinContainerImagesDefault.jpg";
import Toastify from "./components/Toastify/Toastify";
import "react-toastify/dist/ReactToastify.css";

function AppContent() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Refs - re-render olmadan state saxlamaq üçün
  const initStarted = useRef(false);
  const [showInitialLoading, setShowInitialLoading] = useState(true);

  useEffect(() => {
    // Əgər artıq init başlayıbsa, bir daha başlama
    if (initStarted.current) return;
    initStarted.current = true;

    const img = new Image();
    img.src = PinBackground;

    const initApp = async () => {
      const storageData = JSON.parse(localStorage.getItem("profile"));
      const authResult = JSON.parse(localStorage.getItem("authResult"));

      if (authResult) {
        dispatch(setLoginData(authResult));
        navigate("/pin");
      } else if (storageData) {
        try {
          const data = await dispatch(authPos(storageData)).unwrap();
          localStorage.setItem("authResult", JSON.stringify(data));
          navigate("/pin");
        } catch (err) {
          console.error("Auto-login failed:", err);
          navigate("/");
        }
      } else {
        navigate("/");
      }

      // Loading-i 1.5 saniyə sonra gizlət
      setTimeout(() => setShowInitialLoading(false), 1500);
    };

    initApp();
  }, [dispatch, navigate]);

  if (showInitialLoading) {
    return (
      <div
        className="loginLoadingState"
        style={{
          height: "100vh",
          background: "#F3F4F6",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="premium-loader">
          <div className="loader-ring"></div>
          <div className="loader-dot"></div>
        </div>
        <p className="loadingText">Sistem yüklənir...</p>
      </div>
    );
  }

  return (
    <>
      <Toastify />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/pin" element={<Pin />} />
        <Route
          path="/tables"
          element={
            <>
              <Header />
              <Tables />
            </>
          }
        />
        <Route
          path="/tables/:id"
          element={
            <>
              <Header />
              <Tables />
            </>
          }
        />
        <Route path="/check/:id" element={<Check />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

export default App;
