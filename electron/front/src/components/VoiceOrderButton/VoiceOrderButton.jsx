import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useDispatch, useSelector } from 'react-redux';
import { addProducts } from '../../redux/Slices/OrdersSlice';
import './VoiceOrderButton.css';
import apiConfig from '../../utils/apiConfig';
import { t } from "../../utils/translations";

// Wake words
const WAKE_WORDS = ['aigun', 'aygün', 'aygun', 'ai gun', 'aiğun', 'əygun', 'əygün', 'ayqun'];

// ─── OpenAI TTS (nova female voice — speaks Azerbaijani) ──────────────────
const NORMALIZED_WAKE_WORDS = [
    ...WAKE_WORDS,
    'aygün',
    'ay gun',
    'eygun',
    'eygün',
].map((word) => word
    .toLowerCase()
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ğ/g, 'g')
    .replace(/ç/g, 'c')
    .replace(/ş/g, 's')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
).filter(Boolean);

const normalizeVoiceText = (text = '') => text
    .toLowerCase()
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ğ/g, 'g')
    .replace(/ç/g, 'c')
    .replace(/ş/g, 's')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const ORDER_FILLER_RE = /\b(\d+|bir|iki|uc|dord|bes|alti|yeddi|sekkiz|doqquz|on|eded|edet|dene|tane|elave|et|vur|qoy|getir|ver|xahis|zehmet|olmasa)\b/g;

const hasLikelyOrderContent = (command = '') => {
    const cleaned = normalizeVoiceText(command).replace(ORDER_FILLER_RE, '').replace(/\s+/g, ' ').trim();
    return cleaned.length >= 2;
};

const extractInlineCommand = (transcript = '') => {
    const normalized = normalizeVoiceText(transcript);
    if (!normalized) return '';

    const wakeWords = [...NORMALIZED_WAKE_WORDS].sort((a, b) => b.length - a.length);
    for (const wakeWord of wakeWords) {
        const index = normalized.indexOf(wakeWord);
        if (index === -1) continue;

        return normalized
            .slice(index + wakeWord.length)
            .replace(/^(de|da|xahis|zehmet olmasa)\s+/, '')
            .trim();
    }

    return '';
};

let audioCtx = null;
const getAudioCtx = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
};

const speak = async (text, baseURL) => {
    try {
        const response = await axios.post(`${baseURL}/tts`, { text }, { responseType: 'arraybuffer' });
        const ctx = getAudioCtx();
        if (ctx.state === 'suspended') await ctx.resume();
        const audioBuffer = await ctx.decodeAudioData(response.data);
        return new Promise((resolve) => {
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.onended = resolve;
            source.start(0);
        });
    } catch (err) {
        console.warn('TTS failed, skipping speech:', err.message);
    }
};

// ─── Component ────────────────────────────────────────────────────────────
const BASE_URL = apiConfig.defaults.baseURL;

const VoiceOrderButton = () => {
    const [status, setStatus] = useState('idle'); // idle | listening | awake | recording | processing
    const [enabled, setEnabled] = useState(false);

    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recognitionRef = useRef(null);
    const autoStopRef = useRef(null);
    const statusRef = useRef('idle');
    const enabledRef = useRef(false);
    const restartTimerRef = useRef(null);
    const speechDetectedRef = useRef(false);

    const dispatch = useDispatch();
    const { menu } = useSelector((state) => state.OrderSlice);
    const menuRef = useRef(menu);
    useEffect(() => { menuRef.current = menu; }, [menu]);

    const setStatusBoth = (s) => {
        statusRef.current = s;
        setStatus(s);
    };

    // ── Build menu payload ────────────────────────────────────────────────
    const buildMenuData = () => {
        return (menuRef.current || []).map(m => {
            let modifiersList = [];
            if (m.modifier_groups) {
                let groups = m.modifier_groups;
                if (typeof groups === 'string') {
                    try { groups = JSON.parse(groups); } catch (e) { groups = []; }
                }
                if (typeof groups === 'object' && groups !== null && !Array.isArray(groups)) {
                    groups = Object.values(groups);
                }
                if (!Array.isArray(groups)) groups = [];
                groups.forEach(g => {
                    (g.items || []).forEach(i => modifiersList.push({ id: i.id, name: i.name }));
                });
            }
            return { id: m.id, name: m.name, price: m.price, modifiers: modifiersList };
        });
    };

    // ── Stop order recording ──────────────────────────────────────────────
    const handleVoiceOrderResponse = useCallback(async (data) => {
        if (data?.success) {
            if (data.ignored) {
                return;
            }
            if (data.wake) {
                await speak('Buyurun, sizi eşidirəm.', BASE_URL);
                return;
            }
            const items = data.items || [];
            const currentMenu = menuRef.current || [];

            if (items.length > 0) {
                items.forEach(item => {
                    const product = currentMenu.find(m => String(m.id) === String(item.product_id));
                    if (!product) return;

                    const formattedModifiers = [];
                    if (item.modifiers && Array.isArray(item.modifiers)) {
                        let groups = product.modifier_groups;
                        if (typeof groups === 'string') {
                            try { groups = JSON.parse(groups); } catch (e) { groups = []; }
                        }
                        if (typeof groups === 'object' && groups !== null && !Array.isArray(groups)) groups = Object.values(groups);
                        if (!Array.isArray(groups)) groups = [];
                        groups.forEach(g => {
                            (g.items || []).forEach(modItem => {
                                if (item.modifiers.includes(modItem.id)) {
                                    formattedModifiers.push({
                                        id: modItem.id, name: modItem.name,
                                        price: parseFloat(modItem.price || 0), count: 1,
                                        printer_id: modItem.printer_id,
                                        category_id: modItem.category_id,
                                        printer_details: modItem.printer_details || []
                                    });
                                }
                            });
                        });
                    }

                    const itemCount = Number(item.count);
                    const count = Number.isFinite(itemCount) && itemCount > 0 ? itemCount : 1;
                    dispatch(addProducts({
                        ...product,
                        count,
                        quantity: count,
                        comment: item.comment || null,
                        modifiers: formattedModifiers
                    }));
                });

                const nameList = items.map(i => {
                    const p = currentMenu.find(m => String(m.id) === String(i.product_id));
                    return `${i.count || 1} ${p?.name || ''}`;
                }).join(', ');

                toast.success(t("sifaris_elave_edildi"));
                await speak(`${nameList} əlavə edildi.`, BASE_URL);
            } else {
                toast.warning(t("mehsul_tapilmadi"));
                await speak('Üzr istəyirəm, məhsulu tapa bilmədim. Yenidən cəhd edin.', BASE_URL);
            }
        } else {
            await speak('Xəta baş verdi.', BASE_URL);
        }
    }, [dispatch]);

    const stopOrderRecording = useCallback(() => {
        if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    // ── Process audio with Whisper + GPT ─────────────────────────────────
    const processAudio = useCallback(async () => {
        if (audioChunksRef.current.length === 0 || !speechDetectedRef.current) {
            audioChunksRef.current = [];
            setStatusBoth('listening');
            return;
        }
        speechDetectedRef.current = false;
        setStatusBoth('processing');

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'order.webm');
        formData.append('menu', JSON.stringify(buildMenuData()));

        try {
            const response = await axios.post(`${apiConfig.defaults.baseURL}/voice-order`, formData, { timeout: 45000 });
            await handleVoiceOrderResponse(response.data);
            return;

            if (response.data?.success) {
                const items = response.data.items || [];
                const currentMenu = menuRef.current || [];

                if (items.length > 0) {
                    items.forEach(item => {
                        const product = currentMenu.find(m => m.id === item.product_id);
                        if (!product) return;

                        const formattedModifiers = [];
                        if (item.modifiers && Array.isArray(item.modifiers)) {
                            let groups = product.modifier_groups;
                            if (typeof groups === 'string') {
                                try { groups = JSON.parse(groups); } catch (e) { groups = []; }
                            }
                            if (typeof groups === 'object' && groups !== null && !Array.isArray(groups)) groups = Object.values(groups);
                            if (!Array.isArray(groups)) groups = [];
                            groups.forEach(g => {
                                (g.items || []).forEach(modItem => {
                                    if (item.modifiers.includes(modItem.id)) {
                                        formattedModifiers.push({
                                            id: modItem.id, name: modItem.name,
                                            price: parseFloat(modItem.price || 0), count: 1,
                                            printer_id: modItem.printer_id,
                                            category_id: modItem.category_id,
                                            printer_details: modItem.printer_details || []
                                        });
                                    }
                                });
                            });
                        }

                        dispatch(addProducts({
                            ...product, count: item.count || 1, quantity: item.count || 1,
                            comment: item.comment || null, modifiers: formattedModifiers
                        }));
                    });

                    const nameList = items.map(i => {
                        const p = currentMenu.find(m => m.id === i.product_id);
                        return `${i.count || 1} ${p?.name || ''}`;
                    }).join(', ');

                    toast.success(t("sifaris_elave_edildi"));
                    await speak(`${nameList} əlavə edildi.`, BASE_URL);
                } else {
                    toast.warning(t("mehsul_tapilmadi"));
                    await speak('Üzr istəyirəm, başa düşmədim. Yenidən cəhd edin.', BASE_URL);
                }
            } else {
                await speak('Xəta baş verdi.', BASE_URL);
            }
        } catch (err) {
            console.error('Voice order error:', err);
            toast.error(err.response?.data?.message || 'Xəta baş verdi');
        } finally {
            setStatusBoth('listening');
        }
    }, [handleVoiceOrderResponse]);

    // ── Start recording the spoken order ─────────────────────────────────
    const processTextCommand = useCallback(async (commandText) => {
        const text = normalizeVoiceText(commandText);
        if (!hasLikelyOrderContent(text)) {
            setStatusBoth('listening');
            return;
        }

        setStatusBoth('processing');
        try {
            const response = await axios.post(`${apiConfig.defaults.baseURL}/voice-order`, {
                text,
                menu: JSON.stringify(buildMenuData()),
            }, { timeout: 30000 });
            await handleVoiceOrderResponse(response.data);
        } catch (err) {
            console.error('Voice text order error:', err);
            toast.error(err.response?.data?.message || 'Xəta baş verdi');
        } finally {
            setStatusBoth('listening');
        }
    }, [handleVoiceOrderResponse]);

    const startOrderRecording = useCallback(async () => {
        try {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') return;
            if (!streamRef.current || streamRef.current.getTracks().every(t => t.readyState === 'ended')) {
                streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            mediaRecorderRef.current = new MediaRecorder(streamRef.current);
            audioChunksRef.current = [];
            speechDetectedRef.current = false;
            mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mediaRecorderRef.current.onstop = processAudio;
            mediaRecorderRef.current.start();
            setStatusBoth('recording');

            const GRACE_PERIOD = 350;     // quick wait for user to start speaking
            const SILENCE_THRESHOLD = 12; // mic amplitude cutoff
            const SILENCE_DELAY = 650;    // short silence = done speaking
            const MAX_DURATION = 5500;    // hard max 5.5 sec

            const hardStop = setTimeout(() => {
                stopOrderRecording();
            }, MAX_DURATION);
            autoStopRef.current = hardStop;

            // Wait grace period THEN start silence detection
            setTimeout(() => {
                if (statusRef.current !== 'recording') return;

                const silenceCtx = new (window.AudioContext || window.webkitAudioContext)();
                const source2 = silenceCtx.createMediaStreamSource(streamRef.current);
                const analyser = silenceCtx.createAnalyser();
                analyser.fftSize = 512;
                source2.connect(analyser);
                const data = new Uint8Array(analyser.frequencyBinCount);

                let silenceStart = null;
                let hasSpeech = false;

                const checkSilence = () => {
                    if (statusRef.current !== 'recording') {
                        try { silenceCtx.close(); } catch(e) {}
                        return;
                    }
                    analyser.getByteFrequencyData(data);
                    const avg = data.reduce((a, b) => a + b, 0) / data.length;

                    if (avg > SILENCE_THRESHOLD) {
                        hasSpeech = true;
                        speechDetectedRef.current = true;
                        silenceStart = null;
                    } else if (hasSpeech) {
                        if (!silenceStart) silenceStart = Date.now();
                        if (Date.now() - silenceStart > SILENCE_DELAY) {
                            clearTimeout(hardStop);
                            try { silenceCtx.close(); } catch(e) {}
                            stopOrderRecording();
                            return;
                        }
                    }
                    requestAnimationFrame(checkSilence);
                };
                requestAnimationFrame(checkSilence);
            }, GRACE_PERIOD);

        } catch (err) {
            console.error('Microphone error:', err);
            setStatusBoth('listening');
        }
    }, [processAudio, stopOrderRecording]);

    // ── Wake word recognition ─────────────────────────────────────────────
    const startRecognition = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
        }

        const rec = new SR();
        // Turkish recognition catches "Aygün" more reliably than unsupported az-AZ in Chromium
        rec.lang = 'tr-TR';
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 5;
        recognitionRef.current = rec;

        rec.onresult = async (event) => {
            if (statusRef.current !== 'listening') return;

            for (let i = event.resultIndex; i < event.results.length; i++) {
                for (let j = 0; j < event.results[i].length; j++) {
                    const transcript = event.results[i][j].transcript.toLowerCase().trim();
                    const normalizedTranscript = normalizeVoiceText(transcript);
                    if (NORMALIZED_WAKE_WORDS.some(w => normalizedTranscript.includes(w))) {
                        const inlineCommand = extractInlineCommand(transcript);
                        setStatusBoth('awake');
                        // Pause recognition during order
                        try { rec.stop(); } catch (e) { /* ignore */ }
                        if (hasLikelyOrderContent(inlineCommand)) {
                            await processTextCommand(inlineCommand);
                            return;
                        }
                        await speak('Buyurun, sizi dinləyirəm!', BASE_URL);
                        await startOrderRecording();
                        return;
                    }
                    if (hasLikelyOrderContent(transcript)) {
                        try { rec.stop(); } catch (e) { /* ignore */ }
                        await processTextCommand(transcript);
                        return;
                    }
                }
            }
        };

        rec.onend = () => {
            if (!enabledRef.current) return;
            // If we are still in 'listening' state, restart
            if (statusRef.current === 'listening') {
                restartTimerRef.current = setTimeout(() => {
                    if (enabledRef.current && statusRef.current === 'listening') {
                        startRecognition();
                    }
                }, 300);
            }
        };

        rec.onerror = (e) => {
            if (e.error === 'no-speech' || e.error === 'aborted') return;
            // On network / language error try tr-TR fallback
            if (e.error === 'language-not-supported' || e.error === 'service-not-allowed') {
                rec.lang = 'tr-TR';
            }
        };

        try { rec.start(); } catch (e) { /* ignore double-start */ }
    }, [processTextCommand, startOrderRecording]);

    // Resume wake-word listening after order is done
    useEffect(() => {
        if (enabled && status === 'listening') {
            startOrderRecording();
        }
    }, [enabled, status]); // eslint-disable-line

    // ── Toggle AiGün on / off ─────────────────────────────────────────────
    const toggleAiGun = useCallback(async () => {
        if (enabledRef.current && statusRef.current === 'listening') {
            if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
            if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
                recognitionRef.current = null;
            }
            setStatusBoth('awake');
            await speak('Buyurun, sifarişinizi deyin.', BASE_URL);
            await startOrderRecording();
            toast.success(t("aigun_dinleyir_sifarisinizi_deyin"));
            return;
        }

        if (enabledRef.current) {
            // Turn off
            enabledRef.current = false;
            setEnabled(false);
            if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
            stopOrderRecording();
            if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
                recognitionRef.current = null;
            }
            setStatusBoth('idle');
            toast.info(t("aigun_deaktiv_edildi"));
        } else {
            // Turn on
            enabledRef.current = true;
            setEnabled(true);
            setStatusBoth('awake');
            await speak('Buyurun, sifarişinizi deyin.', BASE_URL);
            await startOrderRecording();
            toast.success(t("aigun_dinleyir_sifarisinizi_deyin"));
            return;
            await speak('Salam! Mən AiGün. Hazıram, buyurun!', BASE_URL);
            startRecognition();
            toast.success(t("aigun_aktiv_aigun_deyerek_sifarisinizi_bildirin"));
        }
    }, [stopOrderRecording, startOrderRecording]);

    // Auto-enable AiGün on screen load, cleanup on unmount
    useEffect(() => {
        enabledRef.current = true;
        setEnabled(true);
        setStatusBoth('listening');
        startOrderRecording();

        return () => {
            enabledRef.current = false;
            if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
            if (autoStopRef.current) clearTimeout(autoStopRef.current);
            if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
            window.speechSynthesis?.cancel();
        };
    }, []); // eslint-disable-line

    // ── Status label ──────────────────────────────────────────────────────
    const labels = {
        idle: 'AiGün',
        listening: 'Dinləyirəm...',
        awake: 'Hazıram!',
        recording: 'Sizi eşidirəm...',
        processing: 'Analiz edilir...',
    };

    const isActive = enabled && status !== 'idle';
    const isRecordingOrder = status === 'recording' || status === 'awake';
    const isProc = status === 'processing';

    return (
        <div className="aigun-container aigun-auto">
            {isActive && (
                <div className={`aigun-status ${isRecordingOrder ? 'awake' : status === 'listening' ? 'listening' : ''}`}>
                    <span className="aigun-status-dot"></span>
                    <span className="aigun-status-text">{labels[status]}</span>
                </div>
            )}
        </div>
    );

    return (
        <div className="aigun-container">
            {isActive && (
                <div className={`aigun-status ${isRecordingOrder ? 'awake' : status === 'listening' ? 'listening' : ''}`}>
                    <span className="aigun-status-dot"></span>
                    <span className="aigun-status-text">{labels[status]}</span>
                </div>
            )}

            <button
                className={`voice-order-btn ${isRecordingOrder ? 'recording' : ''} ${isProc ? 'processing' : ''} ${enabled && !isRecordingOrder && !isProc ? 'aigun-on' : ''}`}
                onClick={toggleAiGun}
                disabled={isProc}
                title={enabled ? '"AiGün" deyərək sifarişinizi bildirin' : 'AiGün-ü aktivləşdirmək üçün klikləyin'}
            >
                {isProc ? (
                    <div className="spinner-border spinner-border-sm text-white" role="status"></div>
                ) : isRecordingOrder ? (
                    <span className="recording-waves">
                        <span className="wave"></span>
                        <span className="wave"></span>
                        <span className="wave"></span>
                    </span>
                ) : enabled ? (
                    <span className="aigun-logo">AI</span>
                ) : (
                    <i className="bi bi-mic"></i>
                )}
            </button>
        </div>
    );
};

export default VoiceOrderButton;
