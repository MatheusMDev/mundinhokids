import { useState, type FormEvent } from 'react';
import { Logo } from '../components/Icone';
import { supabase } from '../lib/supabase';

const MENSAGENS: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Este e-mail ainda não foi confirmado.',
};

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setEnviando(true);
    setErro(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error) setErro(MENSAGENS[error.message] ?? error.message);
  }

  return (
    <main className="tela-login">
      <div className="login-painel">
        <div className="login-painel-brilho" />
        <div className="login-marca-painel"><Logo tamanho={68} /></div>
        <div className="login-boas-vindas">
          <p className="login-kicker">Gestão de eventos</p>
          <h1>Seu time,<br />no ritmo certo.</h1>
          <p>Organize a agenda, a equipe e cada detalhe das festas em um só lugar.</p>
        </div>
        <span className="login-painel-detalhe">Mundinho Kids · Gestão que cuida</span>
      </div>
      <form className="login-formulario" onSubmit={entrar}>
        <div className="login-marca-mobile">
          <Logo tamanho={44} />
          <span><strong>Mundinho Kids</strong><small>Gestão de eventos</small></span>
        </div>
        <div className="login-cabecalho">
          <p className="login-kicker">Bem-vinda de volta</p>
          <h2>Entrar na sua conta</h2>
          <p>Use seu e-mail e senha para acessar o painel.</p>
        </div>
        <div className="login-campos">
          <label className="campo-login" htmlFor="login-email">
            <span>E-mail</span>
            <input id="login-email" type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => { setEmail(e.target.value); setErro(null); }} placeholder="voce@mundinhokids.com.br" aria-invalid={!!erro} />
          </label>
          <label className="campo-login" htmlFor="login-senha">
            <span>Senha</span>
            <span className="senha-wrapper">
              <input id="login-senha" type={mostrarSenha ? 'text' : 'password'} autoComplete="current-password" required value={senha} onChange={(e) => { setSenha(e.target.value); setErro(null); }} placeholder="Digite sua senha" aria-invalid={!!erro} aria-describedby={erro ? 'login-erro' : undefined} />
              <button type="button" className="senha-toggle" onClick={() => setMostrarSenha((atual) => !atual)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                {mostrarSenha ? 'Ocultar' : 'Mostrar'}
              </button>
            </span>
          </label>
        </div>
        {erro && <p id="login-erro" className="login-erro" role="alert">{erro}</p>}
        <button type="submit" className="botao primario login-submit" disabled={enviando}>
          {enviando ? <><span className="login-spinner" aria-hidden="true" /> Entrando...</> : 'Entrar no painel'}
        </button>
        <p className="login-rodape">Acesso exclusivo para a equipe Mundinho Kids.</p>
      </form>
    </main>
  );
}
