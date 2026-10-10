/**
 * PERFORMANS İNDEKSLƏRİ
 * =====================
 *
 * NİYƏ AYRICA MODUL:
 * İndekslər əvvəl modellərin `indexes:` bölməsində elan olunmuşdu, lakin onları
 * yalnız `sequelize.sync({ alter })` yaradır — o da `shouldRunSchemaMigration()`
 * ilə qorunur və proqramın VERSİYASI dəyişməyincə ümumiyyətlə işləmir
 * ("[Schema] Versiya dəyişməyib — sxem migrasiyası ötürülür"). Nəticədə
 * indekslər heç vaxt yaranmırdı.
 *
 * Bu modul onları versiyadan asılı olmadan, HƏR AÇILIŞDA təmin edir:
 *   • əvvəlcə mövcud indeksləri bir sorğu ilə oxuyur (ucuz)
 *   • yalnız çatışmayanları yaradır (təkrar yaratmır)
 *   • xəta olsa proqramı dayandırmır, sadəcə loga yazır
 *
 * NİYƏ VACİBDİR:
 * Bu cədvəllərdə yalnız PRIMARY KEY indeksi vardı. Ən çox işlənən sorğular
 * (aktiv çeklər, sinxron sayğacları, çek jurnalı, ödənişlər) hər dəfə TAM
 * CƏDVƏL SKANI edirdi. Satış tarixçəsi böyüdükcə POS getdikcə daha çox donurdu.
 */

const db = require("./database/config");

/**
 * Hər yazı: [indeks adı, cədvəl, sütunlar, izah]
 * Adlar sabitdir — təkrar yaratmanın qarşısını almaq üçün onlara görə yoxlanılır.
 */
const INDEXES = [
  // Aktiv çeklər ekranı və masalar lövhəsi:
  // WHERE profile_id=? AND status=1 AND deleted_at IS NULL ORDER BY start_date DESC
  ["orders_profile_status_idx", "orders", ["profile_id", "status", "deleted_at"]],
  // Sinxron sayğacları (hər 8 saniyə) və sinxron dövrü (hər 2 saniyə)
  ["orders_profile_synced_idx", "orders", ["profile_id", "is_synced", "deleted_at"]],
  ["orders_synced_idx", "orders", ["is_synced"]],
  // Masaya görə çek axtarışı
  ["orders_table_status_idx", "orders", ["table_id", "status"]],
  // Hesabatlar və arxiv (tarix aralığı + sıralama)
  ["orders_profile_start_date_idx", "orders", ["profile_id", "start_date"]],
  ["orders_profile_created_at_idx", "orders", ["profile_id", "created_at"]],

  // Çek sətirləri: `separate: true` include → WHERE order_id IN (...)
  // `orders_items.order_id` sütunu TEXT tipindədir (həmişə 36 simvollu UUID saxlayır).
  // TEXT sütunu prefiks uzunluğu olmadan indekslənmir — 36 UUID-ni tam əhatə edir.
  ["orders_items_order_id_idx", "orders_items", ["order_id(36)", "deleted_at"]],
  ["orders_items_product_id_idx", "orders_items", ["product_id"]],

  // Çek jurnalı: çek detalı açılanda WHERE order_id=?
  ["order_logs_order_id_idx", "order_logs", ["order_id"]],

  // Ödənişlər: çek bağlananda və hesabatlarda
  ["order_payments_order_id_idx", "order_payments", ["order_id"]],
  ["order_payments_profile_created_idx", "order_payments", ["profile_id", "created_at"]],
  ["order_item_payments_order_id_idx", "order_item_payments", ["order_id"]],
  ["order_item_payments_item_idx", "order_item_payments", ["order_item_id"]],

  // Menyu yüklənməsi
  ["products_profile_idx", "products", ["profile_id", "deleted_at"]],
  ["products_category_idx", "products", ["category_id"]],

  // Masalar və zallar
  ["tables_profile_hall_idx", "tables", ["profile_id", "hall_id"]],

  // Növbə/smena
  ["sales_shifts_profile_status_idx", "sales_shifts", ["profile_id", "status"]],
];

/** Bazada hansı indekslər var — bir sorğu ilə */
async function readExisting() {
  const rows = await db.sequelize.query(
    `SELECT DISTINCT index_name AS n, table_name AS t
       FROM information_schema.statistics
      WHERE table_schema = DATABASE()`,
    { type: db.Sequelize.QueryTypes.SELECT },
  );
  const set = new Set();
  for (const r of rows) {
    // MariaDB sütun adlarının registri sürücüdən asılı ola bilər
    const name = r.n ?? r.index_name ?? r.INDEX_NAME;
    if (name) set.add(String(name).toLowerCase());
  }
  return set;
}

/** Cədvəl ümumiyyətlə varmı */
async function tableExists(name) {
  const rows = await db.sequelize.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = :t`,
    { type: db.Sequelize.QueryTypes.SELECT, replacements: { t: name } },
  );
  const c = rows[0]?.c ?? rows[0]?.C ?? 0;
  return Number(c) > 0;
}

/**
 * Çatışmayan indeksləri yaradır.
 * Proqramı HEÇ BİR HALDA dayandırmır — indeks yaranmasa POS sadəcə yavaş işləyir.
 */
async function ensurePerformanceIndexes() {
  try {
    const existing = await readExisting();
    const tableOk = new Map();
    let created = 0;
    let failed = 0;

    for (const [name, table, columns] of INDEXES) {
      if (existing.has(name.toLowerCase())) continue;

      if (!tableOk.has(table)) {
        tableOk.set(table, await tableExists(table).catch(() => false));
      }
      if (!tableOk.get(table)) continue;

      // "order_id(36)" şəklində prefiks uzunluğunu dəstəkləyirik (TEXT sütunlar üçün)
      const colList = columns
        .map((c) => {
          const m = /^(\w+)\((\d+)\)$/.exec(c);
          return m ? `\`${m[1]}\`(${m[2]})` : `\`${c}\``;
        })
        .join(", ");
      try {
        // Böyük cədvəldə bu bir dəfəlik olaraq bir qədər çəkə bilər
        await db.sequelize.query(
          `ALTER TABLE \`${table}\` ADD INDEX \`${name}\` (${colList})`,
        );
        created += 1;
        console.log(`[INDEX] Yaradıldı: ${table}(${columns.join(", ")})`);
      } catch (err) {
        const msg = err?.message || String(err);
        // Eyni adlı/eyni tərkibli indeks artıq varsa problem deyil
        if (/duplicate key name|already exists/i.test(msg)) continue;
        failed += 1;
        console.warn(`[INDEX] ${table}.${name} yaradıla bilmədi: ${msg}`);
      }
    }

    if (created > 0 || failed > 0) {
      console.log(
        `[INDEX] Tamamlandı — yaradıldı: ${created}, alınmadı: ${failed}`,
      );
    } else {
      console.log("[INDEX] Bütün performans indeksləri mövcuddur");
    }
  } catch (err) {
    console.warn(
      "[INDEX] İndeks yoxlaması aparıla bilmədi (POS işləməyə davam edir):",
      err?.message || err,
    );
  }
}

module.exports = { ensurePerformanceIndexes };
