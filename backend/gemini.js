const axios = require("axios");

async function evaluateAnswer(question, studentCode, language = "javascript", maxMarks = 100) {
  const prompt = `
    You are an expert software engineer and teacher. Your task is to evaluate a student's code submission.
    
    Question: ${question}
    Language: ${language}
    Student Code: 
    \`\`\`${language}
    ${studentCode}
    \`\`\`
    Max Marks: ${maxMarks}

    Return ONLY a JSON object with this exact structure:
    {
      "score": <calculated_score_out_of_max_marks>,
      "grade": "<grade_letter_e.g_A_B_C_D_F>",
      "feedback": "<concise_summary_of_strengths_and_weaknesses>",
      "improvements": [
        "<suggestion_1>",
        "<suggestion_2>",
        ...
      ]
    }
  `;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        // model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1, // Lower temperature for more consistent JSON
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = response.data.choices[0].message.content;
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}") + 1;
    return JSON.parse(content.slice(start, end));
  } catch (err) {
    console.error("AI Evaluation Error:", err.message);
    throw new Error("Failed to evaluate code with AI.");
  }
}

module.exports = evaluateAnswer;
