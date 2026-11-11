// Folha operacional do evento: salvar em PDF (pela impressão do navegador) e
// copiar o resumo para compartilhar. Nunca mostra valores nem dados do contratante:
// vai para a equipe inteira.

import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Icone, Logo } from '../components/Icone';
import { producaoDoEvento, useEstado } from '../lib/estado';
import { dataLonga, hora, paraCampos } from '../lib/formato';
import {
  descricaoMaquiagem, equipeDoEvento, eventoPorId, localDe, ROTULO_FUNCAO, transporteDoEvento, type MembroEquipe,
} from '../lib/consultas';
import type { BaseDados, Evento } from '../lib/tipos';
import { tituloEvento } from './DetalheEvento';

const linhasDe = (texto: string | null | undefined) => (texto ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

function detalheDoMembro(db: BaseDados, evento: Evento, m: MembroEquipe) {
  if (m.escala.funcao === 'artista') {
    const f = m.fantasia;
    const fantasia = f && (f.identificacao === m.personagem?.nome
      ? `fantasia ${f.tamanho ?? 'única'}`
      : `fantasia ${f.identificacao}${f.tamanho ? ` ${f.tamanho}` : ''}`);
    return [m.personagem?.nome, fantasia, m.escala.maquiar && 'maquiagem'].filter(Boolean).join(' · ');
  }
  if (m.escala.funcao === 'maquiador') return descricaoMaquiagem(db, evento, m);
  return 'Responsável pelo evento';
}

/** Texto estruturado para colar em qualquer canal de comunicação. */
function resumoParaCompartilhar(db: BaseDados, evento: Evento) {
  const local = localDe(db, evento);
  const equipe = equipeDoEvento(db, evento.id);
  const transporte = transporteDoEvento(db, evento);
  const orientacoes = linhasDe(evento.orientacoes);
  const separador = '--------------------';
  const linhas = [
    `🎉 ${tituloEvento(evento)}`,
    `📅 ${dataLonga(evento.inicio, false)} · ${hora(evento.inicio)} às ${hora(evento.fim)}`,
    separador,
    '📍 LOCAL',
    `- ${local?.nome ?? 'Não informado'}${local?.endereco ? ` · ${local.endereco}` : ''}`,
    ...(local?.link_localizacao ? [`🗺️ Mapa: ${local.link_localizacao}`] : []),
    separador,
    '👥 EQUIPE',
    ...(equipe.length
      ? equipe.map((m) => `- ${ROTULO_FUNCAO[m.escala.funcao]}: ${m.profissional?.nome ?? ''}${m.escala.funcao === 'artista' && m.personagem ? ` (${m.personagem.nome})` : ''}`)
      : ['- Equipe ainda não escalada.']),
    separador,
    '🚗 TRANSPORTE',
    transporte.reserva
      ? `- ${transporte.veiculoNome} com ${transporte.responsavel?.nome ?? ''}, retirada ${hora(transporte.reserva.retirada)}`
      : '- Sem veículo reservado.',
    ...(orientacoes.length ? [separador, '📝 ORIENTAÇÕES', ...orientacoes.map((o) => `- ${o}`)] : []),
  ];
  return linhas.filter((l, i, todas) => l !== '' || todas[i - 1] !== '').join('\n').trim();
}

async function copiarTexto(texto: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(texto);
      return;
    } catch {
      // Alguns navegadores bloqueiam a Clipboard API fora de contexto seguro.
    }
  }

  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const copiou = document.execCommand('copy');
  area.remove();
  if (!copiou) throw new Error('A cópia foi bloqueada pelo navegador.');
}

export function PdfEvento() {
  const { id = '' } = useParams();
  const { db, hoje, usuario, permissoes, papeis } = useEstado();
  const [copiando, setCopiando] = useState(false);
  const [feedbackCopia, setFeedbackCopia] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const timerFeedback = useRef<number | null>(null);
  const evento = eventoPorId(db, id);

  useEffect(() => () => {
    if (timerFeedback.current) window.clearTimeout(timerFeedback.current);
  }, []);

  // O nome do arquivo salvo vem do título da página
  useEffect(() => {
    if (!evento) return;
    const anterior = document.title;
    const { data } = paraCampos(evento.inicio);
    document.title = `Equipe - ${evento.titulo} - ${data.split('-').reverse().join('-')}`;
    return () => { document.title = anterior; };
  }, [evento]);

  if (!evento) {
    return <Layout tituloMobile="PDF do evento"><div className="vazio">Evento não encontrado.</div></Layout>;
  }

  const local = localDe(db, evento);
  const equipe = equipeDoEvento(db, evento.id);
  const produtores = equipe.filter((m) => m.escala.funcao === 'produtor');
  const maquiagem = equipe.find((m) => m.escala.funcao === 'maquiador');
  const transporte = transporteDoEvento(db, evento);
  const personagens = [...new Map(equipe.flatMap((m) => (m.personagem ? [[m.personagem.id, m.personagem] as const] : []))).values()];
  const orientacoes = linhasDe(evento.orientacoes);
  const acesso = local?.orientacoes_acesso && !evento.orientacoes?.includes(local.orientacoes_acesso) ? local.orientacoes_acesso : null;
  // Formulário de feedback: só produção (escalada no evento) e acima
  const feedback = producaoDoEvento(db, evento.id, usuario.profissionalId, permissoes, papeis)
    ? db.configuracoes.link_formulario_produtor : undefined;
  const resumo = resumoParaCompartilhar(db, evento);
  const geradoEm = `${dataLonga(hoje, false).toLowerCase()}, ${hora(hoje)}`;

  async function copiarResumo() {
    setCopiando(true);
    setFeedbackCopia(null);
    if (timerFeedback.current) window.clearTimeout(timerFeedback.current);
    try {
      await copiarTexto(resumo);
      setFeedbackCopia({ tipo: 'sucesso', texto: 'Resumo copiado. Agora é só colar onde quiser.' });
    } catch {
      setFeedbackCopia({ tipo: 'erro', texto: 'Não foi possível copiar. Verifique a permissão da área de transferência e tente novamente.' });
    } finally {
      setCopiando(false);
      timerFeedback.current = window.setTimeout(() => setFeedbackCopia(null), 3500);
    }
  }

  return (
    <Layout tituloMobile="PDF da equipe">
      <div className="folha-acoes">
        <Link to={`/eventos/${evento.id}`} className="botao"><Icone nome="esquerda" /> Voltar</Link>
        <button type="button" className="botao" onClick={() => void copiarResumo()} disabled={copiando}>
          <Icone nome="copiar" /> {copiando ? 'Copiando...' : 'Copiar o resumo'}
        </button>
        <button type="button" className="botao primario" onClick={() => window.print()}>
          <Icone nome="impressora" /> Salvar PDF
        </button>
      </div>
      <p className="folha-dica so-tela">Copie o resumo para enviar no WhatsApp, e-mail ou qualquer outro canal. No “Salvar PDF”, escolha <strong>Salvar como PDF</strong> no destino da impressão.</p>
      {feedbackCopia && <p className={`folha-feedback ${feedbackCopia.tipo === 'erro' ? 'erro' : ''}`} role="status" aria-live="polite">{feedbackCopia.texto}</p>}

      <article className="folha">
        <header className="folha-topo">
          <div>
            <span className="rotulo">Programação da equipe</span>
            <h1>{tituloEvento(evento)}</h1>
            <p className="folha-quando">{dataLonga(evento.inicio)} · <strong>{hora(evento.inicio)} às {hora(evento.fim)}</strong></p>
            {evento.situacao === 'cancelado' && <p className="folha-alerta">EVENTO CANCELADO</p>}
          </div>
          <Logo tamanho={52} />
        </header>

        <div className="folha-grade">
          <section>
            <h2>Local</h2>
            <p className="folha-destaque">{local?.nome}</p>
            {local?.endereco && <p>{local.endereco}</p>}
            {local?.link_localizacao && <p><a href={local.link_localizacao}>Abrir no mapa</a><span className="so-impressao"> · {local.link_localizacao}</span></p>}
            {acesso && <p className="folha-obs">{acesso}</p>}
          </section>
          <section>
            <h2>Produção responsável</h2>
            {produtores.length ? produtores.map((m) => (
              <p key={m.escala.id}><span className="folha-destaque">{m.profissional?.nome}</span>{m.profissional?.telefone && ` · ${m.profissional.telefone}`}</p>
            )) : <p>A definir</p>}
            <h2>Transporte</h2>
            {transporte.reserva ? (
              <p>{transporte.veiculoNome} com {transporte.responsavel?.nome} · retirada {hora(transporte.reserva.retirada)}, devolução {hora(transporte.reserva.devolucao_prevista)}</p>
            ) : <p>Sem veículo reservado.</p>}
          </section>
        </div>

        <section>
          <h2>Equipe</h2>
          {equipe.length ? (
            <table className="folha-tabela">
              <thead><tr><th>Função</th><th>Nome</th><th>Personagem e detalhes</th><th>Telefone</th></tr></thead>
              <tbody>
                {equipe.map((m) => (
                  <tr key={m.escala.id}>
                    <td>{ROTULO_FUNCAO[m.escala.funcao]}</td>
                    <td><strong>{m.profissional?.nome}</strong></td>
                    <td>{detalheDoMembro(db, evento, m)}</td>
                    <td>{m.profissional?.telefone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p>Equipe ainda não escalada.</p>}
          {evento.tem_maquiagem && !maquiagem && <p className="folha-obs">Este evento tem maquiagem, mas ninguém foi escalado para fazer.</p>}
        </section>

        <section>
          <h2>Orientações do evento</h2>
          {orientacoes.length ? <ul className="orientacoes">{orientacoes.map((o) => <li key={o}>{o}</li>)}</ul> : <p>Sem orientações específicas.</p>}
        </section>

        {personagens.some((p) => p.orientacoes || p.referencias) && (
          <section>
            <h2>Personagens</h2>
            {personagens.map((p) => (
              <div key={p.id} className="folha-personagem">
                <p className="folha-destaque">{p.nome}</p>
                {p.orientacoes && <p>{p.orientacoes}</p>}
                {linhasDe(p.referencias).map((r) => <p key={r} className="folha-obs">Referência: {r}</p>)}
              </div>
            ))}
          </section>
        )}

        {feedback && produtores.length > 0 && (
          <section>
            <h2>Depois do evento</h2>
            <p>A produção preenche o formulário de feedback, com o vídeo: <a href={feedback}>{feedback}</a></p>
          </section>
        )}

        <footer className="folha-rodape">Mundinho Kids · gerado em {geradoEm} · documento da equipe, sem valores.</footer>
      </article>
    </Layout>
  );
}
