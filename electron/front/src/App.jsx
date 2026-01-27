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
import { authPos } from "./redux/Slices/LoginSlice";
import { HashRouter, Routes, Route, useNavigate } from "react-router-dom";
import Login from "./components/Login/Login";
import PinBackground from "./assets/images/PinContainerImagesDefault.jpg";

function AppContent() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(true);

  const isFirstLoad = useRef(true);

  useEffect(() => {
    // Preload PIN background image
    const img = new Image();
    img.src = PinBackground;

    const initApp = async () => {
      const storageData = JSON.parse(localStorage.getItem("profile"));

      if (isFirstLoad.current) {
        if (storageData) {
          try {
            await dispatch(authPos(storageData)).unwrap();
            navigate("/pin");
          } catch (err) {
            console.error("Auto-login failed:", err);
            navigate("/");
          }
        } else {
          navigate("/");
        }
        isFirstLoad.current = false;
        // Animasiyanı hiss etmək üçün qısa fasilə
        setTimeout(() => setIsInitializing(false), 1000);
      } else {
        setIsInitializing(false);
      }
    };

    initApp();
  }, [dispatch, navigate]);

  if (isInitializing) {
    return (
      <div className="loginLoadingState" style={{ height: "100vh", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="premium-loader">
          <div className="loader-ring"></div>
          <div className="loader-dot"></div>
        </div>
        <p className="loadingText">Sistem yüklənir...</p>
      </div>
    );
  }

  return (
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
      <Route path="/check/:id" element={<Check />} />
    </Routes>
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
