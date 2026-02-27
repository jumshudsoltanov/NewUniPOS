import axios from 'axios';
import { io } from 'socket.io-client';
import { getData } from './storage';

let baseURL = '';
let socket = null;

export const setBaseUrl = (ip) => {
    baseURL = `http://${ip}:5000`; // Assuming 5000 is the backend port
};

export const getBaseUrl = () => baseURL;

export const api = axios.create();

api.interceptors.request.use(async (config) => {
    if (!config.baseURL) {
        const ip = await getData('master_ip');
        if (ip) {
            config.baseURL = `http://${ip}:5000/api`;
        }
    }
    return config;
});

export const initSocket = (ip) => {
    if (socket) socket.disconnect();
    socket = io(`http://${ip}:5000`);
    return socket;
};

export const getSocket = () => socket;
