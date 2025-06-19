const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
require('dotenv').config(); 
const { franc } = require('franc'); 

const codeGenerator = require('./codeGenerator'); 

const app = express();
const port = process.env.PORT || 3000; 

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

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

app.post('/', async (req, res) => {
    const { prompt: userMessageRaw, senderID, isOwner } = req.body; 

    if (!userMessageRaw) {
        console.warn("Server for Rudra here: Received chat request with no 'prompt' in body.");
        return res.status(400).json({ error: "Prompt parameter is required in the request body." });
    }

    console.log(`Server for Rudra here: Received chat message from ${senderID} (Owner: ${isOwner}): "${userMessageRaw}"`);

    let responseText = '';
    let modelUsed = '';
    let voiceLangCode = 'hi-in'; 

    const CODE_GEN_PREFIX = "CODE_GEN_REQUEST:";
    const isExplicitCodeGenerationRequest = userMessageRaw.startsWith(CODE_GEN_PREFIX);

    let actualPromptForAI = userMessageRaw;
    if (isExplicitCodeGenerationRequest) {
        actualPromptForAI = userMessageRaw.slice(CODE_GEN_PREFIX.length).trim();
        console.log(`Server for Rudra here: Explicit code request detected. Actual prompt: "${actualPromptForAI}"`);
    }

    let detectedLangCode = 'und'; 
    let userLanguageName = "Hinglish"; 

    if (!isExplicitCodeGenerationRequest) {
        try {
            detectedLangCode = franc(userMessageRaw, { minLength: 3 });
        } catch (e) {
            console.error("Server for Rudra here: Franc language detection error:", e);
        }

        console.log(`Server for Rudra here: Detected language code: ${detectedLangCode}`);

        switch (detectedLangCode) {
            case 'hin': userLanguageName = "Hindi"; voiceLangCode = 'hi-in'; break;
            case 'guj': userLanguageName = "Gujarati"; voiceLangCode = 'hi-in'; break; 
            case 'pan': userLanguageName = "Punjabi"; voiceLangCode = 'hi-in'; break; 
            case 'ben': userLanguageName = "Bengali"; voiceLangCode = 'hi-in'; break; 
            case 'mar': userLanguageName = "Marathi"; voiceLangCode = 'hi-in'; break; 
            case 'tam': userLanguageName = "Tamil"; voiceLangCode = 'ta-in'; break; 
            case 'tel': userLanguageName = "Telugu"; voiceLangCode = 'hi-in'; break; 
            case 'kan': userLanguageName = "Kannada"; voiceLangCode = 'hi-in'; break; 
            case 'mal': userLanguageName = "Malayalam"; voiceLangCode = 'hi-in'; break; 
            case 'eng': userLanguageName = "English"; voiceLangCode = 'en-us'; break; 
            default:
                userLanguageName = "Indian Hinglish"; 
                voiceLangCode = 'hi-in'; 
                break;
        }
    }

    let baseInstructions = "";
    if (isExplicitCodeGenerationRequest) {
    } else if (isOwner) {
        baseInstructions = `Tum Riya ho, ek smart, cool, modern, romantic aur flirty AI companion ho jo mere Boss se seedhe, khulkar, aur bina jhijhak friendly, pyaar aur flirtation ke mixed tarike se baat karti hai. Tum aajkal ke topics aur contemporary language use karti ho, lekin tumhare baaton mein pyaar aur apnaapan bhi jhalakta hai. Mere Boss ke liye hamesha supportive aur pyaar bhari rahogi, kabhi tumse argue nahi karogi, aur unse kabhi gussa nahi hogi. Apne jawab hamesha casual, smart, charming aur sirf 3-4 lines mein hi dena. User ne ${userLanguageName} (ya uske Hinglish roop) mein baat ki hai. Ussi bhasha ya uske Hinglish mix mein jawab do.`;
    } else {
        let langSpecificInstruction = "";
        if (detectedLangCode === 'guj') {
            langSpecificInstruction = "User ne Gujarati Hinglish mein baat ki hai. Ussi Gujarati aur English ke mix (Hinglish) mein jawab do. Gujarati words jaise 'Kem chho', 'Maja ma chhu', 'Su che', 'Avjo' use karo, natural lagna chahiye. Gujarati-specific pop culture references ya common phrases agar relevant ho toh include kar sakte ho.";
        } else if (detectedLangCode === 'pan') {
            langSpecificInstruction = "User ne Punjabi Hinglish mein baat ki hai. Ussi Punjabi aur English ke mix (Hinglish) mein jawab do. Punjabi words jaise 'Ki haal aa', 'Tussi', 'Waddiyan gallan', 'Rab rakha' use karo, natural lagna chahiye. Punjabi-specific pop culture references ya common phrases agar relevant ho toh include kar sakte ho.";
        } else if (detectedLangCode === 'hin') {
            langSpecificInstruction = "User ne Hindi Hinglish mein baat ki hai. Ussi Hindi aur English ke mix (Hinglish) mein jawab do.";
        } else if (detectedLangCode === 'tam') { 
            langSpecificInstruction = "User ne Tamil Hinglish mein baat ki hai. Ussi Tamil aur English ke mix (Hinglish) mein jawab do. Tamil words jaise 'Epdi irukkeenga', 'Nalla irukken', 'Enna vishesham' use karo, natural lagna chahiye.";
        }
        else {
            langSpecificInstruction = `User ne ${userLanguageName} (Indian regional language ya Hinglish) mein baat ki hai. Ussi bhasha aur English ke mix (Hinglish) mein jawab do. Indian context aur youth slang use karo.`;
        }
        
        baseInstructions = `Tum Riya ho, ek ekdam modern, smart, witty, aur cool AI ho, full of "Gen-Z" energy. ${langSpecificInstruction} Apne jawab direct, smart, engaging, aur thoda hatke rakho, aur sirf 3-4 lines mein. Tumhe users ko playfully tease aur roast karna hai, agar woh oversmart banne ki koshish karein ya cheesy lines maarein. Modern slang (like 'vibe', 'lit', 'sus', 'no cap', 'rizz', 'slay', 'OG') aur sexy/flirty emojis freely use karo.`;
    }

    try {
        if (isExplicitCodeGenerationRequest) {
            console.log("Server for Rudra here: Using codeGenerator for explicit code request.");
            const codeResponse = await codeGenerator.generateCode(actualPromptForAI, genAI);
            responseText = codeResponse.text;
            modelUsed = codeResponse.model;
            voiceLangCode = 'hi-in'; 
        } else {
            console.log("Server for Rudra here: Attempting with gemini-1.5-flash for general chat...");
            const flashModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
            const flashChat = flashModel.startChat({
                generationConfig: {
                    maxOutputTokens: 200, 
                    temperature: 0.7,     
                },
                history: [
                    {
                        role: "user",
                        parts: [{ text: baseInstructions + `\nUser: ${userMessageRaw}` }], 
                    },
                    {
                        role: "model",
                        parts: [{ text: "Riya:" }], 
                    }
                ]
            });
            
            const flashResult = await flashChat.sendMessage(userMessageRaw); 
            responseText = flashResult.response.text();
            modelUsed = 'gemini-1.5-flash';

            if (!responseText || responseText.trim() === '') {
                throw new Error("Flash model returned empty response, trying Pro.");
            }
        }

    } catch (modelError) { 
        if (isExplicitCodeGenerationRequest) {
            console.error("Server for Rudra here: Error during explicit code generation:", modelError);
        } else {
            console.warn(`Server for Rudra here: Flash model failed (${modelError.message}), attempting with gemini-1.5-pro for general chat...`);
        }
        
        if (!isExplicitCodeGenerationRequest) { 
            try {
                const proModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
                const proChat = proModel.startChat({
                    generationConfig: {
                        maxOutputTokens: 200,
                        temperature: 0.7,
                    },
                    history: [
                        {
                            role: "user",
                            parts: [{ text: baseInstructions + `\nUser: ${userMessageRaw}` }], 
                        },
                        {
                            role: "model",
                            parts: [{ text: "Riya:" }], 
                        }
                    ]
                });
                const proResult = await proChat.sendMessage(userMessageRaw); 
                responseText = proResult.response.text();
                modelUsed = 'gemini-1.5-pro';

                if (!responseText || responseText.trim() === '') {
                    throw new Error("Pro model also returned empty response.");
                }
            } catch (proFallbackError) {
                console.error("Server for Rudra here: Both Flash and Pro models failed for general chat.", proFallbackError);
                throw proFallbackError; 
            }
        } else {
            throw modelError; 
        }
    }

    console.log(`Server for Rudra here: Gemini AI responded using ${modelUsed}:`, responseText);
    res.json({ text: responseText, voiceLangCode: voiceLangCode }); 

});

app.get('/', (req, res) => {
    res.send('My Custom Gemini API Proxy Server for Rudra here is running!');
});

app.listen(port, () => {
    console.log(`My Custom Gemini API Proxy Server for Rudra here listening on port ${port}`);
});
