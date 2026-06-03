const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const normalizeOrderText = (value = "") => String(value)
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/ş/g, "s")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const AZ_NUMBER_WORDS = {
    bir: 1,
    iki: 2,
    uc: 3,
    dord: 4,
    bes: 5,
    alti: 6,
    yeddi: 7,
    sekkiz: 8,
    doqquz: 9,
    on: 10,
    yarim: 0.5,
};

const ORDER_NOISE_RE = /\b(aygun|ai gun|aigun|eygun|ayqun|buyur|buyurun|eded|edek|ededk|edet|dene|tane|elave|et|vur|qoy|getir|ver|xahis|zehmet|olmasa|lazimdi|lazimdir)\b/g;
const CHICKEN_WORDS = ["toyuq", "toyug", "tavuk", "chicken", "ciken"];

const parseQuantityFromText = (text) => {
    const normalized = normalizeOrderText(text);
    const digitMatch = normalized.match(/(^|\s)(\d+(?:[.,]\d+)?)(?=\s|$)/);
    if (digitMatch) {
        const value = Number(String(digitMatch[2]).replace(",", "."));
        if (Number.isFinite(value) && value > 0) return value;
    }

    for (const [word, value] of Object.entries(AZ_NUMBER_WORDS)) {
        if (new RegExp(`\\b${word}\\b`).test(normalized)) return value;
    }

    return 1;
};

const cleanProductQuery = (text) => normalizeOrderText(text)
    .replace(ORDER_NOISE_RE, " ")
    .replace(/\b\d+(?:[.,]\d+)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const FOREIGN_TRANSCRIPT_NOISE_RE = /\b(pitaa|pita|lahtea|lahte|juoda|vetta|veta|kiitos|mita|etta|olen|sina|mina)\b/g;
const ORDER_INTENT_RE = /\b(aygun|ai gun|aigun|eygun|ayqun|elave|vur|qoy|getir|ver|eded|edet|dene|tane|bir|iki|uc|dord|bes|alti|yeddi|sekkiz|doqquz|on|yarim)\b/;

const sanitizeTranscribedText = (text) => normalizeOrderText(text)
    .replace(/\bkatlet\w*\b/g, "kotlet")
    .replace(/\bkotlet\w{2,}\b/g, "kotlet")
    .replace(/\bqrec?k\w*\b/g, "qrecka")
    .replace(FOREIGN_TRANSCRIPT_NOISE_RE, " ")
    .replace(/\s+/g, " ")
    .trim();

const isWakeOnlyText = (text) => {
    const cleaned = cleanProductQuery(text);
    return !cleaned && /\b(aygun|ai gun|aigun|eygun|ayqun)\b/.test(normalizeOrderText(text));
};

const levenshteinDistance = (a, b) => {
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;

    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    const current = new Array(b.length + 1);

    for (let i = 1; i <= a.length; i++) {
        current[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const insert = current[j - 1] + 1;
            const remove = previous[j] + 1;
            const replace = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
            current[j] = Math.min(insert, remove, replace);
        }
        previous.splice(0, previous.length, ...current);
    }

    return previous[b.length];
};

const tokenMatches = (queryToken, nameToken) => {
    if (!queryToken || !nameToken) return false;
    const stemToken = (token) => token
        .replace(/(dan|den|nan|nen)$/g, "")
        .replace(/(lar|ler)$/g, "")
        .replace(/(li|lu|li)$/g, "")
        .replace(/[aeiou]$/g, "");
    const queryStem = stemToken(queryToken);
    const nameStem = stemToken(nameToken);

    if (nameToken.includes(queryToken) || queryToken.includes(nameToken)) return true;
    if (nameStem.includes(queryStem) || queryStem.includes(nameStem)) return true;
    if (queryStem.length >= 4 && nameStem.length >= 4 && levenshteinDistance(queryStem, nameStem) <= 1) return true;
    return false;
};

const scoreMenuProduct = (query, productName) => {
    const normalizedName = normalizeOrderText(productName);
    if (!query || !normalizedName) return 0;
    if (normalizedName === query) return 300;
    if (normalizedName.includes(query)) return 220;

    const queryTokens = query.split(" ").filter((token) => token.length > 1);
    const nameTokens = normalizedName.split(" ").filter((token) => token.length > 1);
    if (!queryTokens.length || !nameTokens.length) return 0;

    let matched = 0;
    for (const queryToken of queryTokens) {
        if (nameTokens.some((nameToken) => tokenMatches(queryToken, nameToken))) matched += 1;
    }

    const ratio = matched / queryTokens.length;
    return Math.round(ratio * 120 + matched * 18);
};

const textHasAnyWord = (text, words) => {
    const normalized = normalizeOrderText(text);
    return words.some((word) => new RegExp(`\\b${word}\\b`).test(normalized));
};

const removeUnspokenQualifierProducts = (query, scoredProducts) => {
    if (textHasAnyWord(query, CHICKEN_WORDS)) return scoredProducts;

    const hasNonChickenMatch = scoredProducts.some(({ product, score }) => (
        score > 0 && !textHasAnyWord(product?.name || "", CHICKEN_WORDS)
    ));

    if (!hasNonChickenMatch) return scoredProducts;

    return scoredProducts.filter(({ product }) => !textHasAnyWord(product?.name || "", CHICKEN_WORDS));
};

const isGenericQualifierOnlyQuery = (query) => {
    const tokens = normalizeOrderText(query).split(" ").filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => CHICKEN_WORDS.includes(token));
};

const parseMenuData = (menuData) => {
    let menu = [];
    try {
        menu = typeof menuData === "string" ? JSON.parse(menuData || "[]") : menuData;
    } catch {
        menu = [];
    }
    return Array.isArray(menu) ? menu : [];
};

const getMenuCandidates = (orderText, menuData, limit = 12) => {
    const menu = parseMenuData(menuData);
    const count = parseQuantityFromText(orderText);
    const query = cleanProductQuery(orderText);
    if (query.length < 2 || !menu.length) return { count, query, candidates: [] };

    const scoredProducts = menu
        .map((product) => ({ product, score: scoreMenuProduct(query, product.name) }))
        .filter(({ score }) => score > 0);

    const candidates = removeUnspokenQualifierProducts(query, scoredProducts)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return { count, query, candidates };
};

const buildCandidateMenuData = (orderText, menuData) => {
    const { candidates } = getMenuCandidates(orderText, menuData, 18);
    if (!candidates.length) return menuData;
    return JSON.stringify(candidates.map(({ product }) => product));
};

const shouldSkipOpenAIFallback = (orderText, menuData) => {
    const { query, candidates } = getMenuCandidates(orderText, menuData, 4);
    const queryTokens = query.split(" ").filter((token) => token.length > 1);
    if (!candidates.length) return true;
    return queryTokens.length <= 1;
};

const guardOpenAIItems = (orderText, menuData, items) => {
    if (!Array.isArray(items) || !items.length) return [];

    const menu = parseMenuData(menuData);
    const { query, candidates } = getMenuCandidates(orderText, menuData, 10);
    const candidateIds = new Set(candidates.map(({ product }) => String(product.id)));

    return items.filter((item) => {
        const product = menu.find((menuItem) => String(menuItem.id) === String(item.product_id));
        if (!product) return false;
        if (!candidateIds.has(String(product.id))) return false;
        return scoreMenuProduct(query, product.name) >= 120;
    });
};

const buildTranscriptionPrompt = (menuData) => {
    const menuNames = parseMenuData(menuData)
        .map((product) => product?.name)
        .filter(Boolean)
        .slice(0, 80)
        .join(", ");

    return [
        "Azərbaycan dilində restoran sifarişi.",
        "Sözlər: Aygün, əlavə et, ədəd, dənə, vur, qoy, gətir.",
        "Məhsullar:",
        menuNames,
    ].filter(Boolean).join(" ");
};

const shouldIgnoreTranscript = (text, menuData) => {
    const normalized = normalizeOrderText(text);
    if (!normalized || normalized.length < 2) return true;
    const { candidates } = getMenuCandidates(normalized, menuData, 1);
    if (candidates.length) return false;
    return !ORDER_INTENT_RE.test(normalized);
};

const tryLocalParseOrder = (orderText, menuData) => {
    const { count, query, candidates } = getMenuCandidates(orderText, menuData, 3);
    if (query.length < 2 || !candidates.length) return [];
    if (isGenericQualifierOnlyQuery(query)) return [];

    const [best, second] = candidates;
    const gap = best.score - (second?.score || 0);
    const singleToken = query.split(" ").filter((token) => token.length > 1).length === 1;
    const confident = best.score >= 260 || (best.score >= 160 && gap >= (singleToken ? 45 : 25));

    if (!confident) return [];

    return [{
        product_id: best.product.id,
        count,
        comment: null,
        modifiers: [],
    }];
};

const parseOrderTextWithOpenAI = async (orderText, menuData, apiKey) => {
    const systemPrompt = `You are Aygun, a voice assistant for a restaurant POS in Azerbaijan.

Extract ordered products from Azerbaijani text and match them to the provided menu.

Rules:
- Ignore wake words such as "Aygun", "Aygün", "AiGün", "ai gun".
- Add verbs: "əlavə et", "elave et", "vur", "qoy", "gətir", "getir", "ver".
- Quantity words: "ədəd", "eded", "ededk", "edet", "dənə", "dene", "tane".
- Azerbaijani numbers: bir=1, iki=2, üç/uc=3, dörd/dord=4, beş/bes=5, altı/alti=6, yeddi=7, səkkiz/sekkiz=8, doqquz=9, on=10.
- "yarım"/"yarim" means 0.5.
- Match by closest menu name. Example: "kotlet" should match a menu item containing "Kotlet" or "Kotleti".
- Use only product IDs and modifier IDs that exist in Menu. Never invent IDs.
- If no product can be matched, return {"items":[]}.

Return strict JSON:
{
  "items": [
    {
      "product_id": "exact id from Menu",
      "count": 2,
      "comment": null,
      "modifiers": []
    }
  ]
}

Menu: ${menuData}`;

    const completionResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4o-mini",
        temperature: 0.1,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: orderText }
        ],
        response_format: { type: "json_object" }
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 25000
    });

    const parsedContent = JSON.parse(completionResponse.data.choices[0].message.content);
    return Array.isArray(parsedContent.items) ? parsedContent.items : [];
};

const processVoiceOrder = async (req, res) => {
    try {
        console.log("Voice order request received. Body keys:", Object.keys(req.body));
        console.log("File info:", req.file);

        const directText = typeof req.body.text === 'string' ? req.body.text.trim() : "";

        if (!req.file && !directText) {
            console.log("Error: No audio or text provided in request");
            return res.status(400).json({ success: false, message: "No audio or text provided" });
        }

        let apiKey = req.body.apiKey || process.env.OPENAI_API_KEY;
        
        // If not found in process.env, try to read directly from .env file (useful if server wasn't restarted)
        if (!apiKey) {
            try {
                const envPath = path.join(__dirname, '../.env');
                if (fs.existsSync(envPath)) {
                    const envContent = fs.readFileSync(envPath, 'utf8');
                    const match = envContent.match(/OPENAI_API_KEY=(.*)/);
                    if (match && match[1]) {
                        apiKey = match[1].trim();
                        process.env.OPENAI_API_KEY = apiKey; // Cache it
                    }
                }
            } catch (err) {
                console.log("Error reading .env manually:", err);
            }
        }

        if (!apiKey) {
            console.log("Error: OpenAI API Key is missing");
            return res.status(400).json({ success: false, message: "OpenAI API Key is missing. Zəhmət olmasa backend serveri yenidən başladın." });
        }
        
        const menuData = req.body.menu || "[]";

        if (directText) {
            console.log("Direct voice text:", directText);
            if (isWakeOnlyText(directText)) {
                return res.json({ success: true, text: directText, items: [], wake: true, source: "wake" });
            }
            const localItems = tryLocalParseOrder(directText, menuData);
            if (localItems.length) {
                return res.json({ success: true, text: directText, items: localItems, source: "local" });
            }
            if (shouldSkipOpenAIFallback(directText, menuData)) {
                return res.json({ success: true, text: directText, items: [], source: "uncertain_local" });
            }
            const items = guardOpenAIItems(
                directText,
                menuData,
                await parseOrderTextWithOpenAI(directText, buildCandidateMenuData(directText, menuData), apiKey)
            );
            return res.json({ success: true, text: directText, items, source: "openai" });
        }

        // 1. Transcribe audio using Whisper directly via Axios to avoid FormData polyfill issues
        const form = new FormData();
        form.append('file', fs.createReadStream(req.file.path), { filename: 'audio.webm', contentType: 'audio/webm' });
        form.append('model', 'whisper-1');
        form.append('language', 'az');
        form.append('temperature', '0');
        form.append('prompt', buildTranscriptionPrompt(menuData));

        const whisperResponse = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${apiKey}`
            }
        });
        
        const rawTranscribedText = whisperResponse.data.text || "";
        const transcribedText = sanitizeTranscribedText(rawTranscribedText);
        console.log("Transcribed text:", rawTranscribedText, "=>", transcribedText);
        
        // Delete temporary audio file
        fs.unlinkSync(req.file.path);

        if (isWakeOnlyText(transcribedText)) {
            return res.json({ success: true, text: transcribedText, items: [], wake: true, source: "wake" });
        }

        if (shouldIgnoreTranscript(transcribedText, menuData)) {
            return res.json({ success: true, text: transcribedText, items: [], ignored: true, source: "ignored_transcript" });
        }

        const localItems = tryLocalParseOrder(transcribedText, menuData);
        if (localItems.length) {
            return res.json({ success: true, text: transcribedText, items: localItems, source: "local" });
        }

        if (shouldSkipOpenAIFallback(transcribedText, menuData)) {
            return res.json({ success: true, text: transcribedText, items: [], source: "uncertain_local" });
        }

        const items = guardOpenAIItems(
            transcribedText,
            menuData,
            await parseOrderTextWithOpenAI(transcribedText, buildCandidateMenuData(transcribedText, menuData), apiKey)
        );
        return res.json({ success: true, text: transcribedText, items, source: "openai" });

    } catch (error) {
        console.error("Voice order error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Text-to-Speech via OpenAI (nova = female voice) ──────────────────────
const textToSpeech = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ success: false, message: 'Text is required' });

        let apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            try {
                const envPath = path.join(__dirname, '../.env');
                if (fs.existsSync(envPath)) {
                    const envContent = fs.readFileSync(envPath, 'utf8');
                    const match = envContent.match(/OPENAI_API_KEY=(.*)/);
                    if (match && match[1]) { apiKey = match[1].trim(); process.env.OPENAI_API_KEY = apiKey; }
                }
            } catch (err) { /* ignore */ }
        }

        if (!apiKey) return res.status(400).json({ success: false, message: 'OpenAI API Key is missing' });

        const ttsResponse = await axios.post('https://api.openai.com/v1/audio/speech', {
            model: 'tts-1',
            voice: 'nova',
            input: text,
            speed: 0.88
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer'
        });

        res.set('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(ttsResponse.data));
    } catch (error) {
        console.error('TTS error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    processVoiceOrder,
    textToSpeech
};
