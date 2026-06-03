import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useDispatch, useSelector } from 'react-redux';
import { addProducts } from '../../redux/Slices/OrdersSlice';
import './VoiceOrderButton.css';
import apiConfig from '../../utils/apiConfig';

const VoiceOrderButton = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const dispatch = useDispatch();
    const { menu } = useSelector((state) => state.OrderSlice);

    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const startRecording = async () => {
        if (isProcessing) return;
        try {
            if (!streamRef.current) {
                streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            mediaRecorderRef.current = new MediaRecorder(streamRef.current);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = processAudio;
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            toast.error('Mikrofona icazə verilmir və ya xəta baş verdi!');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            // We intentionally do not stop the stream tracks here, so subsequent clicks are instantaneous.
        }
    };

    const processAudio = async () => {
        if (audioChunksRef.current.length === 0) return;
        setIsProcessing(true);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'order.webm');
        
        // Prepare menu data for GPT context
        const menuData = menu.map(m => {
            let modifiersList = [];
            if (m.modifier_groups) {
                let groups = m.modifier_groups;
                if (typeof groups === 'string') {
                    try { groups = JSON.parse(groups); } catch(e) { groups = []; }
                }
                if (typeof groups === 'object' && !Array.isArray(groups)) {
                    groups = Object.values(groups);
                }
                if (Array.isArray(groups)) {
                    groups.forEach(g => {
                        if (g.items) {
                            g.items.forEach(i => {
                                modifiersList.push({ id: i.id, name: i.name });
                            });
                        }
                    });
                }
            }
            return { id: m.id, name: m.name, price: m.price, modifiers: modifiersList };
        });
        formData.append('menu', JSON.stringify(menuData));

        try {
            const response = await axios.post(`${apiConfig.defaults.baseURL}/voice-order`, formData);

            if (response.data && response.data.success) {
                const items = response.data.items;
                if (items && items.length > 0) {
                    items.forEach(item => {
                        const product = menu.find(m => m.id === item.product_id);
                        if (product) {
                            const formattedModifiers = [];
                            if (item.modifiers && Array.isArray(item.modifiers)) {
                                let groups = product.modifier_groups;
                                if (typeof groups === 'string') {
                                    try { groups = JSON.parse(groups); } catch(e) { groups = []; }
                                }
                                if (typeof groups === 'object' && !Array.isArray(groups)) groups = Object.values(groups);
                                if (Array.isArray(groups)) {
                                    groups.forEach(g => {
                                        if (g.items) {
                                            g.items.forEach(modItem => {
                                                // If GPT matched this modifier ID
                                                if (item.modifiers.includes(modItem.id)) {
                                                    formattedModifiers.push({
                                                        id: modItem.id,
                                                        name: modItem.name,
                                                        price: parseFloat(modItem.price || 0),
                                                        count: 1, // assume 1 qty for now for voice modifiers
                                                        printer_id: modItem.printer_id,
                                                        category_id: modItem.category_id,
                                                        printer_details: modItem.printer_details || []
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            }

                            dispatch(addProducts({
                                ...product,
                                count: item.count || 1,
                                quantity: item.count || 1,
                                comment: item.comment || null,
                                modifiers: formattedModifiers
                            }));
                        }
                    });
                    toast.success('Sifariş səsli əlavə edildi!');
                } else {
                    toast.warning(`Başa düşmədim: "${response.data.text}"`);
                }
            } else {
                toast.error('Sifarişi tanımaq olmadı');
            }
        } catch (error) {
            console.error('Process audio error:', error);
            const errorMsg = error.response?.data?.message || 'Səsli sifariş alınarkən xəta baş verdi';
            toast.error(errorMsg);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <button
            className={`voice-order-btn ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            title="Basılı saxla və sifarişi de"
            disabled={isProcessing}
        >
            {isProcessing ? (
                <div className="spinner-border spinner-border-sm text-white" role="status"></div>
            ) : (
                <i className={`bi ${isRecording ? 'bi-mic-fill' : 'bi-mic'}`}></i>
            )}
            {isRecording && <span className="recording-waves"><span className="wave"></span><span className="wave"></span><span className="wave"></span></span>}
        </button>
    );
};

export default VoiceOrderButton;
