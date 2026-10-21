-- =============================================================================
-- Conferência da tesouraria: bloqueio, confirmação, divergência, resposta do
-- membro e reabertura.
--
-- Estados (Requisitos v0.3, seção 5):
--   aguardando -> em_conferencia -> confirmado | divergencia
--   divergencia -> confirmado (membro aceita) | contestada, e a tesouraria
--                  reabre a conferência e resolve
--   confirmado -> aguardando (só Pastor de Governo, com justificativa)
--
-- Todas as transições passam por estas funções. A tesouraria não tem
-- permissão de UPDATE direto em lancamentos (RN-018: não altera o valor
-- informado).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Quem registrou a divergência (vira a assinatura se o membro aceitar)
-- -----------------------------------------------------------------------------

alter table public.lancamentos
  add column divergencia_por uuid references auth.users (id),
  add column divergencia_por_nome text,
  add constraint lancamentos_divergencia_completa check (
    status <> 'divergencia'
    or (valor_conferido_centavos is not null and divergencia_em is not null and divergencia_por is not null)
  ),
  add constraint lancamentos_em_conferencia_com_dono check (
    status <> 'em_conferencia' or (em_conferencia_por is not null and em_conferencia_desde is not null)
  );

-- O app não preenche os campos novos ao registrar.
create function public.limpar_divergencia_no_registro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    new.divergencia_por := null;
    new.divergencia_por_nome := null;
  end if;
  return new;
end;
$$;

create trigger lancamentos_b_limpar_divergencia
  before insert on public.lancamentos
  for each row execute function public.limpar_divergencia_no_registro();


-- -----------------------------------------------------------------------------
-- Prazos e auxiliares
-- -----------------------------------------------------------------------------

-- RN-029: bloqueio de conferência parado por mais de 10 minutos volta à fila.
create function public.prazo_conferencia()
returns interval
language sql
immutable
as $$
  select interval '10 minutes';
$$;

-- D-056: divergência sem resposta em 15 dias fica sinalizada.
create function public.prazo_resposta_divergencia()
returns interval
language sql
immutable
as $$
  select interval '15 days';
$$;

create function public.bloqueio_vencido(p_desde timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_desde is null or p_desde < now() - public.prazo_conferencia();
$$;

-- O lançamento é da ficha do próprio usuário logado (qualquer status).
create function public.eh_proprio_lancamento(p_membro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membros m
    where m.id = p_membro_id and m.usuario_id = (select auth.uid())
  );
$$;

-- Nome do usuário logado na igreja (para a "assinatura" que o membro vê).
create function public.meu_nome_na_igreja(p_igreja_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.nome from public.membros m
  where m.igreja_id = p_igreja_id and m.usuario_id = (select auth.uid());
$$;

-- Ao sair da conferência sem decidir, o lançamento volta ao estado de antes:
-- divergência contestada volta a ser divergência; o resto volta à fila.
create function public.status_ao_liberar(p_resposta public.resposta_divergencia)
returns public.status_lancamento
language sql
immutable
as $$
  select case when p_resposta = 'contestada' then 'divergencia'::public.status_lancamento
              else 'aguardando'::public.status_lancamento end;
$$;

-- Busca o lançamento travando a linha e confere se o usuário pode conferir.
create function public.lancamento_para_conferir(p_lancamento_id uuid)
returns public.lancamentos
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

  -- RN-034: ninguém confere o próprio lançamento.
  if public.eh_proprio_lancamento(v.membro_id) then
    raise exception 'proprio_lancamento' using errcode = '42501';
  end if;

  return v;
end;
$$;

-- Confere que o usuário está com o lançamento aberto.
create function public.exigir_conferencia_aberta(v public.lancamentos)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if v.status <> 'em_conferencia' or v.em_conferencia_por is distinct from (select auth.uid()) then
    raise exception 'conferencia_nao_aberta' using errcode = '42501';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- Abrir, manter e liberar a conferência (RN-029, D-041)
-- -----------------------------------------------------------------------------

-- Abre um lançamento específico: fica "Em conferência por <tesoureiro>".
create function public.abrir_conferencia(p_lancamento_id uuid)
returns public.lancamentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.lancamentos := public.lancamento_para_conferir(p_lancamento_id);
begin
  if v.status = 'em_conferencia'
     and v.em_conferencia_por <> (select auth.uid())
     and not public.bloqueio_vencido(v.em_conferencia_desde) then
    raise exception 'em_conferencia_por_outro' using errcode = '55P03';
  end if;

  if not (
    v.status in ('aguardando', 'em_conferencia')
    or (v.status = 'divergencia' and v.resposta_membro = 'contestada')
  ) then
    raise exception 'lancamento_indisponivel' using errcode = '42501';
  end if;

  update public.lancamentos
     set status = 'em_conferencia',
         em_conferencia_por = (select auth.uid()),
         em_conferencia_desde = now()
   where id = v.id
  returning * into v;

  return v;
end;
$$;

-- Abre o primeiro da fila por ordem de chegada (RN-020), pulando os que outro
-- tesoureiro está conferindo e os do próprio usuário. Devolve null se a fila
-- estiver vazia. Filtros opcionais da tela T-01.
create function public.abrir_proximo_da_fila(
  p_igreja_id uuid,
  p_tipo public.tipo_lancamento default null,
  p_campanha_id uuid default null,
  p_com_comprovante boolean default null
)
returns public.lancamentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.lancamentos;
begin
  if not public.eh_tesouraria(p_igreja_id) then
    raise exception 'lancamento_indisponivel' using errcode = '42501';
  end if;

  select l.* into v
  from public.lancamentos l
  join public.membros m on m.id = l.membro_id
  where l.igreja_id = p_igreja_id
    and (l.status = 'aguardando'
         or (l.status = 'em_conferencia' and public.bloqueio_vencido(l.em_conferencia_desde)))
    and m.usuario_id is distinct from (select auth.uid())
    and (p_tipo is null or l.tipo = p_tipo)
    and (p_campanha_id is null or l.campanha_id = p_campanha_id)
    and (p_com_comprovante is null
         or exists (select 1 from public.comprovantes c where c.lancamento_id = l.id) = p_com_comprovante)
  order by l.registrado_em, l.id
  limit 1
  for update of l skip locked;

  if v.id is null then
    return null;
  end if;

  update public.lancamentos
     set status = 'em_conferencia',
         em_conferencia_por = (select auth.uid()),
         em_conferencia_desde = now()
   where id = v.id
  returning * into v;

  return v;
end;
$$;

-- Sinal de vida da tela de conferência: enquanto o tesoureiro está nela, o
-- bloqueio não vence.
create function public.manter_conferencia(p_lancamento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.lancamentos
     set em_conferencia_desde = now()
   where id = p_lancamento_id
     and status = 'em_conferencia'
     and em_conferencia_por = (select auth.uid());

  if not found then
    raise exception 'conferencia_nao_aberta' using errcode = '42501';
  end if;
end;
$$;

-- O tesoureiro sai sem decidir: o lançamento volta para onde estava.
create function public.liberar_conferencia(p_lancamento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.lancamentos
     set status = public.status_ao_liberar(resposta_membro),
         em_conferencia_por = null,
         em_conferencia_desde = null
   where id = p_lancamento_id
     and status = 'em_conferencia'
     and em_conferencia_por = (select auth.uid());

  if not found then
    raise exception 'conferencia_nao_aberta' using errcode = '42501';
  end if;
end;
$$;

-- Rotina automática (pg_cron, a cada minuto): devolve à fila os bloqueios
-- parados há mais de 10 minutos.
create function public.liberar_conferencias_paradas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quantidade integer;
begin
  update public.lancamentos
     set status = public.status_ao_liberar(resposta_membro),
         em_conferencia_por = null,
         em_conferencia_desde = null
   where status = 'em_conferencia'
     and public.bloqueio_vencido(em_conferencia_desde);

  get diagnostics v_quantidade = row_count;
  return v_quantidade;
end;
$$;


-- -----------------------------------------------------------------------------
-- Decisões da conferência
-- -----------------------------------------------------------------------------

-- Confirmar (passo 7): grava a "assinatura" (quem, nome, data e hora).
-- Valor diferente do informado só ao resolver uma divergência contestada;
-- fora disso, a diferença é registrada como divergência.
create function public.confirmar_lancamento(p_lancamento_id uuid, p_valor_conferido_centavos bigint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.lancamentos := public.lancamento_para_conferir(p_lancamento_id);
  v_valor bigint;
begin
  perform public.exigir_conferencia_aberta(v);

  if v.resposta_membro = 'contestada' then
    v_valor := p_valor_conferido_centavos;
    if v_valor is null or v_valor <= 0 then
      raise exception 'valor_conferido_obrigatorio' using errcode = '23502';
    end if;
  else
    v_valor := coalesce(p_valor_conferido_centavos, v.valor_informado_centavos);
    if v_valor <> v.valor_informado_centavos then
      raise exception 'registre_divergencia' using errcode = '22023';
    end if;
  end if;

  update public.lancamentos
     set status = 'confirmado',
         valor_conferido_centavos = v_valor,
         confirmado_por = (select auth.uid()),
         confirmado_por_nome = public.meu_nome_na_igreja(v.igreja_id),
         confirmado_em = now(),
         em_conferencia_por = null,
         em_conferencia_desde = null
   where id = v.id;
end;
$$;

-- Registrar divergência (RN-018): valor conferido ao lado, com observação;
-- o valor informado nunca muda.
create function public.registrar_divergencia(
  p_lancamento_id uuid,
  p_valor_conferido_centavos bigint,
  p_observacao text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.lancamentos := public.lancamento_para_conferir(p_lancamento_id);
begin
  perform public.exigir_conferencia_aberta(v);

  if p_valor_conferido_centavos is null or p_valor_conferido_centavos <= 0 then
    raise exception 'valor_conferido_obrigatorio' using errcode = '23502';
  end if;
  if p_valor_conferido_centavos = v.valor_informado_centavos then
    raise exception 'valor_igual_ao_informado' using errcode = '22023';
  end if;
  if p_observacao is null or length(trim(p_observacao)) = 0 then
    raise exception 'observacao_obrigatoria' using errcode = '23502';
  end if;

  perform set_config('app.motivo', trim(p_observacao), true);

  update public.lancamentos
     set status = 'divergencia',
         valor_conferido_centavos = p_valor_conferido_centavos,
         observacao_tesouraria = trim(p_observacao),
         divergencia_em = now(),
         divergencia_por = (select auth.uid()),
         divergencia_por_nome = public.meu_nome_na_igreja(v.igreja_id),
         -- Nova rodada: a resposta anterior (se houver) fica no log.
         resposta_membro = null,
         mensagem_membro = null,
         respondido_em = null,
         em_conferencia_por = null,
         em_conferencia_desde = null
   where id = v.id;

  perform set_config('app.motivo', '', true);
end;
$$;

-- RN-030: o membro aceita (confirma com o valor conferido, assinado por quem
-- conferiu) ou contesta com uma mensagem.
create function public.responder_divergencia(p_lancamento_id uuid, p_aceitar boolean, p_mensagem text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.lancamentos;
  v_mensagem text := nullif(trim(p_mensagem), '');
begin
  select * into v from public.lancamentos where id = p_lancamento_id for update;

  if v.id is null or not public.eh_minha_ficha(v.membro_id) then
    raise exception 'lancamento_indisponivel' using errcode = '42501';
  end if;
  if v.status <> 'divergencia' or v.resposta_membro is not null then
    raise exception 'divergencia_indisponivel' using errcode = '42501';
  end if;

  if p_aceitar then
    update public.lancamentos
       set status = 'confirmado',
           resposta_membro = 'aceita',
           mensagem_membro = v_mensagem,
           respondido_em = now(),
           confirmado_por = v.divergencia_por,
           confirmado_por_nome = v.divergencia_por_nome,
           confirmado_em = now()
     where id = v.id;
  else
    if v_mensagem is null then
      raise exception 'mensagem_obrigatoria' using errcode = '23502';
    end if;

    perform set_config('app.motivo', v_mensagem, true);

    update public.lancamentos
       set resposta_membro = 'contestada',
           mensagem_membro = v_mensagem,
           respondido_em = now()
     where id = v.id;

    perform set_config('app.motivo', '', true);
  end if;
end;
$$;

-- RN-031: só o Pastor de Governo reabre um confirmado, com justificativa.
-- Volta para a fila; o histórico completo fica no log.
create function public.reabrir_lancamento(p_lancamento_id uuid, p_justificativa text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.lancamentos;
begin
  select * into v from public.lancamentos where id = p_lancamento_id for update;

  if v.id is null or not public.eh_administrador(v.igreja_id) then
    raise exception 'lancamento_indisponivel' using errcode = '42501';
  end if;
  if v.status <> 'confirmado' then
    raise exception 'so_confirmado_reabre' using errcode = '42501';
  end if;
  if p_justificativa is null or length(trim(p_justificativa)) = 0 then
    raise exception 'justificativa_obrigatoria' using errcode = '23502';
  end if;

  perform set_config('app.motivo', trim(p_justificativa), true);

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


-- -----------------------------------------------------------------------------
-- Visão para as telas: lançamento com nome e número do membro e sinais
-- calculados. "security_invoker" faz a RLS de quem consulta valer aqui.
-- -----------------------------------------------------------------------------

create view public.lancamentos_detalhados
with (security_invoker = true)
as
select
  l.*,
  m.nome as membro_nome,
  m.numero as membro_numero,
  (l.status = 'em_conferencia' and public.bloqueio_vencido(l.em_conferencia_desde)) as conferencia_parada,
  (l.status = 'divergencia'
   and l.resposta_membro is null
   and l.divergencia_em < now() - public.prazo_resposta_divergencia()) as divergencia_sinalizada,
  exists (select 1 from public.comprovantes c where c.lancamento_id = l.id) as tem_comprovante
from public.lancamentos l
join public.membros m on m.id = l.membro_id;

comment on view public.lancamentos_detalhados is 'Fila da tesouraria (T-01) e Cartão do membro (M-03), com a RLS de quem consulta.';


-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------

revoke all on public.lancamentos_detalhados from anon;
grant select on public.lancamentos_detalhados to authenticated;

revoke execute on function
  public.lancamento_para_conferir(uuid),
  public.exigir_conferencia_aberta(public.lancamentos),
  public.liberar_conferencias_paradas()
from public, anon, authenticated;

revoke execute on function
  public.abrir_conferencia(uuid),
  public.abrir_proximo_da_fila(uuid, public.tipo_lancamento, uuid, boolean),
  public.manter_conferencia(uuid),
  public.liberar_conferencia(uuid),
  public.confirmar_lancamento(uuid, bigint),
  public.registrar_divergencia(uuid, bigint, text),
  public.responder_divergencia(uuid, boolean, text),
  public.reabrir_lancamento(uuid, text)
from public, anon;

grant execute on function
  public.abrir_conferencia(uuid),
  public.abrir_proximo_da_fila(uuid, public.tipo_lancamento, uuid, boolean),
  public.manter_conferencia(uuid),
  public.liberar_conferencia(uuid),
  public.confirmar_lancamento(uuid, bigint),
  public.registrar_divergencia(uuid, bigint, text),
  public.responder_divergencia(uuid, boolean, text),
  public.reabrir_lancamento(uuid, text)
to authenticated;


-- -----------------------------------------------------------------------------
-- Rotina automática: libera bloqueios parados a cada minuto
-- -----------------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.schedule(
  'liberar-conferencias-paradas',
  '* * * * *',
  $$ select public.liberar_conferencias_paradas(); $$
);
