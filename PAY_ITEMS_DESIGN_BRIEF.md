# UniPOS — "Məhsul üzrə ödəniş" paneli (dizayn brief-i)

Bu sənəd paneli YENİDƏN dizayn edəcək şəxs üçündür. Panel artıq kodda mövcuddur və işləkdir (funksionallıq hazırdır) — tələb olunan yalnız **vizual dizaynın yenilənməsidir**, funksionallıq dəyişmir.

## 1. Nədir, haradan açılır
Kassir açıq çekdən bəzi məhsulları (və ya məhsulun bir hissəsini) seçib, çeki bağlamadan onlar üçün ödəniş alır. Check ekranının sol sidebar-ında pul ikonuna basanda **sağdan slide olan panel (offcanvas)** açılır, arxa fon tutqunlaşır.

## 2. İstifadə mühiti (vacib)
- Kassa **toxunma ekranındadır** (touchscreen), siçan deyil barmaqla işlənir. Bütün kliklənən elementlər barmaq üçün rahat ölçüdə olmalıdır (minimum ~44–48px hündürlük).
- Ekranlar adətən 1080p/kiçik-orta monitor + toxunma overlay. Panel çox dar olmamalıdır — hazırkı en ~520px civarıdır, bundan aşağı düşməsin.
- Panel sağ tərəfdə, əsas çek ekranının üstündə açılır, tam hündürlükdə.

## 3. Hazırkı problem (niyə yenidən dizayn lazımdır)
- Məhsul seçim sətirləri və ödəniş üsulu düymələri **"kobud"** görünür — vizual zəriflik, incə detallar, rahat boşluq (padding/spacing) çatışmır.
- Əvvəlki versiyalar ya həddən artıq rəngli/qarışıq, ya da həddən artıq "flat və boş" alınıb. Tarazlıq tapılmayıb.
- Məqsəd: **sadə, təmiz, lakin "kobud" olmayan** — yəni minimal elementlər, amma hər elementin öz daxilində yaxşı tərtib olunmuş card/button görünüşü.

## 4. Marka rəngləri (BUNLAR DƏYİŞMƏZ QALMALIDIR)
- Əsas mavi (brend rəngi, bütün tətbiqdə istifadə olunur): **`#053796`**
- Uğur/Ödə rəngi (yaşıl): **`#10b981`**
- Xəbərdarlıq/Ləğv (qırmızı): mövcud tətbiqdəki qırmızı ton (məs. `#d64545` civarı) saxlanıla bilər.
- Mətn/neytral tonlar: tünd mavi-boz mətn (`#0a1e4d` civarı), açıq boz fon (`#f8f9fc` civarı) istifadə olunur, dəyişdirilə bilər.
- **Başqa mavi/yaşıl ton seçilməsin** — tətbiqin hər yerində `#053796` istifadə olunur, panel də bununla uyğun olmalıdır.

## 5. Panel strukturu (yuxarıdan aşağı)
1. **Başlıq zolağı**: "Məhsul üzrə ödəniş" başlığı, altında "Masa adı · #çek nömrəsi", sağda bağla (X) düyməsi.
2. **İki xülasə kartı**: "Ödənilməmiş" (qalan məbləğ) və "Ödənilib" (yaşıl, əvvəl ödənilənlərin cəmi).
3. **"Məhsulları seçin"** bölməsi, sağda "Hamısını seç" linki.
4. **Məhsul siyahısı** — hər sətir: checkbox + ad + "qiymət · qalıb N (ödənilib M)" + sağda sayğac (−/+) + seçilmiş məbləğ. **Bu hissə hazırda "kobud" görünən əsas yerdir — daha yaxşı card dizaynı, rahat boşluq, aydın seçili/seçilməyən fərqi lazımdır.**
5. **"Ödəniş üsulu"** bölməsi, sağda "Böl" açarı (toggle).
6. **Ödəniş üsulu düymələri** (Nağd, Bank, Wolt, Bolt və s.) — 2 sütunlu grid, ikon + ad. **Bu da hazırda "kobud" görünən yerdir — daha yaxşı button dizaynı (icon badge, seçili vəziyyətdə aydın dolu/vurğulanmış görünüş) lazımdır.**
7. (Yalnız "Böl" aktivdirsə) — bölünmə kartı: hər üsul üçün məbləğ xanası, cəm göstəricisi, fərq xəbərdarlığı.
8. **"Əvvəlki ödənişlər"** siyahısı (yalnız varsa) — hər biri: məbləğ + üsul + məhsul siyahısı + "Ləğv et" düyməsi.
9. **Sabit alt zolaq**: solda "Ödəniləcək · N məhsul" + böyük məbləğ, sağda yaşıl "Ödə" düyməsi.

Orta hissə scroll olur, başlıq və alt zolaq həmişə yerində qalır (sticky).

## 6. Vəziyyətlər (hər biri dizaynda nəzərə alınmalıdır)
1. Heç nə seçilməyib — "Ödə" deaktiv (boz).
2. Məhsul seçilib, tək ödəniş üsulu seçilib.
3. Bölünmüş rejim, məbləğlər düzgün bölünüb (cəm uyğundur).
4. Bölünmüş rejim, cəm uyğun deyil — qırmızı "Fərq: X ₼" xəbərdarlığı.
5. Ödəniş üsulları hələ yüklənir ("Yüklənir...").
6. Bütün məhsullar artıq ödənilib — boş vəziyyət (yaşıl ✓ ikon + mətn).
7. Əvvəlki ödənişlər siyahısı göstərilir.
8. Ödəniş gedir (loading, düymə "..." göstərir, təkrar basılmır).

## 7. Nəyə TOXUNULMASIN
- Funksionallıq, data strukturu, state idarəetməsi — dəyişmir, bu sırf vizual/CSS işidir.
- Komponent: `electron/front/src/components/Check/PayItemsOffcanvas.jsx` (JSX strukturu), stillər: `PayItemsOffcanvas.css`.
