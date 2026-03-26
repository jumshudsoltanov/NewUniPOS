import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import store from "./redux/Store/store.js";
import { Provider } from "react-redux";
import { printDevConsoleBrand } from "./utils/devConsoleBrand.js";
import UpdateNotification from "./components/UpdateNotification/UpdateNotification.jsx";

void printDevConsoleBrand();

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <App />
    <UpdateNotification />
  </Provider>,
);
