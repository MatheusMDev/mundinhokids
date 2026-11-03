import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icone, Logo, type NomeIcone } from './Icone';
import { BotaoMinhaSenha } from './MinhaSenha';
import { NOME_PERFIL, useEstado } from '../lib/estado';
import { iniciais } from '../lib/formato';

const MENU: { para: string; texto: string; icone: NomeIcone; soOperacao?: boolean }[] = [
  { para: '/', texto: 'Calendário e painel', icone: 'calendario' },
  { para: '/eventos', texto: 'Eventos', icone: 'presente' },
  { para: '/profissionais', texto: 'Profissionais', icone: 'pessoas' },
  { para: '/personagens', texto: 'Personagens', icone: 'estrela' },
  { para: '/fantasias', texto: 'Fantasias', icone: 'camiseta' },
  { para: '/veiculos', texto: 'Veículos', icone: 'carro' },
  { para: '/financeiro', texto: 'Financeiro', icone: 'dinheiro' },
  { para: '/cadastros', texto: 'Cadastros', icone: 'lista' },
  { para: '/usuarios', texto: 'Usuários e acessos', icone: 'chave', soOperacao: true },
  { para: '/configuracoes', texto: 'Configurações', icone: 'engrenagem', soOperacao: true },
];

const ABAS: { para: string; texto: string; icone: NomeIcone }[] = [
  { para: '/', texto: 'Agenda', icone: 'calendario' },
  { para: '/eventos', texto: 'Eventos', icone: 'presente' },
  { para: '/profissionais', texto: 'Equipe', icone: 'usuario' },
  { para: '/mais', texto: 'Mais', icone: 'menu' },
];

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
  /** Página com barra de ações fixa no celular (esconde as abas) */
  comBarra?: boolean;
}

export function Layout({ children, tituloMobile, comBarra }: Props) {
  const { usuario, aviso, sair, permissoes } = useEstado();
  const inicial = iniciais(usuario.nome);
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const ativo = (para: string) => (para === '/' ? pathname === '/' : pathname.startsWith(para));

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className={`app${comBarra ? ' com-barra' : ''}`}>
      <aside className="lateral">
        <Link to="/" className="marca">
          <Logo />
          <span><strong>Mundinho<br />Kids</strong><small>Gestão de eventos</small></span>
        </Link>
        <nav className="nav" aria-label="Menu principal">
          {MENU.filter((item) => !item.soOperacao || permissoes.operacao).map((item) => (
            <NavLink key={item.para} to={item.para} className={() => (ativo(item.para) ? 'ativo' : '')}>
              <Icone nome={item.icone} /> {item.texto}
            </NavLink>
          ))}
        </nav>
        <div className="lateral-rodape">
          <div className="usuario-cartao">
            <span className="avatar laranja">{inicial}</span>
            <span><strong>{usuario.nome}</strong><small>{NOME_PERFIL[usuario.perfil]}</small></span>
          </div>
          <BotaoMinhaSenha className="link-botao" estilo={{ fontSize: 13, marginBottom: 8 }} />
          <button type="button" className="botao" onClick={sair}>Sair</button>
        </div>
      </aside>

      <header className="topo-mobile">
        {tituloMobile ? (
          <>
            <button type="button" className="voltar-icone" onClick={() => navegar(-1)} aria-label="Voltar" style={{ border: 0, background: 'none' }}>
              <Icone nome="esquerda" tamanho={22} />
            </button>
            <strong style={{ fontFamily: 'var(--fonte)', fontWeight: 600 }}>{tituloMobile}</strong>
            <Logo tamanho={30} />
          </>
        ) : (
          <>
            <Logo tamanho={32} />
            <strong>Mundinho Kids</strong>
            <span className="avatar laranja">{inicial}</span>
          </>
        )}
      </header>

      <main className="conteudo">{children}</main>

      <nav className="abas" aria-label="Navegação">
        {ABAS.map((aba) => (
          <NavLink key={aba.para} to={aba.para} className={() => (ativo(aba.para) ? 'ativo' : '')}>
            <Icone nome={aba.icone} tamanho={20} />
            {aba.texto}
          </NavLink>
        ))}
      </nav>

      {aviso && <div className="aviso-flutuante" role="status">{aviso}</div>}
    </div>
  );
}
