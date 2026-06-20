const fs = require('fs');
const p = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/utils/translations.json';
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

const logsToTranslate = {
  "Yeni sifariş yaradıldı (Check View)": { az: "Yeni sifariş yaradıldı", en: "New order created", ru: "Новый заказ создан", tr: "Yeni sipariş oluşturuldu" },
  "Yeni sifariş yaradıldı (Header)": { az: "Yeni sifariş yaradıldı", en: "New order created", ru: "Новый заказ создан", tr: "Yeni sipariş oluşturuldu" },
  "Yeni sifariş yaradıldı": { az: "Yeni sifariş yaradıldı", en: "New order created", ru: "Новый заказ создан", tr: "Yeni sipariş oluşturuldu" },
  "Çek çap edildi": { az: "Çek çap edildi", en: "Receipt printed", ru: "Чек распечатан", tr: "Adisyon yazdırıldı" },
  "Modifikator dəyişdirildi": { az: "Modifikator dəyişdirildi", en: "Modifier changed", ru: "Модификатор изменен", tr: "Değiştirici değiştirildi" },
  "Çek bağlandı": { az: "Çek bağlandı", en: "Receipt closed", ru: "Чек закрыт", tr: "Adisyon kapatıldı" },
  "Vergi çeki xətası": { az: "Vergi çeki xətası", en: "Tax receipt error", ru: "Ошибка налогового чека", tr: "Vergi fişi hatası" },
  "Vergi geri qaytarma": { az: "Vergi geri qaytarma", en: "Tax refund", ru: "Возврат налога", tr: "Vergi iadesi" },
  "Vergi geri qaytarma xətası": { az: "Vergi geri qaytarma xətası", en: "Tax refund error", ru: "Ошибка возврата налога", tr: "Vergi iadesi hatası" },
  "Vergi təkrar çap": { az: "Vergi təkrar çap", en: "Tax reprint", ru: "Повторная печать налога", tr: "Vergi tekrar yazdırma" },
  "Vergi təkrar çap xətası": { az: "Vergi təkrar çap xətası", en: "Tax reprint error", ru: "Ошибка повторной печати налога", tr: "Vergi tekrar yazdırma hatası" },
  "Vergi təkrar satış": { az: "Vergi təkrar satış", en: "Tax resale", ru: "Повторная продажа налога", tr: "Vergi tekrar satış" },
  "Vergi təkrar satış xətası": { az: "Vergi təkrar satış xətası", en: "Tax resale error", ru: "Ошибка повторной продажи налога", tr: "Vergi tekrar satış hatası" },
  "Yeni otaq sifarişi yaradıldı": { az: "Yeni otaq sifarişi yaradıldı", en: "New room order created", ru: "Новый заказ номера создан", tr: "Yeni oda siparişi oluşturuldu" },
  "Qonaq sayı dəyişdirildi": { az: "Qonaq sayı dəyişdirildi", en: "Guest count changed", ru: "Количество гостей изменено", tr: "Misafir sayısı değiştirildi" },
  "Miqdar dəyişdirildi": { az: "Miqdar dəyişdirildi", en: "Quantity changed", ru: "Количество изменено", tr: "Miktar değiştirildi" },
  "Məhsul əlavə edildi": { az: "Məhsul əlavə edildi", en: "Product added", ru: "Товар добавлен", tr: "Ürün eklendi" },
  "Məhsul əlavə edildi (Manual qiymət)": { az: "Məhsul əlavə edildi (Manual qiymət)", en: "Product added (Manual price)", ru: "Товар добавлен (Ручная цена)", tr: "Ürün eklendi (Manuel fiyat)" },
  "Məhsul əlavə edildi (Sərbəst say)": { az: "Məhsul əlavə edildi (Sərbəst say)", en: "Product added (Custom qty)", ru: "Товар добавлен (Свободное кол-во)", tr: "Ürün eklendi (Serbest miktar)" },
  "Məhsul əlavə edildi (Modifikatorlarla)": { az: "Məhsul əlavə edildi (Modifikatorlarla)", en: "Product added (With modifiers)", ru: "Товар добавлен (С модификаторами)", tr: "Ürün eklendi (Modifiye edicilerle)" },
  "Məhsul əlavə edildi (Porsiya)": { az: "Məhsul əlavə edildi (Porsiya)", en: "Product added (Portion)", ru: "Товар добавлен (Порция)", tr: "Ürün eklendi (Porsiyon)" },
  "Çek geri qaytarma": { az: "Çek geri qaytarma", en: "Receipt refund", ru: "Возврат чека", tr: "Adisyon iadesi" },
  "Sifariş göndərildi": { az: "Sifariş göndərildi", en: "Order sent", ru: "Заказ отправлен", tr: "Sipariş gönderildi" },
  "Endirim dəyişildi": { az: "Endirim dəyişildi", en: "Discount changed", ru: "Скидка изменена", tr: "İndirim değiştirildi" },
  "Servis haqqı dəyişildi": { az: "Servis haqqı dəyişildi", en: "Service fee changed", ru: "Сервисный сбор изменен", tr: "Servis ücreti değiştirildi" },
  "Çek yenidən açıldı": { az: "Çek yenidən açıldı", en: "Receipt reopened", ru: "Чек открыт заново", tr: "Adisyon yeniden açıldı" },
  "Masa dəyişildi": { az: "Masa dəyişildi", en: "Table changed", ru: "Стол изменен", tr: "Masa değiştirildi" },
  "Məhsul silindi": { az: "Məhsul silindi", en: "Product deleted", ru: "Товар удален", tr: "Ürün silindi" },
  "Məhsullar silindi": { az: "Məhsullar silindi", en: "Products deleted", ru: "Товары удалены", tr: "Ürünler silindi" },
  "Çeklər birləşdirildi": { az: "Çeklər birləşdirildi", en: "Receipts merged", ru: "Чеки объединены", tr: "Adisyonlar birleştirildi" },
  "Satış növü dəyişildi": { az: "Satış növü dəyişildi", en: "Sale type changed", ru: "Тип продажи изменен", tr: "Satış türü değiştirildi" },
  "Ofisiant dəyişildi": { az: "Ofisiant dəyişildi", en: "Waiter changed", ru: "Официант изменен", tr: "Garson değiştirildi" },
  "Məhsul köçürüldü": { az: "Məhsul köçürüldü", en: "Product transferred", ru: "Товар перемещен", tr: "Ürün taşındı" },
  "Məhsul qəbul edildi": { az: "Məhsul qəbul edildi", en: "Product received", ru: "Товар принят", tr: "Ürün kabul edildi" },
  "Müştəri təyin edildi": { az: "Müştəri təyin edildi", en: "Customer assigned", ru: "Клиент назначен", tr: "Müşteri atandı" },
  "Müştəri silindi": { az: "Müştəri silindi", en: "Customer deleted", ru: "Клиент удален", tr: "Müşteri silindi" },
  "Hədiyyə verildi": { az: "Hədiyyə verildi", en: "Gift given", ru: "Подарок выдан", tr: "Hediye verildi" },
  "Hədiyyə ləğv edildi": { az: "Hədiyyə ləğv edildi", en: "Gift cancelled", ru: "Подарок отменен", tr: "Hediye iptal edildi" },
  "Məhsula endirim": { az: "Məhsula endirim", en: "Product discount", ru: "Скидка на товар", tr: "Ürüne indirim" },
  "Çek silindi": { az: "Çek silindi", en: "Receipt deleted", ru: "Чек удален", tr: "Adisyon silindi" },
  "Qiymət dəyişdirildi": { az: "Qiymət dəyişdirildi", en: "Price changed", ru: "Цена изменена", tr: "Fiyat değiştirildi" },
  "Ödənişsiz bağlandı": { az: "Ödənişsiz bağlandı", en: "Closed unpaid", ru: "Закрыто без оплаты", tr: "Ödemesiz kapatıldı" },
  "Ödəniş edildi": { az: "Ödəniş edildi", en: "Paid", ru: "Оплачено", tr: "Ödendi" },
  "Kuryer təyin edildi": { az: "Kuryer təyin edildi", en: "Courier assigned", ru: "Курьер назначен", tr: "Kurye atandı" },
  "Depozit verildi": { az: "Depozit verildi", en: "Deposit given", ru: "Внесен депозит", tr: "Depozito verildi" },
  "Mətbəx Çapı": { az: "Mətbəx Çapı", en: "Kitchen Print", ru: "Кухонная печать", tr: "Mutfak Baskısı" },
  "Mətbəx Çapı Xətası": { az: "Mətbəx Çapı Xətası", en: "Kitchen Print Error", ru: "Ошибка кухонной печати", tr: "Mutfak Baskı Hatası" },
  "Müştəri Çapı Xətası": { az: "Müştəri Çapı Xətası", en: "Customer Print Error", ru: "Ошибка печати клиента", tr: "Müşteri Baskı Hatası" },
  "cek_tarixcesi": { az: "Çek tarixçəsi", en: "Receipt history", ru: "История чека", tr: "Adisyon geçmişi" },
  "hele_ki_hec_bir_emeliyyat_yoxdur": { az: "Hələ ki, heç bir əməliyyat yoxdur.", en: "No operations yet.", ru: "Пока нет операций.", tr: "Henüz bir işlem yok." },
  "emeliyyat": { az: "Əməliyyat", en: "Operation", ru: "Операция", tr: "İşlem" }
};

for (const lang of ['az', 'en', 'ru', 'tr']) {
  if (!data[lang]) data[lang] = {};
  for (const [k, v] of Object.entries(logsToTranslate)) {
    data[lang][k] = v[lang];
  }
}

fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
console.log('Added log translations to translations.json');
