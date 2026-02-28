import React, { useState, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, Platform,
    KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, ScrollView,
    Modal, Image
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
                navigation.replace('WebView');
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
        await saveData('master_ip', trimmed);
        setBaseUrl(trimmed);
        navigation.replace('WebView');
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
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#053796" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
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

                    <TouchableOpacity style={styles.connectBtn} onPress={() => handleConnect()}>
                        <Text style={styles.connectBtnText}>Qoşul</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.qrBtn} onPress={openScanner}>
                        <MaterialCommunityIcons name="qrcode-scan" size={20} color="#053796" style={{ marginRight: 8 }} />
                        <Text style={styles.qrBtnText}>QR Skaner</Text>
                    </TouchableOpacity>

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
                            <View style={styles.overlay}>
                                <View style={styles.scanBox} />
                                <Text style={styles.scanText}>QR kodu bu çərçivəyə tuşlayın</Text>
                                <TouchableOpacity
                                    style={styles.closeBtn}
                                    onPress={() => setShowScanner(false)}
                                >
                                    <Text style={styles.closeBtnText}>Bağla</Text>
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
        backgroundColor: '#F8FAFF',
    },
    container: {
        flexGrow: 1,
        backgroundColor: '#F8FAFF',
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
        color: '#64748B',
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
        borderColor: '#D1D5DB',
        borderRadius: 14,
        paddingHorizontal: 20,
        fontSize: 22,
        backgroundColor: '#fff',
        textAlign: 'center',
        fontWeight: '600',
        color: '#333',
    },
    connectBtn: {
        width: '100%',
        height: 56,
        backgroundColor: '#053796',
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    connectBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    qrBtn: {
        width: '100%',
        height: 56,
        backgroundColor: '#fff',
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        borderWidth: 1.5,
        borderColor: '#053796',
    },
    qrBtnText: {
        color: '#053796',
        fontSize: 18,
        fontWeight: '700',
    },
    scannerContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
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
    scanText: {
        color: '#fff',
        fontSize: 16,
        marginTop: 20,
        fontWeight: '600',
    },
    closeBtn: {
        position: 'absolute',
        bottom: 50,
        paddingHorizontal: 30,
        paddingVertical: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#fff',
    },
    closeBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    }
});

export default ConnectionScreen;
