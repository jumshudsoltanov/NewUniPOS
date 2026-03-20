/**
 * can_manage_packs (DB: integer 0/1): 1 olduqda ofisiant PIN-dən sonra birbaşa Çeklər səhifəsinə düşür,
 * zalları görmür (paket / gəl-götür rejimi).
 * Boolean true üçün Number(true)===1 olduğundan səhv yönləndirmə olmasın — yalnız ədəd 1 qəbul edilir.
 *
 * @param {object|undefined} waiterData — loginedWaiter.data və ya API-dən gələn waiter obyekti
 * @returns {boolean}
 */
export function isPacksOnlyWaiter(waiterData) {
  const v = waiterData?.can_manage_packs;
  if (v === undefined || v === null) return false;
  if (typeof v === "boolean") return false;
  const n = Number(v);
  return !Number.isNaN(n) && n === 1;
}
