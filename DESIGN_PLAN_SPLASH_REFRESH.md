# UniPOS – İki kiçik pəncərənin dizayn planı

Bu sənəd dizaynı yazacaq şəxs/AI üçün texniki kontekstdir. Kod dəyişikliyi tələb olunmur, yalnız məlumat verir.

## Ümumi qaydalar (hər iki ekran)
- Electron frameless pəncərə, `alwaysOnTop`, tapşırıq panelində görünmür.
- İnternetsiz işləməlidir: xarici font/CDN yoxdur. Font: **Segoe UI** (çəki ilə hiyerarxiya).
- Rənglər:
  - Əsas mətn: tünd naviy `#0a1e4d`
  - ".tech" mətni: sönük boz-mavi `#8b96b4`
  - Fon: ağ `#ffffff`
  - Track/boş bar: `#eef1f8`
  - Yenilə ekranında əlavə accent: `#4F85F4` → `#6366f1`
- Loqo: `electron/static/images/logo-build.png` (256px, yumru kvadrat, şəffaf fon). Altında forması ilə uyğun (yumru kvadrat) yumşaq kölgə olmalıdır; dairəvi glow olmaz.
- Üslub: sakit və peşəkar. Bounce, rəngarəng ring, hərf-hərf yazılma yoxdur. Yalnız fade/slide.
- Yüngül animasiya (zəif kassa kompüterləri üçün aşağı CPU).

---

## Ekran 1 – Açılış Splash pəncərəsi

- **Fayl:** `electron/server/splash.html` (təmiz HTML + CSS)
- **Ölçü:** 440×280, ekran mərkəzində
- **Müddət:** minimum 2.5 saniyə ekranda qalır (`SPLASH_MIN_DISPLAY_MS` in `main.js`), sonra bağlanır və tam ekran Pin ekranı açılır.

### Elementlər (yuxarıdan aşağı)
1. Loqo (~74px) + ətrafında nazik dairəvi spinner ring (3px, boz iz + naviy fırlanan qövs, 0.9s linear) + altında yumru kvadrat yumşaq kölgə.
2. Wordmark: **UniPOS** (çəki 600, naviy) + **.tech** (çəki 400, `#8b96b4`), 24px. Bütöv blok kimi fade-in.
3. Nazik loading bar: 200×4px, yumru; içində soldan sağa sürüşən naviy hissə (1.2s, ease-in-out, sonsuz).

### Animasiya ardıcıllığı
loqo fade-in (0.1s) → wordmark (0.35s) → bar (0.55s) → sakit loop (spinner + bar).

### Qadağalar
Hərf-hərf yazılma, rotate/bounce, gradient rəngarəng ring.

### Qəbul meyarı
İstənilən kadrda ekran yarımçıq/qarışıq görünməməlidir.

---

## Ekran 2 – "Yenilə" sinxronizasiya pəncərəsi

- **Fayllar:** `electron/front/src/components/RefreshLoader/RefreshSyncWindow.jsx` və `RefreshLoader.css` (siniflər `rl-*`), route: `#/refresh-sync`
- **Ölçü:** 560×470 (eni geniş düzbucaqlı), mərkəzdə, sürüşdürülə bilər.
- **Açıldığı yerlər:** Pin ekranı və Tənzimləmələr → Yenilə düyməsi.

### Elementlər
1. **Loqo** (~28–52px) + yumşaq halo (yüklənərkən pulsasiya, bitəndə yaşıl "burst").
2. **Status sətri:**
   - Yüklənərkən: spinner + "Məlumatlar yenilənir…"
   - Bitəndə: yaşıl ✓ + "Sinxronizasiya tamamlandı" + ümumi say badge-i ("N qeyd")
   - Oflayn: sarı banner "İnternet yoxdur, lokal məlumatlar"
3. **Progress bar** (mavi→bənövşəyi gradient) + sağda faiz.
4. **Addım siyahısı (7 sətir):** Məhsullar, Alt kateqoriyalar, Kateqoriyalar, Masalar, Masa qrupları, Ofisiantlar, Ödəniş üsulları. Hər sətir: dairəvi ikon, ad, sağda say.

### Davranış / animasiya
- Sətirlər ardıcıllıqla soldan fade ilə görünür.
- Gözləyən sətirdə say yerində shimmer zolağı; hazır olanda ✓ ikon (pop) və say.
- **Yeni gələnlər:** əvvəlki yeniləmədən say artıbsa adın yanında **"+N YENİ"** badge (narıncı-çəhrayı gradient, pop animasiyası).
- Bitəndən sonra hər sətir növbə ilə **sağa sürüşüb solaraq silinir** (translateX + opacity, ~0.3s, sətirlər arası 90ms). Sonda pəncərə özü bağlanır.
- Müddət qısa olmalıdır: yükləmə ≈ 1.6s, bitmə animasiyası ≈ 1.5s.

### Data axını (dizayner bilməli)
Pəncərə əvvəl `start`, sonra `done` hadisəsi alır (`counts`, `deltas`, `isOnline`). Ehtiyat: 20 saniyədə bağlanmazsa avtomatik bağlanır.

### Qəbul meyarı
- 7 sətir 470px hündürlükdə scroll-suz sığmalıdır.
- "+N YENİ" badge-i say ilə toqquşmamalıdır.
