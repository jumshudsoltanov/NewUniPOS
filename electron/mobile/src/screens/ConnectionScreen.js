import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, Platform,
    KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, ScrollView
} from 'react-native';
import { saveData, getData, removeData } from '../utils/storage';
import { setBaseUrl } from '../utils/apiConfig';

const ConnectionScreen = ({ navigation }) => {
    const [ip, setIp] = useState('');
    const [loading, setLoading] = useState(true);

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

    const handleConnect = async () => {
        const trimmed = ip.trim();
        if (!trimmed) {
            Alert.alert('Xəta', 'IP ünvanı daxil edin');
            return;
        }
        Keyboard.dismiss();
        await saveData('master_ip', trimmed);
        setBaseUrl(trimmed);
        navigation.replace('WebView');
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
                        <Text style={styles.brandIcon}>📡</Text>
                        <Text style={styles.title}>UniPOS Mobile</Text>
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

                    <TouchableOpacity style={styles.connectBtn} onPress={handleConnect}>
                        <Text style={styles.connectBtnText}>Qoşul</Text>
                    </TouchableOpacity>
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
    },
    brandArea: {
        alignItems: 'center',
        marginBottom: 40,
    },
    brandIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#053796',
    },
    subtitle: {
        fontSize: 15,
        color: '#666',
        marginTop: 8,
        textAlign: 'center',
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
});

export default ConnectionScreen;
