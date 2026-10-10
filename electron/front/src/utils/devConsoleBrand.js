import uniposLogo from "../assets/images/unipos_logo.png";

/**
 * Qeyd: Pəncərə başlığındakı (Electron) ikon — `electron/server/main.js` (getAppIconPath / BrowserWindow icon).
 * Bu fayl yalnız konsol daxilində mətn/şəkil brend üçündür.
 */

/**
 * Vite-dən gələn loqo yolunu səhifə üzrə tam URL-ə çevirir (DevTools-da background üçün).
 */
function resolveLogoHref(imported) {
  const s = typeof imported === "string" ? imported : String(imported);
  if (!s) return "";
  if (s.startsWith("data:") || s.startsWith("http://") || s.startsWith("https://") || s.startsWith("file:")) {
    return s;
  }
  try {
    return new URL(s, window.location.href).href;
  } catch {
    return s;
  }
}

/**
 * Loqonu data URL edir — Electron file:// və DevTools-da nisbi URL çox vaxt görünmür;
 * base64 konsolda həmişə işləyir.
 */
async function logoToDataUrl(href) {
  const res = await fetch(href, { cache: "force-cache" });
  if (!res.ok) throw new Error(String(res.status));
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function logConsoleBrandLines() {
  console.log(
    "%c UniPOS Tech",
    "color: #053796; font-size: 15px; font-weight: 700; font-family: system-ui, Segoe UI, sans-serif; letter-spacing: 0.02em;",
  );
  console.log(
    "%c POS · Developer console",
    "color: #64748b; font-size: 11px; font-weight: 500;",
  );
  console.log(
    "%c —",
    "color: #e2e8f0; font-size: 10px;",
  );
}

/**
 * Chrome / Electron DevTools konsolunda tətbiq loqosu (Pin ekranı ilə eyni fayl) + brend.
 * Şəkil: %c + background-image; data URL ilə Electron/Vite bütün rejimlərdə görünür.
 */
export async function printDevConsoleBrand() {
  const href = resolveLogoHref(uniposLogo);
  let bgUrl = href;

  try {
    if (href && !href.startsWith("data:")) {
      bgUrl = await logoToDataUrl(href);
    }
  } catch {
    /* data URL alınmasa köhnə üsulla bir cəhd */
    bgUrl = href;
  }

  try {
    if (bgUrl) {
      /* Dairəvi loqo üçün kifayət qədər böyük “xəritə” — contain mərkəzdə saxlayır */
      console.log(
        "%c ",
        "padding: 56px 120px; margin: 8px 0 12px 0; background: url(\"" +
          bgUrl.replace(/\\/g, "\\\\").replace(/"/g, '\\"') +
          "\") center / contain no-repeat; font-size: 1px; line-height: 56px; border-radius: 8px;",
      );
    }
  } catch {
    /* konsol stil limiti */
  }

  logConsoleBrandLines();
}
