// Estado do app em modo demonstração. As ações imitam as funções do banco
// (decidir_substituicao etc.) para a tela se comportar como vai se comportar
// ligada ao Supabase.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { criarBaseDemo, HOJE_DEMO } from '../data/demo';
import type { BaseDados } from './tipos';
import { aprovaTrocas, type PerfilTela } from './consultas';

interface Estado {
  db: BaseDados;
  hoje: string;
  perfil: PerfilTela;
  setPerfil: (p: PerfilTela) => void;
  decidirTroca: (substituicaoId: string, aprova: boolean) => void;
  aviso: string | null;
  avisar: (mensagem: string) => void;
}

const Contexto = createContext<Estado | null>(null);

const NOME_PERFIL: Record<PerfilTela, string> = { gerente: 'Gerente geral', supervisora: 'Supervisora' };

export function ProvedorEstado({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<BaseDados>(criarBaseDemo);
  const [perfil, setPerfil] = useState<PerfilTela>('gerente');
  const [aviso, setAviso] = useState<string | null>(null);
  const hoje = HOJE_DEMO;

  const avisar = useCallback((mensagem: string) => {
    setAviso(mensagem);
    window.setTimeout(() => setAviso((atual) => (atual === mensagem ? null : atual)), 3200);
  }, []);

  const decidirTroca = useCallback((substituicaoId: string, aprova: boolean) => {
    if (!aprovaTrocas(perfil)) {
      avisar('Só a gerente ou a direção aprovam trocas.');
      return;
    }
    setDb((atual) => {
      const troca = atual.substituicoes.find((s) => s.id === substituicaoId);
      if (!troca || troca.situacao !== 'aguardando_aprovacao') return atual;
      const escala = atual.evento_escala.find((x) => x.id === troca.escala_id);
      if (!escala) return atual;

      const nome = (id: string) => atual.profissionais.find((p) => p.id === id)?.nome ?? '';
      const personagem = atual.personagens.find((p) => p.id === escala.personagem_id)?.nome ?? 'personagem';
      const proximoHistorico = Math.max(0, ...atual.historico.map((h) => h.id)) + 1;

      const substituicoes = atual.substituicoes.map((s) =>
        s.id === troca.id ? { ...s, situacao: aprova ? 'aprovada' as const : 'recusada' as const, decidido_em: hoje } : s);

      // Aprovada: a vaga antiga sai da escala (fica no histórico) e entra o substituto
      const evento_escala = aprova
        ? [
            ...atual.evento_escala.map((x) => (x.id === escala.id ? { ...x, ativo: false } : x)),
            { ...escala, id: `es-troca-${troca.id}`, profissional_id: troca.substituto_id, ativo: true },
          ]
        : atual.evento_escala;

      const descricao = aprova
        ? `Troca aprovada: ${nome(troca.substituto_id)} assume o ${personagem}`
        : `Troca recusada: ${nome(troca.solicitante_id)} continua como ${personagem}`;

      return {
        ...atual,
        substituicoes,
        evento_escala,
        historico: [
          ...atual.historico,
          { id: proximoHistorico, evento_id: escala.evento_id, descricao, financeiro: false, usuario_nome: NOME_PERFIL[perfil], em: hoje },
        ],
      };
    });
    avisar(aprova ? 'Troca aprovada. Escala atualizada e equipe avisada.' : 'Troca recusada. A escala continua como estava.');
  }, [perfil, hoje, avisar]);

  const valor = useMemo(
    () => ({ db, hoje, perfil, setPerfil, decidirTroca, aviso, avisar }),
    [db, hoje, perfil, decidirTroca, aviso, avisar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useEstado(): Estado {
  const estado = useContext(Contexto);
  if (!estado) throw new Error('useEstado fora do ProvedorEstado');
  return estado;
}

export { NOME_PERFIL };
