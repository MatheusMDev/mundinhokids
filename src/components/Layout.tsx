import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icone, Logo, type NomeIcone } from './Icone';
import { BotaoMinhaSenha } from './MinhaSenha';
import { NOME_PAINEL, nomeDosPapeis, tipoDoPainel, useEstado, type Tela } from '../lib/estado';
import { hora, iniciais } from '../lib/formato';
import type { Notificacao } from '../lib/tipos';
import { prepararSom, tocarSomNotificacao } from '../lib/som';
import { textoNotificacao } from '../lib/notificacoes';

interface ItemMenu { para: string; texto: string; icone: NomeIcone; tela: Tela }

export const MENU: ItemMenu[] = [
  { para: '/', texto: 'Calendário', icone: 'calendario', tela: 'painel' },
  { para: '/eventos', texto: 'Eventos', icone: 'presente', tela: 'eventos' },
  { para: '/notificacoes', texto: 'Notificações', icone: 'sino', tela: 'notificacoes' },
  { para: '/profissionais', texto: 'Profissionais', icone: 'pessoas', tela: 'profissionais' },
  { para: '/personagens', texto: 'Personagens', icone: 'estrela', tela: 'personagens' },
  { para: '/fantasias', texto: 'Fantasias', icone: 'camiseta', tela: 'fantasias' },
  { para: '/veiculos', texto: 'Veículos', icone: 'carro', tela: 'veiculos' },
  { para: '/financeiro', texto: 'Financeiro', icone: 'dinheiro', tela: 'financeiro' },
  { para: '/cadastros', texto: 'Cadastros', icone: 'lista', tela: 'cadastros' },
  { para: '/usuarios', texto: 'Usuários e acessos', icone: 'acessos', tela: 'usuarios' },
  { para: '/configuracoes', texto: 'Configurações', icone: 'engrenagem', tela: 'configuracoes' },
];

/** Abas do celular: as principais do perfil (no máximo 3) e "Mais" com o resto e a conta */
// Notificações ficam no sino do topo; os demais menus podem virar atalhos mobile.
export const ABAS_CANDIDATAS: ItemMenu[] = MENU.filter((item) => item.tela !== 'notificacoes');

export const abasDoPerfil = (telas: ReadonlySet<Tela>, escolhidas?: readonly string[] | null) => {
  const disponiveis = ABAS_CANDIDATAS.filter((aba) => telas.has(aba.tela));
  const selecionadas = (escolhidas ?? [])
    .map((para) => disponiveis.find((aba) => aba.para === para))
    .filter((aba): aba is ItemMenu => !!aba);
  const restantes = disponiveis.filter((aba) => !selecionadas.some((selecionada) => selecionada.para === aba.para));
  return [...selecionadas, ...restantes].slice(0, 3);
};

function MenuNotificacoes({ notificacoes, eventos }: { notificacoes: Notificacao[]; eventos: { id: string; titulo: string }[] }) {
  const [aberto, setAberto] = useState(false);
  const referencia = useRef<HTMLDivElement>(null);
  const naoLidas = notificacoes.filter((notificacao) => !notificacao.lida_em).length;
  const recentes = [...notificacoes]
    .sort((a, b) => new Date(b.agendada_para).getTime() - new Date(a.agendada_para).getTime())
    .slice(0, 5);

  useEffect(() => {
    if (!aberto) return;
    const fecharAoClicarFora = (evento: PointerEvent) => {
      if (!referencia.current?.contains(evento.target as Node)) setAberto(false);
    };
    const fecharComEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false);
    };
    document.addEventListener('pointerdown', fecharAoClicarFora);
    document.addEventListener('keydown', fecharComEscape);
    return () => {
      document.removeEventListener('pointerdown', fecharAoClicarFora);
      document.removeEventListener('keydown', fecharComEscape);
    };
  }, [aberto]);

  return (
    <div className="notificacoes-topo" ref={referencia}>
      <button
        type="button"
        className={`topo-notificacoes${aberto ? ' ativo' : ''}`}
        aria-label={naoLidas > 0 ? `${naoLidas} notificações não lidas` : 'Abrir notificações'}
        aria-expanded={aberto}
        onClick={() => setAberto((atual) => !atual)}
      >
        <Icone nome="sino" tamanho={19} />
        <span className="topo-notificacoes-label">Notificações</span>
        {naoLidas > 0 && <span className="menu-contador">{naoLidas > 99 ? '99+' : naoLidas}</span>}
      </button>

      {aberto && <div className="menu-notificacoes" role="dialog" aria-label="Notificações recentes">
        <div className="menu-notificacoes-topo">
          <div><strong>Notificações</strong><small>{naoLidas > 0 ? `${naoLidas} não lida(s)` : 'Tudo em dia'}</small></div>
          <Icone nome="sino" tamanho={18} />
        </div>
        {recentes.length > 0 ? <div className="menu-notificacoes-lista">
          {recentes.map((notificacao) => (
            <Link
              key={notificacao.id}
              to={notificacao.evento_id ? `/eventos/${notificacao.evento_id}` : '/notificacoes'}
              className={`menu-notificacao${notificacao.lida_em ? '' : ' nao-lida'}`}
              onClick={() => setAberto(false)}
            >
              <span className="menu-notificacao-icone"><Icone nome="sino" tamanho={15} /></span>
              <span className="menu-notificacao-texto">
                <strong>{textoNotificacao(notificacao, eventos.find((evento) => evento.id === notificacao.evento_id)?.titulo ?? '')}</strong>
                <small>{hora(notificacao.agendada_para)}</small>
              </span>
            </Link>
          ))}
        </div> : <div className="menu-notificacoes-vazio"><Icone nome="sino" tamanho={22} /><span>Nenhuma notificação por aqui.</span></div>}
        <Link to="/notificacoes" className="menu-notificacoes-todas" onClick={() => setAberto(false)}>
          Ver todas as notificações <Icone nome="direita" tamanho={14} />
        </Link>
      </div>}
    </div>
  );
}

export function useCelular() {
  // Mantém tablet e notebook estreito na mesma navegação compacta do celular.
  const consulta = '(max-width: 899px)';
  const [celular, setCelular] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const mudou = () => setCelular(mq.matches);
    mq.addEventListener('change', mudou);
    mudou(); // a janela pode ter mudado entre o primeiro desenho e este efeito
    return () => mq.removeEventListener('change', mudou);
  }, []);
  return celular;
}

interface Props {
  children: ReactNode;
  /** Título da barra do celular; sem título mostra a marca */
  tituloMobile?: string;
  /** Página com barra de ações acima da navegação do celular */
  comBarra?: boolean;
}

export function Layout({ children, tituloMobile, comBarra }: Props) {
  const { db, usuario, cliente, aviso, sair, telas, inicio, permissoes, papeis } = useEstado();
  // Operação mantém os nomes do menu; equipe e fantasias veem o nome do próprio painel
  const nomePainel = NOME_PAINEL[tipoDoPainel(permissoes, papeis)];
  const nomeItem = (item: ItemMenu) => (item.tela === 'painel' && nomePainel) || item.texto;
  const idsNotificacoes = useRef<Set<string> | null>(null);
  const [notificacaoToast, setNotificacaoToast] = useState<Notificacao | null>(null);
  const naoLidas = db.notificacoes.filter((notificacao) => !notificacao.lida_em).length;
  const inicial = iniciais(usuario.nome);
  const fotoPath = db.usuarios.find((conta) => conta.id === usuario.id)?.foto_path;
  const fotoUrl = fotoPath ? cliente.storage.from('avatares').getPublicUrl(fotoPath).data.publicUrl : null;
  const avatar = (className: string) => fotoUrl
    ? <span className={`${className} avatar-com-foto`}><img src={fotoUrl} alt="" /></span>
    : <span className={className}>{inicial}</span>;
  const principais = abasDoPerfil(telas, usuario.abasMobile).map((item) => ({ ...item, texto: nomeItem(item) }));
  const abas = [
    ...principais,
    { para: '/mais', texto: 'Mais', icone: 'menu' as NomeIcone },
  ];
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const corresponde = (para: string) => (para === '/' ? pathname === '/' : pathname === para || pathname.startsWith(`${para}/`));
  const itemAtual = MENU.find((item) => corresponde(item.para));
  const ativo = (para: string): boolean => para === '/mais'
    ? corresponde('/mais') || MENU.some((item) => telas.has(item.tela) && corresponde(item.para) && !principais.some((aba) => aba.para === item.para))
    : corresponde(para);

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  useEffect(() => {
    window.addEventListener('pointerdown', prepararSom);
    return () => window.removeEventListener('pointerdown', prepararSom);
  }, []);

  useEffect(() => {
    const atuais = new Set(db.notificacoes.map((notificacao) => notificacao.id));
    const nova = idsNotificacoes.current
      ? db.notificacoes.find((notificacao) => !idsNotificacoes.current?.has(notificacao.id) && !notificacao.lida_em)
      : undefined;
    if (nova) {
      setNotificacaoToast(nova);
      window.setTimeout(() => setNotificacaoToast((atual) => atual?.id === nova.id ? null : atual), 7000);
      tocarSomNotificacao();
    }
    idsNotificacoes.current = atuais;
  }, [db.notificacoes]);

  return (
    <div className={`app${comBarra ? ' com-barra' : ''}`}>
      <aside className="lateral">
        <Link to={inicio} className="marca">
          <Logo />
          <span><strong>Mundinho<br />Kids</strong><small>Gestão de eventos</small></span>
        </Link>
        <nav className="nav" aria-label="Menu principal">
           {MENU.filter((item) => item.tela !== 'notificacoes' && telas.has(item.tela)).map((item) => (
            <NavLink key={item.para} to={item.para} className={() => (ativo(item.para) ? 'ativo' : '')}>
               <Icone nome={item.icone} /> <span>{nomeItem(item)}</span>{item.tela === 'notificacoes' && naoLidas > 0 && <span className="menu-contador">{naoLidas > 99 ? '99+' : naoLidas}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="lateral-rodape">
           <Link to="/minha-conta" className="usuario-cartao">
             {avatar('avatar laranja')}
             <span><strong>{usuario.nome}</strong><small>{nomeDosPapeis(usuario.perfil, papeis)}</small></span>
           </Link>
          <BotaoMinhaSenha className="link-botao" estilo={{ fontSize: 13, marginBottom: 8 }} />
          <button type="button" className="botao" onClick={sair}>Sair</button>
         </div>
       </aside>

       <header className="topo-desktop">
         <div className="topo-desktop-contexto">
           <span>Mundinho Kids</span>
           <strong>{itemAtual ? nomeItem(itemAtual) : 'Gestão de eventos'}</strong>
         </div>
          <MenuNotificacoes notificacoes={db.notificacoes} eventos={db.eventos} />
       </header>

       <header className="topo-mobile">
        {tituloMobile ? (
          <>
             <button type="button" className="voltar-icone" onClick={() => window.history.state?.idx > 0 ? navegar(-1) : navegar(inicio)} aria-label="Voltar" style={{ border: 0, background: 'none' }}>
               <Icone nome="esquerda" tamanho={22} />
             </button>
             <strong style={{ fontFamily: 'var(--fonte)', fontWeight: 600 }}>{tituloMobile}</strong>
              <MenuNotificacoes notificacoes={db.notificacoes} eventos={db.eventos} />
             <Logo tamanho={30} />
           </>
         ) : (
           <>
             <Logo tamanho={32} />
             <strong>Mundinho Kids</strong>
              <MenuNotificacoes notificacoes={db.notificacoes} eventos={db.eventos} />
             <Link to="/minha-conta" className="avatar-link" aria-label="Abrir Minha conta">{avatar('avatar laranja')}</Link>
           </>
        )}
      </header>

      <main className="conteudo">{children}</main>

      <nav className="abas" aria-label="Navegação">
        {abas.map((aba) => (
          <NavLink key={aba.para} to={aba.para} aria-current={ativo(aba.para) ? 'page' : false} className={() => (ativo(aba.para) ? 'ativo' : '')}>
            <Icone nome={aba.icone} tamanho={20} />
             {aba.texto}{aba.para === '/mais' && naoLidas > 0 && <span className="menu-contador">{naoLidas > 99 ? '99+' : naoLidas}</span>}
          </NavLink>
        ))}
      </nav>

      {aviso && <div className="aviso-flutuante" role="status">{aviso}</div>}
      {notificacaoToast && <div className="notificacao-toast" role="status" aria-live="polite">
        <span className="notificacao-icone"><Icone nome="sino" /></span>
        <Link to={notificacaoToast.evento_id ? `/eventos/${notificacaoToast.evento_id}` : '/notificacoes'} onClick={() => setNotificacaoToast(null)}>
          <strong>Nova notificação</strong>
          <span>{textoNotificacao(notificacaoToast, db.eventos.find((evento) => evento.id === notificacaoToast.evento_id)?.titulo ?? '')}</span>
        </Link>
        <button type="button" onClick={() => setNotificacaoToast(null)} aria-label="Fechar notificação">×</button>
      </div>}
    </div>
  );
}
