import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./ios-standalone.css";
import App from "./App.jsx";
import store from "./redux/Store/store.js";
import { Provider } from "react-redux";
import { printDevConsoleBrand } from "./utils/devConsoleBrand.js";
import { initIosViewportFix } from "./utils/iosViewportFix.js";
import UpdateNotification from "./components/UpdateNotification/UpdateNotification.jsx";

void printDevConsoleBrand();
initIosViewportFix();

// Mute all console logs as requested by the user
if (import.meta.env.PROD || true) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.info = () => {};
}

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <App />
    <UpdateNotification />
  </Provider>,
);
