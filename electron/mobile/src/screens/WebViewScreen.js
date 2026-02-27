import React, { useEffect, useState } from 'react';
import { StyleSheet, ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { getData } from '../utils/storage';

const WebViewScreen = () => {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        const loadUrl = async () => {
            const ip = await getData('master_ip');
            if (ip) {
                // Using port 5173 which is Vite's default dev port
                setUrl(`http://${ip}:5173`);
            }
        };
        loadUrl();
    }, []);

    if (!url) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <WebView
                source={{ uri: url }}
                style={styles.webview}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                startInLoadingState={true}
                scalesPageToFit={true}
                mixedContentMode="always"
                renderLoading={() => (
                    <View style={styles.loading}>
                        <ActivityIndicator size="large" color="#007AFF" />
                    </View>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    webview: {
        flex: 1,
    },
    loading: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
});

export default WebViewScreen;
