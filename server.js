const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const cors = require('cors');
require('dotenv').config(); // For local .env use

const codeGenerator = require('./codeGenerator'); 

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let genAI;
if (GEMINI_API_KEY) {
    try {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        console.log("✅ Gemini AI client initialized.");
    } catch (error) {
        console.error("❌ Error initializing Gemini AI:", error.message);
        process.exit(1);
    }
} else {
    console.error("❌ GEMINI_API_KEY not set.");
    process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// === OpenAI Fallback ===
async function fallbackToOpenAI(fullPrompt) {
    try {
        console.log("⚠️ Falling back to OpenAI GPT-3.5...");
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: fullPrompt }],
        });
        const openaiReply = response.choices[0]?.message?.content || '';
        if (!openaiReply.trim()) throw new Error("OpenAI returned empty response.");
        return { text: openaiReply, model: 'openai-gpt-3.5' };
    } catch (err) {
        console.error("❌ OpenAI GPT-3.5 fallback failed.", err);
        throw err;
    }
}

// === Main Chat Endpoint ===
app.post('/', async (req, res) => {
    const userMessageFull = req.body.prompt;
    const senderID = req.body.senderID || 'anonymous_user';

    if (!userMessageFull) {
        return res.status(400).json({ error: "Prompt parameter is required in the request body." });
    }

    console.log(`📩 Prompt received from ${senderID}: "${userMessageFull}"`);

    let responseText = '';
    let modelUsed = '';

    let languageInstruction = '';
    let actualUserMessageForAI = userMessageFull;

    const langInstructionPrefix = "LANGUAGE_INSTRUCTION:";
    const actualPromptPrefix = "ACTUAL_PROMPT:";

    if (userMessageFull.startsWith(langInstructionPrefix)) {
        const parts = userMessageFull.split(actualPromptPrefix);
        if (parts.length > 1) {
            languageInstruction = parts[0].replace(langInstructionPrefix, '').trim();
            actualUserMessageForAI = parts[1].trim();
            console.log(`🌐 Language: "${languageInstruction}"`);
            console.log(`💬 Actual Prompt: "${actualUserMessageForAI}"`);
        }
    }

    const CODE_GEN_PREFIX = "CODE_GEN_REQUEST:";
    const isExplicitCodeGenerationRequest = actualUserMessageForAI.startsWith(CODE_GEN_PREFIX);
    let finalPromptToGemini = actualUserMessageForAI;

    if (isExplicitCodeGenerationRequest) {
        finalPromptToGemini = actualUserMessageForAI.slice(CODE_GEN_PREFIX.length).trim();
    } else {
        if (languageInstruction) {
            finalPromptToGemini = `${languageInstruction} ${actualUserMessageForAI}`;
        }
    }

    try {
        if (isExplicitCodeGenerationRequest) {
            console.log("🛠️ Using codeGenerator for code request.");
            const codeResponse = await codeGenerator.generateCode(finalPromptToGemini, genAI);
            responseText = codeResponse.text;
            modelUsed = codeResponse.model;
        } else {
            console.log("✨ Trying gemini-1.5-flash...");
            const flashModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
            const flashChat = flashModel.startChat({ generationConfig: { maxOutputTokens: 200, temperature: 0.7 } });
            const flashResult = await flashChat.sendMessage(finalPromptToGemini);
            responseText = flashResult.response.text();
            modelUsed = 'gemini-1.5-flash';

            if (!responseText || responseText.trim() === '') {
                throw new Error("⚠️ Flash returned empty response.");
            }
        }

    } catch (modelError) {
        if (isExplicitCodeGenerationRequest) {
            console.error("❌ Code generation error:", modelError);
            return res.status(500).json({ error: `Code generation failed: ${modelError.message || "Unknown error"}` });
        }

        console.warn(`⚠️ Flash failed: ${modelError.message}, trying gemini-1.5-pro...`);
        try {
            const proModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
            const proChat = proModel.startChat({ generationConfig: { maxOutputTokens: 200, temperature: 0.7 } });
            const proResult = await proChat.sendMessage(finalPromptToGemini);
            responseText = proResult.response.text();
            modelUsed = 'gemini-1.5-pro';

            if (!responseText || responseText.trim() === '') {
                throw new Error("⚠️ Pro also returned empty response.");
            }

        } catch (proFallbackError) {
            console.error("❌ Both Gemini models failed:", proFallbackError);

            try {
                const openaiResult = await fallbackToOpenAI(finalPromptToGemini);
                responseText = openaiResult.text;
                modelUsed = openaiResult.model;
            } catch (finalAIError) {
                return res.status(500).json({ error: `All AI models failed: ${finalAIError.message || "Unknown error"}` });
            }
        }
    }

    console.log(`✅ Replied using ${modelUsed}:`, responseText);
    res.json({ text: responseText });
});

// Root check
app.get('/', (req, res) => {
    res.send('🌐 Rudra AI Server is running!');
});

app.listen(port, () => {
    console.log(`🚀 Rudra AI Server listening on port ${port}`);
});
