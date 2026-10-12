# UniPOS — Açılış və Yeniləmə Ekranlarının Dizayn Planı

Bu sənəd dizayner üçündür. Burada **nə çəkilməli olduğu** və **hansı məhdudiyyətlərə**
tabe olduğu yazılıb. Hazır məlumat sahələri koddan götürülüb — uydurma sahə əlavə
etmək olmaz, çünki proqram onları verə bilmir.

---

## 1. Üç ekran var, üçü də ayrıdır

| # | Ekran | Növ | Ölçü | Nə vaxt görünür | Nə qədər |
|---|---|---|---|---|---|
| 1 | **Splash** | Ayrıca Electron pəncərəsi | 440 × 280 | Proqram ikonuna basılan andan | ~2.5 san |
| 2 | **Daxili yüklənmə** | Əsas pəncərənin içində örtük | tam ekran | Splash bağlananda | ~0.3 san |
| 3 | **Yeniləmə (sinxronizasiya)** | Ayrıca Electron pəncərəsi | 560 × 470 | Kassir "Yenilə" basanda | 2–20 san |

Birinci ikisi **açılış** axınıdır, üçüncü **iş zamanı** istənilən vaxt çıxır.
Hər üçü eyni ailəyə oxşamalıdır, amma eyni olmamalıdır.

---

## 2. Bütün ekranlara aid məhdudiyyətlər

Bunlar texniki tələbdir, zövq məsələsi deyil:

- **Pəncərənin öz başlığı yoxdur** (`frame: false`). Windows-un mavi başlıq zolağı,
  bağla/kiçilt düymələri YOXDUR. Bağlama düyməsi lazımdırsa dizayna özün çəkməlisən.
- **Ölçü sabitdir**, istifadəçi dəyişə bilmir. Verilmiş piksellərin xaricinə çıxmaq olmaz
  və **sürüşdürmə (scroll) olmamalıdır** — kəsilən məzmun sadəcə görünməyəcək.
- **İnternetsiz işləməlidir.** Google Fonts, CDN şəkli, xarici ikon kitabxanası OLMAZ.
  Hər şey proqramın içində olmalıdır. Kassa çox vaxt oflayn açılır.
- **Dörd dil:** Azərbaycan, İngilis, Rus, Türk. Rus mətnləri ~30% uzundur —
  yazılar üçün yer ehtiyatı saxla, sabit enli qutulara mətn sığışdırma.
- **Toxunma ekranı.** Basıla bilən hər şey ən azı 44 × 44 px olmalıdır.
- **Miqyas:** kassalarda 1366×768-dən 1920×1080-a qədər ekranlar var, bəzilərində
  Windows miqyası 125%-dir. Dizayn 100% miqyasa görə verilsin, amma 125%-də
  kəsilməyəcəyinə əmin ol.
- **Fon:** hazırda ağ (`#ffffff`). Dəyişdirilə bilər, amma pəncərənin fonu kodda da
  təyin olunur — yeni rəng seçsən qeyd et.

### Mövcud palitra və şrift

```
Brend mavisi (əsas)   #053796
Tünd mavi (mətn)      #0a1e4d
Boz-mavi (ikinci)     #8b96b4
Açıq haşiyə           #cfd6e6 / #e6eaf3
Açıq fon              #eef1f8 / #f0f2f8
Sarı (oflayn)         #9a6a12  (mətn) / #d8a83a (vurğu)
Şrift                 "Segoe UI", system-ui, sans-serif
```

Brend rəngini dəyişmək istəmirik. Başqa çalarlar əlavə edilə bilər.

---

## 3. Ekran 1 — Splash (440 × 280)

### İndi necədir

Ağ kart, mərkəzdə logo + "UniPOS.tech" + "HORECA System", altında dəyişən mətn və
nazik proqres zolağı.

### Əlçatan məlumat

| Sahə | Mənbə | Nümunə |
|---|---|---|
| Logo | proqramın içində şəkil | `logo-build.png` |
| Versiya | proqramdan gəlir | `v2.3.33` |
| Mərhələ mətni | **saxtadır** (aşağıya bax) | "lokal baza açılır" |
| Proqres faizi | **saxtadır** (aşağıya bax) | 0→100% |

### ⚠ Vacib problem — dizayna təsir edir

Splash-dakı mərhələ mətni və proqres zolağı **həqiqi vəziyyəti göstərmir**.
Onlar sadəcə taymerlə 2.5 saniyəyə sayır. Proqram 0.3 saniyəyə hazır olsa belə,
splash yenə 2.5 saniyə gözləyir (`SPLASH_MIN_DISPLAY_MS = 2500`).

Yəni **istifadəçi hazır proqramı 2.2 saniyə gözləyir.**

Dizaynda iki yoldan birini seç:

- **A (tövsiyə olunur):** Proqres zolağını və mərhələ mətnini tamamilə çıxar.
  Sadəcə logo + versiya + zərif bir canlanma. Belə olanda splash həqiqətən hazır
  olan kimi bağlana bilər və saxta məlumat göstərmir. Açılış 2.5 → ~0.5 saniyə.
- **B:** Proqres qalsın, amma həqiqi mərhələləri göstərsin. Bu halda proqramdan
  real siqnallar ötürülməlidir (bu, əlavə iş deməkdir — nə qədər olduğunu de).

Hansını seçsən, qeyd et — kodda uyğun dəyişiklik lazımdır.

### Vəziyyətlər

1. **Normal** — yeganə vəziyyət. Splash səhv göstərmir, çünki xəta olsa belə
   proqram 12 saniyəyə məcburi açılır.

---

## 4. Ekran 2 — Daxili yüklənmə örtüyü

### İndi necədir

Tam ekran ağ örtük, mərkəzdə fırlanan halqa + logo + "Sistem yüklənir...".

### Vəziyyət

Bu ekran əvvəl 1.5 saniyə görünürdü, indi **~0.3 saniyə** görünür (düzəliş edilib).
Yəni istifadəçi onu praktiki olaraq görmür — bir anlıq parıltıdır.

### Dizayndan gözlənilən

İki variant:

- **A (tövsiyə olunur):** Bu ekranı tamamilə sil. Splash onsuz da örtür;
  0.3 saniyəlik ikinci ekran yalnız yanıb-sönmə effekti yaradır.
- **B:** Qalsın, amma splash ilə **tam eyni** görünsün ki, keçid hiss olunmasın
  (eyni fon, eyni logo ölçüsü və mövqeyi). Hazırda ikisi fərqlidir, ona görə
  gözə çarpan sıçrayış var.

---

## 5. Ekran 3 — Yeniləmə pəncərəsi (560 × 470)

Ən çox iş tələb edən ekran budur. İstifadəçi onu **tez-tez** görür.

### İndi necədir

```
┌──────────────────────────────────────────────┐
│ [logo]  Məlumatların yenilənməsi      47%    │
│         YENİLƏNİR                 1,284 qeyd │
├──────────────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                              │
│  ✓  Məhsullar                    +12     847 │
│  ✓  Alt kateqoriyalar                     34 │
│  ✓  Kateqoriyalar                          8 │
│  ✓  Masalar                       +2      52 │
│  ✓  Masa qrupları                          6 │
│  ✓  Ofisiantlar                            4 │
│  ✓  Ödəniş üsulları                        4 │
└──────────────────────────────────────────────┘
```

### Əlçatan məlumat — dəqiq siyahı

Hər sətir üçün üç dəyər var:

| Dəyər | İzah | Nümunə |
|---|---|---|
| Ad | bölmənin adı (tərcümə olunur) | "Məhsullar" |
| Say | bazadakı ümumi qeyd sayı | `847` |
| Fərq | bu yeniləmədə NEÇƏ YENİ gəldi | `+12` (0 olanda göstərilmir) |

Başlıqda:

| Dəyər | İzah |
|---|---|
| Faiz | 0–100 (oflayn rejimdə `—`) |
| Ümumi say | bütün sətirlərin cəmi, `1,284 qeyd` |
| Status | `YENİLƏNİR` / `TAMAMLANDI` / `OFLAYN REJİM` |

### Hazırda göstərilən 7 bölmə

Məhsullar, Alt kateqoriyalar, Kateqoriyalar, Masalar, Masa qrupları,
Ofisiantlar, Ödəniş üsulları.

### Proqram daha 5 bölmə verir, amma göstərilmir

`tags` (teqlər), `printers` (printerlər), `salesTypes` (satış növləri),
`rooms` (otel otaqları), `activeChecks` (açıq çeklər).

**Dizayner üçün sual:** 12 sətrin hamısı göstərilsin, yoxsa 7 qalsın?
12 olarsa pəncərə hündürlüyü artmalıdır (560 × 470 kifayət etməyəcək) və ya
sətirlər iki sütuna bölünməlidir. Otel otaqları yalnız otel müştərilərində
mənalıdır — sıfır olanda gizlətmək olar.

### Çəkilməli vəziyyətlər (hamısı lazımdır)

**1. Yüklənir**
Faiz artır, sətirlər bir-bir görünür (70 ms ara ilə), saylar yerində `——`.
Hər sətirdə ✓ yerinə boz nöqtə.

**2. Tamamlandı — onlayn**
Faiz 100%, bütün sətirlərdə ✓, saylar görünür, yeni gələnlərdə yaşıl `+N` nişanı.
Pəncərə ~1.5 saniyə sonra özü bağlanır (sətirlər bir-bir yuxarı "uçub" gedir).

**3. Tamamlandı — oflayn** ⚠ ayrıca vəziyyətdir
Server əlçatmaz olub, yalnız lokal məlumat göstərilir. Hazırda sarı rəngə keçir,
faiz yerinə `—` yazılır, ✓ əvəzinə boz nöqtə qalır və xəbərdarlıq sətri çıxır:
"İnternet yoxdur — lokal məlumatlar göstərilir".
**Bu, xəta deyil.** Kassa oflayn da tam işləyir. Dizayn qorxuducu olmamalıdır —
qırmızı, nida işarəsi, "XƏTA" sözü işlətmə. Sakit bir məlumatlandırma lazımdır.

**4. İlişmə (watchdog)**
20 saniyə ərzində cavab gəlməsə pəncərə özü bağlanır. Ayrıca ekran lazım deyil,
amma 10+ saniyə gözləyəndə "hələ işləyir" hissi verən bir şey faydalı olardı
(məsələn proqres zolağının sönüb-yanması).

### Animasiya haqqında

Hazırkı animasiyalar və vaxtları (saxlanıla da bilər, dəyişdirilə də):

```
sətirlərin görünməsi   70 ms ara ilə ardıcıl
bitəndən sonra gözləmə 500 ms
çıxış animasiyası      hər sətir 90 ms ara ilə, keçid 300 ms
bağlanmadan əvvəl      350 ms
yüklənmə proqresi      onlayn 1.6 san, oflayn 0.7 san-da 92%-ə çatır
```

**Məhdudiyyət:** kassa kompüterləri zəifdir. Kölgə, blur (`backdrop-filter`),
böyük qradiyent animasiyaları ağırlıq yaradır. Sadə `opacity` və `transform`
animasiyaları seçilsin.

---

## 6. Dizaynerdən gözlənilən fayllar

Hər ekran üçün:

1. **Normal ölçüdə maket** (440×280, tam ekran, 560×470 — dəqiq piksellərdə)
2. **Hər vəziyyət ayrıca** (yuxarıda 1–4 kimi nömrələnib)
3. **4 dildə ən uzun mətnlə yoxlanmış variant** (adətən rus dili)
4. Rəng, ölçü və boşluq dəyərləri (developer onları koda köçürəcək)
5. Animasiya üçün: nəyin, haradan-haraya, neçə ms — mətnlə yazılsa kifayətdir

İstifadə oluna bilən format: Figma (üstünlük verilir), və ya PNG + dəyərlər cədvəli.

---

## 7. Qərar verilməli suallar

Dizayna başlamazdan əvvəl bunlar cavablandırılmalıdır:

1. **Splash:** saxta proqres çıxarılsın (A) yoxsa real mərhələlərə bağlansın (B)?
2. **Daxili yüklənmə ekranı:** silinsin (A) yoxsa splash ilə eyniləşdirilsin (B)?
3. **Yeniləmə pəncərəsi:** 7 sətir qalsın, yoxsa 12-yə genişlənsin?
4. Yeniləmə pəncərəsində **bağlama düyməsi** olsun? Hazırda yoxdur — kassir
   gözləməyə məcburdur (maksimum 20 saniyə).
5. Pəncərələr **tünd rejim** dəstəkləməlidirmi? Hazırda yalnız açıq rejim var.

---

## 8. Toxunulmamalı şeylər

- Pəncərə ölçüləri koddan gəlir; dizayn onlara uyğunlaşmalıdır. Dəyişmək lazımdırsa
  əvvəlcə de — mən koddan dəyişərəm, sonra dizayn çəkilsin.
- Logo faylı dəyişmir (`logo-build.png`).
- Status mətnləri (`YENİLƏNİR`, `TAMAMLANDI`, `OFLAYN REJİM`) tərcümə sistemindən
  gəlir; sözləri dəyişmək olar, amma hər dildə qarşılığı verilməlidir.
