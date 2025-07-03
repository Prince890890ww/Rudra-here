const { GoogleGenerativeAI } = require('@google/generative-ai');
// const OpenAI = require('openai'); // OpenAI import hata diya gaya hai

// const openai = new OpenAI({ // OpenAI instance hata diya gaya hai
//   apiKey: process.env.OPENAI_API_KEY
// });

/**
 * Gemini का उपयोग करके कोड जनरेट करता है।
 * @param {string} prompt - कोड जनरेशन के लिए यूज़र का प्रॉम्प्ट
 * @param {GoogleGenerativeAI} genAIInstance - GoogleGenerativeAI इंस्टेंस
 * @returns {Promise<{text: string, model: string}>}
 */
async function generateCode(prompt, genAIInstance) {
    let responseText = '';
    let modelUsed = '';

    try {
        console.log("CodeGenerator: Trying with gemini-1.5-pro...");
        const model = genAIInstance.getGenerativeModel({ model: "gemini-1.5-pro" });

        const chat = model.startChat({
            generationConfig: {
                maxOutputTokens: 1000,
                temperature: 0.2,
                topP: 0.9,
                topK: 40,
            },
        });

        const result = await chat.sendMessage(prompt);
        responseText = result.response.text();
        modelUsed = 'gemini-1.5-pro';

        if (!responseText || responseText.trim() === '') {
            throw new Error("Gemini 1.5 Pro returned empty response. No fallback available."); // Error message update kiya gaya hai
        }

    } catch (error) {
        console.error("CodeGenerator: Gemini failed, no other fallback available:", error); // Console error message update kiya gaya hai
        throw error; // Seedha error throw karega, OpenAI fallback nahi hai ab
    }

    return { text: responseText, model: modelUsed };
}

module.exports = {
    generateCode
};
