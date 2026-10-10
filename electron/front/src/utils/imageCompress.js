/**
 * Telefon/kamera şəkilləri çox vaxt 3-10MB olur — birbaşa base64 kimi DB-yə
 * yazılsa, hər menyu sorğusunda bu böyüklükdə data köçürülür, zəif komplarda
 * render/parse vaxtı artır, hətta DB insert paket limitini aşa bilir.
 * Yükləmə zamanı ölçünü kiçildib JPEG-ə sıxırıq — məhsul kartı üçün bundan
 * böyük ölçü lazım deyil, keyfiyyət fərqi gözlə seçilmir.
 */
export const compressImageFile = (file, { maxDim = 700, quality = 0.75 } = {}) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Fayl yoxdur"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Fayl oxuna bilmədi"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(reader.result); // fallback — sıxıla bilmirsə orijinalı saxla
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width <= 0 || height <= 0) {
            resolve(reader.result);
            return;
          }

          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL("image/jpeg", quality);
          // Sıxılmış nəticə orijinaldan böyükdürsə (kiçik/artıq sadə şəkil) orijinalı saxla
          resolve(compressed.length < reader.result.length ? compressed : reader.result);
        } catch {
          resolve(reader.result); // canvas xətası — orijinal data URL ilə davam et
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
};
