// Folha operacional do evento para salvar em PDF e mandar no WhatsApp.
// Nunca mostra valores: vai para a equipe inteira.

import { Link, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Icone, Logo } from '../components/Icone';
import { useEstado } from '../lib/estado';
import { dataLonga, hora } from '../lib/formato';
import {
  descricaoMaquiagem, equipeDoEvento, eventoPorId, localDe, ROTULO_FUNCAO, transporteDoEvento,
} from '../lib/consultas';
import { tituloEvento } from './DetalheEvento';

export function PdfEvento() {
  const { id = '' } = useParams();
  const { db } = useEstado();
  const evento = eventoPorId(db, id);

  if (!evento) {
    return <Layout tituloMobile="PDF do evento"><div className="vazio">Evento não encontrado.</div></Layout>;
  }

  const local = localDe(db, evento);
  const equipe = equipeDoEvento(db, evento.id);
  const produtores = equipe.filter((m) => m.escala.funcao === 'produtor');
  const transporte = transporteDoEvento(db, evento);
  const orientacoes = [
    ...(evento.orientacoes ?? '').split('\n'),
    local?.orientacoes_acesso && !evento.orientacoes?.includes(local.orientacoes_acesso)
      ? `Acesso ao local: ${local.orientacoes_acesso}` : '',
  ].map((l) => l.trim()).filter(Boolean);

  return (
    <Layout tituloMobile="PDF do evento">
      <div className="folha-acoes">
        <Link to={`/eventos/${evento.id}`} className="botao"><Icone nome="esquerda" /> Voltar ao evento</Link>
        <button type="button" className="botao primario" onClick={() => window.print()}>
          <Icone nome="impressora" /> Salvar PDF
        </button>
      </div>

      <article className="folha">
        <header className="folha-topo">
          <div>
            <span className="rotulo">Programação da equipe</span>
            <h1>{tituloEvento(evento)}</h1>
            <p className="suave" style={{ margin: '4px 0 0' }}>{dataLonga(evento.inicio)} · {hora(evento.inicio)} às {hora(evento.fim)}</p>
          </div>
          <Logo tamanho={48} />
        </header>

        <h2>Local</h2>
        <dl>
          <dt>Local</dt><dd>{local?.nome}</dd>
          <dt>Endereço</dt><dd>{local?.endereco ?? '—'}</dd>
          <dt>Localização</dt>
          <dd>{local?.link_localizacao ? <a href={local.link_localizacao}>{local.link_localizacao}</a> : '—'}</dd>
        </dl>

        <h2>Equipe</h2>
        <dl>
          {equipe.map((m) => (
            <div key={m.escala.id} style={{ display: 'contents' }}>
              <dt>{ROTULO_FUNCAO[m.escala.funcao]}</dt>
              <dd>
                {m.profissional?.nome}
                {m.escala.funcao === 'artista' && m.personagem && ` · ${m.personagem.nome}`}
                {m.fantasia && ` (fantasia ${m.fantasia.tamanho ?? 'única'})`}
                {m.escala.funcao === 'maquiador' && ` · ${descricaoMaquiagem(db, evento, m)}`}
                {m.profissional?.telefone && ` · ${m.profissional.telefone}`}
              </dd>
            </div>
          ))}
          <dt>Produção responsável</dt>
          <dd>{produtores.map((m) => m.profissional?.nome).join(' e ') || 'A definir'}</dd>
        </dl>

        <h2>Transporte</h2>
        <p style={{ margin: 0 }}>
          {transporte.reserva
            ? `${transporte.veiculoNome} com ${transporte.responsavel?.nome} · retirada ${hora(transporte.reserva.retirada)}, devolução ${hora(transporte.reserva.devolucao_prevista)}`
            : 'Sem veículo reservado.'}
        </p>

        <h2>Orientações</h2>
        {orientacoes.length ? (
          <ul className="orientacoes">{orientacoes.map((o) => <li key={o}>{o}</li>)}</ul>
        ) : <p style={{ margin: 0 }}>Sem orientações específicas.</p>}

        <footer className="folha-rodape">Mundinho de Kids · documento para a equipe, sem valores.</footer>
      </article>
    </Layout>
  );
}
