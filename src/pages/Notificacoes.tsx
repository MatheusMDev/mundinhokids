import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Icone } from '../components/Icone';
import { useEstado } from '../lib/estado';
import { marcarNotificacaoLida, salvarInscricaoPush, salvarPreferenciasNotificacao } from '../lib/acoes';
import type { Notificacao } from '../lib/tipos';
import { dataLonga, hora } from '../lib/formato';
import { prepararSom, tocarSomNotificacao } from '../lib/som';

const TIPOS_EQUIPE: { tipo: Notificacao['tipo']; titulo: string; texto: string }[] = [
  { tipo: 'escalado', titulo: 'Nova escala', texto: 'Quando você entrar na equipe de um evento.' },
  { tipo: 'alterado', titulo: 'Evento alterado', texto: 'Quando a data ou os dados de um evento mudarem.' },
  { tipo: 'cancelado', titulo: 'Evento cancelado', texto: 'Quando um evento da sua agenda for cancelado.' },
  { tipo: 'removido', titulo: 'Saída da escala', texto: 'Quando você for retirado de um evento.' },
  { tipo: 'substituicao', titulo: 'Troca de artista', texto: 'Quando houver uma troca envolvendo você.' },
  { tipo: 'lembrete', titulo: 'Lembrete', texto: 'Antes do início de um evento da sua agenda.' },
];

const TIPOS_GESTAO: { tipo: Notificacao['tipo']; titulo: string; texto: string }[] = [
  { tipo: 'despesa_aprovacao', titulo: 'Despesas para aprovar', texto: 'Quando uma despesa ultrapassar o limite configurado.' },
  { tipo: 'evento_gestao', titulo: 'Mudanças em eventos', texto: 'Quando um evento for cancelado ou remarcado.' },
  { tipo: 'pendencia_operacional', titulo: 'Pendências de equipe', texto: 'Quando um evento próximo estiver sem equipe escalada.' },
  { tipo: 'resumo_diario', titulo: 'Resumo diário', texto: 'Uma visão diária dos eventos previstos para a semana.' },
];
const TIPOS_GESTAO_IDS = new Set(TIPOS_GESTAO.map(({ tipo }) => tipo));
type Filtro = 'todas' | 'nao_lidas' | 'gestao' | 'equipe';

function estadoSecao(usuarioId: string, nome: string) {
  try {
    return localStorage.getItem(`mundinho:notificacoes:${usuarioId}:${nome}`) !== 'fechada';
  } catch {
    return true;
  }
}

const CHAVE_VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function chaveVapid(chave: string) {
  const preenchida = `${chave}${'='.repeat((4 - (chave.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(preenchida);
  return Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
}

function textoNotificacao(notificacao: Notificacao, tituloEvento: string) {
  if (notificacao.mensagem) return notificacao.mensagem;
  const nomes: Record<Notificacao['tipo'], string> = {
    escalado: 'Você foi escalado', lembrete: 'Lembrete de evento', alterado: 'Evento alterado',
    cancelado: 'Evento cancelado', removido: 'Você saiu da escala', substituicao: 'Atualização de troca',
    despesa_aprovacao: 'Despesa aguardando aprovação', evento_gestao: 'Mudança em evento',
    pendencia_operacional: 'Pendência operacional', resumo_diario: 'Resumo diário',
  };
  return `${nomes[notificacao.tipo]}${tituloEvento ? `: ${tituloEvento}` : '.'}`;
}

export function Notificacoes() {
  const { db, usuario, cliente, executar } = useEstado();
  const [preferencias, setPreferencias] = useState<Record<Notificacao['tipo'], boolean>>(() =>
    Object.fromEntries([...TIPOS_EQUIPE, ...(usuario.perfil === 'diretora' || usuario.perfil === 'gerente' ? TIPOS_GESTAO : [])].map(({ tipo }) => [tipo, db.notificacao_preferencias.find((p) => p.tipo === tipo)?.ativa ?? true])) as Record<Notificacao['tipo'], boolean>,
  );
  const [salvando, setSalvando] = useState(false);
  const [pushStatus, setPushStatus] = useState<'inativo' | 'ativo' | 'indisponivel' | 'erro'>('inativo');
  const [pushMensagem, setPushMensagem] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [dispositivoAberto, setDispositivoAberto] = useState(() => estadoSecao(usuario.id, 'dispositivo'));
  const [preferenciasAbertas, setPreferenciasAbertas] = useState(() => estadoSecao(usuario.id, 'preferencias'));

  useEffect(() => {
    const temInscricao = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setPushStatus('indisponivel');
      const registro = await navigator.serviceWorker.getRegistration('/');
      if (registro && await registro.pushManager.getSubscription()) setPushStatus('ativo');
    };
    void temInscricao();
  }, []);

  const naoLidas = db.notificacoes.filter((n) => !n.lida_em).length;
  const rotuloPush = pushStatus === 'ativo' ? 'Ativado neste dispositivo' : pushStatus === 'indisponivel' ? 'Indisponível neste navegador' : 'Não ativado';
  const notificacoesFiltradas = useMemo(() => db.notificacoes.filter((notificacao) => {
    if (filtro === 'nao_lidas') return !notificacao.lida_em;
    if (filtro === 'gestao') return TIPOS_GESTAO_IDS.has(notificacao.tipo);
    if (filtro === 'equipe') return !TIPOS_GESTAO_IDS.has(notificacao.tipo);
    return true;
  }), [db.notificacoes, filtro]);
  const grupos = useMemo(() => {
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    const porData = new Map<string, { titulo: string; itens: Notificacao[] }>();
    notificacoesFiltradas.forEach((notificacao) => {
      const data = new Date(notificacao.agendada_para);
      const chave = data.toLocaleDateString('pt-BR');
      const titulo = data.toDateString() === hoje.toDateString() ? 'Hoje'
        : data.toDateString() === ontem.toDateString() ? 'Ontem' : dataLonga(notificacao.agendada_para, false).split(',')[0];
      if (!porData.has(chave)) porData.set(chave, { titulo, itens: [] });
      porData.get(chave)!.itens.push(notificacao);
    });
    return [...porData.values()];
  }, [notificacoesFiltradas]);
  const alterarPreferencia = (tipo: Notificacao['tipo'], ativa: boolean) => setPreferencias((atual) => ({ ...atual, [tipo]: ativa }));

  useEffect(() => {
    try {
      localStorage.setItem(`mundinho:notificacoes:${usuario.id}:dispositivo`, dispositivoAberto ? 'aberta' : 'fechada');
      localStorage.setItem(`mundinho:notificacoes:${usuario.id}:preferencias`, preferenciasAbertas ? 'aberta' : 'fechada');
    } catch {
      // A central continua funcionando mesmo quando o navegador bloqueia armazenamento local.
    }
  }, [dispositivoAberto, preferenciasAbertas, usuario.id]);

  async function salvar() {
    setSalvando(true);
    const tipos = [...TIPOS_EQUIPE, ...(usuario.perfil === 'diretora' || usuario.perfil === 'gerente' ? TIPOS_GESTAO : [])];
    const r = await executar(() => salvarPreferenciasNotificacao(cliente, usuario.id, tipos.map(({ tipo }) => ({ tipo, ativa: preferencias[tipo] }))), 'Preferências salvas.');
    setSalvando(false);
    if (r !== true) setPushMensagem(r);
  }

  async function ativarPush() {
    if (!CHAVE_VAPID) return setPushMensagem('O Web Push ainda não foi configurado no ambiente. A central continua funcionando normalmente.');
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('indisponivel');
      return setPushMensagem('Este navegador não oferece notificações desktop.');
    }
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') return setPushMensagem('Permissão não concedida. Você ainda pode consultar a central.');
      const registro = await navigator.serviceWorker.register('/sw.js');
      const inscricao = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveVapid(CHAVE_VAPID) });
      await salvarInscricaoPush(cliente, inscricao.toJSON());
      setPushStatus('ativo');
      setPushMensagem('Notificações desktop ativadas.');
    } catch (erro) {
      setPushStatus('erro');
      setPushMensagem(erro instanceof Error ? erro.message : 'Não foi possível ativar as notificações.');
    }
  }

  async function marcarTodasComoLidas() {
    await executar(() => Promise.all(db.notificacoes.filter((n) => !n.lida_em).map((n) => marcarNotificacaoLida(cliente, n.id))), 'Notificações marcadas como lidas.');
  }

  async function marcarUmaComoLida(id: string) {
    await executar(() => marcarNotificacaoLida(cliente, id), 'Notificação marcada como lida.');
  }

  return (
    <Layout>
      <div className="lista-topo notificacoes-cabecalho">
        <div><h1>Notificações</h1><p>{naoLidas > 0 ? `${naoLidas} não lida(s)` : 'Tudo em dia'} · Acompanhe avisos e pendências da operação.</p></div>
        {naoLidas > 0 && <button type="button" className="botao" onClick={() => void marcarTodasComoLidas()}>Marcar tudo como lido</button>}
      </div>
      <div className="notificacoes-filtros" role="tablist" aria-label="Filtrar notificações">
        {([['todas', 'Todas', db.notificacoes.length], ['nao_lidas', 'Não lidas', naoLidas], ['gestao', 'Gestão', db.notificacoes.filter((n) => TIPOS_GESTAO_IDS.has(n.tipo)).length], ['equipe', 'Equipe', db.notificacoes.filter((n) => !TIPOS_GESTAO_IDS.has(n.tipo)).length]] as [Filtro, string, number][]).map(([id, nome, quantidade]) => (
          <button type="button" role="tab" aria-selected={filtro === id} className={filtro === id ? 'ativo' : ''} onClick={() => setFiltro(id)} key={id}>{nome}<small>{quantidade}</small></button>
        ))}
      </div>
      <div className="notificacoes-grade">
        <section className={`cartao notificacao-configuracao${dispositivoAberto ? '' : ' recolhida'}`}>
          <div className="cartao-topo"><div><h2>Receber no dispositivo</h2><span className={`selo ${pushStatus === 'ativo' ? 'ok' : 'neutro'}`}>{rotuloPush}</span></div><button type="button" className="conferencias-toggle" onClick={() => setDispositivoAberto((aberto) => !aberto)} aria-expanded={dispositivoAberto} aria-label={dispositivoAberto ? 'Recolher seção' : 'Abrir seção'}>{dispositivoAberto ? 'Ocultar' : 'Mostrar'} <Icone nome="direita" tamanho={14} /></button></div>
          {dispositivoAberto && <div className="notificacao-configuracao-corpo">
            <p className="suave">Receba um alerta no desktop ou celular mesmo com o Mundinho Kids em outra aba. A central abaixo funciona sem essa permissão.</p>
            <button type="button" className="botao primario" onClick={() => void ativarPush()} disabled={pushStatus === 'indisponivel' || pushStatus === 'ativo'}>
              <Icone nome="sino" /> {pushStatus === 'ativo' ? 'Notificações ativadas' : 'Ativar notificações'}
            </button>
            <button type="button" className="botao" onClick={() => { prepararSom(); tocarSomNotificacao(); }}>Testar som</button>
            {pushMensagem && <p className="notificacao-feedback" role="status">{pushMensagem}</p>}
          </div>}
        </section>
        <section className={`cartao notificacao-configuracao${preferenciasAbertas ? '' : ' recolhida'}`}>
          <div className="cartao-topo"><div><h2>Quais avisos receber</h2><span className="suave">Padrão: todos</span></div><button type="button" className="conferencias-toggle" onClick={() => setPreferenciasAbertas((aberta) => !aberta)} aria-expanded={preferenciasAbertas} aria-label={preferenciasAbertas ? 'Recolher seção' : 'Abrir seção'}>{preferenciasAbertas ? 'Ocultar' : 'Mostrar'} <Icone nome="direita" tamanho={14} /></button></div>
          {preferenciasAbertas && <div className="notificacao-configuracao-corpo">
            <div className="preferencias-notificacao">
              {[...TIPOS_EQUIPE, ...(usuario.perfil === 'diretora' || usuario.perfil === 'gerente' ? TIPOS_GESTAO : [])].map(({ tipo, titulo, texto }) => (
                <label key={tipo} className="preferencia-notificacao">
                  <span><strong>{titulo}</strong><small>{texto}</small></span>
                  <input type="checkbox" checked={preferencias[tipo]} onChange={(e) => alterarPreferencia(tipo, e.target.checked)} />
                </label>
              ))}
            </div>
            <button type="button" className="botao primario" onClick={() => void salvar()} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar preferências'}</button>
          </div>}
        </section>
      </div>
      <section className="lista-notificacoes">
        <div className="cartao-topo"><h2>{filtro === 'nao_lidas' ? 'Não lidas' : 'Histórico recente'}</h2><span className="suave">{notificacoesFiltradas.length} aviso(s)</span></div>
        {notificacoesFiltradas.length === 0 && <div className="cartao vazio"><Icone nome="sino" tamanho={28} /><strong>{filtro === 'nao_lidas' ? 'Tudo em dia' : 'Nenhuma notificação encontrada'}</strong><p>{filtro === 'nao_lidas' ? 'Você não tem avisos pendentes.' : 'Os avisos aparecerão aqui quando algo acontecer.'}</p></div>}
        {grupos.map((grupo) => <div className="notificacao-grupo" key={grupo.titulo}>
          <h3>{grupo.titulo}</h3>
          {grupo.itens.map((notificacao) => {
            const evento = notificacao.evento_id ? db.eventos.find((item) => item.id === notificacao.evento_id) : undefined;
            const gestao = TIPOS_GESTAO_IDS.has(notificacao.tipo);
            return <article className={`cartao notificacao-item${notificacao.lida_em ? '' : ' nao-lida'}${gestao ? ' gestao' : ''}`} key={notificacao.id}>
              <span className="notificacao-icone"><Icone nome={gestao ? 'acessos' : 'sino'} /></span>
              <div className="notificacao-conteudo"><strong>{textoNotificacao(notificacao, evento?.titulo ?? '')}</strong><small>{hora(notificacao.agendada_para)} · {gestao ? 'Gestão' : 'Equipe'}</small></div>
              <div className="notificacao-acoes">
                {evento && <Link className="botao" to={`/eventos/${evento.id}`}>Abrir</Link>}
                {!notificacao.lida_em && <button type="button" className="link-botao" onClick={() => void marcarUmaComoLida(notificacao.id)}>Marcar lida</button>}
              </div>
            </article>;
          })}
        </div>)}
      </section>
    </Layout>
  );
}
