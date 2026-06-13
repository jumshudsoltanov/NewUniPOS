import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { authPos, setLoginData } from "../../redux/Slices/LoginSlice";
import { getTableGroups } from "../../redux/Slices/TablesSlice";
import { getActiveOrders } from "../../redux/Slices/BooksSlice";
import { menuWithCategories, menuWithGeneralCategories } from "../../redux/Slices/MenuSlice";
import { toast } from "sonner";
import DefaultLogo from "../../assets/images/unipos_logo.png";
import apiConfig from "../../utils/apiConfig";
import { isPaymentExpired, isPosBlocked } from "../../utils/dateHelpers";
import { mergeBlockedLoginPayload } from "../../utils/authResultMerge";
import { t } from "../../utils/translations";
import "./BlockPage.css";

const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
    } catch {
        return dateStr;
    }
};

const BlockPage = () => {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loginedProfileData } = useSelector((state) => state.LoginSlice);

    const authResultFallback = (() => {
        try {
            const s = localStorage.getItem("authResult");
            return s ? JSON.parse(s) : null;
        } catch { return null; }
    })();
    const activeProfileData = loginedProfileData?.data ? loginedProfileData : authResultFallback;

    const profileInfo = activeProfileData?.data?.profile || {};
    const terminalInfo = activeProfileData?.data?.terminal || {};
    const nextPaymentDate = profileInfo?.next_payment_date;
    const isPosBlock = Number(profileInfo?.is_pos_block) === 1;
    const restaurantName = profileInfo?.restaurant_name || profileInfo?.username || "";

    const validImg = (img) => {
        if (!img) return false;
        const s = String(img).trim().toLowerCase();
        if (s === "null" || s === "undefined" || s === "data:directory;base64,") return false;
        return true;
    };

    let logoSrc = DefaultLogo;
    if (validImg(terminalInfo.logoPrint)) {
        logoSrc = terminalInfo.logoPrint.startsWith("http") || terminalInfo.logoPrint.startsWith("data:")
            ? terminalInfo.logoPrint
            : `http://46.224.8.157:35627/${terminalInfo.logoPrint}`;
    } else if (validImg(profileInfo.logo)) {
        logoSrc = profileInfo.logo.startsWith("http") || profileInfo.logo.startsWith("data:")
            ? profileInfo.logo
            : `http://46.224.8.157:35627/${profileInfo.logo}`;
    }

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            let storageData = JSON.parse(localStorage.getItem("profile"));
            if (!storageData) {
                const authProfiles = JSON.parse(localStorage.getItem("authProfiles") || "[]");
                const currentProfileId = activeProfileData?.data?.profile?.id;
                const matched = authProfiles.find(
                    (p) => p.authResult?.data?.profile?.id === currentProfileId
                );
                storageData = matched?.profile;
            }
            if (!storageData) {
                toast.error(t("profil_melumati_tapilmadi"));
                setIsRefreshing(false);
                return;
            }

            const data = await dispatch(authPos(storageData)).unwrap();
            localStorage.setItem("authResult", JSON.stringify(data));

            const profile = data?.data?.profile;

            if (isPosBlocked(profile?.is_pos_block)) {
                toast.error(t("pos_hele_de_bloklanmis_veziyyetdedir"));
                return;
            }

            if (profile?.next_payment_date) {
                if (isPaymentExpired(profile.next_payment_date)) {
                    toast.error(t("abunelik_hele_yenilenmeyib"));
                    return;
                }
            }

            toast.success(t("sistem_yenilendi"));
            if (profile?.id) {
                await Promise.all([
                    dispatch(getTableGroups(profile.id)).unwrap(),
                    dispatch(getActiveOrders({ profileId: profile.id })).unwrap(),
                    dispatch(menuWithCategories(profile.id)).unwrap(),
                    dispatch(menuWithGeneralCategories(profile.id)).unwrap(),
                ]);
            }
            navigate("/pin");
        } catch (error) {
            console.error("Refresh error:", error);
            if (error?.data?.isBlocked) {
                let prevSnapshot = null;
                try {
                    prevSnapshot = JSON.parse(localStorage.getItem("authResult"));
                } catch {}
                const merged = mergeBlockedLoginPayload(error.data, prevSnapshot);
                localStorage.setItem("authResult", JSON.stringify(merged));
                dispatch(setLoginData(merged));
                toast.error(t("pos_hele_de_bloklanmis_veziyyetdedir"));
            } else {
                toast.error(error?.data?.message || t("yenileme_zamani_xeta_bas_verdi"));
            }
        } finally {
            setIsRefreshing(false);
        }
    };

    // ─── Auto payment (POS block) ────────────────────────────────────────
    const autoPaymentEnabled = localStorage.getItem("pos_auto_payment_enabled") === "true";
    const [paymentSent, setPaymentSent] = useState(false);
    const [paymentSending, setPaymentSending] = useState(false);

    const handlePaymentNotify = async () => {
        setPaymentSending(true);
        try {
            const profileId = activeProfileData?.data?.profile?.id;
            if (!profileId) {
                toast.error(t("profil_tapilmadi"));
                return;
            }
            await apiConfig.post("/pin/payment-notification", { profileId });
            setPaymentSent(true);
            toast.success(t("bildiris_gonderildi_zehmet_olmasa_telefonunuzu_yoxlayin"));
        } catch (err) {
            toast.error(err?.response?.data?.message || t("bildiris_gonderilmedi"));
        } finally {
            setPaymentSending(false);
        }
    };

    const handleQuitApp = () => {
        if (window.electronAPI?.quitApp) {
            window.electronAPI.quitApp();
        } else {
            window.close();
        }
    };

    return (
        <div className="block-page">
            <div className="block-card">
                <img
                    src={logoSrc}
                    alt="Logo"
                    className="block-logo"
                    onError={(e) => { if (e.target.src !== DefaultLogo) e.target.src = DefaultLogo; }}
                />

                <h1 className="block-title">
                    {isPosBlock ? "Sistem bloklanıb" : "Abunəlik başa çatıb"}
                </h1>

                <p className="block-subtitle">
                    {isPosBlock
                        ? "POS sistemi administrator tərəfindən dayandırılıb. Davam etmək üçün dəstək ilə əlaqə saxlayın."
                        : "Abunəlik müddətiniz bitib. Xidmətdən istifadə üçün ödənişi həyata keçirin."
                    }
                </p>

                <div className="block-info-row">
                    {restaurantName && (
                        <>
                            <div className="block-info-item">
                                <span className="info-label">{t("enterprise_placeholder")}</span>
                                <span className="info-value">{restaurantName}</span>
                            </div>
                            <div className="block-info-divider"></div>
                        </>
                    )}
                    <div className="block-info-item">
                        <span className="info-label">Status</span>
                        <span className="info-value" style={{ color: '#DC2626' }}>{t("bloklanib")}</span>
                    </div>
                    {nextPaymentDate && !isPosBlock && (
                        <>
                            <div className="block-info-divider"></div>
                            <div className="block-info-item">
                                <span className="info-label">Son tarix</span>
                                <span className="info-value">{formatDate(nextPaymentDate)}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Auto payment card section (yalnız Avtomatik rejim aktivdə) */}
                {autoPaymentEnabled && !paymentSent && (
                    <div className="block-payment-card">
                        <div className="block-payment-header">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#053796" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                                <line x1="1" y1="10" x2="23" y2="10" />
                            </svg>
                            <span>{t("kart_ile_odenis")}</span>
                        </div>
                        <p className="block-payment-desc">{t("abunelik_odenisini_kart_ile_heyata_kecirin_odenis_edildikden_sonra_odedim_duymesine_toxunun")}</p>
                        <button
                            className="block-btn block-btn-pay"
                            onClick={handlePaymentNotify}
                            disabled={paymentSending}
                        >
                            {paymentSending ? (
                                <>
                                    <div className="spinner-border spinner-border-sm" role="status"></div>
                                    <span>{t("gonderilir")}</span>
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>{t("odedim")}</span>
                                </>
                            )}
                        </button>
                    </div>
                )}

                {autoPaymentEnabled && paymentSent && (
                    <div className="block-payment-sent">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <span>{t("bildiris_gonderildi_tesdiq_gozlenilir")}</span>
                    </div>
                )}

                <div className="block-actions">
                    <button
                        className="block-btn block-btn-primary"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? (
                            <>
                                <div className="spinner-border spinner-border-sm" role="status"></div>
                                <span>{t("yoxlanilir")}</span>
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 12C22 17.52 17.52 22 12 22C6.48 22 3.11 16.44 3.11 16.44M3.11 16.44H7.63M3.11 16.44V21.44M2 12C2 6.48 6.44 2 12 2C18.67 2 22 7.56 22 7.56M22 7.56V2.56M22 7.56H17.56" />
                                </svg>
                                <span>{t("refresh")}</span>
                            </>
                        )}
                    </button>

                    <button className="block-btn block-btn-quit" onClick={handleQuitApp}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        <span>{t("proqramdan_cix")}</span>
                    </button>
                </div>

                <div className="block-footer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12C4 7.58 7.58 4 12 4C16.42 4 20 7.58 20 12"></path>
                        <path d="M4 12V16C4 17.1 4.9 18 6 18H7V12H4Z"></path>
                        <path d="M20 12V16C20 17.1 19.1 18 18 18H17V12H20Z"></path>
                    </svg>{t("texniki_destek_ucun_elaqe_saxlayin")}</div>
            </div>
        </div>
    );
};

export default BlockPage;
