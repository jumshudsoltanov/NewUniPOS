import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, ActivityIndicator, View, Text, TouchableOpacity, StatusBar, Platform, AppState, TouchableWithoutFeedback, Alert } from 'react-native';
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

    useEffect(() => {
        setTimeout(loadUrl, 200);

        const subscription = AppState.addEventListener('change', nextAppState => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                if (webViewRef.current) {
                    webViewRef.current.reload();
                } else {
                    loadUrl();
                }
                setHasError(false);
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, []);

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
            Alert.alert(
                'Sistem Tənzimləmələri',
                `Aktiv Master IP: ${masterIp}\nURL: ${url}`,
                [
                    { text: 'Bağla', style: 'cancel' },
                    { text: 'Yenilə', onPress: () => webViewRef.current?.reload() },
                    { text: 'IP-ni Sıfırla (Reset)', onPress: goToConnection, style: 'destructive' },
                ]
            );
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
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#053796" />
                    <Text style={{ marginTop: 15, color: '#64748B', fontSize: 13 }}>Master POS-a qoşulur...</Text>
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
        <View style={{ flex: 1 }}>
            <StatusBar hidden={true} />
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {isFocused ? (
                    <WebView
                        ref={webViewRef}
                        source={{ uri: url }}
                        style={{ flex: 1 }}
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
                        allowsBackForwardNavigationGestures={false}
                        originWhitelist={['*']}
                        onError={handleError}
                        injectedJavaScript={`
                            (function() {
                                var meta = document.querySelector('meta[name="viewport"]');
                                if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'viewport'); document.head.appendChild(meta); }
                                meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
                                var style = document.createElement('style');
                                style.textContent = '::-webkit-scrollbar { display: none !important; } * { -webkit-tap-highlight-color: transparent; }';
                                document.head.appendChild(style);
                            })();
                            true;
                        `}
                        renderLoading={() => (
                            <View style={styles.center}>
                                <ActivityIndicator size="large" color="#053796" />
                            </View>
                        )}
                    />
                ) : null}
            </SafeAreaView>

            {/* Small settings icon - top left corner */}
            <TouchableOpacity
                style={styles.floatingBtn}
                onPress={() => {
                    Alert.alert(
                        'Bağlantı',
                        `Master IP: ${masterIp}`,
                        [
                            { text: 'Bağla', style: 'cancel' },
                            { text: 'Yenilə', onPress: () => { setHasError(false); webViewRef.current?.reload(); } },
                            { text: 'Yeni QR Skan', onPress: goToConnection, style: 'destructive' },
                        ]
                    );
                }}
            >
                <MaterialCommunityIcons name="cog" size={16} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
        backgroundColor: '#F8FAFF',
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
        top: 8,
        left: 8,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(0,0,0,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
    },
});

export default WebViewScreen;
