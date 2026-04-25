/** Sifariş sətirində saxlanılmış adlar köhnə ola bilər — kataloq (menyu) üstünlükdə */

export function getCatalogModifierGroups(product) {
  if (!product?.modifier_groups) return [];
  const g = product.modifier_groups;
  if (Array.isArray(g)) return g;
  if (typeof g === "string") {
    try {
      return JSON.parse(g) || [];
    } catch {
      return [];
    }
  }
  if (typeof g === "object") return Object.values(g);
  return [];
}

export function buildModifierIdLookupFromCatalog(catalogProduct) {
  const map = new Map();
  getCatalogModifierGroups(catalogProduct).forEach((group) => {
    (group.items || []).forEach((item) => {
      const id = Number(item.id);
      if (!Number.isNaN(id)) map.set(id, item);
    });
  });
  return map;
}

export function getDisplayProductName(orderItem, catalogProduct) {
  const fromCat = catalogProduct?.name;
  if (fromCat != null && String(fromCat).trim() !== "") return String(fromCat);
  return (
    orderItem?.name ||
    orderItem?.product_name ||
    orderItem?.product?.name ||
    "Məhsul"
  );
}

export function resolveModifiersForDisplay(savedModifiers, catalogProduct) {
  if (!Array.isArray(savedModifiers) || savedModifiers.length === 0) {
    return savedModifiers || [];
  }
  const lookup = buildModifierIdLookupFromCatalog(catalogProduct);
  return savedModifiers.map((m) => {
    const id = Number(m.id);
    const cat = !Number.isNaN(id) ? lookup.get(id) : null;
    const name =
      cat?.name != null && String(cat.name).trim() !== ""
        ? String(cat.name)
        : m.name;
    let priceNum;
    if (cat != null && cat.price !== undefined && cat.price !== "") {
      priceNum = parseFloat(cat.price);
    } else {
      priceNum = parseFloat(m.price || 0);
    }
    return {
      ...m,
      name,
      price: Number.isFinite(priceNum) ? priceNum : parseFloat(m.price || 0),
    };
  });
}

export function findCatalogProduct(menuList, productId) {
  if (!Array.isArray(menuList) || productId == null) return undefined;
  const pid = Number(productId);
  return menuList.find((m) => Number(m.id) === pid);
}
