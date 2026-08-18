# POS Tərəfi Üçün İnteqrasiya Təlimatı: Taymer Məhsulları (Timer Products)

Salam. Admin paneldə və API tərəfində **Taymer (Timer)** tipli məhsullar üçün (playstation klubları, bilyard, otaqlar və s. üçün nəzərdə tutulan) yeni dinamik qiymətləndirmə sistemi əlavə edilib. Bu yeni funksionallığın POS (kassa) tərəfində hesablanması üçün aşağıdakı dəyişiklikləri nəzərə almağınız xahiş olunur.

## 1. Yeni Məlumat (Payload) Sahələri
API-dən gələn `Product` obyektinə (`product_type === 'timer'` olduqda) 2 yeni sahə əlavə olunub:

- `timer_intervals` **(Array | null)**: Dinamik qiymət intervallarını saxlayır. Boş və ya `null` ola bilər.
- `are_orders_included` **(Number: 0 | 1)**: `1` olduqda bu o deməkdir ki, taymer işləyən masa/otaqda verilən əlavə sifarişlərin (məsələn, çay, yemək) qiyməti müştəridən *alınmamalıdır* (sifarişlər taymer məbləğinə daxildir). `0` olduqda əlavə sifarişlər ayrıca hesablanıb ümumi məbləğə gəlməlidir.

## 2. `timer_intervals` Obyektinin Strukturu
Əgər istifadəçi fərqli intervallar əlavə edibsə, bu sahə aşağıdakı kimi bir massiv (array) şəklində gələcək:

```json
[
  {
    "duration": 15,  // İntervalın neçə dəqiqəni əhatə etdiyi
    "price": 5,      // Həmin interval üçün ödəniləcək məbləğ
    "after": 0       // Bu qaydanın neçənci dəqiqədən sonra qüvvəyə mindiyi
  },
  {
    "duration": 15,
    "price": 3,
    "after": 60
  }
]
```
**Nümunə ssenari (Yuxarıdakı dataya əsasən):**
- İlk 60 dəqiqə ərzində: Hər 15 dəqiqənin qiyməti 5 ₼ olaraq hesablanır.
- Müştəri 60 dəqiqəni (1 saatı) keçdikdən sonra: Qalan hər 15 dəqiqə üçün qiymət 3 ₼ olaraq hesablanır.

## 3. POS Tərəfində Qiymət Hesablama Məntiqi (Tövsiyə)

Hesab (Bill) bağlanarkən və ya cari vəziyyət göstərilərkən Taymer məhsulları üçün bu prioritet izlənməlidir:

1. Əgər `product.timer_intervals` mövcuddursa və içiboş deyilsə ( `length > 0` ): 
   - Müştərinin oturduğu ümumi dəqiqəni hesablayıb, onu `after` (dan sonra) şərtlərinə uyğunlaşdırıb uyğun intervalın `duration` (dəqiqə) addımları ilə bölərək yekun məbləği çıxartmaq lazımdır.
2. Əgər `product.timer_intervals` boşdursa və ya `null`-dursa:
   - O zaman sistem köhnə məntiqdəki kimi məhsulun sadə `hourly_price` (saatlıq qiymət) sahəsini yoxlamalı və hesabı adi qaydada saatlıq qiymətə görə vurmalıdır.

## 4. Əlavə Sifarişlər
Masa/Otaq daxilində məhsul vurularkən, ana məhsulun (`timer` tipli olan) `are_orders_included` dəyəri yoxlanılmalıdır:
- **Əgər `1` isə**: İçəriyə vurulan əlavə məhsulların (qəlyanaltı, çay və s.) qiyməti hesabda (çekdə) çap olunsa belə, YEKUN ödənişə (Total) əlavə edilməməli və ya 100% endirimli kimi tətbiq olunmalıdır.
- **Əgər `0` isə**: Normal qaydada taymer məbləği + əlavə sifarişlərin məbləği cəmlənməlidir.
