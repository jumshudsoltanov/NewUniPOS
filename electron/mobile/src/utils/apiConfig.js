import axios from 'axios';
import { io } from 'socket.io-client';
import { getData } from './storage';

let baseURL = '';
let socket = null;

export const setBaseUrl = (ip) => {
    baseURL = `http://${ip}:55667`; // Updated port to match Electron server
};

export const getBaseUrl = () => baseURL;

export const api = axios.create();

api.interceptors.request.use(async (config) => {
    if (!config.baseURL) {
        const ip = await getData('master_ip');
        if (ip) {
            config.baseURL = `http://${ip}:55667/api`;
        }
    }
    return config;
});

export const initSocket = (ip) => {
    if (socket) socket.disconnect();
    socket = io(`http://${ip}:55667`);
    return socket;
};

export const getSocket = () => socket;
