-- SITE SAĞLIK ANALİZ - GELİŞMİŞ SaaS ŞEMASI (SUPABASE)

-- 1. PROFILLER
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ABONELİKLER (SaaS Mantığı)
CREATE TABLE public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE UNIQUE NOT NULL,
  plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'pro')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  subscription_id TEXT, -- Stripe/Iyzico ID
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. RAPORLAR
CREATE TABLE public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  domain TEXT NOT NULL,
  overall_score INTEGER DEFAULT 0,
  security_score INTEGER DEFAULT 0,
  seo_score INTEGER DEFAULT 0,
  performance_score INTEGER DEFAULT 0,
  summary TEXT,
  full_data JSONB NOT NULL, -- Tüm analiz detayları buraya girer
  is_public BOOLEAN DEFAULT TRUE,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(12), 'base64'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TAKİP EDİLEN DOMAİNLER (Monitoring)
CREATE TABLE public.tracked_domains (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  domain TEXT NOT NULL,
  check_frequency TEXT DEFAULT 'weekly' CHECK (check_frequency IN ('daily', 'weekly', 'monthly')),
  last_check_at TIMESTAMP WITH TIME ZONE,
  alert_threshold INTEGER DEFAULT 10, -- Skorda %10 düşüş olursa uyar
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. FAVORİLER
CREATE TABLE public.favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  domain TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, domain)
);

-- 6. BİLDİRİMLER
CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('alert', 'info', 'report')),
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. AI SOHBET GEÇMİŞİ (AI Danışman)
CREATE TABLE public.ai_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  report_id UUID REFERENCES public.reports ON DELETE CASCADE,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS POLİTİKALARI

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kendi profilini görebilir" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Kendi profilini güncelleyebilir" ON public.profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kendi aboneliğini görebilir" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Genel raporlar açık" ON public.reports FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Rapor ekleme açık" ON public.reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Rapor silme sahibi tarafından" ON public.reports FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.tracked_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kendi takipleri" ON public.tracked_domains USING (auth.uid() = user_id);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kendi favorileri" ON public.favorites USING (auth.uid() = user_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kendi bildirimleri" ON public.notifications USING (auth.uid() = user_id);

ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kendi sohbetleri" ON public.ai_chats USING (auth.uid() = user_id);

-- TRIGGERLER

-- Profil ve Ücretsiz Abonelik Otomatik Başlatma
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, new.raw_user_meta_data->>'avatar_url');
  
  INSERT INTO public.subscriptions (user_id, plan_type, status)
  VALUES (new.id, 'free', 'active');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
