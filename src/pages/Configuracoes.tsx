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
  const { db, cliente, executar, permissoes, usuario } = useEstado();
  const atual = db.configuracoes;
  const podeEditar = permissoes.gestao;

  const [feedback, setFeedback] = useState(atual.link_formulario_produtor ?? '');
  const [respostas, setRespostas] = useState(atual.link_respostas_formulario ?? '');
  const [lembrete, setLembrete] = useState(atual.lembrete_antecedencia_minutos || '120');
  const [prazoTroca, setPrazoTroca] = useState(atual.substituicao_antecedencia_minutos || '90');
  const [exigeAprovacao, setExigeAprovacao] = useState(!!atual.despesa_aprovacao_acima_de);
  const [limite, setLimite] = useState(atual.despesa_aprovacao_acima_de ?? '');
  const [assistenteCancela, setAssistenteCancela] = useState(atual.assistente_pode_cancelar === 'true');
  const [assistenteEquipe, setAssistenteEquipe] = useState(atual.assistente_pode_alterar_equipe === 'true');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const novo: Record<string, string> = {
    link_formulario_produtor: feedback.trim(),
    link_respostas_formulario: respostas.trim(),
    lembrete_antecedencia_minutos: lembrete,
    substituicao_antecedencia_minutos: prazoTroca,
    despesa_aprovacao_acima_de: exigeAprovacao ? String(lerValor(limite) ?? '') : '',
    assistente_pode_cancelar: String(assistenteCancela),
    assistente_pode_alterar_equipe: String(assistenteEquipe),
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
  const temConfiguracoes = Object.values(atual).some((valor) => valor !== '');
  const resumoAprovacao = exigeAprovacao && lerValor(limite) !== null
    ? `Acima de ${moeda(lerValor(limite)!)} passa por aprovação.`
    : exigeAprovacao ? 'Aprovação de despesas ativada.' : 'Lançamentos entram direto.';

  return (
    <Layout>
      <div className="configuracoes-cabecalho">
        <div>
          <h1>Configurações</h1>
          <p>{podeEditar ? 'Regras do dia a dia para toda a operação.' : 'Consulte as regras do sistema. Só a direção e a gerente podem editar.'}</p>
        </div>
        <span className={`configuracoes-status ${podeEditar ? 'editavel' : 'leitura'}`}>
          <i aria-hidden="true" /> {podeEditar ? 'Você pode editar' : 'Somente leitura'}
        </span>
      </div>

      <div className="configuracoes-resumo" aria-label="Resumo das configurações">
        <div className="configuracao-resumo-item">
          <span className="configuracao-resumo-icone">↗</span>
          <div><small>Feedback</small><strong>{feedback.trim() ? 'Formulário configurado' : 'Ainda não configurado'}</strong></div>
        </div>
        <div className="configuracao-resumo-item">
          <span className="configuracao-resumo-icone">◷</span>
          <div><small>Avisos</small><strong>{comAtual(ANTECEDENCIAS_LEMBRETE, lembrete).find((opcao) => opcao.valor === lembrete)?.texto ?? `${lembrete} minutos antes`}</strong></div>
        </div>
        <div className="configuracao-resumo-item">
          <span className="configuracao-resumo-icone">R$</span>
          <div><small>Despesas</small><strong>{resumoAprovacao}</strong></div>
        </div>
      </div>

      {!temConfiguracoes && (
        <div className="configuracoes-vazio" role="status">
          <strong>As configurações ainda não foram preenchidas.</strong>
          <span>Complete os campos abaixo para deixar as regras prontas para a equipe.</span>
        </div>
      )}

      <form className="configuracoes" onSubmit={salvar}>
        <section className="cartao configuracao-secao">
          <div className="configuracao-secao-cabecalho">
            <span className="configuracao-secao-numero">01</span>
            <div><h2>Feedback do produtor</h2><p>Links usados pela equipe para enviar e acompanhar os vídeos.</p></div>
          </div>
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

        <section className="cartao configuracao-secao">
          <div className="configuracao-secao-cabecalho">
            <span className="configuracao-secao-numero">02</span>
            <div><h2>Avisos e trocas</h2><p>Defina os prazos que orientam a agenda e as substituições.</p></div>
          </div>
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

        <section className="cartao configuracao-secao">
          <div className="configuracao-secao-cabecalho">
            <span className="configuracao-secao-numero">03</span>
            <div><h2>Despesas</h2><p>Controle quando um lançamento precisa ser revisado pela gestão.</p></div>
          </div>
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

        {usuario.perfil !== 'assistente' && <section className="cartao configuracao-secao">
          <div className="configuracao-secao-cabecalho">
            <span className="configuracao-secao-numero">04</span>
            <div><h2>Permissões da Assistente</h2><p>Escolha as ações operacionais extras da Assistente.</p></div>
          </div>
          <p className="suave configuracao-nota">Ela sempre cadastra, monta a escala, remarca e confere fantasias. Consulta valores fora do Painel, mas não pode alterá-los.</p>
          <div className="acoes-coluna">
            <Marcador texto="Cancelar eventos" marcado={assistenteCancela} onMudar={setAssistenteCancela} desativado={desativado} />
            <Marcador texto="Tirar alguém de uma equipe já escalada" marcado={assistenteEquipe} onMudar={setAssistenteEquipe} desativado={desativado} />
          </div>
        </section>}

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
