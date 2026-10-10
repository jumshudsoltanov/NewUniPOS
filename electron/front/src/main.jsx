import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./ios-standalone.css";
import "./perf-mode.css";
import App from "./App.jsx";
import store from "./redux/Store/store.js";
import { Provider } from "react-redux";
import { printDevConsoleBrand } from "./utils/devConsoleBrand.js";
import { initIosViewportFix } from "./utils/iosViewportFix.js";
import UpdateNotification from "./components/UpdateNotification/UpdateNotification.jsx";

/**
 * PERFORMANS REJİMİ
 * Ağır CPU effektlərini (backdrop blur, sonsuz box-shadow pulsasiyaları,
 * `transition: all`) söndürür. Detallar: perf-mode.css
 *
 * Defolt qərar GPU vəziyyətinə bağlıdır (main.js preload ilə ötürür):
 *   • GPU SÖNÜLÜ → rejim AKTİV (effektlər CPU-da çox baha başa gəlir)
 *   • GPU AÇIQ   → rejim passiv (effektlər GPU-da ucuzdur, görünüş saxlanılır)
 *
 * İstifadəçi istədiyini seçə bilər, seçim defoltu əvəz edir:
 *   localStorage.setItem("pos_perf_mode", "true")   // həmişə sürət
 *   localStorage.setItem("pos_perf_mode", "false")  // həmişə görünüş
 */
try {
  const saved = localStorage.getItem("pos_perf_mode");
  const gpuEnabled = window.uniposRuntime?.gpuEnabled === true;
  const enabled = saved === "true" ? true : saved === "false" ? false : !gpuEnabled;
  if (enabled) document.body.classList.add("perf-mode");
} catch {
  // localStorage əlçatan deyil — təhlükəsiz tərəf: sürətli rejim
  document.body.classList.add("perf-mode");
}

void printDevConsoleBrand();
initIosViewportFix();

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <App />
    <UpdateNotification />
  </Provider>,
);
