import { useState } from 'react';
import { abrirVideoEvento, enviarVideoEvento, MAX_VIDEO_EVENTO_BYTES } from '../lib/acoes';
import { useEstado } from '../lib/estado';
import { quando } from '../lib/formato';
import type { Evento } from '../lib/tipos';
import { Icone } from './Icone';

function tamanho(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export function VideoEvento({ evento }: { evento: Evento }) {
  const { db, cliente, executar, avisar, permissoes, papeis, usuario, hoje } = useEstado();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const video = db.videos_eventos.find((item) => item.evento_id === evento.id);
  const escalado = db.evento_escala.some((item) => item.evento_id === evento.id
    && item.profissional_id === usuario.profissionalId && item.ativo);
  const terminou = new Date(evento.fim) <= new Date(hoje);
  const cancelado = evento.situacao === 'cancelado';
  const podeEnviar = !cancelado && terminou && (permissoes.gestao || (escalado && papeis.has('produtor')));

  async function salvar() {
    if (!arquivo) return;
    setEnviando(true);
    const resultado = await executar(() => enviarVideoEvento(cliente, evento.id, arquivo), video ? 'Vídeo do evento atualizado.' : 'Vídeo do evento anexado.');
    setEnviando(false);
    if (resultado === true) setArquivo(null);
    else avisar(resultado);
  }

  return <section className="cartao video-evento">
    <div className="cartao-topo">
      <div><h2>Vídeo do evento</h2><p>Obrigatório antes de marcar o evento como realizado.</p></div>
      <span className={`selo ${video ? 'ok' : cancelado ? 'neutro' : 'alerta'}`}>{video ? 'Anexado' : cancelado ? 'Cancelado' : 'Pendente'}</span>
    </div>
    {video ? <div className="video-evento-arquivo">
      <span><strong>{video.nome}</strong><small>{tamanho(video.tamanho_bytes)} · enviado {quando(video.enviado_em, hoje)}</small></span>
      <button type="button" className="botao pequeno" onClick={() => void abrirVideoEvento(cliente, video).catch(() => avisar('Não foi possível abrir o vídeo. Tente novamente.'))}>
        <Icone nome="arquivo" tamanho={15} /> Abrir vídeo
      </button>
    </div> : <p className="suave video-evento-status">{cancelado ? 'Evento cancelado: não é necessário anexar vídeo.'
      : terminou ? 'O produtor escalado pode anexar o vídeo para concluir o evento.'
        : 'O envio ficará disponível após o término do evento.'}</p>}
    {podeEnviar && <div className="video-evento-envio">
      <label className="botao video-evento-seletor">
        <Icone nome="arquivo" tamanho={15} /> {video ? 'Escolher outro vídeo' : 'Selecionar vídeo'}
        <input type="file" accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
      </label>
      <small>MP4, WEBM ou MOV · máximo de 50 MB. Vídeos maiores precisam ser reduzidos.</small>
      {arquivo && <div className="video-evento-selecao">
        <span>{arquivo.name} · {tamanho(arquivo.size)}</span>
        <button type="button" className="botao primario pequeno" disabled={enviando || arquivo.size > MAX_VIDEO_EVENTO_BYTES} onClick={() => void salvar()}>
          {enviando ? 'Enviando…' : video ? 'Substituir vídeo' : 'Anexar vídeo'}
        </button>
        {arquivo.size > MAX_VIDEO_EVENTO_BYTES && <small className="texto-perigo">Este arquivo excede o limite de 50 MB.</small>}
      </div>}
    </div>}
  </section>;
}
