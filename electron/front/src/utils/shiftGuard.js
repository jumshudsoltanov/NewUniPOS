import apiConfig from "./apiConfig";

/**
 * Sifariş yaratmadan əvvəl növbə yoxlaması.
 * is_sales_shift_required aktiv isə API-yə soruşur.
 * @returns {Promise<{blocked: boolean, reason?: string}>}
 */
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

        const res = await apiConfig.get(`/sales-shifts/${profileId}/current`);
        const isOpen = !!res.data?.data;

        if (!isOpen) {
            return { blocked: true, reason: "Növbə açılmayıb. Əvvəlcə növbəni açın." };
        }
        return { blocked: false };
    } catch {
        // API xətası olsa — blok etmə (istifadəçini saxlama)
        return { blocked: false };
    }
}
