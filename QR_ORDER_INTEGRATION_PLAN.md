# QR Sifarişi İnteqrasiyası — POS API Təlimatı

Bu sənəd QR menyudan gələn sifarişlərin UniPOS kassa sisteminə necə yazılacağını izah edir.
Burada yazılan format POS-un öz daxili iş axınının eynisidir — yəni bu qaydaya uyğun
göndərilən sifariş kassada adi sifariş kimi görünəcək.

> **Hansı yolu seçmək?**
> Razılaşdırılmış əsas yol **bulud socket**-idir (`QR_ORDER_SOCKET_PLAN.md`): kassa
> `http://46.224.8.157:35627/pos` namespace-inə özü qoşulur, sifariş `qr:order:new`
> hadisəsi ilə gəlir, POS onu özü bazaya yazır və mətbəxə çap edir. Bu halda
> **aşağıdaki HTTP sorğularını siz yazmırsınız** — POS edir. Sizdən tələb olunan
> yalnız socket hadisəsinin göndərilməsi və §5-dəki profil bayraqlarıdır.
>
> Aşağıdaki HTTP təlimatı iki hal üçündür: (a) restoran lokal şəbəkədə
> server-server inteqrasiya istəyirsə, (b) socket yolunu sazlayarkən müqayisə
> üçün. Hər iki halda format eynidir.

---

## 1. Ümumi məntiq

Sifariş **bir sorğu ilə yaradılmır**. İki addım var:

1. Boş çek başlığı yaradılır → cavabda `uuid` qayıdır
2. Məhsullar həmin `uuid`-ə əlavə edilir

Bu ardıcıllıq məcburidir. Məhsulları birinci addım olmadan göndərmək mümkün deyil.

### Baza ünvan

```
http://<master-terminal-ip>:55667/api
```

`<master-terminal-ip>` — restoranda master kassanın lokal şəbəkə IP-sidir (məs. `192.168.1.50`).
Port həmişə **55667**-dir.

### Autentifikasiya

**Hazırda API-də autentifikasiya yoxdur** və CORS bütün mənbələrə açıqdır (`origin: "*"`).

Bu o deməkdir ki, lokal şəbəkəyə çıxışı olan hər kəs sifariş yarada bilər.
İnteqrasiyanı **yalnız server-server** şəklində qurun: QR saytının brauzer kodu
birbaşa POS-a sorğu göndərməsin, sizin öz backend-iniz göndərsin.

---

## 2. Addım 1 — çek başlığı yaratmaq

### Masaya sifariş (restoran daxili)

```
POST /api/sale
Content-Type: application/json
```

```json
{
  "uuid": "a3f1c2d4-5b6e-47a8-9c01-2d3e4f5a6b7c",
  "profileId": 14,
  "tableId": 16,
  "hallId": 2,
  "waiterId": 1,
  "terminalId": "QR-01",
  "guestCount": 2,
  "sale_type": "dine_in",
  "status": 1,
  "is_selected": 1,
  "serviceType": "percent",
  "serviceValue": 5
}
```

### Masasız sifariş (gəl-götür, çatdırılma)

```
POST /api/other-sale
```

```json
{
  "uuid": "b7e2d1a0-3c4f-48d9-8e12-5a6b7c8d9e0f",
  "profileId": 14,
  "waiterId": 1,
  "terminalId": "QR-01",
  "sale_type": "gel-gotur",
  "status": 1,
  "is_selected": 1
}
```

### Sahələr

| Sahə | Tip | Məcburi | İzah |
|---|---|---|---|
| `profileId` | number | **bəli** | Müəssisənin id-si |
| `tableId` | number | **bəli** (`/sale` üçün) | `tables` cədvəlindəki id. QR kodunda bu saxlanmalıdır |
| `waiterId` | number | **bəli** | Aşağıdakı 5-ci bəndə baxın |
| `terminalId` | string | **bəli** | Aşağıdakı 5-ci bəndə baxın |
| `sale_type` | string | **bəli** (`/other-sale` üçün) | `"dine_in"`, `"gel-gotur"` və s. |
| `uuid` | string | xeyr, **amma göndərin** | Təkrar sifarişin qarşısını alır — 6-cı bəndə baxın |
| `hallId` | number | xeyr | Zal id-si. Verilməsə 0 |
| `guestCount` | number | xeyr | Qonaq sayı. Verilməsə 0 |
| `status` | number | xeyr | Həmişə `1` göndərin (açıq çek) |
| `is_selected` | number | xeyr | Həmişə `1` göndərin |
| `serviceType` | string | xeyr | `"percent"` və ya `"amount"` |
| `serviceValue` | number | xeyr | Servis haqqı dəyəri |
| `id` | number | **xeyr, göndərməyin** | Çek nömrəsi. Verməsəniz server özü təyin edir — belə daha təhlükəsizdir |

### Uğurlu cavab

```json
{
  "message": "success",
  "data": {
    "uuid": "a3f1c2d4-5b6e-47a8-9c01-2d3e4f5a6b7c",
    "id": 2779833,
    "table_id": 16,
    "profile_id": 14,
    "status": 1,
    "table": { "id": 16, "name": "Masa 5" },
    "waiter": { "id": 1, "name": "QR Sifariş" }
  },
  "count": 2779833
}
```

Növbəti addımda **`data.uuid`** dəyərini işlədəcəksiniz.

### Xəta cavabı

```json
{ "message": "false", "data": "Required fields missing (table, waiter, terminal, or profile)" }
```

HTTP 400 — məcburi sahələrdən biri çatışmır.
HTTP 500 — server və ya baza xətası, `data` sahəsində mesaj olur.

---

## 3. Addım 2 — məhsulları əlavə etmək

```
POST /api/orders-items/{uuid}/items
Content-Type: application/json
```

> **Diqqət:** URL-də **`uuid`** gedir, rəqəmli `id` yox.

```json
{
  "profileId": 14,
  "waiterId": 1,
  "productList": [
    {
      "product_id": 28155,
      "quantity": 2,
      "price": 3.50,
      "comment": "buzsuz",
      "portion_name": null,
      "modifiers": [
        { "id": 301, "name": "Lülə", "price": 0, "count": 1, "printer_details": [] }
      ]
    },
    {
      "product_id": 24517,
      "quantity": 1,
      "price": 12.00,
      "comment": null,
      "portion_name": null,
      "modifiers": null
    }
  ]
}
```

### Sətir sahələri

| Sahə | Tip | Məcburi | İzah |
|---|---|---|---|
| `product_id` | number | **bəli** | `products` cədvəlindəki id |
| `quantity` | number | xeyr | Verilməsə 1. `count` adı ilə də qəbul edilir |
| `price` | number | **bəli** | Vahid qiymət (bir ədədin qiyməti, cəm yox) |
| `modifiers` | array \| null | xeyr | **Massiv**, mətn yox — aşağıya baxın |
| `comment` | string \| null | xeyr | Müştərinin qeydi, çekdə və mətbəx çapında görünür |
| `portion_name` | string \| null | xeyr | Porsiya adı (məs. "yarım") |

### `modifiers` formatı

Bu sahə **massivdir**. `JSON.stringify` ETMƏYİN — bazadakı sütun `JSON` tipindədir
və Sequelize onu özü kodlayır. Mətn göndərsəniz ikiqat kodlanır və sütunda
`"[{...}]"` qalır, bu da POS-un oxuduğu formatla uyğun gəlmir.

Massivin strukturu:

```json
[
  { "id": 301, "name": "Lülə",  "price": 0,    "count": 1, "printer_details": [] },
  { "id": 300, "name": "Düyü",  "price": 1.50, "count": 2, "printer_details": [] }
]
```

| Sahə | İzah |
|---|---|
| `id` | Modifikator məhsulunun id-si |
| `name` | Adı (çekdə göstərilir) |
| `price` | **Bir ədədin** əlavə qiyməti. Pulsuzdursa `0` |
| `count` | Neçə ədəd |
| `printer_details` | Boş massiv göndərin — POS özü doldurur |

Modifikator yoxdursa `null` göndərin, boş massiv və ya `"[]"` yox.

**Məbləğ necə hesablanır:** `quantity × (price + modifikatorların price × count cəmi)`

Yuxarıdakı nümunədə: `2 × (3.50 + 0) = 7.00 ₼`

### Uğurlu cavab

Tam yenilənmiş sifariş obyekti qayıdır — içində bütün sətirlər və hesablanmış cəm olur.

### Xəta cavabı

```json
{ "message": "orderId or productList is empty!", "data": {} }
```

---

## 4. Menyunu oxumaq

Qiymətləri və məhsul id-lərini **hər dəfə POS-dan oxuyun**, QR tərəfində saxlamayın.

```
GET /api/menu/{profileId}/menu-with-categories
```

Cavabda kateqoriyalar və onların içində məhsullar gəlir. Hər məhsulda:

| Sahə | İzah |
|---|---|
| `id` | `product_id` kimi göndərəcəyiniz dəyər |
| `name` | Adı |
| `price` | Cari qiymət |
| `is_hidden_qr` | `1` olanları QR menyuda **göstərməyin** |
| `product_type` | `"timer"` olanları QR-dan satmayın (saatlıq hesablanır) |
| `modifier_groups` | Modifikator qrupları |

Masaların siyahısı:

```
GET /api/tables/{profileId}
```

---

## 5. QR üçün ofisiant, terminal və profil bayraqları

### Ofisiant — əl ilə yaratmaq lazım deyil

Admin panelində ofisiantın `is_qr_user` bayrağı varsa POS QR sifarişlərini **həmin
ofisiantın** adına yazır. Bu bayraq ofisiant siyahısı ilə birlikdə sinxronlaşır,
yəni sizdən yalnız `waiters` cavabında `is_qr_user` sahəsinin göndərilməsi lazımdır
(hazırda hər iki API onu qaytarır — yoxlanılıb).

Panelde heç bir ofisiant seçilməyibsə POS "QR Sifariş" adlı lokal ofisiantı **özü
yaradır**. Hansı halın baş verdiyini endpoint özü bildirir:

```
GET /api/qr/waiter-id/:profileId
→ { "message":"success", "data":{ "waiterId":2, "waiterName":"Jumshud", "source":"panel" } }
→ { "message":"success", "data":{ "waiterId":5, "waiterName":"QR Sifariş", "source":"local" } }
```

Terminal mətni sabitdir: **`"QR-01"`**. Bu, hesabatlarda QR sifarişlərini ayırd
etməyə imkan verir.

**Qeyd:** yuxarıdakı yalnız `is_qr_order_direct` rejiminə aiddir. `is_qr_order_manual`
rejimdə çek sifarişi bildirişlər bölməsindən **təsdiqləyən** ofisiantın adına yazılır,
`is_qr_user` nəzərə alınmır.

### Profil bayraqları — BUNLAR OLMADAN QR İŞLƏMİR

POS `profiles` cədvəlində iki bayraq oxuyur və rejimi onlara görə seçir:

| Bayraq | POS-un davranışı |
|---|---|
| `is_qr_order_direct = 1` | Masa QR-dan gəlir, sifariş birbaşa həmin masada yaranır, mətbəxə avtomatik çap olunur |
| `is_qr_order_manual = 1` | Sifariş bildirişlər bölməsinə düşür, səs çalınır, ofisiant təsdiqləyir və masa seçir |
| ikisi də `0` | QR qəbulu **söndürülüdür** — socket belə açılmır, gələn sifariş `rejected` qayıdır |
| ikisi də `1` | `manual` üstün tutulur (kassirin nəzarəti qalsın) |

Bu sahələri **bulud login cavabındaki `profile` obyektinə əlavə etməlisiniz**.
POS login cavabını olduğu kimi lokal bazaya yazır: sahə gəlmirsə `0` qalır və
restoran panelindən QR-ı aça bilməz. Sütunlar POS tərəfdə artıq hazırdır
(`TINYINT DEFAULT 0`), sizdən yalnız dəyərin göndərilməsi tələb olunur.

---

## 6. Təkrar sifarişin qarşısını almaq

Şəbəkə kəsildikdə sorğu POS-a çatıb cavabı itə bilər. Təkrar göndərsəniz **iki eyni çek** yaranar.

Bunun qarşısını almaq üçün:

- Hər sifariş üçün öz tərəfinizdə bir `uuid` yaradın və saxlayın
- Həmin `uuid`-i `POST /api/sale` sorğusunda göndərin
- Cavab gəlməsə eyni `uuid` ilə təkrar cəhd edin — yeni çek yaranmayacaq

`uuid` formatı: standart UUID v4 (`crypto.randomUUID()`).

---

## 7. Sifariş POS-a çatandan sonra nə olur

Məhsullar yazılan kimi server lokal şəbəkəyə iki siqnal yayımlayır:

- `table_updated` → kassa ekranında masa və çek dərhal yenilənir
- `kds_update_trigger` → mətbəx ekranı (KDS) varsa orada da görünür

### Kağız çap — socket yolunda avtomatikdir

**Socket yolunda** (razılaşdırılmış əsas yol) POS çapı özü edir, kassir "Göndər"
basmır. Hər sətir öz printerinə düşür: əvvəlcə məhsulun `printer_details`-inə,
yoxdursa kateqoriyanınkına baxılır, hər printerə ayrıca çap işi yaradılır.

- `direct` rejimdə: sifariş gələn kimi yazılır və çap olunur
- `manual` rejimdə: ofisiant təsdiqləyib masa seçəndən sonra yazılır və çap olunur

**Birbaşa HTTP yolunda** isə çap avtomatik getmir — sətirlər bazaya yazılır,
ekranlarda görünür, amma mətbəxə çapı kassir "Göndər" basanda olur.

---

## 8. Tam nümunə

```javascript
const BASE = "http://192.168.1.50:55667/api";
const PROFILE_ID = 14;
const QR_WAITER_ID = 1;
const QR_TERMINAL = "QR-01";

async function sendQrOrder({ tableId, hallId, guestCount, items }) {
  const uuid = crypto.randomUUID();

  // 1) Çek başlığı
  const head = await fetch(`${BASE}/sale`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uuid,
      profileId: PROFILE_ID,
      tableId,
      hallId,
      waiterId: QR_WAITER_ID,
      terminalId: QR_TERMINAL,
      guestCount,
      sale_type: "dine_in",
      status: 1,
      is_selected: 1,
    }),
  }).then((r) => r.json());

  if (head.message !== "success") {
    throw new Error("Çek yaradılmadı: " + head.data);
  }

  const orderUuid = head.data.uuid;

  // 2) Məhsullar
  const res = await fetch(`${BASE}/orders-items/${orderUuid}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profileId: PROFILE_ID,
      waiterId: QR_WAITER_ID,
      productList: items.map((it) => ({
        product_id: it.productId,
        quantity: it.qty,
        price: it.price,
        comment: it.note || null,
        portion_name: null,
        modifiers: it.modifiers?.length
          ? it.modifiers.map((m) => ({
              id: m.id,
              name: m.name,
              price: m.price || 0,
              count: m.count || 1,
              printer_details: [],
            }))
          : null,
      })),
    }),
  }).then((r) => r.json());

  return { orderUuid, checkNumber: head.count, result: res };
}
```

---

## 9. Yoxlama siyahısı

İnteqrasiyanı bitirməzdən əvvəl bunları yoxlayın:

- [ ] Qiymətlər QR tərəfdən deyil, POS menyusundan oxunur
- [ ] `is_hidden_qr = 1` olan məhsullar QR menyuda görünmür
- [ ] `product_type = "timer"` olan məhsullar QR-dan satılmır
- [ ] Hər sifarişdə `uuid` göndərilir və təkrar cəhddə eyni `uuid` işlənir
- [ ] `modifiers` **massiv** kimi göndərilir, mətn kimi yox
- [ ] `price` vahid qiymətdir, cəm deyil
- [ ] Sorğular sizin backend-dən gedir, brauzerdən yox
- [ ] Masa nömrəsi QR kodunda `tableId` kimi saxlanılır
- [ ] Login cavabındaki `profile` obyektində `is_qr_order_direct` / `is_qr_order_manual` göndərilir
- [ ] Ofisiant `GET /api/qr/waiter-id/:profileId`-dən alınır, bazada əl ilə yaradılmır
- [ ] `waiters` cavabında `is_qr_user` sahəsi göndərilir

---

## 10. Sual yarananda

Ən çox rast gəlinən üç səhv:

**"Required fields missing"** — `tableId`, `waiterId`, `terminalId` və ya `profileId` çatışmır.

**Məhsul çekdə görünür, amma qiymət səhvdir** — `price` sahəsinə cəm məbləğ göndərilib.
Orada **bir ədədin** qiyməti olmalıdır.

**Modifikatorlar səhv saxlanılır** — `modifiers` mətn kimi göndərilib. O, **massiv** olmalıdır.
Bazada `"[{...}]"` görünürsə (kənarda dırnaq var) məhz bu səhvdir.
