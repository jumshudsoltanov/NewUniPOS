/**
 * Master/Slave rejimi: slave + aktiv master-slave olduqda true.
 * Kontrol panelində Master IP kartı və NetworkOverlay yalnız bu halda lazımdır.
 */
export const checkIsSlaveTerminal = () => {
    try {
        if (!window.electronAPI && !!localStorage.getItem("master_ip")) return true;
        const authResultStr = localStorage.getItem("authResult");
        if (!authResultStr) return false;
        const authResult = JSON.parse(authResultStr);
        const profileData = authResult?.data?.profile || {};
        const terminalData = authResult?.data?.terminal || {};
        const isMaster = parseInt(terminalData.is_master) === 1 || parseInt(profileData.is_master) === 1;
        const active = parseInt(terminalData.is_master_slave_active) === 1 || parseInt(profileData.is_master_slave_active) === 1;
        return !isMaster && active;
    } catch {
        return false;
    }
};
