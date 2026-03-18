import { Toaster } from "sonner";
import "./Toastify.css";

const Toastify = () => {
  return (
    <Toaster
      position="bottom-right"
      richColors
      expand={false}
      duration={2000}
      closeButton
      toastOptions={{
        classNames: {
          toast: "toast-modern",
          success: "toast-success",
          error: "toast-error",
          warning: "toast-warning",
          info: "toast-info",
        },
      }}
      style={{ zIndex: 99999 }}
    />
  );
};

export default Toastify;
