// Tela de criar a própria senha: aparece no primeiro acesso (senha provisória
// ou convite) e quando a pessoa chega pelo link de "esqueci minha senha".

import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Logo } from '../components/Icone';
import { trocarMinhaSenha } from '../lib/acoes';
import { traduzirErro } from '../lib/erros';

export function TrocarSenha({ cliente, email, recuperacao, onConcluido, onSair }: {
  cliente: SupabaseClient; email: string; recuperacao: boolean; onConcluido: () => void; onSair: () => void;
}) {
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    if (senha !== repetir) return setErro('As duas senhas estão diferentes.');
    setSalvando(true);
    setErro(null);
    try {
      await trocarMinhaSenha(cliente, senha);
      onConcluido();
    } catch (falha) {
      const texto = traduzirErro(falha);
      setErro(texto.includes('different from the old') ? 'Escolha uma senha diferente da provisória.' : texto);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="tela-login">
      <div className="login-painel">
        <div className="login-painel-brilho" />
        <div className="login-marca-painel"><Logo tamanho={68} /></div>
        <div className="login-boas-vindas">
          <p className="login-kicker">Gestão de eventos</p>
          <h1>Sua senha,<br />só sua.</h1>
          <p>Escolha uma senha que só você saiba. Ninguém da equipe consegue ver a sua senha.</p>
        </div>
        <span className="login-painel-detalhe">Mundinho Kids · Gestão que cuida</span>
      </div>
      <form className="login-formulario" onSubmit={salvar}>
        <div className="login-marca-mobile">
          <Logo tamanho={44} />
          <span><strong>Mundinho Kids</strong><small>Gestão de eventos</small></span>
        </div>
        <div className="login-cabecalho">
          <p className="login-kicker">{recuperacao ? 'Nova senha' : 'Primeiro acesso'}</p>
          <h2>{recuperacao ? 'Criar uma nova senha' : 'Crie a sua senha'}</h2>
          <p>
            {recuperacao
              ? <>Escolha a nova senha de <strong>{email}</strong>.</>
              : <>Antes de começar, troque a senha provisória de <strong>{email}</strong> por uma só sua.</>}
          </p>
        </div>
        <div className="login-campos">
          <label className="campo-login" htmlFor="nova-senha">
            <span>Nova senha</span>
            <span className="senha-wrapper">
              <input
                id="nova-senha" type={mostrar ? 'text' : 'password'} autoComplete="new-password" required minLength={6} autoFocus
                value={senha} onChange={(e) => { setSenha(e.target.value); setErro(null); }} placeholder="Pelo menos 6 caracteres"
              />
              <button type="button" className="senha-toggle" onClick={() => setMostrar((atual) => !atual)} aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}>
                {mostrar ? 'Ocultar' : 'Mostrar'}
              </button>
            </span>
          </label>
          <label className="campo-login" htmlFor="repetir-senha">
            <span>Repita a nova senha</span>
            <input
              id="repetir-senha" type={mostrar ? 'text' : 'password'} autoComplete="new-password" required minLength={6}
              value={repetir} onChange={(e) => { setRepetir(e.target.value); setErro(null); }} placeholder="Digite de novo"
            />
          </label>
        </div>
        {erro && <p className="login-erro" role="alert">{erro}</p>}
        <button type="submit" className="botao primario login-submit" disabled={salvando}>
          {salvando ? <><span className="login-spinner" aria-hidden="true" /> Salvando...</> : 'Salvar e entrar'}
        </button>
        <button type="button" className="link-botao login-link" onClick={onSair} disabled={salvando}>Sair</button>
      </form>
    </main>
  );
}
