/**
 * AÇILIŞDA TƏKRAR SORĞULARIN BİRLƏŞDİRİLMƏSİ
 * ==========================================
 *
 * PROBLEM (ölçülüb):
 * Proqram açılanda eyni endpointlər bir neçə komponent tərəfindən ayrı-ayrı
 * çağırılır. Ölçmə nəticəsi:
 *
 *     4x  /api/tables/14
 *     3x  /api/orders/14/all-checks
 *     2x  /api/sales-shifts/14/current
 *
 * Hamısı 1.5 saniyə ərzində. Server tərəfi ucuzdur (26–57 ms), lakin hər
 * cavab JSON analizi + Redux yenilənməsi + React yenidən render deməkdir —
 * özü də açılışın ən yüklü anında.
 *
 * HƏLL VƏ ONUN SƏRHƏDLƏRİ:
 * Bu, keş DEYİL. Yalnız eyni sorğunu çox qısa fasilə ilə təkrarlayan
 * çağırışları birləşdirir və YALNIZ açılışın ilk saniyələrində işləyir.
 *
 *   • `BOOT_WINDOW_MS` — bu müddət bitəndən sonra heç nə edilmir, yəni iş
 *     rejimində davranış tamamilə əvvəlki kimi qalır.
 *   • `COALESCE_MS` — bundan uzun fasilə ilə gələn sorğu həmişə buraxılır.
 *
 * Niyə belə məhdud: sifariş yazıldıqdan dərhal sonra siyahı yenilənir. Əgər
 * bu, adi keş olsaydı, həmin yenilənmə udula və kassir məhsulu ekranda görə
 * bilməzdi. Açılış pəncərəsində isə hələ heç bir yazma əməliyyatı olmur,
 * ona görə udulan sorğu yalnız təkrar ola bilər.
 *
 * Sazlama lazım olsa: `window.__posDisableBootDedupe = true` ilə söndürülür.
 */

/** Modul yüklənmə anı = proqramın açılış anı */
const BOOT_AT = Date.now();

/** Bu müddətdən sonra birləşdirmə tamamilə dayanır */
const BOOT_WINDOW_MS = 6000;

/** Eyni sorğu bu fasilədən qısa müddətdə təkrarlanırsa buraxılmır */
const COALESCE_MS = 1500;

/** açar -> son buraxılmış sorğunun vaxtı */
const sonuncu = new Map();

/**
 * Sorğu buraxılsınmı?
 *
 * `createAsyncThunk`-ın `condition` seçimində işlədilir. `false` qaytarsa RTK
 * heç bir action göndərmir (defolt `dispatchConditionRejection: false`).
 *
 * @param {string} acar  endpoint + parametrləri təmsil edən sabit mətn
 * @returns {boolean} true — sorğu getsin, false — atılsın
 */
export function bootDedupeAllows(acar) {
  try {
    if (typeof window !== "undefined" && window.__posDisableBootDedupe) return true;
  } catch {
    /* window yoxdur */
  }

  const indi = Date.now();

  // Açılış pəncərəsi bitibsə heç nəyə qarışmırıq
  if (indi - BOOT_AT > BOOT_WINDOW_MS) return true;

  const evvelki = sonuncu.get(acar);
  if (evvelki !== undefined && indi - evvelki < COALESCE_MS) {
    return false;
  }

  sonuncu.set(acar, indi);
  return true;
}

export default bootDedupeAllows;
