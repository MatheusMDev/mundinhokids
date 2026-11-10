// Estado do app: login, base carregada do Supabase (já filtrada pelas
// permissões do banco) e ações que chamam as funções do banco.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { BaseDados, PerfilAcesso } from './tipos';
import type { PerfilTela } from './consultas';
import { carregarBase } from './dados';
import { traduzirErro } from './erros';
import { sairDesteAparelho, supabase } from './supabase';
import { Login } from '../pages/Login';
import { TrocarSenha } from '../pages/TrocarSenha';
import { SkeletonConfiguracoes, SkeletonDetalheEvento, SkeletonEventos } from '../components/SkeletonEventos';
import { SkeletonFinanceiro } from '../components/SkeletonFinanceiro';

interface Estado {
  db: BaseDados;
  hoje: string;
  /** Perfil usado pelas telas: com valores (gerente) ou sem valores (supervisora) */
  perfil: PerfilTela;
  usuario: { id: string; nome: string; perfil: PerfilAcesso; profissionalId: string | null };
  decidirTroca: (substituicaoId: string, aprova: boolean) => void;
  /** O que o perfil do login pode fazer (as mesmas regras do banco, para a tela não oferecer o que vai ser recusado) */
  permissoes: Permissoes;
  /**
   * Papéis do login: o perfil mais as funções do profissional ligado a ele
   * (ex.: perfil Artista com a função Produção no cadastro = artista e produtor)
   */
  papeis: ReadonlySet<PerfilAcesso>;
  /** Telas que o login enxerga, somando todos os papéis (menu, abas e acesso pelo endereço) */
  telas: ReadonlySet<Tela>;
  /** Primeira tela do perfil: o calendário, ou Fantasias para quem só cuida delas */
  inicio: string;
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

function calcularPermissoes(perfil: PerfilAcesso, papeis: ReadonlySet<PerfilAcesso>, config: Record<string, string>): Permissoes {
  const gestao = perfil === 'diretora' || perfil === 'gerente';
  const supervisora = perfil === 'supervisora';
  return {
    operacao: gestao || supervisora,
    gestao,
    alterarEquipe: gestao || (supervisora && config.supervisora_pode_alterar_equipe === 'true'),
    cancelarEvento: gestao || (supervisora && config.supervisora_pode_cancelar === 'true'),
    conferirFantasias: gestao || supervisora || papeis.has('fantasias'),
  };
}

export type Tela =
  | 'painel' | 'eventos' | 'notificacoes' | 'profissionais' | 'personagens' | 'fantasias' | 'veiculos'
  | 'financeiro' | 'cadastros' | 'usuarios' | 'configuracoes';

export const TODAS: Tela[] = [
  'painel', 'eventos', 'notificacoes', 'profissionais', 'personagens', 'fantasias', 'veiculos', 'financeiro', 'cadastros', 'usuarios', 'configuracoes',
];

const GESTAO: PerfilAcesso[] = ['diretora', 'gerente'];
const OPERACAO: PerfilAcesso[] = ['diretora', 'gerente', 'supervisora'];

/**
 * Telas que podem ser liberadas para o perfil (as mesmas travas da função do
 * servidor): Financeiro só gestão; Usuários e Configurações só operação.
 */
export function telaPermitida(tela: Tela, perfil: PerfilAcesso) {
  if (tela === 'financeiro') return GESTAO.includes(perfil);
  if (tela === 'usuarios' || tela === 'configuracoes') return OPERACAO.includes(perfil);
  return true;
}

/** Padrão do perfil, somando as funções do profissional ligado ao login */
export const telasPadrao = (perfil: PerfilAcesso, funcoes: readonly string[]) =>
  new Set([perfil, ...funcoes].flatMap((p) => TELAS_DO_PERFIL[p as PerfilAcesso] ?? []));

/**
 * Telas de cada perfil. Os dados já vêm filtrados pelo banco (cada um só recebe
 * os próprios eventos, e valores só a gestão); aqui fica o que aparece no menu.
 */
const TELAS_DO_PERFIL: Record<PerfilAcesso, Tela[]> = {
  diretora: TODAS,
  gerente: TODAS,
  supervisora: TODAS.filter((t) => t !== 'financeiro'),
  produtor: ['painel', 'eventos', 'notificacoes', 'veiculos'],
  artista: ['painel', 'eventos', 'notificacoes'],
  maquiador: ['painel', 'eventos', 'notificacoes'],
  fantasias: ['eventos', 'notificacoes', 'fantasias'],
};

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
  /** Chegou pelo link de "esqueci minha senha": precisa criar a nova senha antes de usar o sistema */
  const [recuperando, setRecuperando] = useState(false);
  const { aviso, avisar } = useAviso();
  const recargaAtual = useRef(0);

  useEffect(() => {
    cliente.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = cliente.auth.onAuthStateChange((evento, nova) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true);
      setSessao(nova);
    });
    return () => data.subscription.unsubscribe();
  }, [cliente]);

  const recarregar = useCallback(async () => {
    const requisicao = ++recargaAtual.current;
    try {
      const novaBase = await carregarBase(cliente);
      if (requisicao !== recargaAtual.current) return;
      setErro(null);
      setDb(novaBase);
      setHoje(new Date().toISOString());
    } catch (e) {
      if (requisicao === recargaAtual.current) setErro(e instanceof Error ? e.message : String(e));
    }
  }, [cliente]);

  const uid = sessao?.user.id;
  useEffect(() => {
    // Trocar/sair do login invalida respostas de consultas da sessão anterior.
    recargaAtual.current++;
    setDb(null);
    setErro(null);
    if (uid) void recarregar();
    return () => { recargaAtual.current++; };
  }, [uid, recarregar]);

  useEffect(() => {
    if (!uid) return;
    const canal = cliente
      .channel(`notificacoes-${uid}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `usuario_id=eq.${uid}`,
      }, () => { void recarregar(); })
      .subscribe();
    return () => { void cliente.removeChannel(canal); };
  }, [cliente, uid, recarregar]);

  // Exclusões e desativações feitas em outra aba/aparelho precisam chegar
  // também aos formulários que continuam abertos. O banco valida ao salvar.
  useEffect(() => {
    if (!uid) return;
    const atualizar = () => { if (document.visibilityState === 'visible') void recarregar(); };
    window.addEventListener('focus', atualizar);
    document.addEventListener('visibilitychange', atualizar);
    const intervalo = window.setInterval(atualizar, 30_000);
    return () => {
      window.removeEventListener('focus', atualizar);
      document.removeEventListener('visibilitychange', atualizar);
      window.clearInterval(intervalo);
    };
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

  const sair = useCallback(() => { void sairDesteAparelho(cliente); }, [cliente]);

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

  const valor = useMemo<Estado | null>(() => {
    if (!db || !eu) return null;
    const profissional = db.profissionais.find((p) => p.usuario_id === eu.id && p.ativo);
    const papeis = new Set<PerfilAcesso>([eu.perfil, ...(profissional?.funcoes ?? [])]);
    // Telas escolhidas pela gestão na edição do acesso; sem escolha, o padrão do perfil
    const telas = eu.telas
      ? new Set((eu.telas as Tela[]).filter((t) => TODAS.includes(t) && telaPermitida(t, eu.perfil)))
      : telasPadrao(eu.perfil, profissional?.funcoes ?? []);
    return {
      db, hoje,
      perfil: perfilDaTela(eu.perfil),
      usuario: { id: eu.id, nome: eu.nome, perfil: eu.perfil, profissionalId: profissional?.id ?? null },
      decidirTroca: (id, aprova) => { void decidirTroca(id, aprova); },
      permissoes: calcularPermissoes(eu.perfil, papeis, db.configuracoes),
      papeis, telas,
      inicio: telas.has('painel') ? '/' : '/fantasias',
      cliente, executar,
      aviso, avisar, sair,
    };
  }, [db, eu, hoje, decidirTroca, cliente, executar, aviso, avisar, sair]);

  const telaFinanceiro = window.location.pathname === '/financeiro';
  const telaConfiguracoes = window.location.pathname === '/configuracoes';
  const telaDetalheEvento = /^\/eventos\/[^/]+$/.test(window.location.pathname);
  const carregamento = telaFinanceiro ? <SkeletonFinanceiro /> : telaConfiguracoes ? <SkeletonConfiguracoes /> : telaDetalheEvento ? <SkeletonDetalheEvento /> : <SkeletonEventos />;
  if (sessao === undefined) return carregamento;
  if (!sessao) return <Login />;
  // Senha provisória, convite ou link de recuperação: a pessoa cria a própria senha primeiro
  if (recuperando || sessao.user.user_metadata?.trocar_senha === true) {
    return (
      <TrocarSenha
        cliente={cliente} email={sessao.user.email ?? ''} recuperacao={recuperando}
        onConcluido={() => setRecuperando(false)} onSair={sair}
      />
    );
  }
  if (erro) {
    return (
      <TelaSimples
        titulo={telaFinanceiro ? 'Não foi possível carregar o Financeiro' : 'Não foi possível carregar os dados'}
        texto={erro}
        acao={<div className="acoes" style={{ marginTop: 14 }}>
          <button type="button" className="botao primario" onClick={() => void recarregar()}>Tentar de novo</button>
          <button type="button" className="botao" onClick={sair}>Sair</button>
        </div>}
      />
    );
  }
  if (!db) return carregamento;
  if (eu && !eu.ativo) {
    return <TelaSimples titulo="Acesso desativado" texto="Seu acesso foi desativado. Fale com a gerente ou a direção."
      acao={<button type="button" className="botao" onClick={sair}>Sair</button>} />;
  }
  if (!eu || !valor) {
    return (
      <TelaSimples
        titulo="Login sem perfil"
        texto={`O login ${sessao.user.email ?? ''} ainda não tem perfil no sistema. Peça para a direção ou a gerente dar acesso em Usuários e acessos.`}
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
