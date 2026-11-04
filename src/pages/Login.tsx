import { useState, type FormEvent } from 'react';
import { Logo } from '../components/Icone';
import { supabase } from '../lib/supabase';
import { pedirNovaSenha } from '../lib/acoes';

const MENSAGENS: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Este e-mail ainda não foi confirmado.',
  'User is banned': 'Este acesso foi desativado. Fale com a gerente ou a direção.',
};

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [esqueci, setEsqueci] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setEnviando(true);
    setErro(null);
    if (esqueci) {
      try {
        await pedirNovaSenha(supabase, email.trim());
        setEnviado(true);
      } catch (falha) {
        const texto = falha instanceof Error ? falha.message : '';
        setErro(texto.includes('rate limit')
          ? 'Muitos pedidos seguidos. Espere alguns minutos e tente de novo.'
          : 'Não foi possível enviar o e-mail. Peça para a gerente ou a direção definir uma senha provisória.');
      }
      setEnviando(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error) setErro(MENSAGENS[error.message] ?? error.message);
  }

  function trocarModo(paraEsqueci: boolean) {
    setEsqueci(paraEsqueci);
    setErro(null);
    setEnviado(false);
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
          <p className="login-kicker">{esqueci ? 'Recuperar acesso' : 'Bem-vinda de volta'}</p>
          <h2>{esqueci ? 'Esqueci minha senha' : 'Entrar na sua conta'}</h2>
          <p>
            {esqueci
              ? 'Informe o seu e-mail. Se ele tiver acesso, enviamos um link para criar uma nova senha.'
              : 'Use seu e-mail e senha para acessar o painel.'}
          </p>
        </div>
        <div className="login-campos">
          <label className="campo-login" htmlFor="login-email">
            <span>E-mail</span>
            <input id="login-email" type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => { setEmail(e.target.value); setErro(null); }} placeholder="voce@mundinhokids.com.br" aria-invalid={!!erro} />
          </label>
          {!esqueci && (
            <label className="campo-login" htmlFor="login-senha">
              <span>Senha</span>
              <span className="senha-wrapper">
                <input id="login-senha" type={mostrarSenha ? 'text' : 'password'} autoComplete="current-password" required value={senha} onChange={(e) => { setSenha(e.target.value); setErro(null); }} placeholder="Digite sua senha" aria-invalid={!!erro} aria-describedby={erro ? 'login-erro' : undefined} />
                <button type="button" className="senha-toggle" onClick={() => setMostrarSenha((atual) => !atual)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </span>
            </label>
          )}
        </div>
        {erro && <p id="login-erro" className="login-erro" role="alert">{erro}</p>}
        {enviado && <p className="login-aviso" role="status">Pronto. Confira a caixa de entrada (e o spam) de {email.trim()}.</p>}
        <button type="submit" className="botao primario login-submit" disabled={enviando}>
          {esqueci
            ? (enviando ? <><span className="login-spinner" aria-hidden="true" /> Enviando...</> : 'Enviar o link')
            : (enviando ? <><span className="login-spinner" aria-hidden="true" /> Entrando...</> : 'Entrar no painel')}
        </button>
        <button type="button" className="link-botao login-link" onClick={() => trocarModo(!esqueci)}>
          {esqueci ? 'Voltar para o login' : 'Esqueci minha senha'}
        </button>
        <p className="login-rodape">Acesso exclusivo para a equipe Mundinho Kids.</p>
      </form>
    </main>
  );
}
