# RAG Assistant

An interactive Retrieval-Augmented Generation (RAG) assistant for knowledge bases (Game of Thrones, Spider-Man, Apollo 11) with user authentication, custom Ollama settings, and persistent per-user chat history.

---

## 🚀 Features

- **User Authentication**: Secure signup and login backed by Supabase `UserDetails`.
- **Knowledge Bases**: Multi-domain RAG querying powered by Ollama embeddings (`nomic-embed-text`) and Supabase vector database (`match_mainragvdb`).
- **Persistent Chat History**:
  - Automatically saves conversation history per user and per topic.
  - Dual-layer persistence: Supabase cloud database (`chat_history` table) + instant local storage sync.
  - "Clear Chat" support for resetting conversations on demand.
- **Customizable Appearance & Models**:
  - Multiple color themes (Midnight, Dark, Cosmic, Ocean, Sunset, Forest, Light, Custom).
  - Dynamic model selection (e.g., `gemma4:31b-cloud`, `nemotron-3-nano`, `llama3`, etc.).
  - Configurable Ollama Base URL and API Key directly in Settings (ideal for Vercel/cloud hosting).
  - Fine-grained control over temperature, match count, threshold, and system prompt.

---

## 🗄️ Database Setup (Supabase)

To enable persistent cloud chat history across devices:

1. Open your **Supabase Dashboard** -> Select your project.
2. Navigate to **SQL Editor** -> **New query**.
3. Copy and run the script in [`supabase_schema.sql`](supabase_schema.sql):

```sql
CREATE TABLE IF NOT EXISTS public.chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    rag_id TEXT NOT NULL,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'bot')),
    message TEXT NOT NULL,
    stats JSONB DEFAULT '{}'::jsonb,
    chunks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_history_user_rag 
ON public.chat_history (username, rag_id, created_at ASC);
```

> **Note**: Even before running this SQL script, chat history is automatically saved safely in the user's browser local storage so no data is ever lost.

---

## ⚙️ Local Development

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Verify `.env` configuration:
```env
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SECRET_KEY="your-secret-key"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_API_KEY=""
```

3. Start the application:
```bash
python app.py
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## ☁️ Vercel Deployment

1. Push your repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Set the Environment Variables in the Vercel Project Settings:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
   - `OLLAMA_BASE_URL` (Public URL, Cloud Ollama instance, or Ngrok tunnel)
   - `OLLAMA_API_KEY` (if applicable)
4. Deploy! `vercel.json` and `requirements.txt` are already pre-configured for `@vercel/python` serverless execution.
