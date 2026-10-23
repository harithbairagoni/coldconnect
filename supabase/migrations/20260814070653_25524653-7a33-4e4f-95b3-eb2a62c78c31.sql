CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  headline TEXT,
  location TEXT,
  photo_url TEXT,
  linkedin_url TEXT,
  instagram_handle TEXT,
  email TEXT,
  website TEXT,
  about TEXT,
  career_goals TEXT,
  networking_goals TEXT,
  conversation_style TEXT,
  interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience JSONB NOT NULL DEFAULT '[]'::jsonb,
  education JSONB NOT NULL DEFAULT '[]'::jsonb,
  profile_highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  role TEXT,
  linkedin_url TEXT,
  instagram_handle TEXT,
  email TEXT,
  profile_image TEXT,
  meeting_purpose TEXT,
  relationship_status TEXT,
  notes TEXT,
  interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_interaction_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "connections_select_own" ON public.connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "connections_insert_own" ON public.connections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "connections_update_own" ON public.connections FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "connections_delete_own" ON public.connections FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_connections_updated_at BEFORE UPDATE ON public.connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX connections_user_id_idx ON public.connections(user_id);

CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.connections(id) ON DELETE CASCADE,
  title TEXT,
  scheduled_at TIMESTAMPTZ,
  location TEXT,
  purpose TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming',
  preparation_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetings_select_own" ON public.meetings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "meetings_insert_own" ON public.meetings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meetings_update_own" ON public.meetings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meetings_delete_own" ON public.meetings FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX meetings_user_id_idx ON public.meetings(user_id);

CREATE TABLE public.interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.connections(id) ON DELETE CASCADE,
  type TEXT,
  channel TEXT,
  notes TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interactions TO authenticated;
GRANT ALL ON public.interactions TO service_role;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interactions_select_own" ON public.interactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "interactions_insert_own" ON public.interactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "interactions_update_own" ON public.interactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "interactions_delete_own" ON public.interactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX interactions_user_id_idx ON public.interactions(user_id);

CREATE TABLE public.pitch_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.connections(id) ON DELETE SET NULL,
  audio_url TEXT,
  transcript TEXT,
  duration_seconds INTEGER,
  overall_score INTEGER,
  clarity_score INTEGER,
  confidence_score INTEGER,
  storytelling_score INTEGER,
  conciseness_score INTEGER,
  relevance_score INTEGER,
  memorability_score INTEGER,
  biggest_opportunity TEXT,
  what_worked TEXT,
  what_to_improve TEXT,
  improved_pitch TEXT,
  conversation_bridge TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pitch_sessions TO authenticated;
GRANT ALL ON public.pitch_sessions TO service_role;
ALTER TABLE public.pitch_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pitch_sessions_select_own" ON public.pitch_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pitch_sessions_insert_own" ON public.pitch_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pitch_sessions_update_own" ON public.pitch_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pitch_sessions_delete_own" ON public.pitch_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX pitch_sessions_user_id_idx ON public.pitch_sessions(user_id);

CREATE TABLE public.followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.connections(id) ON DELETE CASCADE,
  channel TEXT,
  message TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followups TO authenticated;
GRANT ALL ON public.followups TO service_role;
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followups_select_own" ON public.followups FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "followups_insert_own" ON public.followups FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "followups_update_own" ON public.followups FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "followups_delete_own" ON public.followups FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX followups_user_id_idx ON public.followups(user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, photo_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email,
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();