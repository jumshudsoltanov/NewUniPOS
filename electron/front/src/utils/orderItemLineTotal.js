/**
 * CheckBottom.jsx ilə eyni: kombo/modifikator qiymətləri sətir cəminə daxil edilir.
 * Masa kartı və çek modalları bu util ilə çek içi cəmlə uyğunlaşır.
 */
export function getModifiersTotalPerUnit(item) {
  let modifiersTotal = 0;
  try {
    let mods = item?.modifiers;
    if (typeof mods === "string") mods = JSON.parse(mods);
    if (Array.isArray(mods)) {
      modifiersTotal = mods.reduce(
        (sum, mod) => sum + Number(mod.price || 0) * Number(mod.count || 1),
        0,
      );
    }
  } catch {
    /* ignore */
  }
  return modifiersTotal;
}

/** Bir orders_items sətri: say × (vahid qiymət + modifikatorlar vahidə) */
export function getOrderItemLineTotal(item) {
  const count = Number(item.count || item.quantity || 0);
  const price = Number(item.price || item.amount || 0);
  return count * (price + getModifiersTotalPerUnit(item));
}

/** Yadda saxlanmış sətirlərin məhsul üzrə cəmi (endirim/xidmət daxil deyil) */
export function sumOrderItemsLinesTotal(ordersItems) {
  if (!ordersItems || !ordersItems.length) return 0;
  return ordersItems.reduce((sum, it) => sum + getOrderItemLineTotal(it), 0);
}
