export default async function handler(req, res) {
  try {
    const { prompt, currentCode, apiKey } = req.body;
    // Note: I'm assuming you have a way to handle the API key (apiKey) in a real environment, 
    // even though the provided code uses process.env.OPENAI_API_KEY. I'll maintain that structure.

    // Check if both prompt and currentCode are provided
    if (!prompt || !currentCode)
      return res.status(400).json({ error: "Missing prompt or currentCode." });

    // Check if API key is provided
    // This part is crucial if you are passing the key from the frontend
    if (!apiKey) {
      return res.status(400).json({ error: "Missing API key. Please provide an API key to proceed." });
    }

    // Validate if the API key is valid (should start with 'sk-' for GPT)
    if (!apiKey.startsWith("sk-")) {
      return res.status(400).json({ error: "Invalid API key. GPT keys must start with 'sk-'" });
    }

    // --- FIX APPLIED HERE ---
    const systemPrompt = `
You are an expert Mermaid.js editor.
Modify the provided Mermaid code based on the user’s natural-language request.
You MUST return the COMPLETE, VALID, and FINAL Mermaid code, including the diagram type definition (e.g., 'flowchart TD').
Return only the updated Mermaid code (no explanations, no markdown fences).
    `;
    // ------------------------

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Current Mermaid code:\n${currentCode}\n\nUser request:\n${prompt}\n\nReturn only updated Mermaid code:`,
      },
    ];

    // Send the request to OpenAI API
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`, // Using passed key for consistency with frontend
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
    updatedCode = updatedCode.replace(/```mermaid\s*/gi, "").replace(/```/g, "").trim();

    return res.status(200).json({ updatedCode });
  } catch (err) {
    console.error("Error in AI edit handler:", err);
    res.status(500).json({ error: err.message });
  }
}