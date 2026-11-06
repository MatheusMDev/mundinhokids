// Troca de artista pela visão de quem participa: o artista escalado pede a
// troca indicando quem assume; o indicado aceita ou recusa; a gestão aprova
// (aprovação fica no detalhe do evento).

import { useEffect, useState } from 'react';
import { Campo, Dialogo } from './Formulario';
import { useEstado } from '../lib/estado';
import { buscarSubstitutos, desistirDaTroca, pedirTroca, responderTroca, vazioParaNulo } from '../lib/acoes';
import { traduzirErro } from '../lib/erros';
import { diaCurto, hora } from '../lib/formato';
import type { EscalaItem, Evento } from '../lib/tipos';

/** Até quando o artista pode pedir a troca (configuração do banco, padrão 1h30 antes) */
export function prazoDaTroca(evento: Evento, config: Record<string, string>) {
  const minutos = Number(config.substituicao_antecedencia_minutos || 90);
  return new Date(new Date(evento.inicio).getTime() - minutos * 60_000).toISOString();
}

export function FormPedirTroca({ evento, escala, personagem, onFechar }: {
  evento: Evento; escala: EscalaItem; personagem: string; onFechar: () => void;
}) {
  const { cliente, executar, db } = useEstado();
  const [opcoes, setOpcoes] = useState<{ profissional_id: string; nome: string }[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [substituto, setSubstituto] = useState('');
  const [motivo, setMotivo] = useState('');
  const prazo = prazoDaTroca(evento, db.configuracoes);

  useEffect(() => {
    let cancelado = false;
    setOpcoes(null);
    setErroLista(null);
    buscarSubstitutos(cliente, escala.id).then((lista) => {
      if (cancelado) return;
      setOpcoes(lista);
      setSubstituto((atual) => lista.some((p) => p.profissional_id === atual) ? atual : '');
    }).catch((e) => { if (!cancelado) setErroLista(traduzirErro(e)); });
    return () => { cancelado = true; };
  }, [cliente, escala.id, db.profissionais_disponiveis]);

  return (
    <Dialogo
      titulo={`Pedir troca · ${personagem}`} onFechar={onFechar} textoSalvar="Enviar pedido"
      validar={() => (!substituto ? 'Escolha quem pode assumir.'
        : !opcoes?.some((p) => p.profissional_id === substituto) ? 'Este profissional não está mais disponível. Atualize a lista.' : null)}
      onSalvar={() => executar(
        () => pedirTroca(cliente, escala.id, substituto, vazioParaNulo(motivo)),
        'Pedido enviado. Agora a pessoa indicada precisa aceitar e a gestão aprovar.',
      )}
    >
      <p className="suave" style={{ margin: 0 }}>
        {evento.titulo}, {diaCurto(evento.inicio)} às {hora(evento.inicio)}. Você pode pedir até {diaCurto(prazo)}, {hora(prazo)}.
        A troca só vale depois que a pessoa indicada aceitar e a gerente ou a direção aprovar.
      </p>
      <Campo rotulo="Quem assume" obrigatorio dica="Só aparecem artistas que fazem o personagem e estão livres no horário.">
        {(id) => (
          <select id={id} value={substituto} onChange={(e) => setSubstituto(e.target.value)} disabled={!opcoes?.length} required>
            <option value="">{opcoes === null ? 'Carregando…' : opcoes.length ? 'Escolha…' : 'Ninguém disponível'}</option>
            {opcoes?.map((o) => <option key={o.profissional_id} value={o.profissional_id}>{o.nome}</option>)}
          </select>
        )}
      </Campo>
      {erroLista && <p className="erro">{erroLista}</p>}
      {opcoes?.length === 0 && <p className="suave" style={{ margin: 0 }}>Se for urgente, fale direto com a gerente ou a direção.</p>}
      <Campo rotulo="Motivo">{(id) => <textarea id={id} value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />}</Campo>
    </Dialogo>
  );
}

/** Desistir do próprio pedido antes da aprovação */
export function BotaoDesistir({ substituicaoId }: { substituicaoId: string }) {
  const { cliente, executar, avisar } = useEstado();
  const [enviando, setEnviando] = useState(false);
  return (
    <button
      type="button" className="botao" disabled={enviando}
      onClick={async () => {
        setEnviando(true);
        const r = await executar(() => desistirDaTroca(cliente, substituicaoId), 'Pedido de troca cancelado. Você continua na escala.');
        setEnviando(false);
        if (r !== true) avisar(r);
      }}
    >Desistir do pedido</button>
  );
}

/** Pedidos em que o login foi indicado para assumir */
export function TrocasParaMim() {
  const { db, cliente, executar, avisar } = useEstado();
  const [enviando, setEnviando] = useState<string | null>(null);
  if (!db.trocas_para_mim.length) return null;

  async function responder(id: string, aceita: boolean) {
    setEnviando(id);
    const r = await executar(() => responderTroca(cliente, id, aceita),
      aceita ? 'Você aceitou. Agora falta a aprovação da gestão.' : 'Você recusou o pedido.');
    setEnviando(null);
    if (r !== true) avisar(r);
  }

  return (
    <section className="cartao trocas-para-mim">
      <h2>Pedidos de troca para você</h2>
      {db.trocas_para_mim.map((t) => (
        <div key={t.substituicao_id} className="troca-cartao">
          <div>
            <span className="rotulo">{t.situacao === 'aguardando_aceite' ? 'Você foi indicado' : 'Aguardando aprovação da gestão'}</span>
            <strong>{t.solicitante} pediu para você fazer {t.personagem ? `o ${t.personagem}` : 'a vaga'} na {t.titulo}</strong>
            <p>{diaCurto(t.inicio)}, {hora(t.inicio)} às {hora(t.fim)} · {t.local_nome}{t.motivo ? ` · Motivo: ${t.motivo}` : ''}</p>
          </div>
          {t.situacao === 'aguardando_aceite' ? (
            <div className="acoes">
              <button type="button" className="botao" disabled={enviando === t.substituicao_id} onClick={() => void responder(t.substituicao_id, false)}>Recusar</button>
              <button type="button" className="botao primario" disabled={enviando === t.substituicao_id} onClick={() => void responder(t.substituicao_id, true)}>Aceitar</button>
            </div>
          ) : (
            <div className="troca-espera">Depois da aprovação o evento aparece na sua agenda.</div>
          )}
        </div>
      ))}
      <p className="suave" style={{ margin: 0, fontSize: 12.5 }}>
        Ao aceitar, a vaga ainda passa pela aprovação da gerente ou da direção.
      </p>
    </section>
  );
}
