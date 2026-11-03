// Usuários e acessos: quem tem login, com qual perfil e ligado a qual
// profissional do cadastro. A operação vê a lista; só a gestão altera.
// Criar o login em si exige a chave de administrador do Supabase (fica para o back).

import { useState } from 'react';
import { Layout } from '../components/Layout';
import { Campo, Dialogo, Marcador } from '../components/Formulario';
import { NOME_PERFIL, useEstado } from '../lib/estado';
import { salvarUsuario } from '../lib/acoes';
import type { PerfilAcesso, Usuario } from '../lib/tipos';

const PERFIS: { valor: PerfilAcesso; texto: string; descricao: string; equipe: boolean }[] = [
  { valor: 'diretora', texto: 'Direção', descricao: 'Vê tudo, inclusive valores; aprova trocas e despesas.', equipe: false },
  { valor: 'gerente', texto: 'Gerente geral', descricao: 'Organiza eventos e equipes, vê valores, aprova trocas.', equipe: false },
  { valor: 'supervisora', texto: 'Supervisora', descricao: 'Cadastra, monta escalas e orienta a equipe. Não vê valores.', equipe: false },
  { valor: 'produtor', texto: 'Produção', descricao: 'Vê os próprios eventos, reserva o veículo, lança despesas.', equipe: true },
  { valor: 'artista', texto: 'Artista', descricao: 'Vê os próprios eventos e o valor a receber; pede troca.', equipe: true },
  { valor: 'maquiador', texto: 'Maquiagem', descricao: 'Vê os eventos em que maquia e o valor a receber.', equipe: true },
  { valor: 'fantasias', texto: 'Fantasias', descricao: 'Confere devolução, limpeza e reparo das fantasias.', equipe: true },
];

const perfilEhEquipe = (p: PerfilAcesso) => PERFIS.find((x) => x.valor === p)?.equipe ?? false;

function FormUsuario({ item, onFechar }: { item: Usuario; onFechar: () => void }) {
  const { db, cliente, executar, usuario } = useEstado();
  const ligadoAtual = db.profissionais.find((p) => p.usuario_id === item.id)?.id ?? null;
  const ehVoce = item.id === usuario.id;

  const [nome, setNome] = useState(item.nome);
  const [perfil, setPerfil] = useState<PerfilAcesso>(item.perfil);
  const [ativo, setAtivo] = useState(item.ativo);
  const [profissional, setProfissional] = useState(ligadoAtual ?? '');

  // Profissionais livres (sem login) ou o que já está ligado a este usuário
  const livres = db.profissionais
    .filter((p) => !p.usuario_id || p.usuario_id === item.id)
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const descricao = PERFIS.find((p) => p.valor === perfil)?.descricao;

  return (
    <Dialogo
      titulo={`Acesso de ${item.nome}`}
      onFechar={onFechar}
      validar={() => (!nome.trim() ? 'Informe o nome.'
        : perfilEhEquipe(perfil) && !profissional ? 'Ligue este login ao profissional do cadastro: é assim que ele vê os próprios eventos.'
        : null)}
      onSalvar={() => executar(
        () => salvarUsuario(cliente, item.id, { nome: nome.trim(), perfil, ativo }, {
          atual: ligadoAtual, novo: profissional || null,
        }),
        'Acesso atualizado.',
      )}
    >
      <p className="suave" style={{ margin: 0 }}>Login: <strong>{item.email}</strong></p>
      <Campo rotulo="Nome" obrigatorio>{(id) => <input id={id} value={nome} onChange={(e) => setNome(e.target.value)} required />}</Campo>
      <Campo rotulo="Perfil" dica={ehVoce ? 'Você não pode mudar o próprio perfil (para não perder o acesso à gestão).' : descricao}>
        {(id) => (
          <select id={id} value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilAcesso)} disabled={ehVoce}>
            {PERFIS.map((p) => <option key={p.valor} value={p.valor}>{p.texto}</option>)}
          </select>
        )}
      </Campo>
      <Campo
        rotulo={perfilEhEquipe(perfil) ? 'Profissional do cadastro' : 'Profissional do cadastro (opcional)'}
        obrigatorio={perfilEhEquipe(perfil)}
        dica="Só aparecem profissionais que ainda não têm login."
      >
        {(id) => (
          <select id={id} value={profissional} onChange={(e) => setProfissional(e.target.value)}>
            <option value="">Nenhum</option>
            {livres.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.ativo ? '' : ' (inativo)'}</option>)}
          </select>
        )}
      </Campo>
      <Marcador
        texto="Acesso ativo"
        dica={ehVoce ? 'Você não pode desativar o próprio acesso.' : 'Com o acesso inativo, a pessoa entra mas não vê nada.'}
        marcado={ativo} onMudar={setAtivo} desativado={ehVoce}
      />
    </Dialogo>
  );
}

export function Usuarios() {
  const { db, permissoes, usuario } = useEstado();
  const [editando, setEditando] = useState<Usuario | null>(null);
  const profissionalDe = (id: string) => db.profissionais.find((p) => p.usuario_id === id);
  const lista = [...db.usuarios].sort((a, b) => Number(b.ativo) - Number(a.ativo)
    || PERFIS.findIndex((p) => p.valor === a.perfil) - PERFIS.findIndex((p) => p.valor === b.perfil)
    || a.nome.localeCompare(b.nome));
  const semLogin = db.profissionais.filter((p) => p.ativo && !p.usuario_id);

  return (
    <Layout>
      <div className="lista-topo">
        <div>
          <h1>Usuários e acessos</h1>
          <p>{permissoes.gestao ? 'Quem entra no sistema, com qual perfil.' : 'Só a direção e a gerente alteram os acessos.'}</p>
        </div>
      </div>

      <div className="coluna">
        <section className="cartao tabela-rolagem">
          <table className="tabela">
            <thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Profissional</th><th>Situação</th></tr></thead>
            <tbody>
              {lista.map((u) => {
                const abrir = permissoes.gestao ? () => setEditando(u) : undefined;
                const prof = profissionalDe(u.id);
                const faltaLigar = perfilEhEquipe(u.perfil) && !prof;
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
                    <td><span className={`selo ${u.ativo ? 'ok' : 'neutro'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="cartao">
          <h2>Novo acesso</h2>
          <p className="suave" style={{ margin: '0 0 8px' }}>
            Por enquanto, o login é criado no painel do Supabase (Authentication → Users) e ligado ao perfil pelo
            arquivo <code>supabase/vincular_usuarios.sql</code>. O convite por e-mail direto daqui entra com o back.
          </p>
          {semLogin.length > 0 && (
            <p className="suave" style={{ margin: 0 }}>
              Profissionais ativos ainda sem login: {semLogin.map((p) => p.nome).join(', ')}.
            </p>
          )}
        </section>
      </div>

      {editando && <FormUsuario item={editando} onFechar={() => setEditando(null)} />}
    </Layout>
  );
}
