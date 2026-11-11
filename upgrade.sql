-- Execute uma vez no SQL Editor do Supabase.
-- Permite ao autor excluir suas próprias avaliações.
DROP POLICY IF EXISTS "Reviews delete own" ON public.reviews;
CREATE POLICY "Reviews delete own" ON public.reviews
FOR DELETE TO authenticated
USING (user_id = (select auth.uid()));
