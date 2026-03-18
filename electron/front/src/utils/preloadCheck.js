// Preload Check komponenti — yeni sifariş yaradanda dərhal açılsın (lazy chunk artıq yüklənmiş olacaq)
export const preloadCheck = () => {
  import("../components/Check/Check");
};
