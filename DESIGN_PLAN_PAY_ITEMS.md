# UniPOS – "Məhsul üzrə ödəniş" paneli (dizayn planı)

Bu sənəd dizaynı hazırlayacaq şəxs/AI üçündür. Dizayn tətbiqin mövcud dizayn dilinə (Check, Pin, Tənzimləmələr ekranları) uyğun olmalıdır. Aşağıdakı rənglər və ölçülər hazırkı işləyən versiyadandır, məqsəd onları sənin dizaynınla əvəz etməkdir.

## 1. Məqsəd
Kassir açıq çekdən bəzi məhsulları (və ya məhsulun bir hissəsini) seçib **çeki bağlamadan** onlar üçün ödəniş alır. Ödənilən məhsullar çekdə "ödənilib" kimi görünür, çekin qalıq məbləği azalır, əməliyyat çek tarixçəsinə (log) düşür. Çek bağlananda yalnız qalıq ödənilir. Ödəniş bir və ya bir neçə ödəniş üsulu ilə (bölünmüş ödəniş) edilə bilər.

## 2. Giriş nöqtəsi
- Check ekranında **sol sidebar**-da yeni ikon: pul/kupür ikonu. Yalnız **açıq** çekdə görünür.
- Basanda **sağdan offcanvas panel** açılır, arxa fon qaralır. Panel bağlananda çek ekranı olduğu kimi qalır.

## 3. Panel: ölçü və struktur
- Sağdan açılır, eni ~440px, tam hündürlük. Mobil/kiçik ekranda tam en.
- Yuxarıdan aşağı:
  1. **Başlıq zolağı**: "Məhsul üzrə ödəniş", altında "Masa adı · #çek nömrəsi", sağda bağla (X) düyməsi.
  2. **İki xülasə kartı**: "Ödənilməmiş" (qalan məhsulların məbləği) və "Ödənilib" (yaşıl rəngli, əvvəl ödənilənlərin cəmi).
  3. **"Məhsulları seçin"** bölməsi, sağda "Hamısını seç" linki.
  4. **"Ödəniş üsulu"** bölməsi, sağda **"Böl"** açarı (toggle).
  5. (Yalnız "Böl" açıqdırsa) bölünmə kartı.
  6. **"Əvvəlki ödənişlər"** siyahısı (yalnız varsa).
  7. **Sabit alt zolaq**: solda "Ödəniləcək · N məhsul" və böyük məbləğ, sağda yaşıl **"Ödə"** düyməsi.
- Orta hissə scroll olur, başlıq və alt zolaq yerində qalır.

## 4. Elementlərin təsviri

### 4.1 Məhsul sətri (seçilə bilən kart)
- Solda seçim qutusu (checkbox), ortada məhsul adı (qalın) və altında "50.00 ₼ · qalıb 3" (qismən ödənilibsə "(ödənilib 1)").
- Sağda say seçici: `−  3  +` (böyük toxunma sahəsi, kassa ekranı üçün). Maksimum = qalan say.
- Seçilibsə: kart vurğulanır (kontur + açıq fon), məhsulun seçilən məbləği (məs. "150.00 ₼") sətrin sağ altında görünür.
- Kartın istənilən yerinə basmaq seçimi açıb-bağlayır (seçəndə say = qalan say).
- Çekdəki ikram (hədiyyə) məhsullar siyahıda göstərilmir.

### 4.2 Boş vəziyyət
Bütün məhsullar ödənilibsə: yaşıl ✓ ikonu və "Bütün məhsullar ödənilib" yazısı (nöqtəli konturlu boş kart).

### 4.3 Ödəniş üsulu düymələri
- İki sütunlu şəbəkə. Hər düymədə ikon + ad (Nağd, Bank, Wolt, Bolt və s.). İkon növə görə: nağd, kart/bank, digər.
- Tək rejimdə: bir üsul seçilir (aktiv düymə tünd/dolu).
- Yüklənərkən: "Yüklənir..." yazısı.

### 4.4 Bölünmüş ödəniş ("Böl" açıq)
- Üsul düymələrindən **bir neçəsini** seçmək olur.
- Altında kart: hər seçilən üsul üçün bir sətir, solda ad, sağda məbləğ xanası (rəqəm, sağa düzlənmiş, valyuta simvolu ilə).
- Bir xanaya yazanda qalıq avtomatik digər üsula keçir (iki üsulda). Cəm seçilən məhsulların cəminə bərabər olmalıdır.
- Xəbərdarlıqlar: "Bölmək üçün ən azı iki ödəniş üsulu seçin" (boz) və "Fərq: X ₼" (qırmızı, cəm uyğun deyilsə).
- "Ödə" düyməsi yalnız cəm dəqiq bərabər olanda aktivdir.

### 4.5 "Əvvəlki ödənişlər"
- Hər əməliyyat bir sətir: "150.00 ₼ · Bank" (bölünübsə "Nağd 60.00 + Bank 40.00"), altında məhsul siyahısı ("Meyve suyu x3").
- Sağda qırmızı konturlu **"Ləğv et"** düyməsi (ödənişi geri alır).

### 4.6 Alt zolaq
- Sol: "Ödəniləcək" etiketi (seçilibsə "· 2 məhsul"), altında böyük məbləğ.
- Sağ: yaşıl "Ödə" düyməsi. Deaktiv vəziyyət: boz. Ödəniş gedərkən "..." göstərir və təkrar basılmır.

## 5. Vəziyyətlər (hər biri üçün ayrıca dizayn lazımdır)
1. Ilkin: heç nə seçilməyib, "Ödə" deaktiv.
2. Məhsul seçilib, tək üsul.
3. Məhsul seçilib, bölünmüş rejim, məbləğlər uyğundur.
4. Bölünmüş rejim, məbləğ uyğun deyil (qırmızı "Fərq").
5. Ödəniş üsulları yüklənir.
6. Bütün məhsullar ödənilib (boş kart).
7. Əvvəlki ödənişlər siyahısı ilə.
8. Ödəniş gedir (loading).
9. Uğur/xəta bildirişi (toast): "150.00 ₼ ödənildi" / server xətası mətni.

## 6. Check ekranında dəyişikliklər (panelin xaricində, dizaynı da lazımdır)
1. **Məhsul sətri**: ödənilmiş məhsulun adının altında yaşıl yumru **"✓ Ödənilib"** nişanı. Qismən ödənilibsə "Ödənilib: 2 / 3". Bütün sətirlərdə nişan eyni yerdə (adın altında) olmalıdır.
2. **Alt xülasə** (mavi panel): "Ara cəm", "Servis haqqı", "Cəm" sətirlərindən sonra əlavə: **"Ödənilib: −312.00"** (ağ rəng) və qalın **"Qalıq: 31.20"**. Yalnız qismən ödəniş varsa görünür.
3. **Böyük bağlama düyməsi** (✓ 343.20) artıq **qalığı** göstərməlidir (31.20).
4. **Çek tarixçəsi (log)**: iki yeni əməliyyat adı: "Məhsul üzrə ödəniş" və "Məhsul ödənişi ləğv edildi". Təfərrüat: "Meyve suyu x3 — 100.00 ₼ (Nağd 60.00 + Bank 40.00)".
5. **Ödəniş ekranı (CheckOver)**: "Ödənilməli" artıq qalıqdır. Ekranda kiçik yaşıl xətt: "Məhsul üzrə əvvəl ödənilib: X ₼ (çekin cəmi Y ₼)".

## 7. Davranış qaydaları (dizayn bunu əks etdirməlidir)
- Ödənilmiş məhsul **kilidlənir**: silmək, sayını ödənilmişdən aşağı salmaq, ikram etmək, endirim və ya qiyməti dəyişmək olmur. Çeki ləğv etmək, bölmək və birləşdirmək də olmur. Səbəb: server "Bu çekdə məhsul üzrə ödəniş var. Əvvəlcə həmin ödənişi ləğv edin." mesajı qaytarır (bu mesaj üçün də dizayn: toast/modal).
- Hələ mətbəxə göndərilməmiş (yeni əlavə edilmiş) məhsullar ödənilə bilməz.
- Çekdəki sifariş səviyyəli endirim və servis haqqı məhsul üzrə ödənişə daxil deyil, qalığa keçir (məs. məhsullar 312.00 ödənilib, servis 31.20 qalıq qalır).

## 8. Real data sahələri (dizaynda nümunə məzmun üçün)
- Məhsul: ad, vahid qiymət, çekdəki say, ödənilmiş say, qalan say.
- Ödəniş üsulu: ad (Nağd, Bank, Wolt, Bolt), növ (nağd/kart/digər).
- Ödəniş əməliyyatı: məbləğ, üsul(lar) və hər üsulun payı, məhsul siyahısı (ad + say), operator.
- Valyuta simvolu tətbiq tənzimləməsindən gəlir (₼ və s.). Mətnlər Azərbaycan dilindədir.

## 9. Dizayn üçün qeydlər
- Əsas istifadə **sensor ekran** kassadır: toxunma sahələri böyük (min. ~44px), düymələr arası məsafə rahat.
- Rəng hiyerarxiyası: əsas hərəkət (Ödə) yaşıl, naviqasiya/seçim tünd mavi, xəbərdarlıq/ləğv qırmızı, "ödənilib" yaşıl.
- Panel açılanda/bağlananda qısa slide animasiyası. Sətir seçiləndə yumşaq keçid. Mürəkkəb effekt lazım deyil.
- Panel çek ekranının işini bloklamamalıdır: bağlamaq hər an mümkündür (X, arxa fona basmaq).
