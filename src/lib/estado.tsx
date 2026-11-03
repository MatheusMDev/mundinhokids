// Estado do app: login, base carregada do Supabase (já filtrada pelas
// permissões do banco) e ações que chamam as funções do banco.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { BaseDados, PerfilAcesso } from './tipos';
import type { PerfilTela } from './consultas';
import { carregarBase } from './dados';
import { traduzirErro } from './erros';
import { supabase } from './supabase';
import { Login } from '../pages/Login';
import { SkeletonEventos } from '../components/SkeletonEventos';

interface Estado {
  db: BaseDados;
  hoje: string;
  /** Perfil usado pelas telas: com valores (gerente) ou sem valores (supervisora) */
  perfil: PerfilTela;
  usuario: { id: string; nome: string; perfil: PerfilAcesso; profissionalId: string | null };
  decidirTroca: (substituicaoId: string, aprova: boolean) => void;
  /** O que o perfil do login pode fazer (as mesmas regras do banco, para a tela não oferecer o que vai ser recusado) */
  permissoes: Permissoes;
  cliente: SupabaseClient;
  /** Roda uma gravação: se der certo recarrega os dados, avisa e devolve true; se não, devolve o erro em português */
  executar: (acao: () => Promise<unknown>, sucesso: string) => Promise<true | string>;
  aviso: string | null;
  avisar: (mensagem: string) => void;
  sair: () => void;
}

export interface Permissoes {
  /** Diretora, gerente e supervisora: cadastros e eventos */
  operacao: boolean;
  /** Diretora e gerente: valores e aprovação de trocas */
  gestao: boolean;
  /** Tirar alguém de uma equipe já escalada */
  alterarEquipe: boolean;
  cancelarEvento: boolean;
  /** Operação e a responsável pelas fantasias */
  conferirFantasias: boolean;
}

const Contexto = createContext<Estado | null>(null);

function calcularPermissoes(perfil: PerfilAcesso, config: Record<string, string>): Permissoes {
  const gestao = perfil === 'diretora' || perfil === 'gerente';
  const supervisora = perfil === 'supervisora';
  return {
    operacao: gestao || supervisora,
    gestao,
    alterarEquipe: gestao || (supervisora && config.supervisora_pode_alterar_equipe === 'true'),
    cancelarEvento: gestao || (supervisora && config.supervisora_pode_cancelar === 'true'),
    conferirFantasias: gestao || supervisora || perfil === 'fantasias',
  };
}

export const NOME_PERFIL: Record<PerfilAcesso, string> = {
  diretora: 'Direção', gerente: 'Gerente geral', supervisora: 'Supervisora', produtor: 'Produção',
  artista: 'Artista', maquiador: 'Maquiagem', fantasias: 'Fantasias',
};

/** Diretora e gerente veem valores; os demais perfis usam a tela sem valores */
const perfilDaTela = (perfil: PerfilAcesso): PerfilTela =>
  perfil === 'diretora' || perfil === 'gerente' ? 'gerente' : 'supervisora';

function useAviso() {
  const [aviso, setAviso] = useState<string | null>(null);
  const avisar = useCallback((mensagem: string) => {
    setAviso(mensagem);
    window.setTimeout(() => setAviso((atual) => (atual === mensagem ? null : atual)), 3500);
  }, []);
  return { aviso, avisar };
}

function TelaSimples({ titulo, texto, acao }: { titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <div className="tela-simples">
      <div className="cartao">
        <h2>{titulo}</h2>
        <p className="suave">{texto}</p>
        {acao}
      </div>
    </div>
  );
}

export function ProvedorEstado({ children }: { children: ReactNode }) {
  if (!supabase) {
    return (
      <TelaSimples
        titulo="Supabase não configurado"
        texto="Crie o arquivo .env.local na raiz do projeto com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja .env.example e supabase/README.md) e reinicie o npm run dev."
      />
    );
  }
  return <ProvedorSupabase cliente={supabase}>{children}</ProvedorSupabase>;
}

function ProvedorSupabase({ cliente, children }: { cliente: SupabaseClient; children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [db, setDb] = useState<BaseDados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [hoje, setHoje] = useState(() => new Date().toISOString());
  const { aviso, avisar } = useAviso();

  useEffect(() => {
    cliente.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = cliente.auth.onAuthStateChange((_evento, nova) => setSessao(nova));
    return () => data.subscription.unsubscribe();
  }, [cliente]);

  const recarregar = useCallback(async () => {
    try {
      setErro(null);
      setDb(await carregarBase(cliente));
      setHoje(new Date().toISOString());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [cliente]);

  const uid = sessao?.user.id;
  useEffect(() => {
    if (uid) void recarregar();
    else setDb(null);
  }, [uid, recarregar]);

  const eu = db?.usuarios.find((u) => u.id === uid);

  const decidirTroca = useCallback(async (substituicaoId: string, aprova: boolean) => {
    const { error } = await cliente.rpc('decidir_substituicao', { p_substituicao_id: substituicaoId, p_aprova: aprova });
    if (error) {
      avisar(error.message);
      return;
    }
    await recarregar();
    avisar(aprova ? 'Troca aprovada. Escala atualizada e equipe avisada.' : 'Troca recusada. A escala continua como estava.');
  }, [cliente, recarregar, avisar]);

  const sair = useCallback(() => { void cliente.auth.signOut(); }, [cliente]);

  const executar = useCallback(async (acao: () => Promise<unknown>, sucesso: string) => {
    try {
      await acao();
    } catch (e) {
      return traduzirErro(e);
    }
    await recarregar();
    avisar(sucesso);
    return true as const;
  }, [recarregar, avisar]);

  const valor = useMemo<Estado | null>(() => (db && eu ? {
    db, hoje,
    perfil: perfilDaTela(eu.perfil),
    usuario: {
      id: eu.id, nome: eu.nome, perfil: eu.perfil,
      profissionalId: db.profissionais.find((p) => p.usuario_id === eu.id)?.id ?? null,
    },
    decidirTroca: (id, aprova) => { void decidirTroca(id, aprova); },
    permissoes: calcularPermissoes(eu.perfil, db.configuracoes),
    cliente, executar,
    aviso, avisar, sair,
  } : null), [db, eu, hoje, decidirTroca, cliente, executar, aviso, avisar, sair]);

  if (sessao === undefined) return <TelaSimples titulo="Mundinho Kids" texto="Carregando…" />;
  if (!sessao) return <Login />;
  if (erro) {
    return (
      <TelaSimples
        titulo="Não foi possível carregar os dados"
        texto={erro}
        acao={<div className="acoes" style={{ marginTop: 14 }}>
          <button type="button" className="botao primario" onClick={() => void recarregar()}>Tentar de novo</button>
          <button type="button" className="botao" onClick={sair}>Sair</button>
        </div>}
      />
    );
  }
  if (!db) return <SkeletonEventos />;
  if (!eu || !valor) {
    return (
      <TelaSimples
        titulo="Login sem perfil"
        texto={`O login ${sessao.user.email ?? ''} ainda não tem perfil no sistema. Peça para a gestão rodar supabase/vincular_usuarios.sql com este e-mail.`}
        acao={<button type="button" className="botao" style={{ marginTop: 14 }} onClick={sair}>Sair</button>}
      />
    );
  }
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useEstado(): Estado {
  const estado = useContext(Contexto);
  if (!estado) throw new Error('useEstado fora do ProvedorEstado');
  return estado;
}
