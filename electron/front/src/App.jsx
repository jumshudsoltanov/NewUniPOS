import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./App.css";
import Pin from "./components/Pin/Pin";
import Header from "./components/Header/Header";
import Tables from "./components/Tables/Tables";
import CustomerModal from "./components/Customers-Modal/CustomersModal";
import Check from "./components/Check/Check";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Pin />} />
          <Route
            path="/tables"
            element={
              <>
                <Header />
                <Tables />
              </>
            }
          />
          <Route path="/check" element={<Check />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
