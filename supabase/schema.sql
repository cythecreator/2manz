-- ============================================================
-- 2 MANZ - Full Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  height TEXT,
  location TEXT,
  salary TEXT,
  fav_quote TEXT,
  fav_date_place TEXT,
  forty_yard_dash TEXT,
  bio TEXT,
  photos TEXT[] DEFAULT '{}',
  two_man_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  two_man_status TEXT DEFAULT 'none' CHECK (two_man_status IN ('pending', 'accepted', 'none')),
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROMPTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TWO_MAN_REQUESTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.two_man_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

-- ============================================================
-- SWIPES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.swipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  swiper_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  swiped_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('like', 'pass')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(swiper_id, swiped_id)
);

-- ============================================================
-- DUO_NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.duo_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notified_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  triggered_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GROUP_CHATS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.group_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MATCHES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  duo1_user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  duo1_user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  duo2_user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  duo2_user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'matched')),
  group_chat_id UUID REFERENCES public.group_chats(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.two_man_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duo_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- USERS policies
CREATE POLICY "Users can view all profiles" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- PROMPTS policies
CREATE POLICY "Anyone can view prompts" ON public.prompts FOR SELECT USING (true);
CREATE POLICY "Users can manage own prompts" ON public.prompts FOR ALL USING (auth.uid() = user_id);

-- TWO_MAN_REQUESTS policies
CREATE POLICY "Users can view their requests" ON public.two_man_requests
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send requests" ON public.two_man_requests
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update requests they received" ON public.two_man_requests
  FOR UPDATE USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- SWIPES policies
CREATE POLICY "Users can view own swipes" ON public.swipes
  FOR SELECT USING (auth.uid() = swiper_id);
CREATE POLICY "Users can insert own swipes" ON public.swipes
  FOR INSERT WITH CHECK (auth.uid() = swiper_id);

-- DUO_NOTIFICATIONS policies
CREATE POLICY "Users can view own notifications" ON public.duo_notifications
  FOR SELECT USING (auth.uid() = notified_user_id);
CREATE POLICY "Authenticated users can insert notifications" ON public.duo_notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own notifications" ON public.duo_notifications
  FOR UPDATE USING (auth.uid() = notified_user_id);

-- GROUP_CHATS policies
CREATE POLICY "Match participants can view group chats" ON public.group_chats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.group_chat_id = id
      AND (m.duo1_user1_id = auth.uid() OR m.duo1_user2_id = auth.uid()
        OR m.duo2_user1_id = auth.uid() OR m.duo2_user2_id = auth.uid())
    )
  );
CREATE POLICY "Authenticated users can insert group chats" ON public.group_chats
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- MATCHES policies
CREATE POLICY "Match participants can view matches" ON public.matches
  FOR SELECT USING (
    duo1_user1_id = auth.uid() OR duo1_user2_id = auth.uid()
    OR duo2_user1_id = auth.uid() OR duo2_user2_id = auth.uid()
  );
CREATE POLICY "Authenticated users can insert matches" ON public.matches
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update matches" ON public.matches
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- MESSAGES policies
CREATE POLICY "Match participants can view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
      AND (m.duo1_user1_id = auth.uid() OR m.duo1_user2_id = auth.uid()
        OR m.duo2_user1_id = auth.uid() OR m.duo2_user2_id = auth.uid())
    )
  );
CREATE POLICY "Match participants can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
      AND (m.duo1_user1_id = auth.uid() OR m.duo1_user2_id = auth.uid()
        OR m.duo2_user1_id = auth.uid() OR m.duo2_user2_id = auth.uid())
    )
  );

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can view photos" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "Authenticated users can upload photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own photos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.duo_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;

-- ============================================================
-- FUNCTION: Auto-create user profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
