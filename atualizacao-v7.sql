-- Executar no Supabase > SQL Editor ANTES de publicar a versao 7.
-- Adiciona campos sem modificar avaliacoes ou contas existentes.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS ordered_item text NOT NULL DEFAULT '';
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS highlights text NOT NULL DEFAULT '';
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS would_return text NOT NULL DEFAULT '';
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS bill_amount numeric(10,2);

-- Restringe valores opcionais e tamanho dos novos campos.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reviews_would_return_valid') THEN
  ALTER TABLE public.reviews ADD CONSTRAINT reviews_would_return_valid CHECK (would_return IN ('','Sim','Não','Talvez'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reviews_bill_amount_valid') THEN
  ALTER TABLE public.reviews ADD CONSTRAINT reviews_bill_amount_valid CHECK (bill_amount IS NULL OR (bill_amount >= 0 AND bill_amount <= 9999999.99));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reviews_ordered_item_length') THEN
  ALTER TABLE public.reviews ADD CONSTRAINT reviews_ordered_item_length CHECK (char_length(ordered_item)<=300);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reviews_highlights_length') THEN
  ALTER TABLE public.reviews ADD CONSTRAINT reviews_highlights_length CHECK (char_length(highlights)<=500);
 END IF;
END $$;

-- Perfil so pode ser alterado pelo titular.
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
CREATE POLICY "Profiles update own" ON public.profiles
FOR UPDATE TO authenticated
USING (id=(select auth.uid())) WITH CHECK (id=(select auth.uid()));

-- Fotos de perfil publicas para que amigos possam ver.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('avatars','avatars',true,5242880,ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public=true,file_size_limit=5242880,allowed_mime_types=ARRAY['image/jpeg'];

DROP POLICY IF EXISTS "Avatars upload own folder" ON storage.objects;
CREATE POLICY "Avatars upload own folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1]=(select auth.uid()::text));

DROP POLICY IF EXISTS "Avatars delete own folder" ON storage.objects;
CREATE POLICY "Avatars delete own folder" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id='avatars' AND (storage.foldername(name))[1]=(select auth.uid()::text));
