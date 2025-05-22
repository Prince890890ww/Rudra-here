const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env file for local development

const app = express();
const port = process.env.PORT || 3000; // Render will provide PORT, else use 3000 for local

// Enable CORS for all origins (for simplicity). In production, you might restrict this.
app.use(cors());
// Middleware to parse JSON bodies (important for receiving 'prompt' in POST request)
app.use(express.json());
// Middleware to parse URL-encoded bodies (though not strictly needed for this POST endpoint, good practice)
app.use(express.urlencoded({ extended: true })); 

// --- Google Gemini AI Configuration ---
// Your API Key will be loaded from Render's environment variables or your local .env file
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

let genAI;
if (GEMINI_API_KEY && GEMINI_API_KEY !== "YOUR_ACTUAL_GEMINI_API_KEY_HERE") {
    try {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        console.log("Server for Rudra here: Google Gemini AI client successfully initialized.");
    } catch (error) {
        console.error("Server for Rudra here: Error initializing Google Gemini AI client:", error.message);
        // If API key is invalid or initialization fails, the server should not start
        // In a production environment, you might want more robust error handling
        process.exit(1); 
    }
} else {
    console.error("Server for Rudra here: GEMINI_API_KEY environment variable is not set or is default. Please set it.");
    process.exit(1); // Exit if API key is missing
}

// --- API Endpoint: / ---
// यह एंडपॉइंट आपके बॉट से JSON बॉडी के साथ POST रिक्वेस्ट प्राप्त करेगा
app.post('/', async (req, res) => {
    // रिक्वेस्ट बॉडी से प्रॉम्प्ट प्राप्त करें (क्योंकि बॉट अब JSON बॉडी में 'prompt' भेज रहा है)
    const userMessage = req.body.prompt; 
    // Optional: Get senderID if your bot sends it for history management
    const senderID = req.body.senderID || 'anonymous_user'; 

    if (!userMessage) {
        console.warn("Server for Rudra here: Received chat request with no 'prompt' in body.");
        return res.status(400).json({ error: "Prompt parameter is required in the request body." });
    }

    console.log(`Server for Rudra here: Received chat message from ${senderID}: "${userMessage}"`);

    let responseText = '';
    let modelUsed = '';

    try {
        // --- पहले gemini-1.5-flash के साथ प्रयास करें ---
        console.log("Server for Rudra here: Attempting with gemini-1.5-flash...");
        const flashModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
        const flashChat = flashModel.startChat({
            generationConfig: {
                maxOutputTokens: 200, // प्रतिक्रिया की लंबाई सीमित करें
                temperature: 0.7,     // रचनात्मकता का स्तर
            },
        });
        const flashResult = await flashChat.sendMessage(userMessage);
        responseText = flashResult.response.text();
        modelUsed = 'gemini-1.5-flash';

        // फ्लैश मॉडल से खाली प्रतिक्रिया के लिए बुनियादी जांच (हालांकि API आमतौर पर त्रुटि देता है)
        if (!responseText || responseText.trim() === '') {
            throw new Error("Flash model returned empty response, trying Pro.");
        }

    } catch (flashError) {
        console.warn(`Server for Rudra here: Flash model failed (${flashError.message}), attempting with gemini-1.5-pro...`);
        // --- gemini-1.5-pro पर फ़ॉलबैक करें ---
        try {
            const proModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
            const proChat = proModel.startChat({
                generationConfig: {
                    maxOutputTokens: 200,
                    temperature: 0.7,
                },
            });
            const proResult = await proChat.sendMessage(userMessage);
            responseText = proResult.response.text();
            modelUsed = 'gemini-1.5-pro';

            // प्रो मॉडल से खाली प्रतिक्रिया के लिए जांच
            if (!responseText || responseText.trim() === '') {
                throw new Error("Pro model also returned empty response.");
            }

        } catch (proError) {
            console.error("Server for Rudra here: Both Flash and Pro models failed.", proError);
            // अंतिम त्रुटि हैंडलिंग के लिए बाहरी कैच ब्लॉक में त्रुटि को फिर से फेंकें
            throw proError;
        }
    }

    // यदि हम यहां पहुंचे, तो फ्लैश या प्रो में से किसी एक द्वारा सफलतापूर्वक प्रतिक्रिया उत्पन्न की गई
    console.log(`Server for Rudra here: Gemini AI responded using ${modelUsed}:`, responseText);
    res.json({ text: responseText }); 

    // --- समग्र त्रुटियों के लिए मौजूदा कैच ब्लॉक ---
    // यह कैच ब्लॉक अब केवल तभी चलेगा जब दोनों मॉडल विफल हो जाएं
    // या कोई अन्य अप्रत्याशित सर्वर-साइड त्रुटि हो।
} catch (error) {
    console.error("Server for Rudra here: Error getting response from Gemini AI:", error);
    // डीबग करने में मदद करने के लिए अधिक विस्तृत त्रुटि जानकारी प्रदान करें
    if (error.response && error.response.data) {
        // यदि उपलब्ध हो तो Google API से पूर्ण त्रुटि प्रतिक्रिया लॉग करें
        console.error("Server for Rudra here: Google API Error Response Data:", error.response.data);
        res.status(error.response.status || 500).json({ 
            error: "Gemini API error occurred.", 
            details: error.response.data.message || error.message 
        });
    } else {
        res.status(500).json({ 
            error: "Internal server error occurred.", 
            details: error.message 
        });
    }
}
});

// --- Basic Root Endpoint ---
// यह एंडपॉइंट रूट URL पर GET रिक्वेस्ट के लिए है, आमतौर पर स्वास्थ्य जांच या एक साधारण संदेश के लिए।
app.get('/', (req, res) => {
    res.send('My Custom Gemini API Proxy Server for Rudra here is running!');
});

// --- Start the server ---
app.listen(port, () => {
    console.log(`My Custom Gemini API Proxy Server for Rudra here listening on port ${port}`);
});

