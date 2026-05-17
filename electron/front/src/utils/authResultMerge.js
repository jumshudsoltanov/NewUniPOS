/**
 * Blok (403 isBlocked) cavabı bəzən yalnız profile gətirir; authResult-da terminal itəndə
 * POS master/slave init səhvən slave kimi davranır. Köhnə authResult snapshot-u ilə terminal (və digər data) saxlanılır.
 * @param {object} serverBody - rejectWithValue / axios cavabı (message, isBlocked, data, ...)
 * @param {object|null} [prevAuthSnapshot] - yazmadan əvvəl oxunmuş authResult; verilməsə, daxildən localStorage cəhd edilir
 */
export function mergeBlockedLoginPayload(serverBody, prevAuthSnapshot) {
    if (!serverBody?.isBlocked || !serverBody.data) return serverBody;
    let prev = prevAuthSnapshot;
    if (prev === undefined) {
        try {
            const s = localStorage.getItem("authResult");
            prev = s ? JSON.parse(s) : null;
        } catch {
            prev = null;
        }
    }
    const prevData = prev?.data && typeof prev.data === "object" ? prev.data : {};
    const incoming =
        serverBody.data && typeof serverBody.data === "object" ? serverBody.data : {};
    return {
        ...serverBody,
        data: {
            ...prevData,
            ...incoming,
            profile: incoming.profile ?? prevData.profile,
            terminal: incoming.terminal ?? prevData.terminal,
        },
    };
}
