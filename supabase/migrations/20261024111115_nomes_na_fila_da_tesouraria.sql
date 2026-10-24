-- =============================================================================
-- Visão da fila da tesouraria (T-01) com quem está conferindo e a conta de
-- destino. Colunas novas entram no fim, como o "create or replace view" exige.
-- Com security_invoker, a RLS de quem consulta continua valendo: o membro
-- não vê o nome do tesoureiro (a ficha dele é invisível para o membro).
-- =============================================================================

create or replace view public.lancamentos_detalhados
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
  exists (select 1 from public.comprovantes c where c.lancamento_id = l.id and c.retirado_em is null) as tem_comprovante,
  (select t.nome from public.membros t
    where t.igreja_id = l.igreja_id and t.usuario_id = l.em_conferencia_por) as em_conferencia_por_nome,
  (select ct.nome from public.contas ct where ct.id = l.conta_id) as conta_nome
from public.lancamentos l
join public.membros m on m.id = l.membro_id;
