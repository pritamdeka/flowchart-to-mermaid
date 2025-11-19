// generate.js (Example using a framework like Next.js or similar serverless function)

export default async function handler(req, res) {
    // Note: process.env.PROMPT_TEXT must contain ALL instructions (role, task, and format requirements).
    const systemPrompt = process.env.PROMPT_TEXT;

    try {
        const { image, model, apiKey } = req.body;

        if (!image || !model) {
            return res.status(400).json({ error: "Missing image or model." });
        }

        if (!apiKey) {
            return res.status(400).json({ error: "Missing API key." });
        }

        // ------------------------------------
        // ===== 🚀 GPT MODELS (OpenAI) =====
        // ------------------------------------
        if (model.startsWith("gpt-")) {
            if (!apiKey.startsWith("sk-")) {
                return res.status(400).json({ error: "Invalid API key for GPT models (expected 'sk-')." });
            }

            const messages = [
                // System role contains ALL instructions
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: [
                        // User role now ONLY provides the image data
                        { type: "text", text: "Here is the image to convert:" }, 
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } },
                    ],
                },
            ];

            const r = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
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

            const output = d.choices?.[0]?.message?.content?.trim() || "";
            const cleanedOutput = output.replace(/```mermaid\s*/gi, "").replace(/```/g, "").trim();

            return res.status(200).json({ output: cleanedOutput });
        }

        // ------------------------------------
        // ===== ♊ GEMINI MODELS (Google) =====
        // ------------------------------------
        if (model.startsWith("gemini")) {
            if (apiKey.startsWith("sk-")) {
                return res.status(400).json({ error: "Invalid API key for Gemini models (API key should not start with 'sk-')." });
            }
            
            const mimeType = "image/jpeg"; 

            const payload = {
                contents: [
                    {
                        role: "user",
                        parts: [
                            // User role provides the combined instruction (system prompt) and the image
                            { text: systemPrompt },
                            { inlineData: { mimeType: mimeType, data: image } },
                        ],
                    },
                ],
                config: {
                    temperature: 0,
                    maxOutputTokens: 2000,
                },
            };

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            const r = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const d = await r.json();
            
            if (!r.ok || d.error) {
                const errorMessage = d.error?.message || d.error || "Gemini API error";
                throw new Error(errorMessage);
            }

            let output = d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            output = output.replace(/```mermaid\s*/gi, "").replace(/```/g, "").trim();

            return res.status(200).json({ output });
        }

        // ------------------------------------
        // ===== 🛑 UNSUPPORTED MODEL =====
        // ------------------------------------
        res.status(400).json({ error: "Unsupported model selected." });
    } catch (err) {
        console.error("Error in handler:", err);
        res.status(500).json({ error: err.message.includes('API') ? err.message : "An unexpected server error occurred." });
    }
}