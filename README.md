# Diagram → Mermaid Converter

A web app that:
- Uploads diagram images  
- Uses GPT-4.1 or Gemini 2.5 Flash to extract Mermaid code  
- Previews & edits the diagram live  
- Opens an interactive **Mermaid Live Editor**  
- Exports SVG or `.mmd` files  

### Environment Variables (Vercel)
| Key | Purpose |
|-----|----------|
| `OPENAI_API_KEY` | OpenAI GPT-4.1 access |
| `GEMINI_API_KEY` | Google Gemini 2.5 Flash access |
| `PROMPT_TEXT` | System prompt text |

### Deploy
1. Push this repo to GitHub  
2. Import to [Vercel](https://vercel.com)  
3. Add environment variables above  
4. Deploy 🚀
