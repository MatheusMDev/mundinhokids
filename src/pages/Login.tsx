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
    <div className="tela-simples">
      <form className="cartao login" onSubmit={entrar}>
        <div className="marca" style={{ padding: 0, marginBottom: 18 }}>
          <Logo />
          <span><strong>Mundinho Kids</strong><small>Gestão de eventos</small></span>
        </div>
        <h2>Entrar</h2>
        <label>
          E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Senha
          <input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="submit" className="botao primario" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
