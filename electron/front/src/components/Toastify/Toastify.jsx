import { Toaster } from "sonner";

const Toastify = () => {
  return (
    <Toaster
      position="top-right"
      richColors
      expand={false}
      duration={3000}
      closeButton
      style={{ zIndex: 99999 }}
    />
  );
};

export default Toastify;
