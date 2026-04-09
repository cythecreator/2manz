-- ============================================================
-- 2 MANZ - Migration v2: Multi 2Man Support
-- Run this in your Supabase SQL Editor AFTER schema.sql
-- ============================================================

-- ============================================================
-- 1. CREATE TWO_MAN_LINKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.two_man_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent duplicate links in either direction
  CONSTRAINT unique_link UNIQUE (
    LEAST(user1_id::text, user2_id::text),
    GREATEST(user1_id::text, user2_id::text)
  )
);

-- ============================================================
-- 2. MIGRATE EXISTING DATA (if any)
-- ============================================================
-- Copy existing accepted two_man pairs to the new table
INSERT INTO public.two_man_links (user1_id, user2_id, requester_id, status)
SELECT
  u.id AS user1_id,
  u.two_man_id AS user2_id,
  u.id AS requester_id,
  'accepted'
FROM public.users u
WHERE u.two_man_id IS NOT NULL
  AND u.two_man_status = 'accepted'
  -- Prevent duplicate rows (only insert the pair once)
  AND u.id < u.two_man_id
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. DROP OLD COLUMNS AND TABLE
-- ============================================================
ALTER TABLE public.users DROP COLUMN IF EXISTS two_man_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS two_man_status;
DROP TABLE IF EXISTS public.two_man_requests CASCADE;

-- ============================================================
-- 4. RLS POLICIES FOR TWO_MAN_LINKS
-- ============================================================
ALTER TABLE public.two_man_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own links"
  ON public.two_man_links FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create links as requester"
  ON public.two_man_links FOR INSERT
  WITH CHECK (auth.uid() = requester_id AND (auth.uid() = user1_id OR auth.uid() = user2_id));

CREATE POLICY "Either party can update a link"
  ON public.two_man_links FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Either party can delete a link"
  ON public.two_man_links FOR DELETE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- ============================================================
-- 5. HELPER FUNCTION: get all 2man partner IDs for a user
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_two_man_ids(p_user_id UUID)
RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(
    CASE WHEN user1_id = p_user_id THEN user2_id ELSE user1_id END
  )
  FROM public.two_man_links
  WHERE (user1_id = p_user_id OR user2_id = p_user_id)
    AND status = 'accepted';
$$ LANGUAGE sql STABLE SECURITY DEFINER;
