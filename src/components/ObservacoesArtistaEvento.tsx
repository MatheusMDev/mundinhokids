import { useState } from 'react';
import { adicionarObservacaoArtistaEvento, MAX_OBSERVACAO_ARTISTA_EVENTO } from '../lib/acoes';
import { useEstado } from '../lib/estado';
import type { Evento } from '../lib/tipos';
import { Icone } from './Icone';

function dataHora(data: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data));
}

export function ObservacoesArtistaEvento({ evento }: { evento: Evento }) {
  const { db, cliente, executar, permissoes, papeis, usuario } = useEstado();
  const [texto, setTexto] = useState('');
  const [publicando, setPublicando] = useState(false);
  const minhaEscala = db.evento_escala.filter((escala) => escala.evento_id === evento.id
    && escala.profissional_id === usuario.profissionalId && escala.ativo);
  const podeVer = permissoes.gestao || minhaEscala.length > 0;
  if (!podeVer) return null;

  const observacoes = (db.observacoes_artistas_eventos ?? [])
    .filter((item) => item.evento_id === evento.id)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  const podePublicar = evento.situacao !== 'cancelado' && papeis.has('artista')
    && minhaEscala.some((escala) => escala.funcao === 'artista');

  async function publicar() {
    if (!usuario.profissionalId || !texto.trim() || publicando) return;
    setPublicando(true);
    const resultado = await executar(
      () => adicionarObservacaoArtistaEvento(cliente, evento.id, usuario.profissionalId as string, texto),
      'Observação publicada para a equipe.',
    );
    setPublicando(false);
    if (resultado === true) setTexto('');
  }

  return <section className="cartao observacoes-artista-evento">
    <div className="cartao-topo">
      <div>
        <h2>Observações da equipe</h2>
        <p>Notas gerais do evento, inclusive sobre fantasia. Visíveis para a equipe escalada e a gestão.</p>
      </div>
      <Icone nome="arquivo" tamanho={18} />
    </div>

    {observacoes.length ? <ul className="observacoes-artista-lista">
      {observacoes.map((item) => {
        const profissional = db.profissionais.find((p) => p.id === item.profissional_id);
        return <li key={item.id}>
          <div><strong>{profissional?.nome ?? 'Artista'}</strong><time dateTime={item.criado_em}>{dataHora(item.criado_em)}</time></div>
          <p>{item.texto}</p>
        </li>;
      })}
    </ul> : <div className="vazio">Ainda não há observações neste evento.</div>}

    {podePublicar && <div className="observacoes-artista-form">
      <label htmlFor={`observacao-artista-${evento.id}`}>Adicionar observação</label>
      <textarea
        id={`observacao-artista-${evento.id}`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={MAX_OBSERVACAO_ARTISTA_EVENTO}
        rows={3}
        placeholder="Escreva uma informação útil para a equipe deste evento."
      />
      <div><small>{texto.length}/{MAX_OBSERVACAO_ARTISTA_EVENTO} caracteres</small>
        <button type="button" className="botao primario pequeno" disabled={!texto.trim() || publicando} onClick={() => void publicar()}>
          {publicando ? 'Publicando…' : 'Publicar observação'}
        </button>
      </div>
    </div>}
  </section>;
}
