import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { saveData, getData } from '../utils/storage';
import { setBaseUrl } from '../utils/apiConfig';

const ConnectionScreen = ({ navigation }) => {
    const [ip, setIp] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const checkExistingIp = async () => {
            const savedIp = await getData('master_ip');
            if (savedIp) {
                setIp(savedIp);
                setBaseUrl(savedIp);
                // Auto navigate if IP exists
                setTimeout(() => {
                    navigation.replace('WebView');
                }, 500);
            }
        };
        checkExistingIp();
    }, []);

    const handleConnect = async () => {
        if (!ip) {
            Alert.alert('Xəta', 'Zəhmət olmasa Master IP daxil edin');
            return;
        }

        setLoading(true);
        try {
            // In a real scenario, we might want to ping the IP here to verify
            await saveData('master_ip', ip);
            setBaseUrl(ip);
            navigation.navigate('WebView');
        } catch (error) {
            Alert.alert('Bağlantı Xətası', 'Master kompüterə bağlanmaq mümkün olmadı');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Mobile POS Connection</Text>
            <Text style={styles.subtitle}>Master kompüterin IP ünvanını daxil edin</Text>

            <TextInput
                style={styles.input}
                placeholder="Məsələn: 192.168.1.10"
                value={ip}
                onChangeText={setIp}
                keyboardType="numeric"
            />

            <TouchableOpacity style={styles.button} onPress={handleConnect} disabled={loading}>
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Qoşul</Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        textAlign: 'center',
    },
    input: {
        width: '100%',
        height: 50,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 20,
        fontSize: 18,
    },
    button: {
        width: '100%',
        height: 50,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
});

export default ConnectionScreen;
