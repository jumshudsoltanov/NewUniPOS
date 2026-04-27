import { DEFAULT_OPERATION_NAMES } from "../components/Operations/OperationsModal";

/**
 * Müştəri çeki və customer display-də xidmət haqqı sətri üçün etiket.
 * Əməliyyat adlarında "serviceFee" üçün fərqli mətn yazılıbsa həmin mətn;
 * əks halda köhnə sabit mətn ("Xidmət haqqı") — yadda saxlanmış tam default
 * düymə mətni ilə eyni olanda da qısa variant qalır.
 */
export function getCustomerFacingServiceFeeLabel() {
  let custom = {};
  try {
    custom = JSON.parse(localStorage.getItem("pos_operation_names") || "{}");
  } catch {
    custom = {};
  }
  const defBtn = DEFAULT_OPERATION_NAMES.serviceFee;
  const raw =
    custom.serviceFee != null ? String(custom.serviceFee).trim() : "";
  if (raw && raw !== defBtn) {
    return raw;
  }
  return "Xidmət haqqı";
}
