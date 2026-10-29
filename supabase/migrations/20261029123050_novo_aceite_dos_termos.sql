-- Novo aceite dos termos (RN-041): quando a versão dos termos muda, quem já
-- usa o app aceita de novo antes de continuar. O app sabe a versão atual
-- (src/i18n/termos) e confere se já há aceite dela; este é o registro.
--
-- Todo aceite passa por função, que exige a declaração de maioridade
-- (D-104): o app deixa de gravar direto na tabela. Quem aceitou uma versão
-- antiga sem a declaração faz a declaração agora.

create function public.aceitar_termos(p_versao text, p_declarou_maioridade boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if p_versao is null or length(trim(p_versao)) = 0 then
    raise exception 'termos_obrigatorios' using errcode = '23502';
  end if;
  if p_declarou_maioridade is not true then
    raise exception 'maioridade_obrigatoria' using errcode = '23502';
  end if;

  insert into public.aceites_termos (usuario_id, versao, declarou_maioridade)
  values ((select auth.uid()), trim(p_versao), true)
  on conflict (usuario_id, versao) do nothing;
end;
$$;

revoke execute on function public.aceitar_termos(text, boolean) from public, anon;
grant execute on function public.aceitar_termos(text, boolean) to authenticated;

-- O aceite só entra pelas funções (concluir_cadastro e aceitar_termos), que
-- conferem a declaração de maioridade.
drop policy aceites_termos_insert on public.aceites_termos;
revoke insert on public.aceites_termos from authenticated;
