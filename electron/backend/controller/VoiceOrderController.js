const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const processVoiceOrder = async (req, res) => {
    try {
        console.log("Voice order request received. Body keys:", Object.keys(req.body));
        console.log("File info:", req.file);

        if (!req.file) {
            console.log("Error: No audio file provided in request");
            return res.status(400).json({ success: false, message: "No audio file provided" });
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
        
        // 1. Transcribe audio using Whisper directly via Axios to avoid FormData polyfill issues
        const form = new FormData();
        form.append('file', fs.createReadStream(req.file.path), { filename: 'audio.webm', contentType: 'audio/webm' });
        form.append('model', 'whisper-1');

        const whisperResponse = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${apiKey}`
            }
        });
        
        const transcribedText = whisperResponse.data.text;
        console.log("Transcribed text:", transcribedText);
        
        // Delete temporary audio file
        fs.unlinkSync(req.file.path);

        // 2. Process text with GPT-4o-mini using Axios to avoid any openai sdk polyfill issues
        const menuData = req.body.menu || "[]";
        
        const systemPrompt = `You are an AI assistant for a restaurant POS system. Your job is to extract order details from a spoken transcript.
You will be provided with a JSON string representing the active menu (including available modifiers).
Match the spoken items to the items in the menu by finding the closest match in name.
Return a strict JSON object with a single key "items" containing an array of objects.
Each object must have:
- product_id: the matched ID from the menu.
- count: the quantity ordered (number, default 1).
- comment: any specific instructions (string, null if none).
- modifiers: an array of modifier IDs (numbers) if any spoken words match the available modifiers for that product.
Menu: ${menuData}`;

        const completionResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: transcribedText }
            ],
            response_format: { type: "json_object" }
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const parsedContent = JSON.parse(completionResponse.data.choices[0].message.content);
        res.json({ success: true, text: transcribedText, items: parsedContent.items || [] });
    } catch (error) {
        console.error("Voice order error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    processVoiceOrder
};
