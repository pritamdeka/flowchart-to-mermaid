export default async function handler(req, res) {
  try {
    const { image, model } = req.body;
    const prompt = process.env.PROMPT_TEXT;

    if (!image || !model) {
      return res.status(400).json({ error: "Missing image or model." });
    }

    // ---------- GPT-4.x branch ----------
    if (model.startsWith("gpt-")) {
      const messages = [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Convert this diagram image to valid Mermaid code." },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${image}` }, // ✅ correct OpenAI format
            },
          ],
        },
      ];

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model, messages, max_tokens: 2000, temperature: 0 }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "OpenAI API error");

      const output = data.choices?.[0]?.message?.content?.trim() || "";
      return res.status(200).json({ output });
    }

    // ---------- GEMINI-2.5-FLASH branch ----------
    if (model.startsWith("gemini")) {
      // Google GenAI uses /v1/models/... endpoint (not v1beta)
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: "Convert this diagram image into a clean, valid Mermaid diagram." },
              { inlineData: { mimeType: "image/png", data: image } },
            ],
          },
        ],
        system_instruction: { parts: [{ text: prompt }] },
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Gemini API error");

      // Extract the Mermaid code only (remove markdown fences if present)
      let output = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      output = output.replace(/```mermaid\s*/gi, "").replace(/```/g, "").trim();

      return res.status(200).json({ output });
    }

    // ---------- Unsupported ----------
    return res.status(400).json({ error: "Unsupported model selected." });
  } catch (err) {
    console.error("Error in handler:", err);
    res.status(500).json({ error: err.message });
  }
}
