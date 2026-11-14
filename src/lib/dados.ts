// Carrega a base do Supabase no mesmo formato dos dados de exemplo.
// Cada tabela já vem filtrada pelas permissões do banco (RLS): a Assistente
// recebe valores fora do Painel, o artista só os próprios eventos, e assim por diante.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BaseDados, Historico, TrocaParaMim } from './tipos';
import { diaCurto, hora, moeda } from './formato';
import { ROTULO_SITUACAO } from './consultas';

const TABELAS = [
  'usuarios', 'profissionais', 'disponibilidade_semanal', 'personagens', 'profissional_personagens', 'contratantes', 'locais',
  'documentos_artistas', 'videos_eventos', 'observacoes_artistas_eventos',
  'fantasias', 'veiculos', 'eventos', 'evento_escala', 'reservas_veiculo', 'evento_financeiro',
  'recebimentos', 'pagamentos_profissionais', 'despesas', 'adicionais_produtores', 'substituicoes', 'conferencias_fantasia',
  'notificacoes', 'notificacao_preferencias', 'profissionais_notas', 'contratantes_notas',
] as const;

interface LinhaHistorico {
  id: number;
  tabela: string;
  evento_id: string | null;
  acao: 'INSERT' | 'UPDATE';
  financeiro: boolean;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  usuario_id: string | null;
  em: string;
}

export async function carregarBase(cliente: SupabaseClient): Promise<BaseDados> {
  const [configuracoes, historico, trocasParaMim, disponiveis, ...tabelas] = await Promise.all([
    cliente.from('configuracoes').select('chave, valor'),
    cliente.from('historico').select('*').order('em', { ascending: false }).limit(500),
    cliente.rpc('trocas_para_mim'),
    cliente.rpc('profissionais_disponiveis'),
    ...TABELAS.map((t) => cliente.from(t).select('*')),
  ]);

  // Os pedidos de troca para o substituto são um extra: se a função ainda não existir no banco, a tela segue sem eles
  if (trocasParaMim.error) console.warn('trocas_para_mim indisponível:', trocasParaMim.error.message);
  const funcaoAusente = !!disponiveis.error
    && ['PGRST202', '42883'].includes(disponiveis.error.code)
    && disponiveis.error.message.includes('profissionais_disponiveis');
  const erro = [configuracoes, historico, ...(funcaoAusente ? [] : [disponiveis]), ...tabelas].find((r) => r.error)?.error;
  if (erro) throw new Error(erro.message);

  const base = Object.fromEntries(TABELAS.map((t, i) => [t, tabelas[i].data ?? []])) as unknown as Omit<BaseDados, 'configuracoes' | 'historico' | 'trocas_para_mim'>;
  if (funcaoAusente) {
    // Compatibilidade durante a implantação: só libera quem tem login ativo
    // comprovado nas linhas que a RLS permite ler. Sem login ou login oculto
    // não é possível distinguir cadastro legítimo de sobra de exclusão antiga.
    const loginsAtivos = new Set(base.usuarios.filter((u) => u.ativo).map((u) => u.id));
    base.profissionais_disponiveis = base.profissionais
      .filter((p) => p.ativo && p.usuario_id !== null && loginsAtivos.has(p.usuario_id))
      .map((p) => p.id);
  } else {
    base.profissionais_disponiveis = (disponiveis.data ?? []).map((p: { id: string }) => p.id);
  }

  return {
    ...base,
    // numeric vem como número no PostgREST; garante mesmo assim
    evento_financeiro: base.evento_financeiro.map((f) => ({ ...f, valor_contratado: Number(f.valor_contratado) })),
    recebimentos: base.recebimentos.map((r) => ({ ...r, valor: Number(r.valor) })),
    pagamentos_profissionais: base.pagamentos_profissionais.map((p) => ({ ...p, valor_combinado: Number(p.valor_combinado) })),
    despesas: base.despesas.map((d) => ({ ...d, valor: Number(d.valor) })),
    adicionais_produtores: base.adicionais_produtores.map((a) => ({ ...a, valor: Number(a.valor), foto_tamanho: Number(a.foto_tamanho) })),
    trocas_para_mim: (trocasParaMim.data ?? []) as TrocaParaMim[],
    configuracoes: Object.fromEntries((configuracoes.data ?? []).map((c) => [c.chave, c.valor])),
    historico: (historico.data as LinhaHistorico[] ?? []).map((h) => resumirHistorico(h, base)),
  };
}

type Linha = Record<string, unknown>;
const texto = (v: unknown) => (typeof v === 'string' ? v : '');

/** Transforma a linha de histórico (tabela, antes, depois) numa frase para a tela */
function resumirHistorico(h: LinhaHistorico, base: Omit<BaseDados, 'configuracoes' | 'historico' | 'trocas_para_mim'>): Historico {
  const antes: Linha = h.antes ?? {};
  const depois: Linha = h.depois ?? {};
  const nomeProfissional = (id: unknown) => base.profissionais.find((p) => p.id === id)?.nome ?? 'Profissional';
  let descricao = 'Alteração registrada';

  switch (h.tabela) {
    case 'eventos':
      if (h.acao === 'INSERT') descricao = 'Evento criado';
      else if (antes.inicio !== depois.inicio) {
        descricao = diaCurto(texto(antes.inicio)) === diaCurto(texto(depois.inicio))
          ? `Horário alterado de ${hora(texto(antes.inicio))} para ${hora(texto(depois.inicio))}`
          : `Remarcado de ${diaCurto(texto(antes.inicio))} para ${diaCurto(texto(depois.inicio))}, ${hora(texto(depois.inicio))}`;
      } else if (antes.situacao !== depois.situacao) {
        const situacao = ROTULO_SITUACAO[depois.situacao as keyof typeof ROTULO_SITUACAO] ?? texto(depois.situacao);
        descricao = depois.situacao === 'cancelado' ? `Evento cancelado: ${texto(depois.motivo_cancelamento)}` : `Situação: ${situacao}`;
      } else descricao = 'Dados do evento atualizados';
      break;
    case 'evento_escala':
      if (h.acao === 'INSERT') descricao = `${nomeProfissional(depois.profissional_id)} entrou na escala`;
      else if (antes.ativo && !depois.ativo) descricao = `${nomeProfissional(depois.profissional_id)} saiu da escala`;
      else descricao = 'Escala atualizada';
      break;
    case 'reservas_veiculo':
      descricao = h.acao === 'INSERT'
        ? `Veículo reservado por ${nomeProfissional(depois.responsavel_id)}`
        : 'Reserva do veículo alterada';
      break;
    case 'evento_financeiro':
      descricao = `Valor contratado: ${moeda(Number(depois.valor_contratado ?? 0))}`;
      break;
    case 'recebimentos':
      descricao = `Recebimento de ${moeda(Number(depois.valor ?? 0))}`;
      break;
    case 'pagamentos_profissionais':
      descricao = depois.cancelado_em && !antes.cancelado_em
        ? `Pagamento pendente de ${nomeProfissional(depois.profissional_id)} cancelado ao sair da escala: ${moeda(Number(depois.valor_combinado ?? 0))}`
        : `Pagamento de ${nomeProfissional(depois.profissional_id)}: ${moeda(Number(depois.valor_combinado ?? 0))} · ${texto(depois.situacao)}`;
      break;
    case 'despesas':
      descricao = `Despesa: ${texto(depois.descricao)} (${moeda(Number(depois.valor ?? 0))})`;
      break;
    case 'adicionais_produtores': {
      const produtor = nomeProfissional(depois.produtor_id);
      const valor = moeda(Number(depois.valor ?? 0));
      descricao = depois.cancelado_em && !antes.cancelado_em
        ? `Adicional de ${produtor} cancelado: ${valor}`
        : `Adicional de ${produtor}: ${texto(depois.descricao)} (${valor})`;
      break;
    }
  }

  return {
    id: h.id,
    evento_id: h.evento_id,
    descricao,
    financeiro: h.financeiro,
    usuario_nome: base.usuarios.find((u) => u.id === h.usuario_id)?.nome ?? 'Sistema',
    em: h.em,
  };
}
