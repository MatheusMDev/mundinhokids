// Folha operacional do evento: salvar em PDF (pela impressão do navegador) e
// mandar o resumo no WhatsApp. Nunca mostra valores nem dados do contratante:
// vai para a equipe inteira.

import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Icone, Logo } from '../components/Icone';
import { useEstado } from '../lib/estado';
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

/** Texto curto para colar no grupo do WhatsApp */
function resumoWhatsApp(db: BaseDados, evento: Evento) {
  const local = localDe(db, evento);
  const equipe = equipeDoEvento(db, evento.id);
  const transporte = transporteDoEvento(db, evento);
  const linhas = [
    `*${tituloEvento(evento)}*`,
    `${dataLonga(evento.inicio, false)} · ${hora(evento.inicio)} às ${hora(evento.fim)}`,
    '',
    `*Local:* ${local?.nome ?? ''}${local?.endereco ? ` · ${local.endereco}` : ''}`,
    local?.link_localizacao ? `Mapa: ${local.link_localizacao}` : '',
    '',
    '*Equipe*',
    ...equipe.map((m) => `- ${ROTULO_FUNCAO[m.escala.funcao]}: ${m.profissional?.nome ?? ''}${m.escala.funcao === 'artista' && m.personagem ? ` (${m.personagem.nome})` : ''}`),
    transporte.reserva
      ? `\n*Transporte:* ${transporte.veiculoNome} com ${transporte.responsavel?.nome ?? ''}, retirada ${hora(transporte.reserva.retirada)}`
      : '',
    ...(linhasDe(evento.orientacoes).length ? ['', '*Orientações*', ...linhasDe(evento.orientacoes).map((o) => `- ${o}`)] : []),
  ];
  return linhas.filter((l, i, todas) => l !== '' || todas[i - 1] !== '').join('\n').trim();
}

export function PdfEvento() {
  const { id = '' } = useParams();
  const { db, hoje } = useEstado();
  const evento = eventoPorId(db, id);

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
  const feedback = db.configuracoes.link_formulario_produtor;
  const linkWhatsApp = `https://wa.me/?text=${encodeURIComponent(resumoWhatsApp(db, evento))}`;
  const geradoEm = `${dataLonga(hoje, false).toLowerCase()}, ${hora(hoje)}`;

  return (
    <Layout tituloMobile="PDF da equipe">
      <div className="folha-acoes">
        <Link to={`/eventos/${evento.id}`} className="botao"><Icone nome="esquerda" /> Voltar</Link>
        <a className="botao" href={linkWhatsApp} target="_blank" rel="noreferrer">Enviar resumo no WhatsApp</a>
        <button type="button" className="botao primario" onClick={() => window.print()}>
          <Icone nome="impressora" /> Salvar PDF
        </button>
      </div>
      <p className="folha-dica so-tela">No “Salvar PDF”, escolha <strong>Salvar como PDF</strong> no destino da impressão. Depois é só anexar o arquivo no WhatsApp.</p>

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
