DROP POLICY IF EXISTS papeis_read_auth ON public.papeis;
CREATE POLICY papeis_read_staff_or_own ON public.papeis FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR public.tem_permissao(auth.uid(), 'gerenciar_usuarios')
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.papel_id = papeis.id)
);