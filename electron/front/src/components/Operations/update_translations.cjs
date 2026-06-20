const fs = require('fs');

const p = 'c:/Users/Jumshud/Desktop/POS-ReDesing/electron/front/src/utils/translations.json';
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

const keys = {
  'ceki_bol': { az: 'Çeki böl', en: 'Split check', ru: 'Разделить чек', tr: 'Adisyonu böl' },
  'emeliyyat_tarixcesi': { az: 'Əməliyyat Tarixçəsi', en: 'Operation History', ru: 'История операций', tr: 'İşlem Geçmişi' },
  'ceke_serh_yaz': { az: 'Çekə şərh yaz', en: 'Add comment', ru: 'Добавить комментарий', tr: 'Yorum ekle' },
  'musteri_bazasi': { az: 'Müştəri bazası', en: 'Customer base', ru: 'База клиентов', tr: 'Müşteri veri tabanı' },
  'ceki_temizleme': { az: 'Çeki təmizləmə', en: 'Clear check', ru: 'Очистить чек', tr: 'Adisyonu temizle' },
  'ceki_birlesdir': { az: 'Çeki birləşdir', en: 'Merge check', ru: 'Объединить чек', tr: 'Adisyonu birleştir' },
  'satis_usulunu_deyis': { az: 'Satış üsulunu dəyiş', en: 'Change sale type', ru: 'Изменить тип продажи', tr: 'Satış türünü değiştir' },
  'emekdas_deyis': { az: 'Əməkdaş dəyiş', en: 'Change staff', ru: 'Изменить сотрудника', tr: 'Personel değiştir' },
  'xidmet_haqqi_elave_et': { az: 'Xidmət haqqı əlavə et', en: 'Add service fee', ru: 'Добавить сервисный сбор', tr: 'Servis ücreti ekle' },
  'masani_deyis': { az: 'Masanı dəyiş', en: 'Change table', ru: 'Сменить стол', tr: 'Masayı değiştir' },
  'ceki_sil': { az: 'Çeki sil', en: 'Delete check', ru: 'Удалить чек', tr: 'Adisyonu sil' },
  'depozit': { az: 'Depozit', en: 'Deposit', ru: 'Депозит', tr: 'Depozit' },
  'qonaq_sayini_deyis': { az: 'Qonaq sayını dəyiş', en: 'Change guest count', ru: 'Изменить кол-во гостей', tr: 'Misafir sayısını değiştir' },
  'porsiya': { az: 'Porsiya', en: 'Portion', ru: 'Порция', tr: 'Porsiyon' },
  'qrup': { az: 'Qrup', en: 'Group', ru: 'Группа', tr: 'Grup' },
  'saat': { az: 'Saat', en: 'Hour', ru: 'Час', tr: 'Saat' },
  'say': { az: 'Say', en: 'Count', ru: 'Кол-во', tr: 'Sayı' },
  'sil': { az: 'Sil', en: 'Delete', ru: 'Удалить', tr: 'Sil' },
  'tarix': { az: 'Tarix', en: 'Date', ru: 'Дата', tr: 'Tarih' },
  'timer': { az: 'Timer', en: 'Timer', ru: 'Таймер', tr: 'Zamanlayıcı' }
};

for (const lang of ['az', 'en', 'ru', 'tr']) {
  if (!data[lang]) data[lang] = {};
  for (const [k, v] of Object.entries(keys)) {
    if (!data[lang][k]) {
      data[lang][k] = v[lang];
    }
  }
}

fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
console.log('Added missing keys to translations.json');
