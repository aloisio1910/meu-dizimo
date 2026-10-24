-- =============================================================================
-- Desfazer confirmação feita por engano (D-084).
--
-- Exceção controlada à RN-031: o próprio tesoureiro que confirmou desfaz, em
-- até 15 minutos e com motivo. Passado o prazo, só o Pastor de Governo reabre
-- (reabrir_lancamento). Não vale quando quem decidiu foi o membro (aceitou a
-- divergência). O lançamento volta para a fila, como na reabertura, e o log
-- guarda a confirmação, a correção e o motivo.
-- =============================================================================

create function public.prazo_desfazer_confirmacao()
returns interval
language sql
immutable
as $$
  select interval '15 minutes';
$$;

create function public.desfazer_confirmacao(p_lancamento_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.lancamentos;
begin
  select * into v from public.lancamentos where id = p_lancamento_id for update;

  if v.id is null or not public.eh_tesouraria(v.igreja_id) then
    raise exception 'lancamento_indisponivel' using errcode = '42501';
  end if;

  -- Só a confirmação feita pelo próprio tesoureiro, e não o aceite do membro.
  if v.status <> 'confirmado'
     or v.confirmado_por is distinct from (select auth.uid())
     or v.resposta_membro = 'aceita' then
    raise exception 'desfazer_indisponivel' using errcode = '42501';
  end if;

  if v.confirmado_em < now() - public.prazo_desfazer_confirmacao() then
    raise exception 'prazo_para_desfazer_vencido' using errcode = '42501';
  end if;

  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'motivo_obrigatorio' using errcode = '23502';
  end if;

  perform set_config('app.motivo', trim(p_motivo), true);

  update public.lancamentos
     set status = 'aguardando',
         valor_conferido_centavos = null,
         confirmado_por = null,
         confirmado_por_nome = null,
         confirmado_em = null,
         observacao_tesouraria = null,
         divergencia_em = null,
         divergencia_por = null,
         divergencia_por_nome = null,
         resposta_membro = null,
         mensagem_membro = null,
         respondido_em = null,
         em_conferencia_por = null,
         em_conferencia_desde = null
   where id = v.id;

  perform set_config('app.motivo', '', true);
end;
$$;

revoke execute on function public.desfazer_confirmacao(uuid, text) from public, anon;
grant execute on function public.desfazer_confirmacao(uuid, text) to authenticated;
