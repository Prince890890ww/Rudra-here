const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Gemini ya OpenAI का उपयोग करके कोड जनरेट करता है।
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
            throw new Error("Gemini 1.5 Pro returned empty.");
        }

    } catch (error) {
        console.error("CodeGenerator: Gemini failed, trying OpenAI...", error);

        // === Fallback to OpenAI ===
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
            });

            responseText = response.choices[0]?.message?.content || '';
            modelUsed = 'openai-gpt-3.5';

            if (!responseText.trim()) {
                throw new Error("OpenAI GPT-3.5 also returned empty response.");
            }

        } catch (openaiError) {
            console.error("CodeGenerator: OpenAI GPT-3.5 fallback failed:", openaiError);
            throw openaiError;
        }
    }

    return { text: responseText, model: modelUsed };
}

module.exports = {
    generateCode
};
