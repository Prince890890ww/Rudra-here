const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Gemini API का उपयोग करके कोड जनरेट करता है।
 * यह फ़ंक्शन मुख्य रूप से कोड-संबंधित प्रॉम्प्ट को संभालने के लिए है।
 * @param {string} prompt - कोड जनरेशन के लिए उपयोगकर्ता का प्रॉम्प्ट।
 * @param {GoogleGenerativeAI} genAIInstance - GoogleGenerativeAI इंस्टेंस।
 * @returns {Promise<{text: string, model: string}>} - जनरेट किया गया कोड और उपयोग किया गया मॉडल।
 */
async function generateCode(prompt, genAIInstance) {
    let responseText = '';
    let modelUsed = '';

    try {
        // कोड जनरेशन के लिए सीधे gemini-1.5-pro का उपयोग करें
        // क्योंकि यह अधिक जटिल कोड को संभालने में बेहतर है।
        console.log("CodeGenerator: Attempting code generation with gemini-1.5-pro...");
        const model = genAIInstance.getGenerativeModel({ model: "gemini-1.5-pro" });

        const chat = model.startChat({
            generationConfig: {
                maxOutputTokens: 1000, // कोड के लिए अधिक आउटपुट टोकन की अनुमति दें
                temperature: 0.2,      // सटीकता के लिए तापमान कम रखें
                topP: 0.9,
                topK: 40,
            },
        });

        const result = await chat.sendMessage(prompt);
        responseText = result.response.text();
        modelUsed = 'gemini-1.5-pro';

        if (!responseText || responseText.trim() === '') {
            throw new Error("Gemini 1.5 Pro model returned empty response for code generation.");
        }

    } catch (error) {
        console.error("CodeGenerator: Error generating code with gemini-1.5-pro:", error);
        // त्रुटि को फिर से फेंकें ताकि server.js इसे पकड़ सके
        throw error;
    }

    return { text: responseText, model: modelUsed };
}

module.exports = {
    generateCode
};

