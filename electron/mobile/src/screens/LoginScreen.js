import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';
import { authPos } from '../redux/Slices/LoginSlice';
import { saveData } from '../utils/storage';

const LoginScreen = ({ navigation }) => {
    const [brand, setBrand] = useState('');
    const [terminalId, setTerminalId] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const dispatch = useDispatch();

    const handleLogin = async () => {
        if (!terminalId || !password) {
            Alert.alert('Xəta', 'Terminal ID və Şifrə daxil edilməlidir');
            return;
        }

        setLoading(true);
        try {
            const loginPayload = {
                username: brand,
                terminalId: terminalId,
                password: password,
                login: true,
            };

            const result = await dispatch(authPos(loginPayload)).unwrap();
            await saveData('profile', loginPayload);
            await saveData('authResult', result);

            navigation.replace('Home');
        } catch (error) {
            Alert.alert('Xəta', 'Giriş uğursuz oldu. Məlumatları yoxlayın.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.title}>UniPOS Mobile</Text>

                {step === 1 ? (
                    <View style={styles.form}>
                        <Text style={styles.label}>Müəssisə adı</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Məsələn: my_brand"
                            value={brand}
                            onChangeText={setBrand}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity style={styles.button} onPress={() => setStep(2)}>
                            <Text style={styles.buttonText}>İrəli</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.form}>
                        <Text style={styles.label}>Terminal ID</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Məsələn: T1"
                            value={terminalId}
                            onChangeText={setTerminalId}
                            autoCapitalize="none"
                        />

                        <Text style={styles.label}>Şifrə</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="****"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        <View style={styles.row}>
                            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setStep(1)}>
                                <Text style={styles.secondaryButtonText}>Geri</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, styles.flex1]} onPress={handleLogin} disabled={loading}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Daxil ol</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 40,
        textAlign: 'center',
    },
    form: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        width: '100%',
        height: 52,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 20,
        fontSize: 16,
        color: '#111827',
    },
    button: {
        height: 52,
        backgroundColor: '#2563EB',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        width: 80,
        marginRight: 12,
    },
    secondaryButtonText: {
        color: '#374151',
        fontWeight: '600',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    row: {
        flexDirection: 'row',
    },
    flex1: {
        flex: 1,
    },
});

export default LoginScreen;
