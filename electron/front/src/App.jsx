import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./App.css";
import Pin from "./components/Pin/Pin";
import Header from "./components/Header/Header";
import Tables from "./components/Tables/Tables";
import CustomerModal from "./components/Customers-Modal/CustomersModal";
import Check from "./components/Check/Check";
import { HashRouter, Routes, Route, Link } from "react-router-dom";
import Login from "./components/Login/Login";

function App() {
  return (
    <>
      <HashRouter>
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
      </HashRouter>
    </>
  );
}

export default App;
