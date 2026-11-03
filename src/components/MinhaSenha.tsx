// "Trocar minha senha": qualquer pessoa logada troca a própria senha.

import { useState, type CSSProperties } from 'react';
import { Campo, Dialogo } from './Formulario';
import { useEstado } from '../lib/estado';
import { trocarMinhaSenha } from '../lib/acoes';

function FormMinhaSenha({ onFechar }: { onFechar: () => void }) {
  const { cliente, executar } = useEstado();
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');

  return (
    <Dialogo
      titulo="Trocar minha senha"
      textoSalvar="Salvar senha"
      onFechar={onFechar}
      validar={() => (senha.length < 6 ? 'A senha precisa ter pelo menos 6 caracteres.'
        : senha !== repetir ? 'As duas senhas estão diferentes.' : null)}
      onSalvar={async () => {
        const r = await executar(() => trocarMinhaSenha(cliente, senha), 'Senha trocada.');
        return r === true || !r.includes('different from the old') ? r : 'Escolha uma senha diferente da atual.';
      }}
    >
      <Campo rotulo="Nova senha" obrigatorio>
        {(id) => <input id={id} type="password" autoComplete="new-password" minLength={6} required value={senha} onChange={(e) => setSenha(e.target.value)} />}
      </Campo>
      <Campo rotulo="Repita a nova senha" obrigatorio>
        {(id) => <input id={id} type="password" autoComplete="new-password" minLength={6} required value={repetir} onChange={(e) => setRepetir(e.target.value)} />}
      </Campo>
    </Dialogo>
  );
}

export function BotaoMinhaSenha({ className = 'botao', estilo }: { className?: string; estilo?: CSSProperties }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className={className} style={estilo} onClick={() => setAberto(true)}>Trocar minha senha</button>
      {aberto && <FormMinhaSenha onFechar={() => setAberto(false)} />}
    </>
  );
}
