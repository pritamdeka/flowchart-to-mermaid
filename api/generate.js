export default async function handler(req, res) {
  try {
    const { image, model } = req.body;

    // System prompt stays from ENV
    const prompt = process.env.PROMPT_TEXT;

    // User API key comes from headers now
    const apiKey = req.headers["x-user-api-key"];

    if (!image || !model || !apiKey)
      return res.status(400).json({
        error: "Missing image, model, or API key."
      });

    // -----------------------------
    //         GPT-4.x
    // -----------------------------
    if (model.startsWith("gpt-")) {
      const messages = [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${image}` }
            }
          ]
        }
      ];

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`   // <-- USER KEY
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: 2000,
            temperature: 0
          })
        }
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message || "OpenAI API error");

      return res.status(200).json({
        output: data.choices?.[0]?.message?.content?.trim() || ""
      });
    }

    // -----------------------------
    //      Gemini 2.5 Flash
    // -----------------------------
    if (model.startsWith("gemini")) {
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/png", data: image } }
            ]
          }
        ]
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, // user key
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message || "Gemini API error");

      let output =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      output = output
        .replace(/```mermaid\s*/gi, "")
        .replace(/```/g, "")
        .trim();

      return res.status(200).json({ output });
    }

    return res.status(400).json({ error: "Unsupported model selected." });

  } catch (err) {
    console.error("Error in handler:", err);
    return res.status(500).json({ error: err.message });
  }
}
