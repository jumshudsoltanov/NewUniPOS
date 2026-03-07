import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, ActivityIndicator, View, Text, TouchableOpacity, StatusBar, Platform, AppState, TouchableWithoutFeedback, Alert, Modal, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { getData, removeData } from '../utils/storage';
import { useIsFocused, CommonActions } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const WebViewScreen = ({ navigation }) => {
    const [url, setUrl] = useState(null);
    const [masterIp, setMasterIp] = useState(null);
    const [hasError, setHasError] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [vConsoleEnabled, setVConsoleEnabled] = useState(false);
    const [showPassModal, setShowPassModal] = useState(false);
    const [showMenuModal, setShowMenuModal] = useState(false);
    const [showFloatingBtn, setShowFloatingBtn] = useState(false);
    const [passInput, setPassInput] = useState('');
    const webViewRef = useRef(null);
    const appState = useRef(AppState.currentState);
    const isFocused = useIsFocused();

    const loadUrl = useCallback(async () => {
        const ip = await getData('master_ip');
        if (ip) {
            setMasterIp(ip);
            const timestamp = Date.now();
            const cleanUrl = `http://mobile.unipos.tech/?master_ip=${ip}&t=${timestamp}#/login?master_ip=${ip}`;
            setUrl(cleanUrl);
        } else {
            goToConnection();
        }
    }, []);

    const watchdogTimer = useRef(null);
    const retryInterval = useRef(null);

    const startWatchdog = () => {
        stopWatchdog();
        watchdogTimer.current = setTimeout(() => {
            if (url && !hasError) {
                console.warn('[WebView] Watchdog triggered - Still loading after 15s');
                setHasError(true);
                setErrorMsg('Bağlantı çox vaxt apardı. Zəhmət olmasa Master POS-un aktiv olduğunu yoxlayın.');
            }
        }, 15000);
    };

    const stopWatchdog = () => {
        if (watchdogTimer.current) {
            clearTimeout(watchdogTimer.current);
            watchdogTimer.current = null;
        }
    };

    const pingMaster = async (ip) => {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(`http://${ip}:55667/api/ping`, { signal: controller.signal });
            clearTimeout(id);
            return response.ok;
        } catch {
            return false;
        }
    };

    // Auto-retry when hasError: ping master every 4s, reload when available
    useEffect(() => {
        if (!hasError) {
            if (retryInterval.current) {
                clearInterval(retryInterval.current);
                retryInterval.current = null;
            }
            return;
        }

        retryInterval.current = setInterval(async () => {
            const ip = await getData('master_ip');
            if (!ip) return;
            const ok = await pingMaster(ip);
            if (ok) {
                console.log('[WebView] Master came online, auto-reloading...');
                clearInterval(retryInterval.current);
                retryInterval.current = null;
                setHasError(false);
                await loadUrl();
            }
        }, 4000);

        return () => {
            if (retryInterval.current) clearInterval(retryInterval.current);
        };
    }, [hasError, loadUrl]);

    useEffect(() => {
        setTimeout(loadUrl, 200);

        const subscription = AppState.addEventListener('change', async (nextAppState) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                console.log('[WebView] App resumed, checking connectivity...');
                const ip = await getData('master_ip');
                if (ip) {
                    const ok = await pingMaster(ip);
                    if (ok) {
                        console.log('[WebView] Ping success, reloading...');
                        webViewRef.current?.reload();
                        setHasError(false);
                    } else {
                        setHasError(true);
                        setErrorMsg('Master POS tapılmadı. Şəbəkəni yoxlayın.');
                    }
                }
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
            stopWatchdog();
            if (retryInterval.current) clearInterval(retryInterval.current);
        };
    }, [loadUrl]);

    const [tapCount, setTapCount] = useState(0);
    const lastTap = useRef(0);

    const handleTripleTap = () => {
        const now = Date.now();
        if (now - lastTap.current < 400) {
            setTapCount(prev => prev + 1);
        } else {
            setTapCount(1);
        }
        lastTap.current = now;

        if (tapCount + 1 >= 3) {
            setTapCount(0);
            setShowFloatingBtn(true);
            // Hide after 5 seconds
            setTimeout(() => setShowFloatingBtn(false), 5000);

            // Still show info alert for developer convenience
            console.log('[WebView] Triple tap detected - Settings icon revealed for 5s');
        }
    };

    const goToConnection = async () => {
        console.log('[WebView] Resetting connection settings...');
        await removeData('master_ip');
        setUrl(null);
        navigation.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: 'Connection' }] })
        );
    };

    const handleError = (syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.warn('[WebView] Error:', nativeEvent);
        setHasError(true);
        setErrorMsg(nativeEvent.description || 'Server tapılmadı. IP düzgündürmü?');
    };

    if (!url) {
        return (
            <TouchableWithoutFeedback onPress={handleTripleTap}>
                <View style={[styles.center, { backgroundColor: '#FFFFFF' }]}>
                    <StatusBar hidden={false} backgroundColor="#FFFFFF" barStyle="dark-content" />
                    <Image
                        source={require('../../assets/unipos_logo.png')}
                        style={{ width: 180, height: 180 }}
                        resizeMode="contain"
                    />
                    <ActivityIndicator size="large" color="#053796" style={{ marginTop: 10 }} />
                    <Text style={{ marginTop: 15, color: '#64748B', fontSize: 13, fontWeight: '500' }}>UniPOS-a qoşulur...</Text>
                </View>
            </TouchableWithoutFeedback>
        );
    }

    if (hasError) {
        return (
            <SafeAreaView style={styles.center}>
                <TouchableWithoutFeedback onPress={handleTripleTap}>
                    <View style={{ alignItems: 'center' }}>
                        <MaterialCommunityIcons name="wifi-off" size={80} color="#64748B" style={{ marginBottom: 20 }} />
                        <Text style={styles.errorTitle}>Bağlantı uğursuz oldu</Text>
                        <Text style={styles.errorMsg}>Master POS (IP: {masterIp}) ilə əlaqə qurula bilmir.</Text>
                        <Text style={styles.errorUrl}>{url}</Text>
                    </View>
                </TouchableWithoutFeedback>

                <TouchableOpacity style={styles.btn} onPress={() => { setHasError(false); webViewRef.current?.reload(); }}>
                    <Text style={styles.btnText}>Yenidən yoxla</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={goToConnection}>
                    <Text style={[styles.btnText, { color: '#053796' }]}>Parametrlərə qayıt</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#053796' }}>
            <StatusBar hidden={false} translucent={true} backgroundColor="transparent" barStyle="light-content" />
            <SafeAreaView style={{ flex: 1, backgroundColor: '#053796' }} edges={[]}>
                <WebView
                    ref={webViewRef}
                    source={{ uri: url }}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    cacheEnabled={false}
                    cacheMode="LOAD_NO_CACHE"
                    allowsInlineMediaPlayback={true}
                    startInLoadingState={true}
                    scalesPageToFit={false}
                    bounces={false}
                    overScrollMode="never"
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    contentMode="mobile"
                    mixedContentMode="always"
                    containerStyle={{ backgroundColor: '#FFFFFF' }}
                    style={{ flex: 1, backgroundColor: '#FFFFFF' }}
                    allowsBackForwardNavigationGestures={false}
                    originWhitelist={['*']}
                    onError={handleError}
                    onLoadStart={startWatchdog}
                    onLoadEnd={stopWatchdog}
                    injectedJavaScript={`
                        (function() {
                            var meta = document.querySelector('meta[name="viewport"]');
                            if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'viewport'); document.head.appendChild(meta); }
                            meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
                            var style = document.createElement('style');
                            style.textContent = '::-webkit-scrollbar { display: none !important; } * { -webkit-tap-highlight-color: transparent; }';
                            document.head.appendChild(style);

                            ${vConsoleEnabled ? `
                                if (!window.vConsole) {
                                    var script = document.createElement('script');
                                    script.src = 'https://unpkg.com/vconsole@latest/dist/vconsole.min.js';
                                    script.onload = function() {
                                        window.vConsole = new window.VConsole();
                                    };
                                    document.head.appendChild(script);
                                }
                            ` : ''}

                            // Triple Tap Detection for Settings Icon (Restricted to Top Right Corner)
                            var tapCount = 0;
                            var lastTap = 0;
                            document.addEventListener('touchend', function(e) {
                                if (!e.changedTouches || e.changedTouches.length === 0) return;
                                var touch = e.changedTouches[0];
                                
                                // Top-Right Corner restriction (within 100px from top and right)
                                if (touch.clientX > window.innerWidth - 120 && touch.clientY < 120) {
                                    var now = Date.now();
                                    if (now - lastTap < 400) {
                                        tapCount++;
                                    } else {
                                        tapCount = 1;
                                    }
                                    lastTap = now;
                                    
                                    // Require 4 consecutive taps
                                    if (tapCount >= 4) {
                                        window.ReactNativeWebView.postMessage('triple_tap');
                                        tapCount = 0;
                                    }
                                } else {
                                    tapCount = 0; // Reset if tapped outside the zone
                                }
                            });
                        })();
                        true;
                    `}
                    onMessage={(event) => {
                        if (event.nativeEvent.data === 'triple_tap') {
                            setShowFloatingBtn(true);
                            setTimeout(() => setShowFloatingBtn(false), 5000);
                        }
                    }}
                    renderLoading={() => (
                        <View style={[styles.center, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', zIndex: 100 }]}>
                            <Image
                                source={require('../../assets/unipos_logo.png')}
                                style={{ width: 120, height: 120 }}
                                resizeMode="contain"
                            />
                            <ActivityIndicator size="large" color="#053796" style={{ marginTop: 10 }} />
                        </View>
                    )}
                />
            </SafeAreaView>

            {/* Premium settings icon - Hidden by default, shown via Triple Tap */}
            {showFloatingBtn && (
                <TouchableOpacity
                    style={styles.floatingBtn}
                    onPress={() => setShowMenuModal(true)}
                >
                    <MaterialCommunityIcons name="cog" size={20} color="#053796" />
                </TouchableOpacity>
            )}

            {/* Custom Menu Modal (Replaces standard Alert for better Android support) */}
            <Modal
                visible={showMenuModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowMenuModal(false)}
            >
                <TouchableWithoutFeedback onPress={() => setShowMenuModal(false)}>
                    <View style={styles.menuOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.menuContent}>
                                <View style={styles.menuHeader}>
                                    <Text style={styles.menuTitle}>Bağlantı Tənzimləmələri</Text>
                                    <Text style={styles.menuSubTitle}>Daxil olan IP: {masterIp}</Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => { setShowMenuModal(false); setHasError(false); webViewRef.current?.reload(); }}
                                >
                                    <MaterialCommunityIcons name="refresh" size={22} color="#053796" />
                                    <View style={styles.menuItemTextContainer}>
                                        <Text style={styles.menuItemTitle}>Yenilə</Text>
                                        <Text style={styles.menuItemSub}>Səhifəni yenidən yükləyin</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => { setShowMenuModal(false); setShowPassModal(true); }}
                                >
                                    <MaterialCommunityIcons name="shield-check" size={22} color="#053796" />
                                    <View style={styles.menuItemTextContainer}>
                                        <Text style={styles.menuItemTitle}>Sistem Tənzimləmələri</Text>
                                        <Text style={styles.menuItemSub}>Geliştirici alətləri (Pass required)</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.menuItem, styles.menuItemDanger]}
                                    onPress={() => { setShowMenuModal(false); goToConnection(); }}
                                >
                                    <MaterialCommunityIcons name="qrcode-scan" size={22} color="#DC2626" />
                                    <View style={styles.menuItemTextContainer}>
                                        <Text style={[styles.menuItemTitle, { color: '#DC2626' }]}>Yeni QR Skan</Text>
                                        <Text style={styles.menuItemSub}>Master IP-ni yenidən daxil et</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.menuCloseBtn}
                                    onPress={() => setShowMenuModal(false)}
                                >
                                    <Text style={styles.menuCloseBtnText}>Bağla</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Custom password modal for Android compatibility */}
            <Modal
                visible={showPassModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowPassModal(false)}
            >
                <View style={styles.modalBg}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Geliştirici Girişi</Text>
                        <Text style={styles.modalSub}>Şifrəni daxil edin:</Text>
                        <TextInput
                            style={styles.modalInput}
                            secureTextEntry={true}
                            value={passInput}
                            onChangeText={setPassInput}
                            keyboardType="numeric"
                            autoFocus={true}
                            placeholder="****"
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.mBtn, styles.mBtnCancel]}
                                onPress={() => { setShowPassModal(false); setPassInput(''); }}
                            >
                                <Text style={styles.mBtnCancelText}>Ləğv et</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.mBtn, styles.mBtnConfirm]}
                                onPress={() => {
                                    if (passInput === '9966') {
                                        setVConsoleEnabled(true);
                                        setShowPassModal(false);
                                        setPassInput('');
                                        Alert.alert('Uğurlu', 'vConsole aktiv edildi. Səhifə yenilənir...');
                                        setTimeout(() => webViewRef.current?.reload(), 1000);
                                    } else {
                                        Alert.alert('Xəta', 'Yanlış şifrə!');
                                    }
                                }}
                            >
                                <Text style={styles.mBtnConfirmText}>Daxil ol</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
        backgroundColor: '#0A0E17',
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#DC2626',
        marginBottom: 8,
    },
    errorMsg: {
        fontSize: 13,
        color: '#666',
        textAlign: 'center',
        marginBottom: 4,
    },
    errorUrl: {
        fontSize: 12,
        color: '#999',
        marginBottom: 30,
    },
    btn: {
        width: '100%',
        height: 50,
        backgroundColor: '#053796',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    btnSecondary: {
        backgroundColor: '#EBF2FE',
    },
    btnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    floatingBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
        // Premium shadow
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    modalBg: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        elevation: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 8,
    },
    modalSub: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 20,
    },
    modalInput: {
        width: '100%',
        height: 56,
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 24,
        textAlign: 'center',
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    mBtn: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mBtnCancel: {
        backgroundColor: '#f1f5f9',
    },
    mBtnConfirm: {
        backgroundColor: '#053796',
    },
    mBtnCancelText: {
        color: '#64748b',
        fontWeight: '600',
    },
    mBtnConfirmText: {
        color: '#fff',
        fontWeight: '700',
    },
    // Custom Menu Styles
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    menuContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    menuHeader: {
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 15,
    },
    menuTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1e293b',
    },
    menuSubTitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: '#f8faff',
    },
    menuItemDanger: {
        backgroundColor: '#fff1f2',
    },
    menuItemTextContainer: {
        marginLeft: 15,
        flex: 1,
    },
    menuItemTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    menuItemSub: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 1,
    },
    menuCloseBtn: {
        marginTop: 12,
        height: 52,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuCloseBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#64748b',
    },
});

export default WebViewScreen;
