import { findMenuItemById } from "./menuIndex";
/** Sifariş sətirində saxlanılmış adlar köhnə ola bilər — kataloq (menyu) üstünlükdə */

export function getCatalogModifierGroups(product) {
  if (!product?.modifier_groups) return [];
  const g = product.modifier_groups;
  if (Array.isArray(g)) return g;
  if (typeof g === "string") {
    try {
      let parsed = JSON.parse(g);
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { /* ignore */ }
      }
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return Object.values(parsed);
      if (typeof parsed === 'string' && parsed.length > 5 && parsed !== '[]') {
        return [parsed];
      }
      return [];
    } catch {
      if (g.length > 5 && g !== '[]' && g !== 'null') return [g];
      return [];
    }
  }
  if (typeof g === "object") return Object.values(g);
  return [];
}

export function buildModifierIdLookupFromCatalog(catalogProduct) {
  const map = new Map();
  getCatalogModifierGroups(catalogProduct).forEach((group) => {
    let items = group.items || group.modifiers || group.modifier_items || group.products || [];
    if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
    }
    if (!Array.isArray(items)) {
        if (typeof items === 'object') items = Object.values(items);
        else items = [];
    }
    items.forEach((item) => {
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
  return findMenuItemById(menuList, pid);
}
