// Usuários e acessos: quem tem login, com qual perfil e ligado a qual
// profissional do cadastro. Tudo é feito aqui no site: a operação vê a lista;
// Direção e Gerente criam e editam acessos (nome, e-mail, perfil, senha e
// situação) pela função "usuarios" do Supabase, que guarda a chave de
// administrador fora do navegador. Só a Direção mexe em acessos de Direção.

import { useCallback, useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Campo, Dialogo, Linha, Marcador } from '../components/Formulario';
import { NOME_PERFIL, useEstado } from '../lib/estado';
import { criarAcesso, editarAcesso, listarLogins, type NovoAcesso } from '../lib/acoes';
import { traduzirErro } from '../lib/erros';
import { diaCurto, hora } from '../lib/formato';
import type { FuncaoProfissional, PerfilAcesso, Profissional, SituacaoLogin, Usuario } from '../lib/tipos';

const PERFIS: { valor: PerfilAcesso; texto: string; descricao: string; equipe: boolean }[] = [
  { valor: 'diretora', texto: 'Direção', descricao: 'Vê tudo, inclusive valores; aprova trocas e despesas; cuida de todos os acessos.', equipe: false },
  { valor: 'gerente', texto: 'Gerente geral', descricao: 'Organiza eventos e equipes, vê valores, aprova trocas e cuida dos acessos.', equipe: false },
  { valor: 'supervisora', texto: 'Supervisora', descricao: 'Cadastra, monta escalas e orienta a equipe. Não vê valores.', equipe: false },
  { valor: 'produtor', texto: 'Produção', descricao: 'Vê os próprios eventos, reserva o veículo, lança despesas.', equipe: true },
  { valor: 'artista', texto: 'Artista', descricao: 'Vê os próprios eventos e o valor a receber; pede troca.', equipe: true },
  { valor: 'maquiador', texto: 'Maquiagem', descricao: 'Vê os eventos em que maquia e o valor a receber.', equipe: true },
  { valor: 'fantasias', texto: 'Fantasias', descricao: 'Confere devolução, limpeza e reparo das fantasias.', equipe: true },
];

const perfilEhEquipe = (p: PerfilAcesso) => PERFIS.find((x) => x.valor === p)?.equipe ?? false;
const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/** Perfil sugerido pela primeira função do profissional */
const PERFIL_DA_FUNCAO: Record<FuncaoProfissional, PerfilAcesso> = {
  artista: 'artista', produtor: 'produtor', maquiador: 'maquiador', fantasias: 'fantasias',
};

/** Senha provisória fácil de ditar (sem letras e números que se confundem) */
function gerarSenha() {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789';
  const sorteio = crypto.getRandomValues(new Uint32Array(8));
  return Array.from(sorteio, (n) => letras[n % letras.length]).join('');
}

function textoAcesso(s: SituacaoLogin | undefined): { texto: string; tipo: string } {
  if (!s) return { texto: '—', tipo: 'neutro' };
  if (s.bloqueado) return { texto: 'Bloqueado', tipo: 'neutro' };
  if (s.convite_pendente) return { texto: 'Convite enviado', tipo: 'alerta' };
  if (!s.ultimo_acesso) return { texto: 'Nunca entrou', tipo: 'alerta' };
  if (s.trocar_senha) return { texto: 'Falta trocar a senha', tipo: 'alerta' };
  return { texto: `Entrou ${diaCurto(s.ultimo_acesso)} · ${hora(s.ultimo_acesso)}`, tipo: 'ok' };
}

/** Perfis que quem está logado pode dar: só a Direção dá o perfil de Direção */
function usePerfisPermitidos(atual?: PerfilAcesso) {
  const { usuario } = useEstado();
  return PERFIS.filter((p) => p.valor !== 'diretora' || usuario.perfil === 'diretora' || atual === 'diretora');
}

function CampoSenha({ rotulo, valor, onMudar, dica, obrigatorio }: {
  rotulo: string; valor: string; onMudar: (v: string) => void; dica: string; obrigatorio?: boolean;
}) {
  return (
    <Campo rotulo={rotulo} dica={dica} obrigatorio={obrigatorio}>
      {(id) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <input id={id} value={valor} onChange={(e) => onMudar(e.target.value)} autoComplete="new-password" minLength={6} style={{ flex: 1 }} />
          <button type="button" className="botao" onClick={() => onMudar(gerarSenha())}>Gerar</button>
        </div>
      )}
    </Campo>
  );
}

function CampoProfissional({ valor, onMudar, perfil, loginId }: {
  valor: string; onMudar: (id: string) => void; perfil: PerfilAcesso; loginId?: string;
}) {
  const { db } = useEstado();
  const equipe = perfilEhEquipe(perfil);
  // Profissionais livres (sem login) ou o que já está ligado a este login
  const livres = db.profissionais
    .filter((p) => !p.usuario_id || p.usuario_id === loginId)
    .filter((p) => p.ativo || p.usuario_id === loginId)
    .sort((a, b) => a.nome.localeCompare(b.nome));
  return (
    <Campo
      rotulo={equipe ? 'Profissional do cadastro' : 'Profissional do cadastro (opcional)'} obrigatorio={equipe}
      dica={equipe ? 'É assim que a pessoa vê os próprios eventos. Só aparecem profissionais sem login.' : 'Só aparecem profissionais sem login.'}
    >
      {(id) => (
        <select id={id} value={valor} onChange={(e) => onMudar(e.target.value)}>
          <option value="">Nenhum</option>
          {livres.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.ativo ? '' : ' (inativo)'}</option>)}
        </select>
      )}
    </Campo>
  );
}

// ---------------------------------------------------------------------

interface Inicial { nome?: string; perfil?: PerfilAcesso; profissional?: string }

function FormNovoAcesso({ inicial, onFechar, onCriado }: { inicial: Inicial; onFechar: () => void; onCriado: () => void }) {
  const { db, cliente, executar } = useEstado();
  const perfis = usePerfisPermitidos();
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState(inicial.nome ?? '');
  const [perfil, setPerfil] = useState<PerfilAcesso>(inicial.perfil ?? 'artista');
  const [profissional, setProfissional] = useState(inicial.profissional ?? '');
  const [modo, setModo] = useState<NovoAcesso['modo']>('senha');
  const [senha, setSenha] = useState(gerarSenha);
  const equipe = perfilEhEquipe(perfil);

  function escolherProfissional(id: string) {
    setProfissional(id);
    const p = db.profissionais.find((x) => x.id === id);
    if (p && !nome.trim()) setNome(p.nome);
  }

  return (
    <Dialogo
      titulo="Novo acesso"
      textoSalvar={modo === 'convite' ? 'Enviar convite' : 'Criar acesso'}
      onFechar={onFechar}
      validar={() => (!emailValido(email) ? 'Informe um e-mail válido.'
        : !nome.trim() ? 'Informe o nome.'
        : equipe && !profissional ? 'Ligue este login ao profissional do cadastro: é assim que ele vê os próprios eventos.'
        : modo === 'senha' && senha.trim().length < 6 ? 'A senha provisória precisa ter pelo menos 6 caracteres.'
        : null)}
      onSalvar={async () => {
        const r = await executar(
          () => criarAcesso(cliente, {
            email: email.trim(), nome: nome.trim(), perfil, profissional_id: profissional || null,
            modo, senha: modo === 'senha' ? senha.trim() : undefined,
          }),
          modo === 'convite' ? `Convite enviado para ${email.trim()}.` : `Acesso criado. Passe o e-mail e a senha provisória para ${nome.trim()}.`,
        );
        if (r === true) onCriado();
        return r;
      }}
    >
      <Linha>
        <Campo rotulo="Nome" obrigatorio>{(id) => <input id={id} value={nome} onChange={(e) => setNome(e.target.value)} required />}</Campo>
        <Campo rotulo="E-mail (é o login)" obrigatorio>
          {(id) => <input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Campo>
      </Linha>
      <Campo rotulo="Perfil" dica={PERFIS.find((p) => p.valor === perfil)?.descricao}>
        {(id) => (
          <select id={id} value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilAcesso)}>
            {perfis.map((p) => <option key={p.valor} value={p.valor}>{p.texto}</option>)}
          </select>
        )}
      </Campo>
      <CampoProfissional valor={profissional} onMudar={escolherProfissional} perfil={perfil} />
      <Campo
        rotulo="Como a pessoa vai entrar"
        dica={modo === 'convite'
          ? 'A pessoa recebe um e-mail com o link para criar a senha. Só funciona com o envio de e-mails configurado.'
          : 'Passe o e-mail e a senha para a pessoa. No primeiro acesso, o sistema pede para ela criar a própria senha.'}
      >
        {(id) => (
          <select id={id} value={modo} onChange={(e) => setModo(e.target.value as NovoAcesso['modo'])}>
            <option value="senha">Senha provisória</option>
            <option value="convite">Convite por e-mail</option>
          </select>
        )}
      </Campo>
      {modo === 'senha' && (
        <CampoSenha rotulo="Senha provisória" valor={senha} onMudar={setSenha} obrigatorio dica="Pelo menos 6 caracteres. Anote antes de salvar." />
      )}
    </Dialogo>
  );
}

// ---------------------------------------------------------------------

function FormUsuario({ item, situacao, onFechar, onSalvo }: {
  item: Usuario; situacao?: SituacaoLogin; onFechar: () => void; onSalvo: () => void;
}) {
  const { db, cliente, executar, usuario } = useEstado();
  const perfis = usePerfisPermitidos(item.perfil);
  const ligadoAtual = db.profissionais.find((p) => p.usuario_id === item.id)?.id ?? '';
  const ehVoce = item.id === usuario.id;

  const [nome, setNome] = useState(item.nome);
  const [email, setEmail] = useState(item.email);
  const [perfil, setPerfil] = useState<PerfilAcesso>(item.perfil);
  const [ativo, setAtivo] = useState(item.ativo);
  const [profissional, setProfissional] = useState(ligadoAtual);
  const [novaSenha, setNovaSenha] = useState('');
  const acesso = textoAcesso(situacao);

  return (
    <Dialogo
      titulo={`Acesso de ${item.nome}`}
      onFechar={onFechar}
      validar={() => (!nome.trim() ? 'Informe o nome.'
        : !emailValido(email) ? 'Informe um e-mail válido.'
        : perfilEhEquipe(perfil) && !profissional ? 'Ligue este login ao profissional do cadastro: é assim que ele vê os próprios eventos.'
        : novaSenha && novaSenha.trim().length < 6 ? 'A senha provisória precisa ter pelo menos 6 caracteres.'
        : null)}
      onSalvar={async () => {
        const r = await executar(
          () => editarAcesso(cliente, {
            id: item.id, nome: nome.trim(), email: email.trim(), perfil, ativo,
            profissional_id: profissional || null, senha: novaSenha.trim() || undefined,
          }),
          novaSenha.trim() ? `Acesso atualizado. Passe a nova senha para ${nome.trim()}.` : 'Acesso atualizado.',
        );
        if (r === true) onSalvo();
        return r;
      }}
    >
      {situacao && (
        <p className="suave" style={{ margin: 0 }}>Situação do login: <span className={`selo ${acesso.tipo}`}>{acesso.texto}</span></p>
      )}
      <Linha>
        <Campo rotulo="Nome" obrigatorio>{(id) => <input id={id} value={nome} onChange={(e) => setNome(e.target.value)} required />}</Campo>
        <Campo rotulo="E-mail (é o login)" obrigatorio dica={email.trim() !== item.email ? 'A pessoa passa a entrar com o e-mail novo.' : undefined}>
          {(id) => <input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Campo>
      </Linha>
      <Campo
        rotulo="Perfil"
        dica={ehVoce ? 'Você não pode mudar o próprio perfil (para não perder o acesso à gestão).' : PERFIS.find((p) => p.valor === perfil)?.descricao}
      >
        {(id) => (
          <select id={id} value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilAcesso)} disabled={ehVoce}>
            {perfis.map((p) => <option key={p.valor} value={p.valor}>{p.texto}</option>)}
          </select>
        )}
      </Campo>
      <CampoProfissional valor={profissional} onMudar={setProfissional} perfil={perfil} loginId={item.id} />
      {!ehVoce && (
        <CampoSenha
          rotulo="Nova senha provisória (opcional)" valor={novaSenha} onMudar={setNovaSenha}
          dica="Use quando a pessoa esqueceu a senha. Em branco, a senha atual continua; no próximo acesso ela cria a própria senha."
        />
      )}
      <Marcador
        texto="Acesso ativo"
        dica={ehVoce ? 'Você não pode desativar o próprio acesso.' : 'Com o acesso desativado, a pessoa não consegue mais entrar.'}
        marcado={ativo} onMudar={setAtivo} desativado={ehVoce}
      />
    </Dialogo>
  );
}

// ---------------------------------------------------------------------

export function Usuarios() {
  const { db, cliente, permissoes, usuario } = useEstado();
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [novo, setNovo] = useState<Inicial | null>(null);
  const [logins, setLogins] = useState<SituacaoLogin[] | null>(null);
  const [erroLogins, setErroLogins] = useState<string | null>(null);

  const carregarLogins = useCallback(async () => {
    if (!permissoes.gestao) return;
    try {
      setErroLogins(null);
      setLogins((await listarLogins(cliente)).logins);
    } catch (e) {
      setErroLogins(traduzirErro(e));
    }
  }, [cliente, permissoes.gestao]);

  useEffect(() => { void carregarLogins(); }, [carregarLogins]);

  /** Gerente não altera acessos de Direção */
  const podeEditar = (u: Usuario) => permissoes.gestao && (u.perfil !== 'diretora' || usuario.perfil === 'diretora');
  const situacaoDe = (id: string) => logins?.find((l) => l.id === id);
  const profissionalDe = (id: string) => db.profissionais.find((p) => p.usuario_id === id);
  const lista = [...db.usuarios].sort((a, b) => Number(b.ativo) - Number(a.ativo)
    || PERFIS.findIndex((p) => p.valor === a.perfil) - PERFIS.findIndex((p) => p.valor === b.perfil)
    || a.nome.localeCompare(b.nome));
  const semLogin = db.profissionais.filter((p) => p.ativo && !p.usuario_id).sort((a, b) => a.nome.localeCompare(b.nome));

  const criarPara = (p: Profissional) => setNovo({
    nome: p.nome, profissional: p.id, perfil: p.funcoes[0] ? PERFIL_DA_FUNCAO[p.funcoes[0]] : 'artista',
  });

  return (
    <Layout>
      <div className="lista-topo">
        <div>
          <h1>Usuários e acessos</h1>
          <p>{permissoes.gestao ? 'Quem entra no sistema, com qual perfil. Tudo é criado e alterado aqui.' : 'Só a direção e a gerente alteram os acessos.'}</p>
        </div>
        {permissoes.gestao && (
          <button type="button" className="botao primario" onClick={() => setNovo({})}>+ Novo acesso</button>
        )}
      </div>

      <div className="coluna">
        {erroLogins && (
          <p className="erro" role="alert" style={{ margin: 0 }}>
            Não foi possível ver a situação dos logins: {erroLogins}
          </p>
        )}

        <section className="cartao tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th><th>Login</th><th>Perfil</th><th>Profissional</th>
                {permissoes.gestao && <th>Acesso</th>}
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => {
                const abrir = podeEditar(u) ? () => setEditando(u) : undefined;
                const prof = profissionalDe(u.id);
                const faltaLigar = perfilEhEquipe(u.perfil) && !prof;
                const acesso = textoAcesso(situacaoDe(u.id));
                return (
                  <tr key={u.id} className={`${abrir ? 'clicavel' : ''}${u.ativo ? '' : ' inativo'}`} onClick={abrir}>
                    <td>
                      {abrir
                        ? <button type="button" className="link-botao" onClick={(e) => { e.stopPropagation(); abrir(); }}>{u.nome}</button>
                        : <strong>{u.nome}</strong>}
                      {u.id === usuario.id && <span className="selo marca" style={{ marginLeft: 8 }}>você</span>}
                    </td>
                    <td className="suave">{u.email}</td>
                    <td>{NOME_PERFIL[u.perfil]}</td>
                    <td>{prof?.nome ?? (faltaLigar ? <span className="alerta-texto">Falta ligar</span> : '—')}</td>
                    {permissoes.gestao && <td>{logins ? <span className={`selo ${acesso.tipo}`}>{acesso.texto}</span> : '…'}</td>}
                    <td><span className={`selo ${u.ativo ? 'ok' : 'neutro'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {semLogin.length > 0 && (
          <section className="cartao">
            <h2>Profissionais ativos sem login</h2>
            {permissoes.gestao ? (
              <div className="acoes-linha" style={{ marginTop: 0 }}>
                {semLogin.map((p) => (
                  <button key={p.id} type="button" className="botao" onClick={() => criarPara(p)}>Criar acesso para {p.nome}</button>
                ))}
              </div>
            ) : (
              <p className="suave" style={{ margin: 0 }}>{semLogin.map((p) => p.nome).join(', ')}.</p>
            )}
          </section>
        )}
      </div>

      {novo && (
        <FormNovoAcesso inicial={novo} onFechar={() => setNovo(null)} onCriado={() => void carregarLogins()} />
      )}
      {editando && (
        <FormUsuario
          item={editando} situacao={situacaoDe(editando.id)}
          onFechar={() => setEditando(null)} onSalvo={() => void carregarLogins()}
        />
      )}
    </Layout>
  );
}
