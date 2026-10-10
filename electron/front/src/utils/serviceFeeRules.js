import { findMenuItemById } from "./menuIndex";

/**
 * SERVİS HAQQI QAYDALARI — tək mənbə
 * ==================================
 *
 * TAPILAN QÜSUR:
 * Çek ekranı ilə ödəniş ekranı servis haqqını FƏRQLİ bazadan hesablayırdı:
 *
 *   • Çek ekranı (CheckBottom) `no_service_fee` bayrağını həm sətirdən, həm də
 *     MENYU kataloqundan oxuyurdu.
 *   • Ödəniş ekranı (CheckOver) yalnız sətrə qoşulmuş `item.product` obyektinə
 *     baxırdı. Həmin obyektdə bayraq olmayanda (köhnə sifariş, natamam data,
 *     lokal əlavə olunmuş sətir) məhsul servis haqqına DAXİL EDİLİRDİ.
 *
 * Nəticədə eyni çek iki ekranda iki fərqli məbləğ göstərirdi, məsələn
 * çekdə 63.60 ₼, ödənişdə 65.10 ₼. Kassir ödəniş ekranında daha çox pul alırdı.
 *
 * İndi hər iki ekran bu funksiyanı işlədir, ona görə nəticə həmişə eynidir.
 */

/**
 * Məhsul sətri servis haqqından azaddırmı?
 *
 * Üç mənbə ardıcıl yoxlanılır:
 *   1. sətrin özündə saxlanmış bayraq
 *   2. sətrə qoşulmuş məhsul obyekti
 *   3. menyu kataloqu (ən etibarlı — həmişə cari vəziyyəti saxlayır)
 *
 * @param {object} item          sifariş sətri
 * @param {Array}  [menuCatalog] menyu məhsulları
 * @returns {boolean}
 */
export function isNoServiceFeeItem(item, menuCatalog) {
  if (!item) return false;

  if (Number(item.no_service_fee) === 1) return true;
  if (Number(item.product?.no_service_fee) === 1) return true;

  // O(1) axtarış (bax: menuIndex.js) — bu funksiya hər sətir üçün çağırılır
  const catalogItem = findMenuItemById(menuCatalog, item.product_id ?? item.id);
  if (catalogItem && Number(catalogItem.no_service_fee) === 1) return true;

  return false;
}
