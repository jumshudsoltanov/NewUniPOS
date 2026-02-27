import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { removeData } from '../utils/storage';

const HomeScreen = ({ navigation }) => {
    const handleLogout = async () => {
        await removeData('profile');
        await removeData('authResult');
        navigation.replace('Login');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Xoş gəldiniz!</Text>
            <Text style={styles.subtitle}>Tezliklə masalar və sifarişlər burada görünəcək.</Text>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutText}>Çıxış</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 30,
    },
    logoutBtn: {
        padding: 15,
        backgroundColor: '#FF3B30',
        borderRadius: 8,
    },
    logoutText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});

export default HomeScreen;
