import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, ActivityIndicator, View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import { getData, removeData } from '../utils/storage';
import { CommonActions } from '@react-navigation/native';

const WebViewScreen = ({ navigation }) => {
    const [url, setUrl] = useState(null);
    const [hasError, setHasError] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const webViewRef = useRef(null);

    useEffect(() => {
        const loadUrl = async () => {
            const ip = await getData('master_ip');
            if (ip) {
                setUrl(`http://${ip}:5173`);
            } else {
                goToConnection();
            }
        };
        loadUrl();
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
                <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
                <ActivityIndicator size="large" color="#053796" />
            </View>
        );
    }

    if (hasError) {
        return (
            <View style={styles.center}>
                <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
                <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
                <Text style={styles.errorTitle}>Bağlantı xətası</Text>
                <Text style={styles.errorMsg}>{errorMsg}</Text>
                <Text style={styles.errorUrl}>{url}</Text>

                <TouchableOpacity style={styles.btn} onPress={() => { setHasError(false); webViewRef.current?.reload(); }}>
                    <Text style={styles.btnText}>🔄 Yenidən cəhd et</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={goToConnection}>
                    <Text style={[styles.btnText, { color: '#053796' }]}>📡 Yeni IP daxil et</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#053796' }}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <WebView
                ref={webViewRef}
                source={{ uri: url }}
                style={{ flex: 1, backgroundColor: '#053796' }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                startInLoadingState={true}
                scalesPageToFit={false}
                scrollEnabled={false}
                bounces={false}
                overScrollMode="never"
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                contentMode="mobile"
                mixedContentMode="always"
                allowsBackForwardNavigationGestures={false}
                onError={handleError}
                onMessage={(event) => {
                    console.log('[WebView]', event.nativeEvent.data);
                }}
                injectedJavaScript={`
                    (function() {
                        // Forward console to React Native
                        var origLog = console.log;
                        var origWarn = console.warn;
                        var origError = console.error;
                        function send(type, args) {
                            try {
                                window.ReactNativeWebView.postMessage(JSON.stringify({type: type, data: Array.from(args).map(function(a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' ')}));
                            } catch(e) {}
                        }
                        console.log = function() { send('log', arguments); origLog.apply(console, arguments); };
                        console.warn = function() { send('warn', arguments); origWarn.apply(console, arguments); };
                        console.error = function() { send('error', arguments); origError.apply(console, arguments); };
                        window.addEventListener('error', function(e) { send('error', ['UNCAUGHT: ' + e.message + ' at ' + e.filename + ':' + e.lineno]); });
                        window.addEventListener('unhandledrejection', function(e) { send('error', ['UNHANDLED PROMISE: ' + (e.reason ? (e.reason.message || JSON.stringify(e.reason)) : 'unknown')]); });

                        // Viewport
                        var meta = document.querySelector('meta[name="viewport"]');
                        if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'viewport'); document.head.appendChild(meta); }
                        meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover');

                        // Prevent iOS zoom on inputs
                        var style = document.createElement('style');
                        style.textContent = 'input, select, textarea { font-size: 16px !important; } body, html { -webkit-text-size-adjust: 100%; margin: 0; padding: 0; }';
                        document.head.appendChild(style);

                        // Prevent pinch zoom
                        document.addEventListener('gesturestart', function(e) { e.preventDefault(); }, { passive: false });

                        // Prevent scroll on input focus
                        document.addEventListener('focusin', function(e) {
                            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                                setTimeout(function() { window.scrollTo(0, 0); }, 100);
                            }
                        });
                    })();
                    true;
                `}
                renderLoading={() => (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color="#053796" />
                    </View>
                )}
            />
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
