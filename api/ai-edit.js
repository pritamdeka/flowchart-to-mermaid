import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  try {
    const { prompt, currentCode } = req.body;

    const messages = [
      {
        role: "system",
        content:
          "You are an assistant that edits Mermaid.js code. You take user instructions and modify the provided Mermaid code accordingly. Always output ONLY valid Mermaid syntax, nothing else."
      },
      {
        role: "user",
        content: `Current Mermaid code:\n${currentCode}\n\nUser request:\n${prompt}\n\nReturn only updated Mermaid code:`
      }
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4.1",
      messages,
      temperature: 0.2
    });

    const updatedCode = completion.choices[0].message.content.trim();
    res.status(200).json({ updatedCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI editing failed." });
  }
}
