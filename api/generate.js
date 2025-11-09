export default async function handler(req, res) {
  try {
    const { image, model } = req.body;
    const prompt = process.env.PROMPT_TEXT;

    const messages = [
      { role: "system", content: prompt },
      {
        role: "user",
        content: [
          { type: "text", text: "Convert this diagram image to valid Mermaid code." },
          { type: "image_url", image_url: `data:image/png;base64,${image}` },
        ],
      },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model, messages }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "API Error");
    }

    const output = data.choices?.[0]?.message?.content || "";
    res.status(200).json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
