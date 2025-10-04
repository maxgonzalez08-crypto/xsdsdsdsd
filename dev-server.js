import express from 'express';

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/ask-ai', async (req, res) => {
  try {
    const { question, financialData, language } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    let promptToSend = question;
    
    if (financialData && financialData.trim()) {
      promptToSend = `User question: "${question}"\n\nUser's financial situation: ${financialData}\n\nRespond in ${language === 'es' ? 'Spanish' : language === 'ca' ? 'Catalan' : 'English'}.`;
    } else {
      promptToSend = `${question}\n\nRespond in ${language === 'es' ? 'Spanish' : language === 'ca' ? 'Catalan' : 'English'}.`;
    }

    const systemMessage = `You are a helpful financial advisor assistant for a gamified financial education app called FinanQuest. You help users learn about budgeting, saving, debt management, and financial literacy. Always provide practical, educational advice suitable for young adults and students. Keep responses conversational but informative. If you receive personal financial data, provide specific advice based on their actual spending patterns. Respond in ${language === 'es' ? 'Spanish' : language === 'ca' ? 'Catalan' : 'English'}.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: promptToSend }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Groq API error:", data);
      throw new Error(data.error?.message || "AI service error");
    }

    const reply = data.choices?.[0]?.message?.content || "No response";
    return res.status(200).json({ response: reply });
    
  } catch (error) {
    console.error("AI service error:", error);
    return res.status(500).json({ error: "AI service error" });
  }
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Development API server running on port ${PORT}`);
});
