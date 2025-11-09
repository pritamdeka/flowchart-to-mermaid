# Diagram to Mermaid Converter

A web app that converts uploaded diagram images into Mermaid code using OpenAI GPT-4.1 or GPT-4.1-mini.

### Features
- Upload diagram images
- Choose model (GPT-4.1 / GPT-4.1-mini)
- Live Mermaid preview
- Secure API key handling via environment variables

### Deployment
1. Push this repo to GitHub.
2. Import into [Vercel](https://vercel.com).
3. Add environment variables:
   - `OPENAI_API_KEY`
   - `PROMPT_TEXT`
4. Deploy.
