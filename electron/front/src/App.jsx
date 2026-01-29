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

function AppContent() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(true);

  const isFirstLoad = useRef(true);

  useEffect(() => {
    const img = new Image();
    img.src = PinBackground;

    const initApp = async () => {
      const storageData = JSON.parse(localStorage.getItem("profile"));
      const authResult = JSON.parse(localStorage.getItem("authResult"));

      if (isFirstLoad.current) {
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
        isFirstLoad.current = false;
        setTimeout(() => setIsInitializing(false), 3000);
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
