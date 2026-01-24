import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./App.css";
import Pin from "./components/Pin/Pin";
import Header from "./components/Header/Header";
import Tables from "./components/Tables/Tables";
import CustomerModal from "./components/Customers-Modal/CustomersModal";
function App() {
  return (
    <>
      <Header />
      <Tables />
      <CustomerModal />
    </>
  );
}

export default App;
