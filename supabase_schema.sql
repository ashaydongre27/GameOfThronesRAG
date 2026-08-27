-- ==============================================================================
-- Supabase Schema for RAG Assistant Chat History
-- Run this script in the Supabase Dashboard -> SQL Editor -> New Query
-- ==============================================================================

-- 1. Create chat_history table
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

-- 2. Create index for fast user and topic queries
CREATE INDEX IF NOT EXISTS idx_chat_history_user_rag 
ON public.chat_history (username, rag_id, created_at ASC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- 4. Create policy for open service role & anon key access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'chat_history' AND policyname = 'Enable full access for chat_history'
    ) THEN
        CREATE POLICY "Enable full access for chat_history" 
        ON public.chat_history 
        FOR ALL 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;
