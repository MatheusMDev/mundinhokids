// Conferência das fantasias depois do evento: devolução, condição, limpeza,
// reparo e pendências para o próximo uso. A situação da fantasia (limpeza ou
// manutenção) muda sozinha no banco; a previsão de volta entra aqui.

import { useState } from 'react';
import { Campo, Dialogo, Linha, Marcador, SeletorData, SeletorOpcao } from './Formulario';
import { useEstado } from '../lib/estado';
import { salvarConferencias, vazioParaNulo, type DadosConferencia } from '../lib/acoes';
import { deCampos, paraCampos } from '../lib/formato';
import { equipeDoEvento } from '../lib/consultas';
import type { CondicaoPeca, Evento } from '../lib/tipos';

interface LinhaConferencia {
  fantasia_id: string;
  nome: string;
  quem: string;
  devolvida: boolean;
  condicao: CondicaoPeca;
  limpeza: boolean;
  reparo: boolean;
  pendencias: string;
  volta: string;
}

export const ROTULO_CONDICAO: Record<CondicaoPeca, string> = { ok: 'Em ordem', danificada: 'Danificada', faltando: 'Faltando peça' };

export function FormConferencia({ evento, onFechar }: { evento: Evento; onFechar: () => void }) {
  const { db, cliente, executar } = useEstado();

  const [linhas, setLinhas] = useState<LinhaConferencia[]>(() => {
    const membros = equipeDoEvento(db, evento.id).filter((m) => m.fantasia);
    const vistas = new Set<string>();
    return membros.flatMap((m) => {
      const f = m.fantasia!;
      if (vistas.has(f.id)) return [];
      vistas.add(f.id);
      const anterior = db.conferencias_fantasia.find((c) => c.evento_id === evento.id && c.fantasia_id === f.id);
      return [{
        fantasia_id: f.id,
        nome: `${f.identificacao} · ${f.tamanho ?? 'único'}`,
        quem: m.profissional?.nome ?? '',
        devolvida: anterior?.devolvida ?? true,
        condicao: anterior?.condicao ?? 'ok',
        limpeza: anterior?.precisa_limpeza ?? false,
        reparo: anterior?.precisa_reparo ?? false,
        pendencias: anterior?.pendencias ?? '',
        volta: f.previsao_disponivel ? paraCampos(f.previsao_disponivel).data : '',
      }];
    });
  });

  const mudar = (id: string, campo: Partial<LinhaConferencia>) =>
    setLinhas((atual) => atual.map((l) => (l.fantasia_id === id ? { ...l, ...campo } : l)));

  return (
    <Dialogo
      titulo={`Conferir fantasias · ${evento.titulo}`}
      onFechar={onFechar}
      textoSalvar="Salvar conferência"
      validar={() => {
        const semNota = linhas.find((l) => (l.condicao !== 'ok' || !l.devolvida) && !l.pendencias.trim());
        return semNota ? `Descreva o que falta ou o dano em ${semNota.nome}.` : null;
      }}
      onSalvar={() => executar(() => salvarConferencias(
        cliente, evento.id,
        linhas.map((l): DadosConferencia => ({
          fantasia_id: l.fantasia_id, devolvida: l.devolvida, condicao: l.condicao,
          precisa_limpeza: l.limpeza, precisa_reparo: l.reparo || l.condicao === 'danificada',
          pendencias: vazioParaNulo(l.pendencias),
        })),
        linhas.filter((l) => (l.limpeza || l.reparo || l.condicao === 'danificada') && l.volta)
          .map((l) => ({ fantasia_id: l.fantasia_id, previsao: deCampos(l.volta, '12:00') })),
      ), linhas.some((l) => l.limpeza || l.reparo || l.condicao === 'danificada')
        ? 'Conferência salva. As fantasias que precisam de cuidado saíram da lista de disponíveis.'
        : 'Conferência salva.')}
    >
      {linhas.length === 0 && <div className="vazio">Nenhuma fantasia foi escalada neste evento.</div>}
      {linhas.map((l) => {
        const foraDeUso = l.limpeza || l.reparo || l.condicao === 'danificada';
        return (
          <fieldset key={l.fantasia_id} className="conferencia">
            <legend><strong>{l.nome}</strong>{l.quem && <small> · com {l.quem}</small>}</legend>
            <Linha>
              <Marcador texto="Devolvida" marcado={l.devolvida} onMudar={(v) => mudar(l.fantasia_id, { devolvida: v, condicao: v ? l.condicao : 'faltando' })} />
              <SeletorOpcao rotulo="Condição" valor={l.condicao} opcoes={Object.entries(ROTULO_CONDICAO)} onMudar={(valor) => mudar(l.fantasia_id, { condicao: valor as CondicaoPeca })} />
            </Linha>
            <Linha>
              <Marcador texto="Precisa de limpeza" marcado={l.limpeza} onMudar={(v) => mudar(l.fantasia_id, { limpeza: v })} />
              <Marcador texto="Precisa de reparo" marcado={l.reparo || l.condicao === 'danificada'} onMudar={(v) => mudar(l.fantasia_id, { reparo: v })} />
            </Linha>
            {foraDeUso && (
              <SeletorData rotulo="Previsão de volta" valor={l.volta} onMudar={(valor) => mudar(l.fantasia_id, { volta: valor })} />
            )}
            <Campo rotulo="Pendências para o próximo uso" dica={l.condicao !== 'ok' || !l.devolvida ? 'Obrigatório: o que falta ou o que estragou.' : 'Ex.: luva com o dedo descosturado.'}>
              {(id) => <input id={id} value={l.pendencias} onChange={(e) => mudar(l.fantasia_id, { pendencias: e.target.value })} />}
            </Campo>
          </fieldset>
        );
      })}
    </Dialogo>
  );
}
