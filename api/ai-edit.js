export default async function handler(req, res) {
  try {
    const { prompt, currentCode } = req.body;

    // API key now comes from user-supplied request header
    const apiKey = req.headers["x-user-api-key"];

    if (!prompt || !currentCode)
      return res.status(400).json({ error: "Missing prompt or currentCode." });

    if (!apiKey)
      return res.status(400).json({ error: "Missing API key." });

    const systemPrompt = `
You are an expert Mermaid.js editor.
Modify the provided Mermaid code based on the user’s natural-language request.
Return only the updated Mermaid code (no explanations, no markdown fences).
`;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Current Mermaid code:\n${currentCode}\n\nUser request:\n${prompt}\n\nReturn only updated Mermaid code:`,
      },
    ];

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,   // <-- USER KEY
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages,
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });

    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || "OpenAI API error");

    let updatedCode = d.choices?.[0]?.message?.content?.trim() || "";

    // Remove accidental code fences
    updatedCode = updatedCode
      .replace(/```mermaid\s*/gi, "")
      .replace(/```/g, "")
      .trim();

    return res.status(200).json({ updatedCode });

  } catch (err) {
    console.error("Error in AI edit handler:", err);
    res.status(500).json({ error: err.message });
  }
}
