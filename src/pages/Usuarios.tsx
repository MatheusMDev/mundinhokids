// Usuários e acessos: quem tem login, com qual perfil e ligado a qual
// profissional do cadastro. Tudo é feito aqui no site: a operação vê a lista;
// Direção e Gerente criam, editam e excluem acessos (nome, e-mail, perfil, senha e
// situação) pela função "usuarios" do Supabase, que guarda a chave de
// administrador fora do navegador. Só a Direção mexe em acessos de Direção.

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout, MENU } from '../components/Layout';
import { Icone } from '../components/Icone';
import { Paginacao, paginar } from '../components/Paginacao';
import { SeletorFiltro } from '../components/SeletorFiltro';
import { Campo, Dialogo, Linha, Marcador, SeletorMultiplo } from '../components/Formulario';
import { FUNCOES, mascaraTelefone } from '../components/FormulariosCadastro';
import { NOME_PERFIL, TODAS, telaPermitida, telasPadrao, useEstado, type Tela } from '../lib/estado';
import { criarAcesso, editarAcesso, excluirAcesso, listarLogins, salvarProfissional, type DadosEquipe, type NovoAcesso } from '../lib/acoes';
import { traduzirErro } from '../lib/erros';
import { diaCurto, hora, semAcentos } from '../lib/formato';
import type { FuncaoProfissional, PerfilAcesso, SituacaoLogin, Usuario } from '../lib/tipos';

const PERFIS: { valor: PerfilAcesso; texto: string; descricao: string; equipe: boolean }[] = [
  { valor: 'diretora', texto: 'Direção', descricao: 'Acesso total, inclusive valores e usuários.', equipe: false },
  { valor: 'gerente', texto: 'Gerente geral', descricao: 'Organiza eventos e equipes. Vê valores.', equipe: false },
  { valor: 'supervisora', texto: 'Assistente', descricao: 'Organiza eventos e consulta valores fora do Painel.', equipe: false },
  { valor: 'produtor', texto: 'Produção', descricao: 'Seus eventos, veículos e despesas.', equipe: true },
  { valor: 'artista', texto: 'Artista', descricao: 'Seus eventos e trocas.', equipe: true },
  { valor: 'maquiador', texto: 'Maquiagem', descricao: 'Seus eventos de maquiagem.', equipe: true },
  { valor: 'fantasias', texto: 'Fantasias', descricao: 'Conferência das fantasias.', equipe: true },
];

const perfilEhEquipe = (p: PerfilAcesso) => PERFIS.find((x) => x.valor === p)?.equipe ?? false;
const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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
      dica={equipe
        ? 'Profissional ligado a este acesso.'
        : 'Só profissionais sem acesso.'}
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
// Equipe: o que a pessoa vai ser e o cadastro de profissional, no próprio acesso

type TipoAcesso = 'diretora' | 'gerente' | 'supervisora' | 'equipe';

const TIPOS: { valor: TipoAcesso; texto: string; descricao: string }[] = [
  { valor: 'diretora', texto: 'Direção', descricao: PERFIS[0].descricao },
  { valor: 'gerente', texto: 'Gerente geral', descricao: PERFIS[1].descricao },
  { valor: 'supervisora', texto: 'Assistente', descricao: PERFIS[2].descricao },
  { valor: 'equipe', texto: 'Equipe', descricao: 'Vê só os próprios eventos.' },
];

/** Perfil do login de quem é da equipe: a função principal entre as marcadas */
const ORDEM_FUNCOES: FuncaoProfissional[] = ['produtor', 'artista', 'maquiador', 'fantasias'];
const perfilDaEquipe = (funcoes: readonly string[]): PerfilAcesso =>
  ORDEM_FUNCOES.find((f) => funcoes.includes(f)) ?? 'artista';
const tipoDoPerfil = (perfil: PerfilAcesso): TipoAcesso => (perfilEhEquipe(perfil) ? 'equipe' : perfil as TipoAcesso);

/** Tipos que quem está logado pode dar: só a Direção dá o perfil de Direção */
function useTiposPermitidos(atual?: PerfilAcesso) {
  const { usuario } = useEstado();
  return TIPOS.filter((t) => t.valor !== 'diretora' || usuario.perfil === 'diretora' || atual === 'diretora');
}

function useDadosEquipe(inicial?: { funcoes: string[]; telefone: string | null; personagens: string[]; disponibilidade: string | null }) {
  const [funcoes, setFuncoes] = useState<string[]>(inicial?.funcoes ?? ['artista']);
  const [telefone, setTelefone] = useState(mascaraTelefone(inicial?.telefone ?? ''));
  const [personagens, setPersonagens] = useState<string[]>(inicial?.personagens ?? []);
  const disponibilidade = inicial?.disponibilidade ?? null;
  const dados: DadosEquipe = {
    funcoes: funcoes as FuncaoProfissional[], telefone: telefone.trim() || null,
    personagens: funcoes.includes('artista') ? personagens : [], disponibilidade,
  };
  return { funcoes, setFuncoes, telefone, setTelefone, personagens, setPersonagens, dados };
}

function CamposEquipe({ d }: { d: ReturnType<typeof useDadosEquipe> }) {
  const { db } = useEstado();
  return (
    <>
      <SeletorMultiplo rotulo="O que a pessoa vai ser" opcoes={FUNCOES} marcados={d.funcoes} onMudar={d.setFuncoes} />
      <small className="suave" style={{ marginTop: -8 }}>
        Pode marcar mais de uma.
      </small>
      {d.funcoes.includes('artista') && (
        <SeletorMultiplo
          rotulo="Personagens que pode fazer"
          opcoes={db.personagens.filter((p) => p.ativo || d.personagens.includes(p.id)).map((p) => ({ valor: p.id, texto: p.nome }))}
          marcados={d.personagens} onMudar={d.setPersonagens}
          vazio="Nenhum personagem cadastrado ainda."
        />
      )}
      <Linha>
        <Campo rotulo="Telefone">
          {(id) => <input id={id} type="tel" inputMode="numeric" value={d.telefone} onChange={(e) => d.setTelefone(mascaraTelefone(e.target.value))} placeholder="(11) 90000-0000" />}
        </Campo>
      </Linha>
    </>
  );
}

// ---------------------------------------------------------------------

interface Inicial { nome?: string }

function FormNovoAcesso({ inicial, onFechar, onCriado }: { inicial: Inicial; onFechar: () => void; onCriado: () => void }) {
  const { db, cliente, executar } = useEstado();
  const tipos = useTiposPermitidos();
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState(inicial.nome ?? '');
  const [tipo, setTipo] = useState<TipoAcesso>('equipe');
  const [cadastro, setCadastro] = useState<'novo' | 'existente'>('novo');
  const [profissional, setProfissional] = useState('');
  const [modo, setModo] = useState<NovoAcesso['modo']>('senha');
  const [senha, setSenha] = useState(gerarSenha);
  const equipeNovo = useDadosEquipe();
  const equipe = tipo === 'equipe';
  const livres = db.profissionais.filter((p) => p.ativo && !p.usuario_id).sort((a, b) => a.nome.localeCompare(b.nome));
  const existente = db.profissionais.find((p) => p.id === profissional);
  const perfil: PerfilAcesso = !equipe ? tipo
    : cadastro === 'novo' ? perfilDaEquipe(equipeNovo.funcoes) : perfilDaEquipe(existente?.funcoes ?? []);

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
        : equipe && cadastro === 'novo' && !equipeNovo.funcoes.length ? 'Marque o que a pessoa vai ser.'
        : equipe && cadastro === 'existente' && !profissional ? 'Escolha o profissional já cadastrado.'
        : modo === 'senha' && senha.trim().length < 6 ? 'A senha provisória precisa ter pelo menos 6 caracteres.'
        : null)}
      onSalvar={async () => {
        const r = await executar(
          () => criarAcesso(cliente, {
            email: email.trim(), nome: nome.trim(), perfil,
            profissional_id: equipe && cadastro === 'existente' ? profissional : null,
            profissional_novo: equipe && cadastro === 'novo' ? equipeNovo.dados : undefined,
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
      <Campo rotulo="Perfil" dica={TIPOS.find((t) => t.valor === tipo)?.descricao}>
        {(id) => (
          <select id={id} value={tipo} onChange={(e) => setTipo(e.target.value as TipoAcesso)}>
            {tipos.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
          </select>
        )}
      </Campo>
      {equipe && livres.length > 0 && (
        <Campo rotulo="Cadastro do profissional">
          {(id) => (
            <select id={id} value={cadastro} onChange={(e) => setCadastro(e.target.value as 'novo' | 'existente')}>
              <option value="novo">Cadastrar agora</option>
              <option value="existente">Já está cadastrado em Profissionais</option>
            </select>
          )}
        </Campo>
      )}
      {equipe && cadastro === 'novo' && <CamposEquipe d={equipeNovo} />}
      {equipe && cadastro === 'existente' && (
        <Campo rotulo="Profissional" obrigatorio dica={existente ? `Funções: ${existente.funcoes.map((f) => FUNCOES.find((x) => x.valor === f)?.texto ?? f).join(', ')}.` : 'Só profissionais sem acesso.'}>
          {(id) => (
            <select id={id} value={profissional} onChange={(e) => escolherProfissional(e.target.value)}>
              <option value="">Escolha</option>
              {livres.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          )}
        </Campo>
      )}
      <Campo
        rotulo="Como a pessoa vai entrar"
        dica={modo === 'convite'
          ? 'A pessoa recebe um link por e-mail para criar a senha.'
          : 'No primeiro acesso, a pessoa cria a própria senha.'}
      >
        {(id) => (
          <select id={id} value={modo} onChange={(e) => setModo(e.target.value as NovoAcesso['modo'])}>
            <option value="senha">Senha provisória</option>
            <option value="convite">Convite por e-mail</option>
          </select>
        )}
      </Campo>
      {modo === 'senha' && (
        <CampoSenha rotulo="Senha provisória" valor={senha} onMudar={setSenha} obrigatorio dica="Mínimo de 6 caracteres." />
      )}
    </Dialogo>
  );
}

// ---------------------------------------------------------------------

function FormUsuario({ item, situacao, onFechar, onSalvo, onExcluir }: {
  item: Usuario; situacao?: SituacaoLogin; onFechar: () => void; onSalvo: () => void; onExcluir: () => void;
}) {
  const { db, cliente, executar, usuario } = useEstado();
  const tipos = useTiposPermitidos(item.perfil);
  const ligado = db.profissionais.find((p) => p.usuario_id === item.id);
  const ligadoAtual = ligado?.id ?? '';
  const ehVoce = item.id === usuario.id;
  const personagensAtuais = ligado ? db.profissional_personagens.filter((x) => x.profissional_id === ligado.id).map((x) => x.personagem_id) : [];

  const [nome, setNome] = useState(item.nome);
  const [email, setEmail] = useState(item.email);
  const [tipo, setTipo] = useState<TipoAcesso>(tipoDoPerfil(item.perfil));
  const [ativo, setAtivo] = useState(item.ativo);
  const [profissional, setProfissional] = useState(ligadoAtual);
  const dadosEquipe = useDadosEquipe(ligado ? {
    funcoes: ligado.funcoes, telefone: ligado.telefone, personagens: personagensAtuais, disponibilidade: ligado.disponibilidade,
  } : { funcoes: perfilEhEquipe(item.perfil) ? [item.perfil] : ['artista'], telefone: null, personagens: [], disponibilidade: null });
  const equipe = tipo === 'equipe';
  // Com profissional ligado, o que a pessoa é vem das funções marcadas aqui
  const perfil: PerfilAcesso = !equipe ? tipo
    : profissional === ligadoAtual && ligado ? perfilDaEquipe(dadosEquipe.funcoes)
    : perfilDaEquipe(db.profissionais.find((p) => p.id === profissional)?.funcoes ?? []);
  const [novaSenha, setNovaSenha] = useState('');
  const [aba, setAba] = useState<'dados' | 'telas'>('dados');
  // null = padrão do perfil; um conjunto = telas escolhidas pela gestão
  const [escolhidas, setEscolhidas] = useState<Set<Tela> | null>(item.telas ? new Set(item.telas as Tela[]) : null);
  const acesso = textoAcesso(situacao);

  const funcoes = profissional === ligadoAtual && ligado ? dadosEquipe.funcoes : db.profissionais.find((p) => p.id === profissional)?.funcoes ?? [];
  const padrao = telasPadrao(perfil, equipe ? funcoes : []);
  const marcadas = new Set([...(escolhidas ?? padrao)].filter((t) => telaPermitida(t, perfil)));
  const gestao = perfil === 'diretora' || perfil === 'gerente';

  function alternar(tela: Tela, marcar: boolean) {
    const nova = new Set(marcadas);
    if (marcar) nova.add(tela);
    else nova.delete(tela);
    setEscolhidas(nova);
  }

  return (
    <Dialogo
      titulo={`Acesso de ${item.nome}`}
      onFechar={onFechar}
      validar={() => (!nome.trim() ? 'Informe o nome.'
        : !emailValido(email) ? 'Informe um e-mail válido.'
        : equipe && !profissional ? 'Ligue este login ao profissional do cadastro: é assim que ele vê os próprios eventos.'
        : equipe && ligado && profissional === ligadoAtual && !dadosEquipe.funcoes.length ? 'Marque o que a pessoa vai ser.'
        : novaSenha && novaSenha.trim().length < 6 ? 'A senha provisória precisa ter pelo menos 6 caracteres.'
        : escolhidas && marcadas.size === 0 ? 'Marque pelo menos uma permissão.'
        : null)}
      onSalvar={async () => {
        const r = await executar(
          async () => {
            await editarAcesso(cliente, {
              id: item.id, nome: nome.trim(), email: email.trim(), perfil, ativo,
              profissional_id: equipe ? profissional || null : null, senha: novaSenha.trim() || undefined,
              telas: escolhidas ? TODAS.filter((t) => marcadas.has(t) || (gestao && t === 'usuarios')) : null,
            });
            // Cadastro do profissional ligado: o que a pessoa é, telefone, personagens e disponibilidade
            if (equipe && ligado && profissional === ligadoAtual) {
              const d = dadosEquipe.dados;
              const nota = db.profissionais_notas.find((n) => n.profissional_id === ligado.id)?.observacoes ?? null;
              await salvarProfissional(cliente, ligado.id, {
                nome: nome.trim(), email: email.trim(), telefone: d.telefone, funcoes: d.funcoes,
                disponibilidade: d.disponibilidade, ativo: ligado.ativo,
              }, { atuais: personagensAtuais, novos: d.personagens }, nota);
            }
          },
          novaSenha.trim() ? `Acesso atualizado. Passe a nova senha para ${nome.trim()}.` : 'Acesso atualizado.',
        );
        if (r === true) onSalvo();
        return r;
      }}
    >
      <div className="contadores" role="tablist" aria-label="Partes do acesso" style={{ marginBottom: 0 }}>
        <button type="button" role="tab" aria-selected={aba === 'dados'} className={`contador${aba === 'dados' ? ' ativo' : ''}`} onClick={() => setAba('dados')}>
          Informações
        </button>
        <button type="button" role="tab" aria-selected={aba === 'telas'} className={`contador${aba === 'telas' ? ' ativo' : ''}`} onClick={() => setAba('telas')}>
          Permissões
        </button>
      </div>

      {aba === 'telas' ? (
        <>
          <p className="suave" style={{ margin: 0 }}>Escolha o que {nome.trim() || 'esta pessoa'} pode acessar no sistema.</p>
          {escolhidas && (
            <button type="button" className="link-botao" style={{ alignSelf: 'flex-start' }} onClick={() => setEscolhidas(null)}>
              Voltar ao padrão do perfil
            </button>
          )}
          <div className="acoes-coluna">
            {MENU.map((m) => {
              const obrigatoria = gestao && m.tela === 'usuarios';
              return (
                <Marcador
                  key={m.tela} texto={m.texto}
                  marcado={marcadas.has(m.tela) || obrigatoria}
                  onMudar={(v) => alternar(m.tela, v)}
                  desativado={!telaPermitida(m.tela, perfil) || obrigatoria}
                />
              );
            })}
          </div>
        </>
      ) : (
      <>
      {situacao && (
        <p className="suave" style={{ margin: 0 }}>Situação do login: <span className={`selo ${acesso.tipo}`}>{acesso.texto}</span></p>
      )}
      <Linha>
        <Campo rotulo="Nome" obrigatorio>{(id) => <input id={id} value={nome} onChange={(e) => setNome(e.target.value)} required />}</Campo>
        <Campo rotulo="E-mail (é o login)" obrigatorio dica={email.trim() !== item.email ? 'O login passa a ser o novo e-mail.' : undefined}>
          {(id) => <input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Campo>
      </Linha>
      <Campo
        rotulo="Perfil"
        dica={ehVoce ? 'Você não pode mudar o próprio perfil.' : TIPOS.find((t) => t.valor === tipo)?.descricao}
      >
        {(id) => (
          <select id={id} value={tipo} onChange={(e) => setTipo(e.target.value as TipoAcesso)} disabled={ehVoce}>
            {tipos.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
          </select>
        )}
      </Campo>
      {equipe && ligado && profissional === ligadoAtual
        ? <CamposEquipe d={dadosEquipe} />
        : equipe && <CampoProfissional valor={profissional} onMudar={setProfissional} perfil={perfil} loginId={item.id} />}
      {!ehVoce && (
        <CampoSenha
          rotulo="Nova senha provisória (opcional)" valor={novaSenha} onMudar={setNovaSenha}
          dica="Deixe em branco para manter a senha atual."
        />
      )}
      <Marcador
        texto="Acesso ativo"
        dica={ehVoce ? 'Você não pode desativar o próprio acesso.' : 'Acesso desativado não entra no sistema.'}
        marcado={ativo} onMudar={setAtivo} desativado={ehVoce}
      />
      {!ehVoce && (
        <div style={{ borderTop: '1px solid var(--borda)', paddingTop: 14 }}>
          <button type="button" className="botao perigo" onClick={onExcluir}>Excluir acesso</button>
          <small className="suave" style={{ display: 'block', marginTop: 6 }}>
            Só para acessos sem histórico. Com histórico, desative.
          </small>
        </div>
      )}
      </>
      )}
    </Dialogo>
  );
}

function ConfirmarExclusao({ item, onFechar, onExcluido }: { item: Usuario; onFechar: () => void; onExcluido: () => void }) {
  const { cliente, executar } = useEstado();
  return (
    <Dialogo
      titulo="Excluir acesso"
      textoSalvar="Excluir de vez"
      perigo
      onFechar={onFechar}
      onSalvar={async () => {
        const r = await executar(() => excluirAcesso(cliente, item.id), `Acesso de ${item.nome} excluído.`);
        if (r === true) onExcluido();
        return r;
      }}
    >
      <p style={{ margin: 0 }}>
        Excluir o acesso de <strong>{item.nome}</strong> ({item.email})? O login deixa de existir e isso não pode ser desfeito.
      </p>
      <p className="suave" style={{ margin: 0 }}>
        Se a pessoa for ligada a um profissional, o cadastro dele é desativado e preservado para consulta. Se ela já tiver registros no sistema, a exclusão é
        recusada: nesse caso, desative o acesso.
      </p>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------

const POR_PAGINA = 10;

type FiltroSituacao = '' | 'ativos' | 'inativos' | 'nunca' | 'senha';

/** Situações da lista; as que dependem da situação do login só aparecem para a gestão */
const SITUACOES_FILTRO: { valor: FiltroSituacao; texto: string; precisaLogins?: boolean }[] = [
  { valor: '', texto: 'Todos' },
  { valor: 'ativos', texto: 'Ativos' },
  { valor: 'inativos', texto: 'Inativos' },
  { valor: 'nunca', texto: 'Nunca entraram', precisaLogins: true },
  { valor: 'senha', texto: 'Falta trocar a senha', precisaLogins: true },
];

export function Usuarios() {
  const { db, cliente, permissoes, usuario } = useEstado();
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [excluindo, setExcluindo] = useState<Usuario | null>(null);
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
  const todos = [...db.usuarios].sort((a, b) => Number(b.ativo) - Number(a.ativo)
    || PERFIS.findIndex((p) => p.valor === a.perfil) - PERFIS.findIndex((p) => p.valor === b.perfil)
    || a.nome.localeCompare(b.nome));

  // Filtros no endereço da página: continuam ao voltar e podem ser compartilhados
  const [parametros, setParametros] = useSearchParams();
  const busca = parametros.get('busca') ?? '';
  const perfilFiltro = parametros.get('perfil') ?? '';
  const situacaoFiltro = (parametros.get('situacao') ?? '') as FiltroSituacao;
  const pagina = Number(parametros.get('pagina')) || 1;
  const alterar = (nome: string, valor: string) => {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(nome, valor);
    else novos.delete(nome);
    if (nome !== 'pagina') novos.delete('pagina');
    setParametros(novos, { replace: true });
  };

  const passaSituacao = (u: Usuario, filtro: FiltroSituacao) => {
    const s = situacaoDe(u.id);
    switch (filtro) {
      case 'ativos': return u.ativo;
      case 'inativos': return !u.ativo;
      case 'nunca': return u.ativo && !!s && !s.ultimo_acesso;
      case 'senha': return u.ativo && !!s && s.trocar_senha && !!s.ultimo_acesso;
      default: return true;
    }
  };
  const termo = semAcentos(busca.trim());
  const filtrados = todos.filter((u) => (!termo || semAcentos(`${u.nome} ${u.email} ${profissionalDe(u.id)?.nome ?? ''}`).includes(termo))
    && (!perfilFiltro || u.perfil === perfilFiltro)
    && passaSituacao(u, situacaoFiltro));
  const { itens: lista, atual, totalPaginas } = paginar(filtrados, pagina, POR_PAGINA);

  return (
    <Layout>
      <div className="lista-topo">
        <div>
          <h1>Usuários e acessos</h1>
          <p>{filtrados.length} de {todos.length} acessos{permissoes.gestao ? '' : ' · só a direção e a gerente alteram os acessos'}</p>
        </div>
        {permissoes.gestao && (
          <button type="button" className="botao primario" onClick={() => setNovo({})}><Icone nome="mais" /> Novo acesso</button>
        )}
      </div>

      {erroLogins && (
        <p className="erro" role="alert" style={{ margin: '0 0 14px' }}>
          Não foi possível ver a situação dos logins: {erroLogins}
        </p>
      )}

          <section className="filtros-eventos filtros-acessos" aria-label="Filtros de acessos">
            <label className="busca-eventos">
              <span className="busca-icone" aria-hidden="true">⌕</span>
              <span className="sr-only">Buscar acesso</span>
              <input
                type="search" value={busca} onChange={(e) => alterar('busca', e.target.value)}
                placeholder="Buscar por nome, e-mail ou profissional"
              />
              {busca && <button type="button" className="limpar-busca" onClick={() => alterar('busca', '')} aria-label="Limpar busca">×</button>}
            </label>
            <SeletorFiltro
              label="Perfil" icon="acessos" value={perfilFiltro} onChange={(valor) => alterar('perfil', valor)}
              options={[['', 'Todos os perfis'], ...PERFIS.map((p) => [p.valor, p.texto] as [string, string])]}
            />
            <SeletorFiltro
              label="Situação" icon="lista" value={situacaoFiltro} onChange={(valor) => alterar('situacao', valor)}
              options={SITUACOES_FILTRO.filter((f) => permissoes.gestao || !f.precisaLogins)
                .map((f) => [f.valor, f.valor ? f.texto : 'Todas as situações'] as [string, string])}
            />
          </section>

      {lista.length ? (
        <div className="profissionais-grade">
          {lista.map((u) => {
            const abrir = podeEditar(u) ? () => setEditando(u) : undefined;
            const prof = profissionalDe(u.id);
            const faltaLigar = perfilEhEquipe(u.perfil) && !prof;
            const acesso = textoAcesso(situacaoDe(u.id));
            const funcoes = prof?.funcoes.map((f) => FUNCOES.find((x) => x.valor === f)?.texto ?? f) ?? [];
            return (
              <article
                key={u.id}
                className={`profissional-cartao${u.ativo ? '' : ' inativo'}${abrir ? ' clicavel' : ''}`}
                onClick={abrir}
                onKeyDown={(evento) => { if (evento.key === 'Enter') abrir?.(); }}
                role={abrir ? 'button' : undefined}
                tabIndex={abrir ? 0 : undefined}
              >
                <div className="profissional-cartao-cabecalho">
                  <div className="profissional-identidade">
                    <span className="profissional-avatar"><Icone nome="usuario" tamanho={19} /></span>
                    <div>
                      <div className="profissional-nome-linha">
                        <strong>{u.nome}</strong>
                        {u.id === usuario.id && <span className="usuario-proprio">Você</span>}
                      </div>
                      <span className={`selo ${u.ativo ? 'confirmado' : 'realizado'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </div>
                  {abrir && <Icone nome="lapis" tamanho={16} />}
                </div>
                <div className="profissional-funcoes">
                  <small>Perfil</small>
                  <span>{NOME_PERFIL[u.perfil]}</span>
                  {funcoes.filter((f) => f !== NOME_PERFIL[u.perfil]).map((f) => <span key={f}>{f}</span>)}
                </div>
                <div className="profissional-detalhes">
                  <div><Icone nome="email" tamanho={15} /><span><small>Login</small><strong>{u.email}</strong></span></div>
                  <div>
                    <Icone nome="pessoas" tamanho={15} />
                    <span><small>Profissional</small><strong>{prof?.nome ?? (faltaLigar ? 'Falta ligar ao cadastro' : 'Não se aplica')}</strong></span>
                  </div>
                  {permissoes.gestao && (
                    <div>
                      <Icone nome="relogio" tamanho={15} />
                      <span><small>Acesso</small><strong>{logins ? acesso.texto : '…'}</strong></span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="vazio">
          {todos.length ? 'Nenhum acesso encontrado com esses filtros. ' : 'Nenhum acesso cadastrado ainda.'}
          {todos.length > 0 && (
            <button type="button" className="link-botao" onClick={() => setParametros(new URLSearchParams(), { replace: true })}>Limpar filtros</button>
          )}
        </div>
      )}

      <Paginacao
        pagina={atual} total={totalPaginas} rotulo="Paginação dos acessos"
        onMudar={(p) => { alterar('pagina', p > 1 ? String(p) : ''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />

      {novo && (
        <FormNovoAcesso inicial={novo} onFechar={() => setNovo(null)} onCriado={() => void carregarLogins()} />
      )}
      {editando && (
        <FormUsuario
          item={editando} situacao={situacaoDe(editando.id)}
          onFechar={() => setEditando(null)} onSalvo={() => void carregarLogins()}
          onExcluir={() => { setExcluindo(editando); setEditando(null); }}
        />
      )}
      {excluindo && (
        <ConfirmarExclusao item={excluindo} onFechar={() => setExcluindo(null)} onExcluido={() => void carregarLogins()} />
      )}
    </Layout>
  );
}
