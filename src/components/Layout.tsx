import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icone, Logo, type NomeIcone } from './Icone';
import { BotaoMinhaSenha } from './MinhaSenha';
import { NOME_PERFIL, useEstado, type Tela } from '../lib/estado';
import { iniciais } from '../lib/formato';

interface ItemMenu { para: string; texto: string; icone: NomeIcone; tela: Tela }

export const MENU: ItemMenu[] = [
  { para: '/', texto: 'Calendário e painel', icone: 'calendario', tela: 'painel' },
  { para: '/eventos', texto: 'Eventos', icone: 'presente', tela: 'eventos' },
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
  /** Página com barra de ações fixa no celular (esconde as abas) */
  comBarra?: boolean;
}

export function Layout({ children, tituloMobile, comBarra }: Props) {
  const { usuario, aviso, sair, telas, inicio } = useEstado();
  const inicial = iniciais(usuario.nome);
  const abas = [
    ...abasDoPerfil(telas),
    { para: '/mais', texto: 'Mais', icone: 'menu' as NomeIcone },
  ];
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const ativo = (para: string) => (para === '/' ? pathname === '/' : pathname.startsWith(para));

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

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
        {abas.map((aba) => (
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
