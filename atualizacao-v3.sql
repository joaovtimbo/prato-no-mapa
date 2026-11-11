-- Execute uma vez no Supabase > SQL Editor, conectado ao projeto correto.
-- Não remove dados. Autoriza alterações e exclusão de locais criados pelo próprio usuário.
DROP POLICY IF EXISTS "Restaurants update own" ON public.restaurants;
CREATE POLICY "Restaurants update own" ON public.restaurants
FOR UPDATE TO authenticated
USING (created_by = (select auth.uid()))
WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Restaurants delete own" ON public.restaurants;
CREATE POLICY "Restaurants delete own" ON public.restaurants
FOR DELETE TO authenticated
USING (created_by = (select auth.uid()));

-- Impede a remoção de um restaurante que já foi avaliado por outras pessoas,
-- inclusive quando essas avaliações estão invisíveis pelas regras de amizade.
CREATE OR REPLACE FUNCTION public.protect_restaurant_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.reviews WHERE restaurant_id = OLD.id AND user_id <> auth.uid()) THEN
   RAISE EXCEPTION 'O restaurante possui avaliações de outras pessoas';
 END IF;
 RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS prevent_shared_restaurant_deletion ON public.restaurants;
CREATE TRIGGER prevent_shared_restaurant_deletion
BEFORE DELETE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.protect_restaurant_deletion();

-- Garante exclusão da própria avaliação (se não foi feito na atualização anterior).
DROP POLICY IF EXISTS "Reviews delete own" ON public.reviews;
CREATE POLICY "Reviews delete own" ON public.reviews
FOR DELETE TO authenticated
USING (user_id = (select auth.uid()));
