import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * SABİT KİMLİKLİ HADİSƏ İŞLƏYİCİSİ
 * ================================
 *
 * PROBLEM:
 * `React.memo` ilə bükülmüş sətir komponentləri yalnız props-ları dəyişməyəndə
 * render olunmur. Lakin `const handleClick = () => {...}` hər render-də YENİ
 * funksiya yaradır, yəni props həmişə "dəyişmiş" sayılır və memo heç vaxt
 * işləmir.
 *
 * NİYƏ `useCallback` DEYİL:
 * `useCallback`-a asılılıq siyahısı yazmaq lazımdır. Siyahı natamam olarsa
 * funksiya KÖHNƏ dəyərləri oxuyur. POS-da bu, sürüşdürüb silmə zamanı səhv
 * məhsulun və ya səhv miqdarın silinməsi deməkdir — səssiz və pul itkisinə
 * səbəb olan qüsur.
 *
 * HƏLL:
 * Qaytarılan funksiyanın kimliyi HEÇ VAXT dəyişmir (boş asılılıq siyahısı),
 * lakin çağırılanda həmişə ƏN SON bağlanışı işlədir. Yəni memo işləyir və
 * köhnə dəyər oxuma riski ümumiyyətlə yoxdur.
 *
 * DİQQƏT: yalnız hadisə işləyiciləri üçündür (onClick, onTouchStart və s.).
 * Render zamanı çağırılmamalıdır, çünki ref render bitdikdən sonra yenilənir.
 */
export function useEventCallback(fn) {
  const ref = useRef(fn);

  // Render-dən dərhal sonra, lakin brauzer boyamazdan əvvəl yenilənir
  useLayoutEffect(() => {
    ref.current = fn;
  });

  return useCallback((...args) => ref.current?.(...args), []);
}

export default useEventCallback;
