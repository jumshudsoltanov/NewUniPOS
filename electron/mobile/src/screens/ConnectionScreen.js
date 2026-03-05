import React, { useState, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, Platform,
    KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, ScrollView,
    Modal, Image, StatusBar
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { saveData, getData, removeData } from '../utils/storage';
import { setBaseUrl } from '../utils/apiConfig';

const ConnectionScreen = ({ navigation }) => {
    const [ip, setIp] = useState('');
    const [loading, setLoading] = useState(true);
    const [scanned, setScanned] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    useEffect(() => {
        const init = async () => {
            const savedIp = await getData('master_ip');
            if (savedIp) {
                setIp(savedIp);
                setBaseUrl(savedIp);
                setTimeout(() => navigation.replace('WebView'), 300);
            } else {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleConnect = async (customIp) => {
        const targetIp = customIp || ip;
        const trimmed = targetIp.trim();
        if (!trimmed) {
            Alert.alert('Xəta', 'IP ünvanı daxil edin');
            return;
        }
        Keyboard.dismiss();
        setLoading(true);

        try {
            // Validate connection to Master POS before saving
            // Use a short timeout to not keep the user waiting too long
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 sec timeout

            const response = await fetch(`http://${trimmed}:55667/api/ping`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    await saveData('master_ip', trimmed);
                    setBaseUrl(trimmed);
                    setTimeout(() => navigation.replace('WebView'), 300);
                } else {
                    throw new Error('Yanlış cavab');
                }
            } else {
                throw new Error('Server tapılmadı');
            }
        } catch (error) {
            setLoading(false);
            console.warn('[Connection] Validation failed:', error);
            Alert.alert(
                'Bağlantı xətası',
                `Master POS (${trimmed}) tapılmadı.\n\nEyni şəbəkədə olduğunuzu və Master POS-da UniPOS-un açıq olduğunu yoxlayın.`
            );
        }
    };

    const handleBarCodeScanned = ({ data }) => {
        setScanned(true);
        setShowScanner(false);
        // Assuming the QR code contains just the IP address
        if (data) {
            handleConnect(data);
        }
    };

    const openScanner = async () => {
        const { status } = await requestPermission();
        if (status === 'granted') {
            setShowScanner(true);
            setScanned(false);
        } else {
            Alert.alert('Kamera icazəsi', 'QR kodu skan etmək üçün kamera icazəsi lazımdır.');
        }
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: '#FFFFFF' }]}>
                <StatusBar hidden={false} backgroundColor="#FFFFFF" barStyle="dark-content" />
                <Image
                    source={require('../../assets/unipos_logo.png')}
                    style={[styles.logo, { width: 180, height: 180 }]}
                    resizeMode="contain"
                />
                <ActivityIndicator size="large" color="#053796" style={{ marginTop: 10 }} />
                <Text style={{ marginTop: 15, color: '#64748B', fontSize: 13, fontWeight: '500' }}>Haqlar qorunur © UniPOS</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#FFFFFF' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar hidden={false} backgroundColor="#FFFFFF" barStyle="dark-content" />
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <ScrollView
                    contentContainerStyle={styles.container}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                >
                    <View style={styles.brandArea}>
                        <Image
                            source={require('../../assets/unipos_logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <Text style={styles.subtitle}>Master kompüterin IP ünvanını daxil edin</Text>
                    </View>

                    <View style={styles.inputArea}>
                        <TextInput
                            style={styles.input}
                            placeholder="192.168.1.10"
                            placeholderTextColor="#aaa"
                            value={ip}
                            onChangeText={setIp}
                            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                            autoCorrect={false}
                            autoCapitalize="none"
                            returnKeyType="go"
                            onSubmitEditing={handleConnect}
                            autoFocus={true}
                        />
                    </View>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.connectBtn} onPress={() => handleConnect()}>
                            <Text style={styles.connectBtnText}>Qoşul</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.qrBtn} onPress={openScanner}>
                            <MaterialCommunityIcons name="qrcode-scan" size={24} color="#053796" />
                        </TouchableOpacity>
                    </View>

                    <Modal
                        visible={showScanner}
                        animationType="slide"
                        onRequestClose={() => setShowScanner(false)}
                    >
                        <View style={styles.scannerContainer}>
                            <CameraView
                                style={StyleSheet.absoluteFillObject}
                                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                                barcodeSettings={{
                                    barcodeTypes: ["qr"],
                                }}
                            />
                            <View style={styles.lightOverlay}>
                                <View style={styles.scanBox} />
                                <Text style={styles.scanTextDark}>QR kodu bu çərçivəyə tuşlayın</Text>
                                <TouchableOpacity
                                    style={styles.closeBtnDark}
                                    onPress={() => setShowScanner(false)}
                                >
                                    <Text style={styles.closeBtnTextDark}>Bağla</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                </ScrollView>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0A0E17',
    },
    container: {
        flexGrow: 1,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
        paddingHorizontal: 40,
    },
    brandArea: {
        alignItems: 'center',
        width: '100%',
        marginBottom: 50,
        paddingTop: 20,
    },
    logo: {
        width: 220,
        height: 100,
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    inputArea: {
        width: '100%',
        marginBottom: 20,
    },
    input: {
        width: '100%',
        height: 56,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        paddingHorizontal: 20,
        fontSize: 22,
        backgroundColor: '#F8FAFF',
        textAlign: 'center',
        fontWeight: '600',
        color: '#1E293B',
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
        marginTop: 10,
    },
    connectBtn: {
        flex: 1,
        height: 56,
        backgroundColor: '#4F46E5',
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
    },
    connectBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    qrBtn: {
        width: 65,
        height: 56,
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#4F46E5',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    scannerContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    lightOverlay: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanBox: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: '#fff',
        borderRadius: 20,
        backgroundColor: 'transparent',
    },
    scanTextDark: {
        color: '#1E293B',
        fontSize: 16,
        marginTop: 20,
        fontWeight: '600',
    },
    closeBtnDark: {
        position: 'absolute',
        bottom: 50,
        paddingHorizontal: 30,
        paddingVertical: 12,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    closeBtnTextDark: {
        color: '#1E293B',
        fontSize: 16,
        fontWeight: '600',
    }
});

export default ConnectionScreen;
