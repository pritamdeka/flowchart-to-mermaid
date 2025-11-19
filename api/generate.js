export default async function handler(req, res) {
  try {
    const { image, model, apiKey } = req.body;
    const prompt = process.env.PROMPT_TEXT;

    if (!image || !model) {
      return res.status(400).json({ error: "Missing image or model." });
    }

    if (!apiKey) {
      return res.status(400).json({ error: "Missing API key." });
    }

    // ===== GPT MODELS =====
    if (model.startsWith("gpt-")) {
      if (!apiKey.startsWith("sk-")) {
        return res.status(400).json({ error: "Invalid API key for GPT models." });
      }

      const messages = [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Convert this diagram image to valid Mermaid code." },
            { type: "image_url", image_url: { url: `data:image/png;base64,${image}` } },
          ],
        },
      ];

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey || process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 2000,
          temperature: 0,
        }),
      });

      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || "OpenAI API error");

      return res.status(200).json({
        output: d.choices?.[0]?.message?.content?.trim() || "",
      });
    }

    // ===== GEMINI MODELS =====
    if (model.startsWith("gemini")) {
      if (apiKey.startsWith("sk-")) {
        return res.status(400).json({ error: "Invalid API key for Gemini models." });
      }

      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: `${prompt}\n\nConvert this diagram image to valid Mermaid code.` },
              { inlineData: { mimeType: "image/png", data: image } },
            ],
          },
        ],
      };

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey || process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || "Gemini API error");

      let output = d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      output = output.replace(/```mermaid\s*/gi, "").replace(/```/g, "").trim();

      return res.status(200).json({ output });
    }

    res.status(400).json({ error: "Unsupported model selected." });
  } catch (err) {
    console.error("Error in handler:", err);
    res.status(500).json({ error: err.message });
  }
}
