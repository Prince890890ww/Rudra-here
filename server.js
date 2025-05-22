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

    try {
        // Use the gemini-pro model for chat
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        // Start a new chat session for each request.
        // If you need persistent chat history, you'd have to implement
        // a server-side storage (e.g., in-memory map, database) for chat histories per senderID.
        // For now, we'll send the entire 'fullPrompt' from the bot as a single message.
        const chat = model.startChat({
            generationConfig: {
                maxOutputTokens: 200, // Limit response length
                temperature: 0.7,     // Creativity level
            },
        });

        const result = await chat.sendMessage(userMessage);
        const responseText = result.response.text();

        console.log("Server for Rudra here: Gemini AI responded with:", responseText);
        // Send back the reply in JSON format with 'text' property, as Riya bot expects
        res.json({ text: responseText }); 

    } catch (error) {
        console.error("Server for Rudra here: Error getting response from Gemini AI:", error);
        // Provide more detailed error information to help debug
        if (error.response && error.response.data) {
            // Log full error response from Google API if available
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
// This endpoint is for GET requests to the root URL, typically for health checks or a simple message.
app.get('/', (req, res) => {
    res.send('My Custom Gemini API Proxy Server for Rudra here is running!');
});

// --- Start the server ---
app.listen(port, () => {
    console.log(`My Custom Gemini API Proxy Server for Rudra here listening on port ${port}`);
});

