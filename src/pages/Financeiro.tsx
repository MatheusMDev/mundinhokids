import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Icone, type NomeIcone } from '../components/Icone';
import { FormDespesa } from '../components/FormulariosValores';
import { AdicionaisProdutores, FormAdicionalProdutor } from '../components/AdicionaisProdutores';
import { Paginacao, paginar } from '../components/Paginacao';
import { SeletorFiltro } from '../components/SeletorFiltro';
import { useEstado } from '../lib/estado';
import { resumoDoFinanceiro } from '../lib/financeiro';
import { veValores } from '../lib/consultas';
import { dataLonga, hora, iniciais, mesAno, moeda, partes, semAcentos } from '../lib/formato';
import type { Despesa } from '../lib/tipos';

const SECOES = [
  { id: 'eventos', nome: 'Por evento', icone: 'presente' },
  { id: 'equipe', nome: 'Equipe a pagar', icone: 'pessoas' },
  { id: 'despesas', nome: 'Despesas gerais', icone: 'dinheiro' },
  { id: 'adicionais', nome: 'Adicionais gerais', icone: 'dinheiro' },
] as const;
const SITUACOES = { pendente: 'Pendente', parcial: 'Parcial', pago: 'Pago' };
const APROVACAO = { nao_requer: 'Sem aprovação necessária', pendente: 'Aguardando aprovação', aprovada: 'Aprovada', recusada: 'Recusada' };
const mesDoEvento = (inicio: string) => { const { ano, mes } = partes(inicio); return `${ano}-${String(mes).padStart(2, '0')}`; };

type ValorPlanilha = string | number;

async function logoComoPng() {
  const svg = await fetch('/logo.svg').then((resposta) => resposta.text());
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const imagem = new Image();
    const carregou = new Promise<void>((resolve, reject) => {
      imagem.onload = () => resolve();
      imagem.onerror = () => reject(new Error('Não foi possível carregar a logo.'));
    });
    imagem.src = url;
    await carregou;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    canvas.getContext('2d')?.drawImage(imagem, 0, 0, 128, 128);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function baixarPlanilha(
  nome: string, titulo: string, cabecalhos: string[], linhas: ValorPlanilha[][], colunasMoeda: number[],
) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet('Financeiro', { views: [{ state: 'frozen', ySplit: 5 }] });
  const ultimaColuna = cabecalhos.length;
  const rosa = 'FFC8177E';
  const rosaClaro = 'FFFCE8F3';
  const borda = { style: 'thin' as const, color: { argb: 'FFE8C8DB' } };

  planilha.mergeCells(1, 1, 3, 2);
  planilha.mergeCells(1, 3, 1, ultimaColuna);
  planilha.mergeCells(2, 3, 2, ultimaColuna);
  planilha.mergeCells(3, 3, 3, ultimaColuna);
  planilha.getCell('C1').value = 'Mundinho Kids';
  planilha.getCell('C2').value = titulo;
  planilha.getCell('C3').value = `Exportado em ${dataLonga(new Date().toISOString())}`;
  planilha.getCell('C1').font = { name: 'Arial', size: 18, bold: true, color: { argb: rosa } };
  planilha.getCell('C2').font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF3D3040' } };
  planilha.getCell('C3').font = { name: 'Arial', size: 9, color: { argb: 'FF776B78' } };
  planilha.getCell('C1').alignment = { vertical: 'middle' };
  planilha.getCell('C2').alignment = { vertical: 'middle' };
  planilha.getCell('C3').alignment = { vertical: 'middle' };
  planilha.getRow(1).height = 24;
  planilha.getRow(2).height = 20;
  planilha.getRow(3).height = 18;

  const imagem = await logoComoPng();
  const imagemId = workbook.addImage({ base64: imagem, extension: 'png' });
  planilha.addImage(imagemId, { tl: { col: 0.2, row: 0.2 }, ext: { width: 52, height: 52 } });

  const cabecalho = planilha.addRow([]);
  cabecalho.height = 8;
  const linhaCabecalho = planilha.addRow(cabecalhos);
  linhaCabecalho.height = 28;
  linhaCabecalho.eachCell((celula) => {
    celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rosa } };
    celula.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    celula.alignment = { vertical: 'middle', wrapText: true };
    celula.border = { top: borda, bottom: borda, left: borda, right: borda };
  });

  linhas.forEach((linha, indice) => {
    const linhaPlanilha = planilha.addRow(linha);
    linhaPlanilha.eachCell((celula, coluna) => {
      celula.font = { name: 'Arial', size: 10, color: { argb: 'FF3D3040' } };
      celula.alignment = { vertical: 'middle', wrapText: coluna === 1 || coluna === 2 };
      celula.border = { top: borda, bottom: borda, left: borda, right: borda };
      if (indice % 2 === 1) celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rosaClaro } };
      if (colunasMoeda.includes(coluna) && typeof celula.value === 'number') {
        celula.numFmt = 'R$ #,##0.00';
        celula.alignment = { vertical: 'middle', horizontal: 'right' };
      }
    });
  });

  planilha.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + linhas.length, column: ultimaColuna } };
  planilha.columns.forEach((coluna, indice) => {
    const maior = Math.max(cabecalhos[indice].length, ...linhas.map((linha) => String(linha[indice] ?? '').length));
    coluna.width = Math.min(42, Math.max(14, maior + 2));
  });

  const arquivo = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([arquivo], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function Vazio({ icone, titulo, filtrado, limpar }: { icone: NomeIcone; titulo: string; filtrado: boolean; limpar: () => void }) {
  return <div className="financeiro-vazio" role="status">
    <span className="financeiro-vazio-icone"><Icone nome={icone} tamanho={24} /></span>
    <h3>{filtrado ? 'Nenhum resultado encontrado' : titulo}</h3>
    <p>{filtrado ? 'Tente outro termo ou ajuste os filtros.' : 'Os registros aparecerão aqui assim que forem lançados.'}</p>
    {filtrado && <button type="button" className="botao" onClick={limpar}>Limpar filtros</button>}
  </div>;
}

export function Financeiro() {
  const { db, perfil, permissoes, avisar } = useEstado();
  const [parametros, setParametros] = useSearchParams();
  const [despesa, setDespesa] = useState<{ item?: Despesa } | null>(null);
  const [adicional, setAdicional] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [valoresOcultos, setValoresOcultos] = useState(true);
  const dados = useMemo(() => resumoDoFinanceiro(db), [db]);
  const aba = SECOES.find((s) => s.id === parametros.get('aba'))?.id ?? 'eventos';
  const busca = parametros.get(`busca_${aba}`) ?? '';
  const termo = semAcentos(busca.trim());
  const mes = parametros.get('mes') ?? '';
  const situacao = parametros.get('situacao') ?? '';
  const tipo = parametros.get('tipo') ?? '';
  const aprovacao = parametros.get('aprovacao') ?? '';
  const chavePagina = `pagina_${aba}`;
  const paginaPedida = Number(parametros.get(chavePagina));
  const pagina = Number.isFinite(paginaPedida) && paginaPedida >= 1 ? Math.floor(paginaPedida) : 1;
  const alterar = (chave: string, valor: string) => {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(chave, valor); else novos.delete(chave);
    novos.delete(chavePagina);
    setParametros(novos);
  };
  const limpar = () => {
    const novos = new URLSearchParams(parametros);
    for (const chave of [`busca_${aba}`, chavePagina, ...(aba === 'eventos' ? ['mes', 'situacao'] : aba === 'despesas' ? ['tipo', 'aprovacao'] : [])]) novos.delete(chave);
    setParametros(novos);
  };
  const mudarPagina = (nova: number) => {
    const novos = new URLSearchParams(parametros);
    if (nova > 1) novos.set(chavePagina, String(nova)); else novos.delete(chavePagina);
    setParametros(novos);
    document.getElementById('financeiro-lista')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  if (!veValores(perfil)) return <Layout><section className="cartao oculto"><h1>Financeiro</h1><p>Só Direção e Gerência acessam o painel Financeiro. A Assistente consulta valores nos detalhes dos eventos.</p></section></Layout>;

  const { totais } = dados;
  const meses = new Map<string, string>();
  for (const { evento } of dados.eventos) { const { ano, mes } = partes(evento.inicio); meses.set(mesDoEvento(evento.inicio), mesAno(ano, mes)); }
  const eventos = dados.eventos.filter((r) => (!termo || semAcentos(`${r.evento.titulo} ${r.evento.aniversariante ?? ''}`).includes(termo))
    && (!mes || mesDoEvento(r.evento.inicio) === mes) && (!situacao || r.situacao === situacao))
    .sort((a, b) => b.evento.inicio.localeCompare(a.evento.inicio));
  const equipe = dados.equipe.filter((p) => !termo || semAcentos(`${p.nome} ${p.eventos.map((e) => e.titulo).join(' ')}`).includes(termo));
  const despesas = dados.despesasGerais.filter((d) => (!termo || semAcentos(`${d.descricao} ${db.profissionais.find((p) => p.id === d.responsavel_id)?.nome ?? ''}`).includes(termo))
    && (!tipo || d.tipo === tipo) && (!aprovacao || d.aprovacao === aprovacao));
  const adicionais = dados.adicionaisGerais.filter((a) => !termo || semAcentos(`${a.descricao} ${db.profissionais.find((p) => p.id === a.produtor_id)?.nome ?? ''}`).includes(termo));
  const paginaEventos = paginar(eventos, pagina, 6);
  const paginaEquipe = paginar(equipe, pagina, 6);
  const paginaDespesas = paginar(despesas, pagina, 6);
  const paginaAdicionais = paginar(adicionais, pagina, 6);
  const paginacao = aba === 'eventos' ? paginaEventos : aba === 'equipe' ? paginaEquipe : aba === 'despesas' ? paginaDespesas : paginaAdicionais;
  const total = aba === 'eventos' ? dados.eventos.length : aba === 'equipe' ? dados.equipe.length : aba === 'despesas' ? dados.despesasGerais.length : dados.adicionaisGerais.length;
  const encontrados = aba === 'eventos' ? eventos.length : aba === 'equipe' ? equipe.length : aba === 'despesas' ? despesas.length : adicionais.length;
  const filtrado = !!termo || (aba === 'eventos' ? !!mes || !!situacao : aba === 'despesas' ? !!tipo || !!aprovacao : false);
  const filtrosSelecionados = aba === 'eventos' ? Number(!!mes) + Number(!!situacao) : aba === 'despesas' ? Number(!!tipo) + Number(!!aprovacao) : 0;
  const exportarPlanilha = async () => {
    try {
      if (aba === 'eventos') {
        await baixarPlanilha('mundinho-kids-financeiro-por-evento.xlsx', 'Financeiro por evento', ['Evento', 'Aniversariante', 'Data do evento', 'Situação', 'Valor contratado', 'Valor recebido', 'Valor a receber', 'Equipe a pagar', 'Despesas'], eventos.map((r) => [r.evento.titulo, r.evento.aniversariante ?? 'Não informado', `${dataLonga(r.evento.inicio)} · ${hora(r.evento.inicio)}`, SITUACOES[r.situacao], r.contratado, r.recebido, Math.max(0, r.contratado - r.recebido), r.aPagar, r.despesas]), [5, 6, 7, 8, 9]);
      } else if (aba === 'equipe') {
        await baixarPlanilha('mundinho-kids-financeiro-equipe.xlsx', 'Equipe a pagar', ['Profissional', 'Total a pagar', 'Eventos pendentes'], equipe.map((p) => [p.nome, p.total, p.eventos.map((e) => e.titulo).join(', ')]), [2]);
      } else if (aba === 'adicionais') {
        await baixarPlanilha('mundinho-kids-adicionais-produtores.xlsx', 'Adicionais gerais de produtores', ['Produtor', 'Data', 'Descrição', 'Valor', 'Situação'], adicionais.map((a) => [db.profissionais.find((p) => p.id === a.produtor_id)?.nome ?? 'Produtor não informado', a.data, a.descricao, a.valor, a.cancelado_em ? 'Cancelado' : 'Ativo']), [4]);
      } else {
        await baixarPlanilha('mundinho-kids-financeiro-despesas.xlsx', 'Despesas gerais e insumos', ['Descrição', 'Tipo', 'Valor', 'Responsável', 'Aprovação'], despesas.map((d) => [d.descricao, d.tipo === 'insumo' ? 'Insumo' : 'Gasto extra', d.valor, db.profissionais.find((p) => p.id === d.responsavel_id)?.nome ?? 'Responsável não informado', APROVACAO[d.aprovacao]]), [3]);
      }
      avisar('Planilha Excel exportada.');
    } catch {
      avisar('Não foi possível gerar a planilha Excel.');
    }
  };
  const indicadores: { nome: string; valor: number; detalhe: string; icone: NomeIcone; tom: string }[] = [
    { nome: 'Contratado', valor: totais.contratado, detalhe: `${dados.eventos.length} ${dados.eventos.length === 1 ? 'evento' : 'eventos'} com valores`, icone: 'arquivo', tom: 'rosa' },
    { nome: 'Recebido', valor: totais.recebido, detalhe: `${moeda(Math.max(0, totais.contratado - totais.recebido))} a receber`, icone: 'dinheiro', tom: 'verde' },
    { nome: 'Equipe a pagar', valor: totais.aPagar, detalhe: `${dados.equipe.length} ${dados.equipe.length === 1 ? 'profissional' : 'profissionais'}`, icone: 'pessoas', tom: 'laranja' },
    { nome: 'Despesas', valor: totais.despesas, detalhe: dados.pendentesAprovacao.length ? `${dados.pendentesAprovacao.length} para aprovar` : 'Dos eventos e gerais', icone: 'lista', tom: 'neutro' },
  ];

  return <Layout>
    <div className="lista-topo financeiro-cabecalho">
      <div><h1>Financeiro</h1><p>Recebimentos, equipe e despesas em um só lugar.</p></div>
      <div className="financeiro-acoes">
        <button type="button" className="botao financeiro-visibilidade" onClick={() => setValoresOcultos((atual) => !atual)} aria-label={valoresOcultos ? 'Mostrar valores financeiros' : 'Ocultar valores financeiros'} aria-pressed={!valoresOcultos}>
          <Icone nome={valoresOcultos ? 'olhoFechado' : 'olho'} /><span className="financeiro-visibilidade-texto">{valoresOcultos ? 'Mostrar valores' : 'Ocultar valores'}</span>
        </button>
        {permissoes.gestao && <button type="button" className="botao primario" onClick={() => setDespesa({})}><Icone nome="mais" /> Lançar despesa</button>}
      </div>
    </div>
    <section className="financeiro-indicadores" aria-label="Resumo financeiro geral">
      {indicadores.map((i) => <article className={`financeiro-indicador ${i.tom}`} key={i.nome}>
        <div className="financeiro-indicador-topo"><span>{i.nome}</span><span className="financeiro-indicador-icone"><Icone nome={i.icone} tamanho={18} /></span></div>
         <strong className={valoresOcultos ? 'valor-financeiro-oculto' : undefined}>{moeda(i.valor)}</strong><small title={i.detalhe} className={valoresOcultos && i.nome === 'Recebido' ? 'valor-financeiro-oculto' : undefined}>{i.detalhe}</small>
      </article>)}
    </section>
    {dados.multasCancelamento.length > 0 && <section className="cartao financeiro-multas-cancelamento" aria-labelledby="multas-cancelamento-titulo">
      <div className="financeiro-secao-topo">
        <div><h2 id="multas-cancelamento-titulo">Multas de cancelamento</h2><p>{dados.multasCancelamento.length} registro(s), separados dos recebimentos confirmados.</p></div>
      </div>
      <ul className="financeiro-multas-lista">
        {dados.multasCancelamento.map((multa) => <li key={multa.id}>
          <div>
            <Link to={`/eventos/${multa.evento_id}`}>
              {multa.evento?.titulo ?? 'Evento cancelado'} <Icone nome="direita" tamanho={14} />
            </Link>
            <small>{multa.tipo === 'percentual'
              ? `${String(multa.percentual).replace('.', ',')}% de ${moeda(multa.valor_base)}`
              : 'Valor fixo'} · {multa.justificativa}</small>
            <small>Aplicada por {multa.responsavel} · {dataLonga(multa.aplicado_em, false)}</small>
          </div>
          <strong className={valoresOcultos ? 'valor-financeiro-oculto' : undefined}>{moeda(multa.valor)}</strong>
        </li>)}
      </ul>
    </section>}
    <nav className="financeiro-abas" aria-label="Seções do financeiro">
      {SECOES.map((s) => {
        const novos = new URLSearchParams(parametros); novos.set('aba', s.id);
         const quantidade = s.id === 'eventos' ? dados.eventos.length : s.id === 'equipe' ? dados.equipe.length : s.id === 'despesas' ? dados.despesasGerais.length : dados.adicionaisGerais.length;
        return <Link key={s.id} to={{ pathname: '/financeiro', search: novos.toString() }} aria-current={aba === s.id ? 'page' : undefined} className={aba === s.id ? 'ativo' : ''}>
          <Icone nome={s.icone} tamanho={18} /><span className="financeiro-aba-nome">{s.nome}</span><span className="financeiro-aba-curto">{s.id === 'eventos' ? 'Eventos' : s.id === 'equipe' ? 'Equipe' : 'Despesas'}</span><small>{quantidade}</small>
        </Link>;
      })}
    </nav>
    <section className="financeiro-secao" id="financeiro-lista" aria-labelledby="financeiro-titulo">
       <div className="financeiro-secao-topo"><div>
          <h2 id="financeiro-titulo">{aba === 'eventos' ? 'Resumo por evento' : aba === 'equipe' ? 'Pagamentos pendentes' : aba === 'despesas' ? 'Despesas gerais e insumos' : 'Adicionais gerais de produtores'}</h2>
          <p>{encontrados} de {total} {aba === 'eventos' ? 'eventos · mais recentes primeiro' : aba === 'equipe' ? 'profissionais' : aba === 'despesas' ? 'despesas' : 'adicionais'}</p>
        </div><div className="financeiro-lista-acoes">
          {filtrado && <button type="button" className="link-botao" onClick={limpar}>Limpar filtros</button>}
          {aba === 'adicionais' && permissoes.gestao && <button type="button" className="botao pequeno primario" onClick={() => setAdicional(true)}><Icone nome="mais" tamanho={15} /> Registrar adicional</button>}
          <button type="button" className="botao pequeno primario" onClick={() => void exportarPlanilha()}><Icone nome="arquivo" tamanho={15} /> Exportar Excel</button>
        </div></div>
       <div className={`financeiro-filtros ${aba === 'equipe' || aba === 'adicionais' ? 'somente-busca' : ''}${filtrosAbertos ? ' aberto' : ''}`}>
        <div className="financeiro-busca-linha">
        <label className="busca-eventos"><span className="busca-icone" aria-hidden="true">⌕</span><span className="sr-only">{aba === 'eventos' ? 'Buscar evento' : aba === 'equipe' ? 'Buscar profissional ou evento' : 'Buscar despesa'}</span>
          <input type="search" value={busca} onChange={(e) => alterar(`busca_${aba}`, e.target.value)} placeholder={aba === 'eventos' ? 'Buscar evento' : aba === 'equipe' ? 'Buscar profissional ou evento' : 'Buscar despesa'} />
          {busca && <button type="button" className="limpar-busca" aria-label="Limpar busca" onClick={() => alterar(`busca_${aba}`, '')}>×</button>}
        </label>
         {(aba === 'eventos' || aba === 'despesas') && <button type="button" className="botao financeiro-filtros-toggle so-mobile" aria-expanded={filtrosAbertos} aria-controls="financeiro-filtros-detalhes" onClick={() => setFiltrosAbertos((atual) => !atual)}>
          <Icone nome="lista" tamanho={16} /><span>Filtros</span>{filtrosSelecionados > 0 && <small>{filtrosSelecionados}</small>}
        </button>}
        </div>
         {(aba === 'eventos' || aba === 'despesas') && <div className="financeiro-filtros-detalhes" id="financeiro-filtros-detalhes">
        {aba === 'eventos' && <>
          <SeletorFiltro label="Mês" icon="calendario" value={mes} options={[[ '', 'Todos os meses' ], ...[...meses].sort(([a], [b]) => b.localeCompare(a))]} onChange={(v) => alterar('mes', v)} />
          <SeletorFiltro label="Recebimento" icon="dinheiro" value={situacao} options={[[ '', 'Todas as situações' ], ...Object.entries(SITUACOES)]} onChange={(v) => alterar('situacao', v)} />
        </>}
        {aba === 'despesas' && <>
          <SeletorFiltro label="Tipo" icon="lista" value={tipo} options={[[ '', 'Todos os tipos' ], ['extra', 'Gasto extra'], ['insumo', 'Insumo']]} onChange={(v) => alterar('tipo', v)} />
          <SeletorFiltro label="Aprovação" icon="acessos" value={aprovacao} options={[[ '', 'Todas as situações' ], ...Object.entries(APROVACAO)]} onChange={(v) => alterar('aprovacao', v)} />
        </>}
        </div>}
      </div>
      {aba === 'eventos' && (paginaEventos.itens.length ? <div className="financeiro-grade">
        {paginaEventos.itens.map((r) => {
          const percentual = r.contratado > 0 ? Math.min(100, Math.max(0, r.recebido / r.contratado * 100)) : 0;
          return <Link to={`/eventos/${r.evento.id}`} state={{ voltarPara: `/financeiro?${parametros}` }} className="financeiro-evento" key={r.evento.id}>
            <div className="financeiro-cartao-topo"><span className="financeiro-cartao-icone"><Icone nome="presente" tamanho={19} /></span><span className={`selo ${r.situacao === 'pago' ? 'ok' : r.situacao === 'parcial' ? 'alerta' : 'neutro'}`}>{SITUACOES[r.situacao]}</span></div>
            <h3>{r.evento.titulo}</h3><p className="financeiro-data"><Icone nome="calendario" tamanho={14} />{dataLonga(r.evento.inicio, false)}</p>
             <dl className="financeiro-valores"><div><dt>Contratado</dt><dd className={valoresOcultos ? 'valor-financeiro-oculto' : undefined}>{moeda(r.contratado)}</dd></div><div><dt>Recebido</dt><dd className={`ok-texto${valoresOcultos ? ' valor-financeiro-oculto' : ''}`}>{moeda(r.recebido)}</dd></div></dl>
            <progress className={r.situacao === 'pago' ? 'pago' : ''} value={percentual} max={100} aria-label={`Recebido de ${r.evento.titulo}`} />
             <div className="financeiro-restante"><span>A receber</span><strong className={valoresOcultos ? 'valor-financeiro-oculto' : undefined}>{moeda(Math.max(0, r.contratado - r.recebido))}</strong></div>
             <div className="financeiro-evento-rodape"><div><span>Equipe a pagar</span><strong className={valoresOcultos ? 'valor-financeiro-oculto' : undefined}>{moeda(r.aPagar)}</strong></div><div><span>Despesas</span><strong className={valoresOcultos ? 'valor-financeiro-oculto' : undefined}>{moeda(r.despesas)}</strong></div><Icone nome="direita" tamanho={18} /></div>
          </Link>;
        })}
      </div> : <Vazio icone="presente" titulo="Nenhum evento com valores registrados" filtrado={filtrado} limpar={limpar} />)}
       {aba === 'equipe' && (paginaEquipe.itens.length ? <div className="financeiro-grade">
        {paginaEquipe.itens.map((p) => <article className="financeiro-profissional" key={p.id}>
          <div className="financeiro-profissional-topo"><span className="avatar">{iniciais(p.nome)}</span><div><h3>{p.nome}</h3><small>{p.eventos.length} {p.eventos.length === 1 ? 'evento pendente' : 'eventos pendentes'}</small></div><span className="selo alerta">A pagar</span></div>
           <strong className={`financeiro-pagamento-total${valoresOcultos ? ' valor-financeiro-oculto' : ''}`}>{moeda(p.total)}</strong>
          <details className="financeiro-profissional-eventos"><summary>Ver eventos<Icone nome="direita" tamanho={15} /></summary>
             <ul className="financeiro-pagamento-eventos">{p.eventos.map((e) => <li key={e.id}><Link to={`/eventos/${e.id}`} state={{ voltarPara: `/financeiro?${parametros}` }}>{e.titulo}<Icone nome="direita" tamanho={14} /></Link><strong className={valoresOcultos ? 'valor-financeiro-oculto' : undefined}>{moeda(e.valor)}</strong></li>)}</ul>
          </details>
        </article>)}
       </div> : <Vazio icone="pessoas" titulo="Nenhum pagamento pendente" filtrado={filtrado} limpar={limpar} />)}
       {aba === 'adicionais' && <AdicionaisProdutores adicionais={paginaAdicionais.itens} mostrarTopo={false} />}
       {aba === 'despesas' && (paginaDespesas.itens.length ? <div className="financeiro-grade">
         {paginaDespesas.itens.map((d) => permissoes.gestao ? <button type="button" className="financeiro-despesa" key={d.id} onClick={() => setDespesa({ item: d })} aria-label={`Editar despesa ${d.descricao}`}>
          <span className="financeiro-cartao-topo"><span className="financeiro-cartao-icone"><Icone nome="dinheiro" tamanho={19} /></span><span className="selo neutro">{d.tipo === 'insumo' ? 'Insumo' : 'Gasto extra'}</span></span>
          <strong className="financeiro-despesa-titulo">{d.descricao}</strong><span className="financeiro-data">{db.profissionais.find((p) => p.id === d.responsavel_id)?.nome ?? 'Responsável não informado'}</span>
           <strong className={`financeiro-despesa-valor${valoresOcultos ? ' valor-financeiro-oculto' : ''}`}>{moeda(d.valor)}</strong>
          <span className="financeiro-despesa-rodape"><span className={`selo ${d.aprovacao === 'pendente' ? 'alerta' : d.aprovacao === 'aprovada' ? 'ok' : 'neutro'}`}>{APROVACAO[d.aprovacao]}</span><Icone nome="lapis" tamanho={16} /></span>
         </button> : <article className="financeiro-despesa" key={d.id}>
           <span className="financeiro-cartao-topo"><span className="financeiro-cartao-icone"><Icone nome="dinheiro" tamanho={19} /></span><span className="selo neutro">{d.tipo === 'insumo' ? 'Insumo' : 'Gasto extra'}</span></span>
           <strong className="financeiro-despesa-titulo">{d.descricao}</strong><span className="financeiro-data">{db.profissionais.find((p) => p.id === d.responsavel_id)?.nome ?? 'Responsável não informado'}</span>
           <strong className={`financeiro-despesa-valor${valoresOcultos ? ' valor-financeiro-oculto' : ''}`}>{moeda(d.valor)}</strong>
           <span className="financeiro-despesa-rodape"><span className={`selo ${d.aprovacao === 'pendente' ? 'alerta' : d.aprovacao === 'aprovada' ? 'ok' : 'neutro'}`}>{APROVACAO[d.aprovacao]}</span></span>
         </article>)}
      </div> : <Vazio icone="dinheiro" titulo="Nenhuma despesa geral lançada" filtrado={filtrado} limpar={limpar} />)}
      <Paginacao pagina={paginacao.atual} total={paginacao.totalPaginas} onMudar={mudarPagina} rotulo={`Paginação de ${SECOES.find((s) => s.id === aba)?.nome}`} />
     </section>
     {despesa && <FormDespesa item={despesa.item} onFechar={() => setDespesa(null)} />}
     {adicional && <FormAdicionalProdutor onFechar={() => setAdicional(false)} />}
   </Layout>;
}
