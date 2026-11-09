import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icone, Logo, type NomeIcone } from './Icone';
import { BotaoMinhaSenha } from './MinhaSenha';
import { NOME_PERFIL, useEstado, type Tela } from '../lib/estado';
import { iniciais } from '../lib/formato';
import type { Notificacao } from '../lib/tipos';
import { prepararSom, tocarSomNotificacao } from '../lib/som';

interface ItemMenu { para: string; texto: string; icone: NomeIcone; tela: Tela }

export const MENU: ItemMenu[] = [
  { para: '/', texto: 'Calendário e painel', icone: 'calendario', tela: 'painel' },
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
const ABAS_CANDIDATAS: ItemMenu[] = [
  { para: '/', texto: 'Agenda', icone: 'calendario', tela: 'painel' },
  { para: '/eventos', texto: 'Eventos', icone: 'presente', tela: 'eventos' },
  { para: '/profissionais', texto: 'Equipe', icone: 'usuario', tela: 'profissionais' },
  { para: '/veiculos', texto: 'Veículos', icone: 'carro', tela: 'veiculos' },
  { para: '/fantasias', texto: 'Fantasias', icone: 'camiseta', tela: 'fantasias' },
];

export const abasDoPerfil = (telas: ReadonlySet<Tela>) => ABAS_CANDIDATAS.filter((a) => telas.has(a.tela)).slice(0, 3);

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
  const { db, usuario, cliente, aviso, sair, telas, inicio, permissoes } = useEstado();
  const idsNotificacoes = useRef<Set<string> | null>(null);
  const [notificacaoToast, setNotificacaoToast] = useState<Notificacao | null>(null);
  const naoLidas = db.notificacoes.filter((notificacao) => !notificacao.lida_em).length;
  const inicial = iniciais(usuario.nome);
  const fotoPath = db.usuarios.find((conta) => conta.id === usuario.id)?.foto_path;
  const fotoUrl = fotoPath ? cliente.storage.from('avatares').getPublicUrl(fotoPath).data.publicUrl : null;
  const avatar = (className: string) => fotoUrl
    ? <span className={`${className} avatar-com-foto`}><img src={fotoUrl} alt="" /></span>
    : <span className={className}>{inicial}</span>;
  const principais = abasDoPerfil(telas).map(item => item.tela === 'painel' && !permissoes.operacao ? { ...item, texto: 'Minha agenda' } : item);
  const abas = [
    ...principais,
    { para: '/mais', texto: 'Mais', icone: 'menu' as NomeIcone },
  ];
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const corresponde = (para: string) => (para === '/' ? pathname === '/' : pathname === para || pathname.startsWith(`${para}/`));
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
          {MENU.filter((item) => telas.has(item.tela)).map((item) => (
            <NavLink key={item.para} to={item.para} className={() => (ativo(item.para) ? 'ativo' : '')}>
               <Icone nome={item.icone} /> <span>{item.tela === 'painel' && !permissoes.operacao ? 'Minha agenda' : item.texto}</span>{item.tela === 'notificacoes' && naoLidas > 0 && <span className="menu-contador">{naoLidas > 99 ? '99+' : naoLidas}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="lateral-rodape">
           <Link to="/minha-conta" className="usuario-cartao">
             {avatar('avatar laranja')}
             <span><strong>{usuario.nome}</strong><small>{NOME_PERFIL[usuario.perfil]}</small></span>
           </Link>
          <BotaoMinhaSenha className="link-botao" estilo={{ fontSize: 13, marginBottom: 8 }} />
          <button type="button" className="botao" onClick={sair}>Sair</button>
        </div>
      </aside>

      <header className="topo-mobile">
        {tituloMobile ? (
          <>
            <button type="button" className="voltar-icone" onClick={() => window.history.state?.idx > 0 ? navegar(-1) : navegar(inicio)} aria-label="Voltar" style={{ border: 0, background: 'none' }}>
              <Icone nome="esquerda" tamanho={22} />
            </button>
            <strong style={{ fontFamily: 'var(--fonte)', fontWeight: 600 }}>{tituloMobile}</strong>
            <Logo tamanho={30} />
          </>
        ) : (
          <>
            <Logo tamanho={32} />
            <strong>Mundinho Kids</strong>
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
          <span>{notificacaoToast.mensagem ?? 'Você recebeu um novo aviso.'}</span>
        </Link>
        <button type="button" onClick={() => setNotificacaoToast(null)} aria-label="Fechar notificação">×</button>
      </div>}
    </div>
  );
}
