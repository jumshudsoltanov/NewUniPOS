import apiConfig from "./apiConfig";

/**
 * Sifariş yaratmadan əvvəl növbə yoxlaması.
 * is_sales_shift_required aktiv isə API-yə soruşur.
 * @returns {Promise<{blocked: boolean, reason?: string}>}
 */
const SHIFT_CACHE_MS = 30000;
const shiftOpenCache = { profileId: null, isOpen: false, at: 0 };

/** Növbə bağlananda/açılanda keşi sıfırla (SalesShiftModal çağırır) */
export function resetShiftGuardCache() {
    shiftOpenCache.profileId = null;
    shiftOpenCache.isOpen = false;
    shiftOpenCache.at = 0;
}

export async function checkShiftGuard(profileData) {
    try {
        // is_sales_shift_required dəyərini çox mənbədən oxu
        let required = false;
        const fromRedux = profileData?.data?.profile?.queue_sales_module;
        if (fromRedux != null) {
            required = Number(fromRedux) === 1;
        } else {
            try {
                const stored = JSON.parse(localStorage.getItem("profile") || "{}");
                if (stored.queue_sales_module != null) {
                    required = Number(stored.queue_sales_module) === 1;
                } else {
                    const auth = JSON.parse(localStorage.getItem("authResult") || "{}");
                    required = Number(auth?.data?.profile?.queue_sales_module) === 1;
                }
            } catch { required = false; }
        }

        if (!required) return { blocked: false };

        // Növbə açıq olub-olmadığını birbaşa API-dən yoxla
        const profileId = profileData?.data?.profile?.id;
        if (!profileId) return { blocked: false };

        // PERFORMANS: masaya hər vuranda bu sorğu gözlənilirdi (slave-də master-ə gedir).
        // Açıq növbə nəticəsi 30 saniyə keşlənir — masa dərhal açılır.
        const now = Date.now();
        let isOpen;
        if (shiftOpenCache.profileId === profileId && shiftOpenCache.isOpen && now - shiftOpenCache.at < SHIFT_CACHE_MS) {
            isOpen = true;
        } else {
            const res = await apiConfig.get(`/sales-shifts/${profileId}/current`, { timeout: 4000 });
            isOpen = !!res.data?.data;
            shiftOpenCache.profileId = profileId;
            shiftOpenCache.isOpen = isOpen;
            shiftOpenCache.at = now;
        }

        if (!isOpen) {
            return { blocked: true, reason: "Növbə açılmayıb. Əvvəlcə növbəni açın." };
        }
        return { blocked: false };
    } catch {
        // API xətası olsa — blok etmə (istifadəçini saxlama)
        return { blocked: false };
    }
}
