import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icone } from './Icone';
import { useEstado } from '../lib/estado';
import { salvarInscricaoPush, salvarPreferenciasNotificacao } from '../lib/acoes';
import type { Notificacao } from '../lib/tipos';
import { prepararSom, tocarSomNotificacao } from '../lib/som';

export const TIPOS_EQUIPE: { tipo: Notificacao['tipo']; titulo: string; texto: string }[] = [
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

export const TIPOS_GESTAO_IDS = new Set(TIPOS_GESTAO.map(({ tipo }) => tipo));
const CHAVE_VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function chaveVapid(chave: string) {
  const preenchida = `${chave}${'='.repeat((4 - (chave.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(preenchida);
  return Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
}

export function PreferenciasNotificacao() {
  const { db, usuario, cliente, executar } = useEstado();
  const tipos = [...TIPOS_EQUIPE, ...(usuario.perfil === 'diretora' || usuario.perfil === 'gerente' ? TIPOS_GESTAO : [])];
  const [preferencias, setPreferencias] = useState<Record<Notificacao['tipo'], boolean>>(() =>
    Object.fromEntries(tipos.map(({ tipo }) => [tipo, db.notificacao_preferencias.find((p) => p.tipo === tipo)?.ativa ?? true])) as Record<Notificacao['tipo'], boolean>,
  );
  const [salvando, setSalvando] = useState(false);
  const [pushStatus, setPushStatus] = useState<'inativo' | 'ativo' | 'indisponivel' | 'erro'>('inativo');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    const verificarInscricao = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setPushStatus('indisponivel');
      try {
        const registro = await navigator.serviceWorker.ready;
        if (await registro.pushManager.getSubscription()) setPushStatus('ativo');
      } catch {
        setPushStatus('erro');
      }
    };
    void verificarInscricao();
  }, []);

  const rotuloPush = pushStatus === 'ativo' ? 'Ativado neste dispositivo' : pushStatus === 'indisponivel' ? 'Indisponível neste navegador' : 'Não ativado';

  async function salvar() {
    setSalvando(true);
    const resultado = await executar(() => salvarPreferenciasNotificacao(cliente, usuario.id, tipos.map(({ tipo }) => ({ tipo, ativa: preferencias[tipo] }))), 'Preferências salvas.');
    setSalvando(false);
    if (resultado !== true) setMensagem(resultado);
  }

  async function ativarPush() {
    if (!CHAVE_VAPID) return setMensagem('O Web Push ainda não foi configurado no ambiente.');
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('indisponivel');
      return setMensagem('Este navegador não oferece notificações desktop.');
    }
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') return setMensagem('Permissão não concedida. Você ainda pode consultar a central.');
      const registro = await navigator.serviceWorker.register('/sw.js');
      const inscricao = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveVapid(CHAVE_VAPID) });
      await salvarInscricaoPush(cliente, inscricao.toJSON());
      setPushStatus('ativo');
      setMensagem('Notificações desktop ativadas.');
    } catch (erro) {
      setPushStatus('erro');
      setMensagem(erro instanceof Error ? erro.message : 'Não foi possível ativar as notificações.');
    }
  }

  return (
    <section className="cartao conta-notificacoes" id="notificacoes">
      <div className="cartao-topo">
        <div><h2>Notificações</h2><p className="suave">Escolha como receber avisos e quais eventos merecem sua atenção.</p></div>
        <span className="selo neutro">Preferências pessoais</span>
      </div>
      <div className="conta-notificacoes-dispositivo">
        <div>
          <strong>Receber no dispositivo</strong>
          <small>{rotuloPush}</small>
          <small className="conta-notificacoes-dica">A central de avisos continua funcionando mesmo sem autorização do navegador.</small>
        </div>
        <div className="acoes-linha">
          <button type="button" className="botao primario pequeno" onClick={() => void ativarPush()} disabled={pushStatus === 'indisponivel' || pushStatus === 'ativo'}>
            <Icone nome="sino" /> {pushStatus === 'ativo' ? 'Ativado' : 'Ativar'}
          </button>
          <button type="button" className="botao pequeno" onClick={() => { prepararSom(); tocarSomNotificacao(); }}>Testar som</button>
        </div>
      </div>
      <div className="preferencias-notificacao">
        {tipos.map(({ tipo, titulo, texto }) => (
          <label key={tipo} className="preferencia-notificacao">
            <span><strong>{titulo}</strong><small>{texto}</small></span>
            <input type="checkbox" checked={preferencias[tipo]} onChange={(e) => setPreferencias((atual) => ({ ...atual, [tipo]: e.target.checked }))} />
          </label>
        ))}
      </div>
      <div className="conta-notificacoes-rodape">
        {mensagem && <p className="notificacao-feedback" role="status">{mensagem}</p>}
        <button type="button" className="botao primario" onClick={() => void salvar()} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar preferências'}</button>
      </div>
      <Link className="conta-notificacoes-central" to="/notificacoes">Ir para a central de notificações <Icone nome="direita" tamanho={14} /></Link>
    </section>
  );
}
