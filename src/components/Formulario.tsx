// Janela de formulário (diálogo nativo: Esc fecha e o foco fica dentro) e campos.

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';

interface PropsDialogo {
  titulo: string;
  onFechar: () => void;
  /** Chamado no envio; devolve true se salvou (aí a janela fecha) ou a mensagem de erro */
  onSalvar: () => Promise<true | string>;
  textoSalvar?: string;
  /** Botão de salvar em vermelho, para ações como cancelar evento */
  perigo?: boolean;
  /** Validação antes de enviar; devolve a mensagem de erro ou null */
  validar?: () => string | null;
  children: ReactNode;
}

export function Dialogo({ titulo, onFechar, onSalvar, textoSalvar = 'Salvar', perigo, validar, children }: PropsDialogo) {
  const ref = useRef<HTMLDialogElement>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) {
      dialogo.showModal();
      // O diálogo põe o foco no primeiro botão (fechar); o certo é o primeiro campo
      dialogo.querySelector<HTMLElement>('.dialogo-corpo :is(input, select, textarea):not([disabled])')?.focus();
    }
    return () => dialogo?.close();
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const problema = validar?.() ?? null;
    setErro(problema);
    if (problema) return;
    setSalvando(true);
    const resultado = await onSalvar();
    setSalvando(false);
    if (resultado === true) onFechar();
    else setErro(resultado);
  }

  return (
    <dialog
      ref={ref} className="dialogo" aria-labelledby={idTitulo}
      onCancel={(e) => { e.preventDefault(); if (!salvando) onFechar(); }}
      onClick={(e) => { if (e.target === ref.current && !salvando) onFechar(); }}
    >
      <form onSubmit={enviar} noValidate={false}>
        <header className="dialogo-topo">
          <h2 id={idTitulo}>{titulo}</h2>
          <button type="button" className="icone-botao" onClick={onFechar} aria-label="Fechar" disabled={salvando}>✕</button>
        </header>
        <div className="dialogo-corpo">{children}</div>
        <footer className="dialogo-rodape">
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button type="button" className="botao" onClick={onFechar} disabled={salvando}>Voltar</button>
          <button type="submit" className={`botao ${perigo ? 'perigo' : 'primario'}`} disabled={salvando}>
            {salvando ? 'Salvando…' : textoSalvar}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

interface PropsCampo {
  rotulo: string;
  dica?: string;
  obrigatorio?: boolean;
  children: (id: string) => ReactNode;
  largo?: boolean;
}

/** Rótulo + campo + dica. O filho recebe o id para ligar o rótulo ao campo. */
export function Campo({ rotulo, dica, obrigatorio, children, largo }: PropsCampo) {
  const id = useId();
  return (
    <div className={`campo${largo ? ' largo' : ''}`}>
      <label htmlFor={id}>{rotulo}{obrigatorio && <span className="obrigatorio" aria-hidden="true"> *</span>}</label>
      {children(id)}
      {dica && <small>{dica}</small>}
    </div>
  );
}

export function Linha({ children }: { children: ReactNode }) {
  return <div className="linha-campos">{children}</div>;
}

interface Opcao { valor: string; texto: string; desativada?: boolean; detalhe?: string }

/** Lista de caixas de marcar (várias escolhas) */
export function Marcadores({ rotulo, opcoes, marcados, onMudar, vazio }: {
  rotulo: string; opcoes: Opcao[]; marcados: string[]; onMudar: (v: string[]) => void; vazio?: string;
}) {
  return (
    <fieldset className="campo largo marcadores">
      <legend>{rotulo}</legend>
      {opcoes.length === 0 && <small>{vazio ?? 'Nenhuma opção.'}</small>}
      {opcoes.map((o) => (
        <label key={o.valor} className={o.desativada ? 'desativada' : ''}>
          <input
            type="checkbox" checked={marcados.includes(o.valor)} disabled={o.desativada}
            onChange={(e) => onMudar(e.target.checked ? [...marcados, o.valor] : marcados.filter((m) => m !== o.valor))}
          />
          <span>{o.texto}{o.detalhe && <small> · {o.detalhe}</small>}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Uma caixa de marcar com texto ao lado */
export function Marcador({ texto, marcado, onMudar, dica, desativado }: {
  texto: string; marcado: boolean; onMudar: (v: boolean) => void; dica?: string; desativado?: boolean;
}) {
  return (
    <label className={`marcador${desativado ? ' desativada' : ''}`}>
      <input type="checkbox" checked={marcado} onChange={(e) => onMudar(e.target.checked)} disabled={desativado} />
      <span>{texto}{dica && <small>{dica}</small>}</span>
    </label>
  );
}
