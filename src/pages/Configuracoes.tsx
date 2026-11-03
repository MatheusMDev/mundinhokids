// Configurações do sistema: as respostas da direção às perguntas do briefing
// viram valores aqui, sem mexer na estrutura do banco. Todos leem; só a
// direção e a gerente alteram.

import { useState, type FormEvent } from 'react';
import { Layout } from '../components/Layout';
import { Campo, Marcador } from '../components/Formulario';
import { useEstado } from '../lib/estado';
import { salvarConfiguracoes } from '../lib/acoes';
import { lerValor, moeda } from '../lib/formato';

const ANTECEDENCIAS_LEMBRETE = [
  { valor: '60', texto: '1 hora antes' },
  { valor: '90', texto: '1h30 antes' },
  { valor: '120', texto: '2 horas antes' },
  { valor: '180', texto: '3 horas antes' },
  { valor: '1440', texto: '1 dia antes' },
];

const ANTECEDENCIAS_TROCA = [
  { valor: '60', texto: 'Até 1 hora antes' },
  { valor: '90', texto: 'Até 1h30 antes' },
  { valor: '120', texto: 'Até 2 horas antes' },
  { valor: '240', texto: 'Até 4 horas antes' },
  { valor: '1440', texto: 'Até 1 dia antes' },
];

/** Mantém o valor atual na lista mesmo que não seja uma das opções prontas */
function comAtual(opcoes: { valor: string; texto: string }[], atual: string) {
  if (!atual || opcoes.some((o) => o.valor === atual)) return opcoes;
  return [...opcoes, { valor: atual, texto: `${atual} minutos antes` }];
}

export function Configuracoes() {
  const { db, cliente, executar, permissoes } = useEstado();
  const atual = db.configuracoes;
  const podeEditar = permissoes.gestao;

  const [feedback, setFeedback] = useState(atual.link_formulario_produtor ?? '');
  const [respostas, setRespostas] = useState(atual.link_respostas_formulario ?? '');
  const [lembrete, setLembrete] = useState(atual.lembrete_antecedencia_minutos || '120');
  const [prazoTroca, setPrazoTroca] = useState(atual.substituicao_antecedencia_minutos || '90');
  const [exigeAprovacao, setExigeAprovacao] = useState(!!atual.despesa_aprovacao_acima_de);
  const [limite, setLimite] = useState(atual.despesa_aprovacao_acima_de ?? '');
  const [supCancela, setSupCancela] = useState(atual.supervisora_pode_cancelar === 'true');
  const [supEquipe, setSupEquipe] = useState(atual.supervisora_pode_alterar_equipe === 'true');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const novo: Record<string, string> = {
    link_formulario_produtor: feedback.trim(),
    link_respostas_formulario: respostas.trim(),
    lembrete_antecedencia_minutos: lembrete,
    substituicao_antecedencia_minutos: prazoTroca,
    despesa_aprovacao_acima_de: exigeAprovacao ? String(lerValor(limite) ?? '') : '',
    supervisora_pode_cancelar: String(supCancela),
    supervisora_pode_alterar_equipe: String(supEquipe),
  };
  const mudancas = Object.fromEntries(Object.entries(novo).filter(([chave, valor]) => (atual[chave] ?? '') !== valor));
  const alterou = Object.keys(mudancas).length > 0;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (exigeAprovacao && (lerValor(limite) === null || lerValor(limite)! < 0)) {
      setErro('Informe o valor a partir do qual a despesa precisa de aprovação.');
      return;
    }
    setErro(null);
    setSalvando(true);
    const r = await executar(() => salvarConfiguracoes(cliente, mudancas), 'Configurações salvas.');
    setSalvando(false);
    if (r !== true) setErro(r);
  }

  const desativado = !podeEditar || salvando;

  return (
    <Layout>
      <div className="lista-topo">
        <div>
          <h1>Configurações</h1>
          <p>{podeEditar ? 'Regras do dia a dia. Valem para todo o sistema assim que você salva.' : 'Só a direção e a gerente alteram estas regras.'}</p>
        </div>
      </div>

      <form className="configuracoes" onSubmit={salvar}>
        <section className="cartao">
          <h2>Feedback do produtor</h2>
          <Campo rotulo="Link do formulário de feedback" dica="Aparece em cada evento e no PDF da equipe. É o formulário que já existe (com o envio do vídeo).">
            {(id) => <input id={id} type="url" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="https://forms.gle/..." disabled={desativado} />}
          </Campo>
          {podeEditar && (
            <Campo rotulo="Onde ficam as respostas" dica="Atalho só para a direção (ex.: a planilha de respostas do formulário).">
              {(id) => <input id={id} type="url" value={respostas} onChange={(e) => setRespostas(e.target.value)} placeholder="https://docs.google.com/..." disabled={desativado} />}
            </Campo>
          )}
          {podeEditar && atual.link_respostas_formulario && (
            <a className="link-marca" href={atual.link_respostas_formulario} target="_blank" rel="noreferrer">Abrir as respostas</a>
          )}
        </section>

        <section className="cartao">
          <h2>Avisos e trocas</h2>
          <div className="linha-campos">
            <Campo rotulo="Último aviso antes do evento" dica="Vale para os próximos escalados; avisos já agendados não mudam.">
              {(id) => (
                <select id={id} value={lembrete} onChange={(e) => setLembrete(e.target.value)} disabled={desativado}>
                  {comAtual(ANTECEDENCIAS_LEMBRETE, lembrete).map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="Prazo para o artista pedir troca" dica="Depois disso, só falando com a gerente ou a direção.">
              {(id) => (
                <select id={id} value={prazoTroca} onChange={(e) => setPrazoTroca(e.target.value)} disabled={desativado}>
                  {comAtual(ANTECEDENCIAS_TROCA, prazoTroca).map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
                </select>
              )}
            </Campo>
          </div>
        </section>

        <section className="cartao">
          <h2>Despesas</h2>
          <Marcador
            texto="Despesas acima de um valor precisam de aprovação"
            dica="Quem lança vê a despesa como “aguardando aprovação” até a direção ou a gerente decidir."
            marcado={exigeAprovacao} onMudar={setExigeAprovacao} desativado={desativado}
          />
          {exigeAprovacao && (
            <Campo rotulo="Precisa de aprovação acima de (R$)" dica={lerValor(limite) !== null ? `Até ${moeda(lerValor(limite)!)} entra direto.` : undefined}>
              {(id) => <input id={id} inputMode="decimal" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="100" disabled={desativado} />}
            </Campo>
          )}
        </section>

        <section className="cartao">
          <h2>O que a supervisora pode fazer</h2>
          <p className="suave" style={{ margin: '-6px 0 12px', fontSize: 13 }}>Ela sempre cadastra, monta a escala, remarca e confere fantasias. Nunca vê valores.</p>
          <div className="acoes-coluna">
            <Marcador texto="Cancelar eventos" marcado={supCancela} onMudar={setSupCancela} desativado={desativado} />
            <Marcador texto="Tirar alguém de uma equipe já escalada" marcado={supEquipe} onMudar={setSupEquipe} desativado={desativado} />
          </div>
        </section>

        {podeEditar && (
          <div className="configuracoes-rodape">
            {erro && <p className="erro" role="alert">{erro}</p>}
            <button type="submit" className="botao primario" disabled={!alterou || salvando}>
              {salvando ? 'Salvando…' : alterou ? 'Salvar configurações' : 'Nada para salvar'}
            </button>
          </div>
        )}
      </form>
    </Layout>
  );
}
