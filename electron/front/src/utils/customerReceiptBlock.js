import { toast } from "sonner";
import { updateCustomerViaAdmin } from "../redux/Slices/CustomersSlice";
import { updateLockChecK } from "../redux/Slices/OrdersSlice";

/**
 * Ofisiantda can_block_customer_on_check === 1 olduqda, müştəri çeki uğurla çapdan sonra
 * admin API-də müştərini bloklayır (is_blocked: 1).
 * Admin backend (api.unipos.tech) customers PUT endpointində is_blocked sahəsini qəbul etməlidir.
 */
export async function maybeBlockCustomerOnCustomerReceipt(dispatch, loginedWaiter, customerId) {
  if (Number(loginedWaiter?.data?.can_block_customer_on_check) !== 1) return;
  if (!dispatch) return;
  const id = Number(customerId);
  if (!Number.isFinite(id) || id <= 0) return;
  try {
    await dispatch(
      updateCustomerViaAdmin({
        id,
        customerData: { is_blocked: 1 },
      }),
    ).unwrap();
    toast.success("Müştəri çeki çap olundu — müştəri bloklandı");
  } catch (e) {
    const msg = typeof e === "string" ? e : e?.message || "Xəta";
    console.warn("[CUSTOMER_BLOCK] Admin API müştəri bloklana bilmədi:", msg);
    toast.error("Müştəri bloklana bilmədi (admin API). Yoxlayın: is_blocked sahəsi.");
  }
}

/**
 * Ön (müştəri) çeki uğurla çap olunduqda: `can_block_customer_on_check === 1` → sifarişdə `is_locked: 1`.
 * Ofisiant eyni «Çeki kilidlə» modalından «Kilidi aç» ilə çeki yenidən redaktə edə bilər.
 */
export async function maybeLockCheckAfterCustomerReceiptPrint(dispatch, loginedWaiter, checkData, waiterName) {
  if (!dispatch) return;
  if (Number(loginedWaiter?.data?.can_block_customer_on_check) !== 1) return;
  const orderId = checkData?.uuid;
  if (!orderId) return;
  const wn =
    waiterName ||
    loginedWaiter?.data?.name ||
    loginedWaiter?.name ||
    "Naməlum";
  try {
    await dispatch(
      updateLockChecK({
        orderId,
        status: 1,
        waiterName: wn,
      }),
    ).unwrap();
  } catch (e) {
    console.warn("[CUSTOMER_RECEIPT_LOCK] Çek kilidlənmədi:", e);
  }
}
