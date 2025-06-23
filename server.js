Const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env file for local development

// codeGenerator.js को इम्पोर्ट करें
const codeGenerator = require('./codeGenerator'); 

const app = express();
const port = process.env.PORT || 3000; // Render will provide PORT, else use 3000 for local

// Enable CORS for all origins (for simplicity). In production, you might restrict this.
app.use(cors());
// Middleware to parse JSON bodies (important for receiving 'prompt' in POST request)
app.use(express.json());
// Middleware to parse URL-encoded bodies (though not strictly needed for this POST endpoint, good practice)
app.use(express.urlencoded({ extended: true })); 

// --- Google Gemini AI Configuration ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

let genAI;
if (GEMINI_API_KEY && GEMINI_API_KEY !== "YOUR_ACTUAL_GEMINI_API_KEY_HERE") {
    try {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        console.log("Server for Rudra here: Google Gemini AI client successfully initialized.");
    } catch (error) {
        console.error("Server for Rudra here: Error initializing Google Gemini AI client:", error.message);
        process.exit(1); 
    }
} else {
    console.error("Server for Rudra here: GEMINI_API_KEY environment variable is not set or is default. Please set it.");
    process.exit(1); 
}

// --- API Endpoint: / ---
app.post('/', async (req, res) => {
    // --- CHANGES START HERE ---
    // User message aur prompt se language instruction extract karein
    const userMessageFull = req.body.prompt; // Ye ab full prompt hoga jisme language instruction bhi hogi
    const senderID = req.body.senderID || 'anonymous_user'; 

    if (!userMessageFull) {
        console.warn("Server for Rudra here: Received chat request with no 'prompt' in body.");
        return res.status(400).json({ error: "Prompt parameter is required in the request body." });
    }

    console.log(`Server for Rudra here: Received full prompt from ${senderID}: "${userMessageFull}"`);

    let responseText = '';
    let modelUsed = '';

    // --- Extracting actual user message and language instruction ---
    // Hum Riya.js se aane wale prompt ko 'LANGUAGE_INSTRUCTION: [instruction] ACTUAL_PROMPT: [user message]' format mein expect kar rahe hain
    let languageInstruction = '';
    let actualUserMessageForAI = userMessageFull; // By default, full message hi AI prompt hoga

    const langInstructionPrefix = "LANGUAGE_INSTRUCTION:";
    const actualPromptPrefix = "ACTUAL_PROMPT:";

    if (userMessageFull.startsWith(langInstructionPrefix)) {
        const parts = userMessageFull.split(actualPromptPrefix);
        if (parts.length > 1) {
            languageInstruction = parts[0].replace(langInstructionPrefix, '').trim();
            actualUserMessageForAI = parts[1].trim();
            console.log(`Server for Rudra here: Language Instruction: "${languageInstruction}"`);
            console.log(`Server for Rudra here: Actual User Message for AI: "${actualUserMessageForAI}"`);
        }
    }
    // --- CHANGES END HERE ---


    // --- कोड जनरेशन कमांड की जांच करें ---
    const CODE_GEN_PREFIX = "CODE_GEN_REQUEST:";
    // Ab check actualUserMessageForAI par hoga
    const isExplicitCodeGenerationRequest = actualUserMessageForAI.startsWith(CODE_GEN_PREFIX);

    let finalPromptToGemini = actualUserMessageForAI; // Ye prompt Gemini ko bhejenge
    if (isExplicitCodeGenerationRequest) {
        finalPromptToGemini = actualUserMessageForAI.slice(CODE_GEN_PREFIX.length).trim();
        console.log(`Server for Rudra here: Explicit code request detected. Final prompt for code generation: "${finalPromptToGemini}"`);
    } else {
        // --- CHANGES START HERE ---
        // General chat ke liye, language instruction ko actual prompt mein jod do
        if (languageInstruction) {
            finalPromptToGemini = `${languageInstruction} ${actualUserMessageForAI}`;
        }
        console.log(`Server for Rudra here: Final prompt to Gemini for general chat: "${finalPromptToGemini}"`);
        // --- CHANGES END HERE ---
    }
    
    try {
        if (isExplicitCodeGenerationRequest) {
            // यदि स्पष्ट कोड जनरेशन रिक्वेस्ट है, तो codeGenerator का उपयोग करें
            console.log("Server for Rudra here: Using codeGenerator for explicit code request.");
            const codeResponse = await codeGenerator.generateCode(finalPromptToGemini, genAI); // finalPromptToGemini pass kiya
            responseText = codeResponse.text;
            modelUsed = codeResponse.model;
        } else {
            // अन्यथा, सामान्य चैट फ़ॉलबैक लॉजिक का उपयोग करें
            // --- पहले gemini-1.5-flash के साथ प्रयास करें ---
            console.log("Server for Rudra here: Attempting with gemini-1.5-flash for general chat...");
            const flashModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
            const flashChat = flashModel.startChat({
                generationConfig: {
                    maxOutputTokens: 200, 
                    temperature: 0.7,     
                },
            });
            const flashResult = await flashChat.sendMessage(finalPromptToGemini); // yahan finalPromptToGemini bhejenge
            responseText = flashResult.response.text();
            modelUsed = 'gemini-1.5-flash';

            if (!responseText || responseText.trim() === '') {
                throw new Error("Flash model returned empty response, trying Pro.");
            }
        }

    } catch (modelError) { // त्रुटि हैंडलिंग को स्पष्ट किया गया
        if (isExplicitCodeGenerationRequest) {
            console.error("Server for Rudra here: Error during explicit code generation:", modelError);
            // Agar code generation mein error aaye to, ek generic error response bhej do
            return res.status(500).json({ error: `Code generation failed: ${modelError.message || "Unknown error"}` });
        } else {
            console.warn(`Server for Rudra here: Flash model failed (${modelError.message}), attempting with gemini-1.5-pro for general chat...`);
        }
        
        // --- gemini-1.5-pro पर फ़ॉलबैक करें (केवल सामान्य चैट के लिए) ---
        if (!isExplicitCodeGenerationRequest) { // केवल तभी जब यह सामान्य चैट हो
            try {
                const proModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
                const proChat = proModel.startChat({
                    generationConfig: {
                        maxOutputTokens: 200,
                        temperature: 0.7,
                    },
                });
                const proResult = await proChat.sendMessage(finalPromptToGemini); // yahan finalPromptToGemini bhejenge
                responseText = proResult.response.text();
                modelUsed = 'gemini-1.5-pro';

                if (!responseText || responseText.trim() === '') {
                    throw new Error("Pro model also returned empty response.");
                }
            } catch (proFallbackError) {
                console.error("Server for Rudra here: Both Flash and Pro models failed for general chat.", proFallbackError);
                // Dono models fail ho gaye toh client ko error bhejo
                return res.status(500).json({ error: `AI models failed to respond: ${proFallbackError.message || "Unknown error"}` });
            }
        } else {
            // यदि यह एक स्पष्ट कोड रिक्वेस्ट थी और codeGenerator विफल रहा, तो त्रुटि को आगे बढ़ाएं
            // Isko upar handle kar liya gaya hai `return res.status(500)` se
            // throw modelError; 
        }
    }

    console.log(`Server for Rudra here: Gemini AI responded using ${modelUsed}:`, responseText);
    res.json({ text: responseText }); 

}); 

// --- Basic Root Endpoint ---
app.get('/', (req, res) => {
    res.send('My Custom Gemini API Proxy Server for Rudra here is running!');
});

// --- Start the server ---
app.listen(port, () => {
    console.log(`My Custom Gemini API Proxy Server for Rudra here listening on port ${port}`);
});
