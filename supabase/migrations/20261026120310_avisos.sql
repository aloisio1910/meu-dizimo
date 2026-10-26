-- Avisos (notificações) do app, parte 1: os avisos ficam guardados e
-- aparecem no sino do app (D-096). O envio do push para a tela do celular
-- (parte 2) lê esta mesma tabela.
--
-- Eventos da seção 9 do Requisitos:
--   lancamento_confirmado    membro      não desliga
--   divergencia_registrada   membro      não desliga
--   lancamento_reaberto      membro      não desliga
--   nova_campanha            membros     desliga
--   novo_lancamento          tesouraria  desliga
--   novo_comprovante         tesouraria  desliga
--   divergencia_contestada   tesouraria  não desliga
--   pix_alterado             tesouraria  não desliga (RN-040)
-- Os avisos são criados pelo próprio banco (triggers), como a auditoria:
-- não dependem de o app lembrar.

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas (id),
  -- Quem recebe: o login (um aviso por pessoa, mesmo com vários aparelhos).
  usuario_id uuid not null references auth.users (id),
  tipo text not null check (tipo in (
    'lancamento_confirmado', 'divergencia_registrada', 'lancamento_reaberto', 'nova_campanha',
    'novo_lancamento', 'novo_comprovante', 'divergencia_contestada', 'pix_alterado'
  )),
  -- Valores para montar o texto (valor, nomes, ids para abrir a tela certa).
  dados jsonb not null default '{}'::jsonb check (jsonb_typeof(dados) = 'object'),
  criado_em timestamptz not null default now(),
  lida_em timestamptz,
  -- Envio do push (parte 2).
  push_enviado_em timestamptz,
  push_tentativas integer not null default 0,
  push_erro text
);

create index notificacoes_do_usuario on public.notificacoes (usuario_id, criado_em desc);
create index notificacoes_para_enviar on public.notificacoes (criado_em) where push_enviado_em is null;

comment on table public.notificacoes is 'Avisos de cada pessoa (sino do app e push); criados por triggers do banco.';

-- Avisos que a pessoa pode desligar (seção 9). Os demais sempre chegam.
create function public.aviso_pode_desligar(p_tipo text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_tipo in ('nova_campanha', 'novo_lancamento', 'novo_comprovante');
$$;

-- Preferência por igreja, na ficha: a pessoa pode querer avisos de uma
-- igreja e não de outra.
alter table public.membros
  add column avisos_desligados text[] not null default '{}'
    check (avisos_desligados <@ array['nova_campanha', 'novo_lancamento', 'novo_comprovante']);

comment on column public.membros.avisos_desligados is 'Avisos que o próprio membro desligou (só os que podem ser desligados).';

-- Só a própria pessoa liga ou desliga os avisos dela.
create function public.proteger_avisos_desligados()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and new.avisos_desligados is distinct from old.avisos_desligados
     and old.usuario_id is distinct from (select auth.uid()) then
    raise exception 'so_a_pessoa_muda_os_avisos' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger membros_d_avisos
  before update on public.membros
  for each row execute function public.proteger_avisos_desligados();


-- -----------------------------------------------------------------------------
-- Criar avisos
-- -----------------------------------------------------------------------------

-- Para uma ficha: só se ela tem login, está ativa (ou é tesouraria em
-- atividade) e não desligou esse tipo.
create function public.avisar_ficha(p_membro_id uuid, p_tipo text, p_dados jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notificacoes (igreja_id, usuario_id, tipo, dados)
  select m.igreja_id, m.usuario_id, p_tipo, p_dados
  from public.membros m
  where m.id = p_membro_id
    and m.usuario_id is not null
    and m.status = 'ativo'
    and not (p_tipo = any (m.avisos_desligados));
$$;

-- Para a tesouraria ativa da igreja (tesoureiros e Pastor), menos quem
-- causou o evento.
create function public.avisar_tesouraria(p_igreja_id uuid, p_tipo text, p_dados jsonb, p_exceto uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notificacoes (igreja_id, usuario_id, tipo, dados)
  select m.igreja_id, m.usuario_id, p_tipo, p_dados
  from public.membros m
  where m.igreja_id = p_igreja_id
    and m.perfil in ('tesoureiro', 'administrador')
    and m.status = 'ativo'
    and m.usuario_id is not null
    and m.usuario_id is distinct from p_exceto
    and not (p_tipo = any (m.avisos_desligados));
$$;

-- Dados comuns dos avisos de lançamento.
create function public.dados_do_lancamento(l public.lancamentos)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'lancamento_id', l.id,
    'tipo', l.tipo,
    'valor_centavos', coalesce(l.valor_conferido_centavos, l.valor_informado_centavos),
    'valor_informado_centavos', l.valor_informado_centavos,
    'moeda', l.moeda,
    'membro_nome', (select m.nome from public.membros m where m.id = l.membro_id),
    'confirmado_por', l.confirmado_por_nome,
    'campanha_nome', (select c.nome from public.campanhas c where c.id = l.campanha_id)
  );
$$;

create function public.avisar_sobre_lancamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dados jsonb := public.dados_do_lancamento(new);
  v_autor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if new.status = 'confirmado' then
      -- Devolução presencial: nasce confirmada (RN-033).
      perform public.avisar_ficha(new.membro_id, 'lancamento_confirmado', v_dados);
    else
      perform public.avisar_tesouraria(new.igreja_id, 'novo_lancamento', v_dados, v_autor);
    end if;
    return null;
  end if;

  if new.status is distinct from old.status then
    -- Quem aceitou a divergência foi o próprio membro: não precisa avisar.
    if new.status = 'confirmado' and old.status <> 'divergencia' then
      perform public.avisar_ficha(new.membro_id, 'lancamento_confirmado', v_dados);
    elsif new.status = 'divergencia' and old.status <> 'divergencia' then
      perform public.avisar_ficha(new.membro_id, 'divergencia_registrada', v_dados);
    elsif old.status = 'confirmado' and new.status = 'aguardando' then
      perform public.avisar_ficha(new.membro_id, 'lancamento_reaberto', v_dados);
    end if;
  end if;

  if new.resposta_membro is distinct from old.resposta_membro and new.resposta_membro = 'contestada' then
    perform public.avisar_tesouraria(
      new.igreja_id, 'divergencia_contestada', v_dados || jsonb_build_object('mensagem', new.mensagem_membro), v_autor
    );
  end if;

  return null;
end;
$$;

create trigger lancamentos_z_avisos
  after insert or update on public.lancamentos
  for each row execute function public.avisar_sobre_lancamento();

create function public.avisar_sobre_comprovante()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lancamento public.lancamentos;
begin
  select * into v_lancamento from public.lancamentos where id = new.lancamento_id;
  perform public.avisar_tesouraria(new.igreja_id, 'novo_comprovante', public.dados_do_lancamento(v_lancamento), new.enviado_por);
  return null;
end;
$$;

create trigger comprovantes_z_avisos
  after insert on public.comprovantes
  for each row execute function public.avisar_sobre_comprovante();

-- Nova campanha: avisa os membros quando é publicada (rascunho -> ativa).
create function public.avisar_sobre_campanha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'rascunho' and new.status = 'ativa' then
    insert into public.notificacoes (igreja_id, usuario_id, tipo, dados)
    select m.igreja_id, m.usuario_id, 'nova_campanha',
           jsonb_build_object('campanha_id', new.id, 'campanha_nome', new.nome)
    from public.membros m
    where m.igreja_id = new.igreja_id
      and m.status = 'ativo'
      and m.usuario_id is not null
      and not ('nova_campanha' = any (m.avisos_desligados));
  end if;
  return null;
end;
$$;

create trigger campanhas_z_avisos
  after update on public.campanhas
  for each row execute function public.avisar_sobre_campanha();

-- RN-040: conta nova com Pix ou troca de chave, recebedor ou cidade avisa a
-- tesouraria e o Pastor, como proteção contra troca indevida.
create function public.avisar_sobre_pix()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.chave_pix is not null)
     or (tg_op = 'UPDATE' and (new.chave_pix, new.tipo_chave_pix, new.nome_recebedor, new.cidade)
          is distinct from (old.chave_pix, old.tipo_chave_pix, old.nome_recebedor, old.cidade)) then
    perform public.avisar_tesouraria(
      new.igreja_id, 'pix_alterado',
      jsonb_build_object('conta_id', new.id, 'conta_nome', new.nome),
      (select auth.uid())
    );
  end if;
  return null;
end;
$$;

create trigger contas_z_avisos
  after insert or update on public.contas
  for each row execute function public.avisar_sobre_pix();


-- -----------------------------------------------------------------------------
-- Ler e marcar como lido
-- -----------------------------------------------------------------------------

alter table public.notificacoes enable row level security;

-- Cada pessoa vê só os próprios avisos.
create policy notificacoes_select on public.notificacoes
  for select to authenticated
  using (usuario_id = (select auth.uid()));

-- Ninguém do app cria, altera ou apaga avisos: só as funções abaixo marcam
-- como lido, e só os próprios.
revoke all on public.notificacoes from anon;
revoke insert, update, delete, truncate on public.notificacoes from authenticated;
grant select on public.notificacoes to authenticated;

create function public.marcar_avisos_como_lidos(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notificacoes
     set lida_em = now()
   where usuario_id = (select auth.uid())
     and lida_em is null
     and (p_ids is null or id = any (p_ids));
$$;

revoke execute on function
  public.avisar_ficha(uuid, text, jsonb),
  public.avisar_tesouraria(uuid, text, jsonb, uuid),
  public.dados_do_lancamento(public.lancamentos)
from public, anon, authenticated;

revoke execute on function public.marcar_avisos_como_lidos(uuid[]) from public, anon;
grant execute on function public.marcar_avisos_como_lidos(uuid[]) to authenticated;
