import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, ActivityIndicator, View, Text, TouchableOpacity, StatusBar, Platform } from 'react-native';
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
    const isFocused = useIsFocused();

    useEffect(() => {
        let isMounted = true;
        const loadUrl = async () => {
            const ip = await getData('master_ip');
            if (isMounted) {
                if (ip) {
                    setMasterIp(ip);
                    // HashRouter üçün parametrləri həm hash-dən əvvəl, həm də sonra veririk ki, hər iki halda pick up olunsun
                    const timestamp = Date.now();
                    const cleanUrl = `http://mobile.unipos.tech/?master_ip=${ip}&t=${timestamp}#/login?master_ip=${ip}`;
                    setUrl(cleanUrl);
                } else {
                    goToConnection();
                }
            }
        };
        // Gözləmə müddətini artırdıq ki, Navigation transition bitməmiş WebView render olmasın və donmasın
        setTimeout(loadUrl, 200);

        return () => {
            isMounted = false;
        };
    }, []);

    const goToConnection = async () => {
        await removeData('master_ip');
        navigation.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: 'Connection' }] })
        );
    };

    const handleError = (syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        setHasError(true);
        setErrorMsg(nativeEvent.description || 'Server tapılmadı');
    };

    if (!url) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#053796" />
            </View>
        );
    }

    if (hasError) {
        return (
            <SafeAreaView style={styles.center}>
                <MaterialCommunityIcons name="alert-circle-outline" size={72} color="#DC2626" style={{ marginBottom: 16 }} />
                <Text style={styles.errorTitle}>Bağlantı xətası</Text>
                <Text style={styles.errorMsg}>{errorMsg}</Text>
                <Text style={styles.errorUrl}>{url}</Text>

                <TouchableOpacity style={styles.btn} onPress={() => { setHasError(false); webViewRef.current?.reload(); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="refresh" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.btnText}>Yenidən cəhd et</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={goToConnection}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="wifi-settings" size={20} color="#053796" style={{ marginRight: 8 }} />
                        <Text style={[styles.btnText, { color: '#053796' }]}>Yeni IP daxil et</Text>
                    </View>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
            <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />
            <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6' }} edges={['top', 'bottom']}>
                {isFocused ? (
                    <WebView
                        ref={webViewRef}
                        source={{ uri: url }}
                        style={{ flex: 1, backgroundColor: '#F3F4F6' }}
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
                        onHttpError={(e) => console.log('HTTP Error:', e.nativeEvent)}
                        androidLayerType="software"
                        injectedJavaScript={`
                            (function() {
                                var meta = document.querySelector('meta[name="viewport"]');
                                if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'viewport'); document.head.appendChild(meta); }
                                meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover');
                                var style = document.createElement('style');
                                style.textContent = 'input, select, textarea { font-size: 16px !important; } body, html { -webkit-text-size-adjust: 100%; background-color: #F3F4F6 !important; }';
                                document.head.appendChild(style);
                                document.addEventListener('gesturestart', function(e) { e.preventDefault(); }, { passive: false });
                            })();
                            true;
                        `}
                        renderLoading={() => (
                            <View style={[styles.center, { backgroundColor: '#F3F4F6' }]}>
                                <ActivityIndicator size="large" color="#053796" />
                            </View>
                        )}
                    />
                ) : (
                    <View style={[styles.center, { backgroundColor: '#F3F4F6' }]}>
                        <ActivityIndicator size="large" color="#053796" />
                    </View>
                )}
            </SafeAreaView>
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
});

export default WebViewScreen;
