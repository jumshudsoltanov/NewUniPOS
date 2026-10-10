/**
 * GPU REJİMİ — ÖZÜNÜ BƏRPA EDƏN
 * =============================
 * Əvvəl GPU sürətləndirməsi şərtsiz söndürülmüşdü (`disableHardwareAcceleration()`
 * + `--disable-gpu`). Bu, bəzi maşınlardaki video sürücü problemlərinin qarşısını
 * alırdı, lakin bütün render işini CPU-ya yükləyirdi: skroll, animasiya, kölgə və
 * blur effektləri POS-u gözə görünən şəkildə yavaşladırdı.
 *
 * İndi GPU DEFOLT OLARAQ AÇIQDIR, amma avtomatik təhlükəsizlik toru ilə:
 *
 *   1. Açılışdan əvvəl "sınaq" bayrağı diskə yazılır.
 *   2. Pəncərə uğurla yüklənəndə bayraq təmizlənir və sayğac sıfırlanır.
 *   3. Pəncərə yüklənmədən proqram çökərsə/donarsa (ağ ekran, GPU prosesi
 *      çökməsi, məcburi bağlanma) bayraq diskdə qalır. Növbəti açılışda bu
 *      görünür və uğursuzluq sayğacı artır.
 *   4. İki uğursuz sınaqdan sonra GPU qalıcı olaraq söndürülür — yəni proqram
 *      özü köhnə stabil rejimə qayıdır, istifadəçi heç nə etmədən.
 *
 * Yəni ən pis halda davranış bugünkü ilə eynidir, sadəcə bir açılış gecikməsi ilə.
 *
 * Əl ilə idarə:
 *   UNIPOS_DISABLE_GPU=1  → GPU-nu məcburi söndür
 *   UNIPOS_ENABLE_GPU=1   → GPU-nu məcburi aç və sayğacı sıfırla
 */

const fs = require("fs");
const path = require("path");

const MAX_FAILED_TRIALS = 2;

let statePath = null;
let cached = null;
let logger = console;

function logWarn(...a) {
  try {
    (logger.warn || logger.log).call(logger, ...a);
  } catch {
    /* logger yoxdur */
  }
}

function read() {
  if (cached) return cached;
  let data = { disabled: false, failures: 0, trialPending: false };
  try {
    if (statePath && fs.existsSync(statePath)) {
      const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
      if (parsed && typeof parsed === "object") {
        data = {
          disabled: parsed.disabled === true,
          failures: Number(parsed.failures) || 0,
          trialPending: parsed.trialPending === true,
        };
      }
    }
  } catch {
    /* fayl pozulubsa defoltla davam edirik */
  }
  cached = data;
  return cached;
}

function write(data) {
  cached = data;
  try {
    if (statePath) fs.writeFileSync(statePath, JSON.stringify(data), "utf8");
  } catch {
    /* yazıla bilmirsə yalnız avto-bərpa işləmir, proqram işləyir */
  }
}

/**
 * Electron bayraqları qoyulmadan ƏVVƏL çağırılır (app.whenReady-dən əvvəl).
 * @returns {{ enabled: boolean, reason: string }}
 */
function decide(opts) {
  logger = (opts && opts.log) || console;
  try {
    statePath = path.join(opts.userDataPath, "gpu-mode.json");
  } catch {
    statePath = null;
  }

  if (process.env.UNIPOS_DISABLE_GPU === "1") {
    return { enabled: false, reason: "UNIPOS_DISABLE_GPU=1" };
  }

  const st = read();

  if (process.env.UNIPOS_ENABLE_GPU === "1") {
    write({ disabled: false, failures: 0, trialPending: true });
    return { enabled: true, reason: "UNIPOS_ENABLE_GPU=1" };
  }

  if (st.disabled) {
    return {
      enabled: false,
      reason: `əvvəlki ${st.failures} uğursuz sınaqdan sonra avtomatik söndürülüb`,
    };
  }

  // Keçən açılışda sınaq bayrağı təmizlənməyibsə — uğursuz sayılır
  if (st.trialPending) {
    const failures = st.failures + 1;
    if (failures >= MAX_FAILED_TRIALS) {
      write({ disabled: true, failures, trialPending: false });
      logWarn(
        `[GPU] ${failures} uğursuz açılışdan sonra GPU qalıcı söndürülür (stabil rejim)`,
      );
      return { enabled: false, reason: "avtomatik bərpa: GPU stabil deyil" };
    }
    write({ disabled: false, failures, trialPending: true });
    logWarn(`[GPU] Keçən açılış uğursuz sayılır (${failures}/${MAX_FAILED_TRIALS}) — bir daha sınanır`);
    return { enabled: true, reason: `sınaq ${failures}/${MAX_FAILED_TRIALS}` };
  }

  write({ disabled: false, failures: st.failures, trialPending: true });
  return { enabled: true, reason: "normal" };
}

/**
 * Əsas pəncərə uğurla yükləndi — sınaq müvəffəq oldu.
 * Bundan sonra GPU çökməsi baş versə belə proqram işləyir, ona görə
 * uğursuzluq sayılmır.
 */
function markHealthy() {
  const st = read();
  if (!st.trialPending && st.failures === 0) return;
  write({ disabled: st.disabled, failures: 0, trialPending: false });
}

/** GPU prosesi çökdü — bunu uğursuzluq kimi qeyd edirik */
function markGpuCrash() {
  const st = read();
  if (st.disabled) return;
  const failures = st.failures + 1;
  if (failures >= MAX_FAILED_TRIALS) {
    write({ disabled: true, failures, trialPending: false });
    logWarn("[GPU] GPU prosesi təkrar çökdü — növbəti açılışda GPU söndürüləcək");
  } else {
    write({ disabled: false, failures, trialPending: st.trialPending });
    logWarn(`[GPU] GPU prosesi çökdü (${failures}/${MAX_FAILED_TRIALS})`);
  }
}

module.exports = { decide, markHealthy, markGpuCrash };
