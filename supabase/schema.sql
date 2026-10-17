-- ==============================================================================
-- GridGuard AI: Supabase Database Schema
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Enable UUID Extension if not already active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Facility Profiles Table
CREATE TABLE IF NOT EXISTS public.facility_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('college', 'hospital', 'office', 'small_business')),
  backup_kwh NUMERIC NOT NULL CHECK (backup_kwh >= 0),
  backup_type TEXT NOT NULL CHECK (backup_type IN ('UPS', 'Generator', 'Battery Bank')),
  dod_limit_pct NUMERIC NOT NULL DEFAULT 80 CHECK (dod_limit_pct BETWEEN 1 AND 100),
  efficiency_pct NUMERIC NOT NULL DEFAULT 92 CHECK (efficiency_pct BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Equipment Table
CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facility_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('HVAC', 'IT', 'Medical', 'Lighting', 'Security', 'Other')),
  power_w NUMERIC NOT NULL CHECK (power_w > 0),
  priority TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3')),
  always_on BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Scenarios Table
CREATE TABLE IF NOT EXISTS public.scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facility_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  outage_duration_h NUMERIC NOT NULL CHECK (outage_duration_h > 0),
  allocation JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. AI Recommendations Table
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID REFERENCES public.facility_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast query lookups
CREATE INDEX IF NOT EXISTS idx_facility_profiles_user ON public.facility_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_equipment_facility ON public.equipment(facility_id);
CREATE INDEX IF NOT EXISTS idx_equipment_user ON public.equipment(user_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_facility ON public.scenarios(facility_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_user ON public.scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user ON public.ai_recommendations(user_id);

-- ==============================================================================
-- Row Level Security (RLS) Setup
-- ==============================================================================

ALTER TABLE public.facility_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

-- Facility Profiles Policies
CREATE POLICY "Users can view their own facility profiles"
  ON public.facility_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own facility profiles"
  ON public.facility_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own facility profiles"
  ON public.facility_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own facility profiles"
  ON public.facility_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Equipment Policies
CREATE POLICY "Users can view their own equipment"
  ON public.equipment FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own equipment"
  ON public.equipment FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own equipment"
  ON public.equipment FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own equipment"
  ON public.equipment FOR DELETE
  USING (auth.uid() = user_id);

-- Scenarios Policies
CREATE POLICY "Users can view their own scenarios"
  ON public.scenarios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scenarios"
  ON public.scenarios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scenarios"
  ON public.scenarios FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scenarios"
  ON public.scenarios FOR DELETE
  USING (auth.uid() = user_id);

-- AI Recommendations Policies
CREATE POLICY "Users can view their own AI recommendations"
  ON public.ai_recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI recommendations"
  ON public.ai_recommendations FOR INSERT
  WITH CHECK (auth.uid() = user_id);
