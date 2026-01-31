const axios = require("axios");

async function getChatResponse(message, context = {}) {
    const { currentTask, studentCode } = context;

    let systemPrompt = "You are a helpful AI coding assistant. A student is working on a coding challenge and has a doubt.";

    if (currentTask) {
        systemPrompt += `\n\nChallenge Title: ${currentTask.title}\nChallenge Description: ${currentTask.description}`;
    }

    if (studentCode) {
        systemPrompt += `\n\nStudent's Current Code:\n\`\`\`\n${studentCode}\n\`\`\``;
    }

    systemPrompt += "\n\nAnswer the student's question concisely and clearly. Focus on explaining concepts and helping them improve their logic.";

    try {
        console.log("Calling Groq API for chat doubt...");
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                temperature: 0.7,
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
                timeout: 30000 // 30 second timeout
            }
        );

        console.log("Chat response received from Groq.");
        return response.data.choices[0].message.content;
    } catch (err) {
        console.error("AI Chat Error:", err.message);
        return "I apologize, but I'm having trouble connecting to the AI brain right now. Please try again in a moment.";
    }
}

module.exports = getChatResponse;
