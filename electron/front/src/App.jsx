import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./App.css";
import Pin from "./components/Pin/Pin";
import Header from "./components/Header/Header";
import Tables from "./components/Tables/Tables";
import CustomerModal from "./components/Customers-Modal/CustomersModal";
import Check from "./components/Check/Check";
import { useDispatch } from "react-redux";
import { useEffect, useRef } from "react";
import { authPos } from "./redux/Slices/LoginSlice";
import { HashRouter, Routes, Route, useNavigate } from "react-router-dom";
import Login from "./components/Login/Login";

function AppContent() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const isFirstLoad = useRef(true);

  useEffect(() => {
    const storageData = JSON.parse(localStorage.getItem("profile"));

    if (isFirstLoad.current) {
      if (storageData) {
        dispatch(authPos(storageData));
        navigate("/pin");
      } else {
        navigate("/");
      }
      isFirstLoad.current = false;
    }
  }, [dispatch, navigate]);

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
