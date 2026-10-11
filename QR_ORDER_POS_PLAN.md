# QR Sifarişi — POS Tərəfi İcra Planı

Bu sənəd bulud komandasının `QR_ORDER_SOCKET_PLAN.md` sənədinə POS tərəfindən cavabdır.
Orada 6-cı bənddə sadalanan işlərin POS-da necə qurulacağını və 6.6-dakı suallara cavabı
əhatə edir.

İki iş rejimi var və onlar **profil parametri** ilə idarə olunur:

| Parametr | Davranış |
|---|---|
| `is_qr_order_direct` | Masa QR-dan gəlir, sifariş birbaşa həmin masada yaranır, mətbəxə avtomatik çap olunur. Kassir müdaxilə etmir |
| `is_qr_order_manual` | Sifariş bildirişlər bölməsinə düşür, səs çalınır, ofisiant masa seçib təsdiqləyir, sonra çap olunur |

Bu iki parametr bir-birini istisna edir. İkisi də sönülüdürsə QR sifarişi qəbul edilmir.

---

## 1. Bazaya əlavə olunacaq sahələr

`profiles` cədvəlinə iki sahə:

```sql
ALTER TABLE profiles ADD COLUMN is_qr_order_direct TINYINT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN is_qr_order_manual TINYINT DEFAULT 0;
```

Bu sahələr admin paneldən idarə olunur və POS-a `authResult.data.profile` içində gəlir.
Socket payload-undakı `mode` sahəsi ilə uyğunlaşdırılır:

| Socket `mode` | POS parametri |
|---|---|
| `"direct"` | `is_qr_order_direct = 1` |
| `"manual"` | `is_qr_order_manual = 1` |

Uyğunsuzluq olarsa (məsələn bulud `direct` göndərir, amma POS-da `is_qr_order_manual` aktivdir),
**POS-un parametri üstün tutulur** və sifariş manual axına düşür. Belə halda loga xəbərdarlıq yazılır.

---

## 2. Socket klienti

Yeni fayl: `electron/front/src/utils/qrSocket.js`

Mövcud `apiConfig.js`-dəki socket məntiqindən ayrı saxlanılır, çünki bu, **buluda** qoşulur,
lokal master-ə yox.

```javascript
import { io } from "socket.io-client";

let qrSocket = null;

export function initQrSocket({ restaurantName, terminalId, terminalPassword, onNewOrder }) {
  if (qrSocket) return qrSocket;

  qrSocket = io(`${QR_API_BASE}/pos`, {
    auth: { restaurantName, terminalId, terminalPassword },
    transports: ["websocket"],
    reconnection: true,
  });

  qrSocket.on("qr:ready", ({ profileId, isMaster }) => {
    // isMaster = false olsa sifariş gəlməyəcək, sadəcə qoşulu qalır
  });

  qrSocket.on("qr:order:new", (order, ack) => {
    // 1) Dərhal ack — bu, "yaddaşa aldım" deməkdir, təsdiq deyil
    try { ack?.({ ok: true }); } catch { /* nəzərə alınmır */ }
    // 2) Təkrarı at, sonra emal et
    onNewOrder?.(order);
  });

  return qrSocket;
}

export function sendQrStatus(payload) {
  return qrSocket?.timeout(5000).emitWithAck("qr:order:status", payload);
}
```

Qoşulma yeri: `App.jsx` içində, giriş olandan sonra. Yalnız master terminalda qoşulmaq
lazım deyil — bulud özü `isMaster` yoxlayır və sifarişi yalnız master-ə göndərir.

### Təkrarın qarşısı

Bulud ack gəlməyəndə **eyni `orderUuid` ilə** təkrar göndərir. Ona görə emal etməzdən əvvəl:

```javascript
const KEY = "pos_qr_handled_uuids";
function alreadyHandled(uuid) {
  const list = JSON.parse(localStorage.getItem(KEY) || "[]");
  if (list.includes(uuid)) return true;
  list.push(uuid);
  // son 200-ü saxla
  localStorage.setItem(KEY, JSON.stringify(list.slice(-200)));
  return false;
}
```

---

## 3. `direct` rejimi — masaya birbaşa yazmaq

Socket payload-unda `tableId` və `hallId` onsuz da gəlir, ona görə kassir müdaxiləsi yoxdur.

### Addımlar

1. **Masada açıq çek varmı yoxla** (6.6-cı sualın cavabı — aşağıya bax)
2. Yoxdursa `POST /api/sale` ilə yeni çek aç, `uuid = orderUuid`
3. `POST /api/orders-items/{uuid}/items` ilə məhsulları yaz
4. **Mətbəxə avtomatik çap et**
5. `qr:order:status` → `accepted` + `checkId` göndər

### Çap hissəsi — ən vacib fərq

Normal axında çapı kassir "Göndər" düyməsinə basanda edir. QR `direct` rejimində kassir yoxdur,
ona görə çap kodu proqramatik çağırılmalıdır. Mövcud funksiya olduğu kimi işlənir:

```javascript
import { processAndPrintOrders } from "../utils/printerHelpers";

processAndPrintOrders(
  itemsForPrinting,       // QR sifarişinin sətirləri
  printContext,           // çek başlığı: uuid, masa adı, zal adı, ofisiant, çek nömrəsi
  menuDataWithCategories  // Redux-dakı menyu
);
```

`processAndPrintOrders` yönləndirməni **özü** edir: hər sətir üçün əvvəlcə məhsulun
`printer_details`-inə, yoxdursa kateqoriyanın `printer_details`-inə baxır və hər printerə
ayrıca çap işi yaradır. Yəni "hamısından öz zalına və masasına düşsün" tələbi əlavə kod
tələb etmir — mövcud yönləndirmə bunu onsuz da edir.

`printContext` içində masa və zal adı düzgün verilməlidir ki, çap edilən kağızda görünsün:

```javascript
const printContext = {
  uuid: orderUuid,
  id: checkId,
  table: { id: tableId, name: tableName, hall_id: hallId },
  hall: { id: hallId, name: hallName },
  waiter: { id: waiterId, name: waiterName },   // panelde seçilmiş və ya təsdiqləyən ofisiant
  sale_type: "dine_in",
  guest_count: guestCount ?? 0,
  note: note || null,
};
```

### Çap uğursuz olarsa

Sifariş onsuz da bazaya yazılıb, ona görə statusu yenə `accepted` göndərin. Çap xətası ayrıca
bildiriş kimi göstərilsin:

```javascript
addNotification(
  "QR sifarişi çap olunmadı",
  `${tableName} — mətbəx printeri cavab vermir`,
  { type: "error", category: "printer", orderId: orderUuid }
);
```

---

## 4. `manual` rejimi — bildiriş, səs, masa seçimi

### 4.1 Bildirişlər bölməsinə düşmək

Mövcud `notificationService` işlənir, amma yeni kateqoriya ilə:

```javascript
import { addNotification } from "../utils/notificationService";

addNotification(
  "Yeni QR sifarişi",
  `${order.tableName || "Masa seçilməyib"} — ${order.items.length} məhsul, ${order.total} ₼`,
  {
    type: "info",
    category: "qr_order",      // YENİ kateqoriya
    orderId: order.orderUuid,
    dedupeKey: `qr-${order.orderUuid}`,
  }
);
```

Sifarişin tam məzmunu ayrıca saxlanılır, çünki bildiriş obyekti yalnız mətn saxlayır:

```javascript
localStorage.setItem(`pos_qr_pending_${order.orderUuid}`, JSON.stringify(order));
```

### 4.2 Bildiriş səsi

Hazırda `notificationService`-də səs yoxdur. `KitchenDisplay.jsx:53`-də işləyən beep var —
o kod ortaq faylа çıxarılır: `electron/front/src/utils/notificationSound.js`

```javascript
export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch { /* səs çalına bilmədi — kritik deyil */ }
}
```

Səs faylı lazım deyil, brauzerin öz səs mühərriki işlənir. KitchenDisplay də həmin ortaq
funksiyaya keçirilir ki, iki yerdə eyni kod qalmasın.

QR sifarişi gələndə səs **üç dəfə** təkrarlanır (1 saniyə ara ilə), çünki kassir ekranın
yanında olmaya bilər. Təkrar sayı parametr kimi saxlanılır.

### 4.3 Bildirişlər panelində görünüş

`NotificationSidebar.jsx` içində `category === "qr_order"` olan bildirişlər fərqli göstərilir:

- Sol tərəfdə QR ikonu və narıncı zolaq
- Altında **iki düymə**: `Qəbul et` (yaşıl) və `Rədd et` (qırmızı)
- Oxunmuş sayılsa belə sifariş emal olunmayınca siyahıda qalır

### 4.4 Masa seçimi

`Qəbul et` basılanda masa seçmə modalı açılır. **Yeni modal yazmağa ehtiyac yoxdur** —
`components/SlpitOrderModa/SplitTableSelect.jsx` artıq tam uyğundur:

```javascript
<SplitTableSelect
  show={showTablePicker}
  onClose={() => setShowTablePicker(false)}
  onSelect={(table) => {
    // table: { id, name, hall_id, hall_name, ... }
    acceptQrOrder(pendingOrder, table);
  }}
/>
```

QR-dan masa gəlmişsə (`order.tableId`), modal həmin masanı **əvvəlcədən seçilmiş** göstərir,
amma ofisiant dəyişə bilər. Masa gəlməyibsə (`tableId = 0`) seçim məcburidir.

### 4.5 Qəbul etdikdən sonra

`direct` rejimindəki eyni axın işləyir: çek yarat → məhsulları yaz → **mətbəxə çap et** →
`accepted` göndər.

Fərq yalnız masanın mənbəyindədir: `direct`-də QR-dan, `manual`-da ofisiantın seçdiyi.

### 4.6 Rədd etmək

`Rədd et` basılanda qısa səbəb siyahısı açılır (məhsul bitib, masa dolu, digər), sonra:

```javascript
await sendQrStatus({ orderUuid, status: "rejected", reason });
localStorage.removeItem(`pos_qr_pending_${orderUuid}`);
```

Çek yaradılmır.

---

## 5. Ortaq hissə — sifarişi bazaya yazmaq

Hər iki rejim bu funksiyanı çağırır: `electron/front/src/utils/qrOrderIntake.js`

```javascript
export async function writeQrOrderToPos(order, table, profile) {
  // `manual` rejimdə təsdiqləyən ofisiant, `direct`-də panelde seçilmiş (bax: 6-cı bənd)
  const waiterId = waiter?.id || (await resolveQrWaiter(profile.id)).id;
  const terminalId = "QR-01";

  // 1) Çek
  const head = await api.post("/sale", {
    uuid: order.orderUuid,
    profileId: profile.id,
    tableId: table.id,
    hallId: table.hall_id ?? 0,
    waiterId,
    terminalId,
    guestCount: order.guestCount ?? 0,
    sale_type: "dine_in",
    status: 1,
    is_selected: 1,
  });

  const orderUuid = head.data?.data?.uuid;
  const checkId = head.data?.count;

  // 2) Məhsullar — QİYMƏT POS-UN ÖZ BAZASINDAN
  const productList = order.items.map((it) => {
    const local = findMenuItemById(menuCatalog, it.product_id);
    return {
      product_id: it.product_id,
      quantity: it.quantity,
      price: Number(local?.price ?? it.price),   // lokal qiymət üstündür
      comment: it.comment || null,
      portion_name: it.portion_name || null,
      // `orders_items.modifiers` JSON sütunudur — MASSİV verilir, stringify yox
      modifiers: it.modifiers?.length ? it.modifiers : null,
    };
  });

  await api.post(`/orders-items/${orderUuid}/items`, {
    profileId: profile.id,
    waiterId,
    productList,
  });

  return { orderUuid, checkId };
}
```

### Qiymət fərqi

Bulud qiyməti qonağın gördüyü qiymətdir. POS öz bazasındakı cari qiyməti yazır.
Fərq varsa:

- `manual` rejimdə masa seçmə ekranında xəbərdarlıq göstərilir: "2 məhsulun qiyməti dəyişib"
- `direct` rejimdə sakitcə lokal qiymət yazılır və loga qeyd düşür

---

## 6. QR sifarişinin ofisiantı

`POST /api/sale` `waiterId` sahəsini məcburi tələb edir. Ofisiant rejimdən asılı
olaraq fərqli yerdən gəlir:

| Rejim | Çekə düşən ofisiant |
|---|---|
| `direct` | Admin panelində `is_qr_user = 1` seçilmiş ofisiant |
| `direct`, panelde seçim yoxdursa | "QR Sifariş" adlı lokal ofisiant (POS özü yaradır) |
| `manual` | Bildirişi **təsdiqləyən** ofisiant — satış onun hesabatına düşsün |

### `is_qr_user` — admin paneldən gələn bayraq

`waiters` cədvəlində `is_qr_user` sütunu var və ofisiant siyahısı ilə birlikdə
API-dən sinxronlaşır. Hər iki mənbə onu qaytarır:

- `GET http://46.224.8.157:35627/api/waiters/:profileId` (V1)
- `GET https://api.unipos.tech/api/waiters?profile_id=...` (V2)

Sinxronizasiya `data/WaitersData.js`-dədir və sahələri `WaitersModel.rawAttributes`-ə
görə süzür, yəni sütun modelə əlavə olunduğu üçün avtomatik yazılır. Lokal sütun
`app.js`-dəki `ensureSchemaColumns()` ilə təmin edilir (hər açılışda işləyir).

### Seçim necə aparılır

`services/QrWaiterService.js` → `resolveQrWaiter(profileId)`:

```javascript
// 1) Panelde seçilmiş ofisiant
const chosen = await WaitersModel.findOne({
  where: { profile_id: pid, is_qr_user: 1 },
  order: [["id", "ASC"]],
});
if (chosen) return { id: chosen.id, name: chosen.name, source: "panel" };

// 2) Ehtiyat: lokal "QR Sifariş" ofisiantı (yoxdursa yaradılır, is_local = 1)
```

Endpoint:

```
GET /api/qr/waiter-id/:profileId
→ { "message":"success", "data":{ "waiterId":2, "waiterName":"Jumshud", "source":"panel" } }
```

`source` sahəsi panelde seçim olub-olmadığını bildirir — sazlamada faydalıdır.

### Keşləmə

Servisdə **60 saniyəlik** keş var; `data/WaitersData.js` sinxronizasiyadan sonra
`clearQrWaiterCache()` çağırır. Frontend nəticəni `localStorage`-də SAXLAMIR:
əvvəl saxlayırdı və panelde seçim dəyişəndə POS köhnə ofisiantı işlətməyə davam
edirdi. Sorğu indeksli olduğu üçün hər sifarişdə çağırmaq baha deyil.

### `manual` rejimdə

`qrOrderManager.acceptQrOrder` cari ofisianti `ctx.getLoginedWaiter()` ilə oxuyur
(mənbə: `WaitersSlice.loginedWaiter`) və `writeQrOrderToPos`-a `waiter` olaraq
verir. Həmin halda `resolveQrWaiter` heç çağırılmır. Ofisiant tapılmasa (giriş
PIN-siz edilibsə) QR ofisiantına qayıdılır.

`is_local: 1` qoyulan lokal ofisiant admin panelin siyahısını çirkləndirmir və
sinxronizasiya onu silmir (`is_local: { [Op.ne]: 1 }` şərti).

---

## 7. Bulud komandasının suallarına cavab (6.6)

### Sual 1 — masada artıq açıq çek varsa?

**Mövcud çekə əlavə olunsun.** Sizin təklifinizlə razıyıq.

Səbəb: masada oturan qonaq əvvəl ofisiantla sifariş verib, sonra QR-dan əlavə edirsə, iki ayrı
çek açılması ödənişdə qarışıqlıq yaradır.

POS tərəfində məntiq:

```javascript
const existing = activeOrders.find(
  (o) => Number(o.table_id) === Number(table.id) && Number(o.status) === 1
);

if (existing) {
  // Yeni çek AÇMA — birbaşa mövcud çekə məhsul əlavə et
  await api.post(`/orders-items/${existing.uuid}/items`, { ... });
  checkId = existing.id;
} else {
  // Yeni çek aç
}
```

**Vacib nəticə:** bu halda `orderUuid` çek uuid-i kimi işlənmir, çünki çek artıq var.
Təkrarın qarşısını almaq üçün `orderUuid` ayrıca `pos_qr_handled_uuids` siyahısında saxlanılır
(2-ci bəndə bax). Statusda `checkId` kimi mövcud çekin nömrəsi göndərilir.

### Sual 2 — `orders-items` təkrar göndərilsə məhsullar ikiqat yazılırmı?

**Bəli, ikiqat yazılır.** Endpoint-də təkrar yoxlaması yoxdur, hər çağırış yeni sətirlər yaradır.

Ona görə təkrarın qarşısı POS tərəfində `orderUuid` ilə alınır. Sizin ack mexanizminiz +
bizim `pos_qr_handled_uuids` siyahısı birlikdə kifayətdir.

Əlavə qoruma kimi backend-ə `orders-items` üçün idempotency açarı əlavə etmək olar, amma
bu, cari axın üçün zəruri deyil.

### Sual 3 — `:55667` API-sinin autentifikasiyası

Haqlısınız, bu real problemdir. Hazırda API-də nə token var, nə də açar; CORS da `origin: "*"`-dir.
Qonaq Wi-Fi-ına qoşulan hər kəs çek aça bilər.

Sizin axınınız ona toxunmur (bulud → socket → POS), amma biz bunu ayrıca iş kimi planlaşdırırıq.
Bu inteqrasiyanın şərti deyil.

---

## 8. Görüləcək işlərin siyahısı

| # | İş | Fayl |
|---|---|---|
| 1 | `is_qr_order_direct` / `is_qr_order_manual` sahələri | `backend/app.js` sxem migrasiyası |
| 2 | Socket klienti | `front/src/utils/qrSocket.js` (yeni) |
| 3 | Socket-in açılışda qoşulması | `front/src/App.jsx` |
| 4 | Təkrar yoxlaması | `qrSocket.js` |
| 5 | Ortaq səs funksiyası | `front/src/utils/notificationSound.js` (yeni) |
| 6 | KitchenDisplay-i ortaq səsə keçirmək | `components/Kitchen/KitchenDisplay.jsx` |
| 7 | `qr_order` kateqoriyası və düymələr | `components/NotificationSidebar/NotificationSidebar.jsx` |
| 8 | Masa seçimi (mövcud modal) | `components/SlpitOrderModa/SplitTableSelect.jsx` |
| 9 | Sifarişi bazaya yazmaq | `front/src/utils/qrOrderIntake.js` (yeni) |
| 10 | Avtomatik mətbəx çapı | `utils/printerHelpers.js` — mövcud funksiya |
| 11 | QR ofisiantının seçilməsi (`is_qr_user`) və ehtiyat yaradılması | `backend/services/QrWaiterService.js` |
| 11b | Ofisiant id-sini frontend-ə ötürmək | `backend/router/AppRouter.js` (kiçik yeni endpoint) |
| 12 | Status göndərmək | `qrSocket.js` |

Mövcud kodda hazır olanlar: çap yönləndirməsi, masa seçmə modalı, bildiriş servisi, beep səsi.
Sıfırdan yazılacaq: socket klienti, qəbul axını, bildiriş panelindəki düymələr.

---

## 9. Yoxlama siyahısı

- [ ] `direct`: QR-dan sifariş gəlir, masada çek yaranır, mətbəxə **özü** çap olunur
- [ ] `direct`: hər məhsul öz kateqoriyasının printerinə düşür
- [ ] `manual`: bildirişlər bölməsində görünür və **səs çalınır**
- [ ] `manual`: Qəbul et → masa seçmə modalı → çek yaranır → çap olunur
- [ ] `manual`: Rədd et → səbəb seçilir → çek yaranmır
- [ ] Masada açıq çek varsa yeni çek açılmır, mövcuduna əlavə olunur
- [ ] Eyni `orderUuid` iki dəfə gələndə ikinci dəfə emal olunmur
- [ ] Çekə POS-un öz bazasındakı qiymət yazılır
- [ ] "QR Sifariş" ofisiantı avtomatik yaranır, admin panelə sinxronlaşmır
- [ ] Hər nəticə üçün `qr:order:status` göndərilir
- [ ] Çap uğursuz olsa belə status `accepted` gedir və xəta bildiriş kimi görünür
