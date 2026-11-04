// Janela de formulário (diálogo nativo: Esc fecha e o foco fica dentro) e campos.

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { diasDoMes, mesSeguinte, type Mes } from './Calendario';
import { Icone } from './Icone';
import { mesAno } from '../lib/formato';

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

export function SeletorMultiplo({ rotulo, opcoes, marcados, onMudar, vazio }: {
  rotulo: string; opcoes: Opcao[]; marcados: string[]; onMudar: (v: string[]) => void; vazio?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLFieldSetElement>(null);
  const selecionados = opcoes.filter((opcao) => marcados.includes(opcao.valor)).map((opcao) => opcao.texto);

  useEffect(() => {
    const fechar = (evento: MouseEvent) => {
      if (!ref.current?.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  return (
    <fieldset ref={ref} className={`campo largo seletor-multiplo${aberto ? ' aberto' : ''}`}>
      <legend>{rotulo}</legend>
      <button type="button" className="seletor-multiplo-botao" aria-haspopup="listbox" aria-expanded={aberto} onClick={() => setAberto((atual) => !atual)} onKeyDown={(evento) => { if (evento.key === 'Escape') setAberto(false); }}>
        <span>{selecionados.length ? selecionados.join(', ') : opcoes.length ? `Selecione ${rotulo.toLowerCase()}` : (vazio ?? 'Nenhuma opção.')}</span>
        <i aria-hidden="true" />
      </button>
      {aberto && opcoes.length > 0 && (
        <div className="seletor-multiplo-menu" role="listbox" aria-label={rotulo}>
          {opcoes.map((opcao) => (
            <label key={opcao.valor} className={opcao.desativada ? 'desativada' : ''}>
              <input
                type="checkbox"
                checked={marcados.includes(opcao.valor)}
                disabled={opcao.desativada}
                onChange={(evento) => onMudar(evento.target.checked ? [...marcados, opcao.valor] : marcados.filter((marcado) => marcado !== opcao.valor))}
              />
              <span>{opcao.texto}{opcao.detalhe && <small> · {opcao.detalhe}</small>}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

export function SeletorOpcao({ rotulo, valor, opcoes, onMudar, disabled }: {
  rotulo: string; valor: string; opcoes: [string, string][]; onMudar: (valor: string) => void; disabled?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selecionado = opcoes.find(([opcao]) => opcao === valor)?.[1] ?? opcoes[0]?.[1];

  useEffect(() => {
    const fechar = (evento: MouseEvent) => { if (!ref.current?.contains(evento.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  return (
    <div ref={ref} className={`seletor-opcao${aberto ? ' aberto' : ''}`}>
      <span className="seletor-opcao-rotulo">{rotulo}</span>
      <button type="button" className="seletor-opcao-botao" aria-haspopup="listbox" aria-expanded={aberto} disabled={disabled} onClick={() => setAberto((atual) => !atual)} onKeyDown={(evento) => { if (evento.key === 'Escape') setAberto(false); }}>
        <span>{selecionado}</span><i aria-hidden="true" />
      </button>
      {aberto && <div className="seletor-opcao-menu" role="listbox" aria-label={rotulo}>
        {opcoes.map(([opcao, texto]) => <button key={opcao} type="button" role="option" aria-selected={opcao === valor} className={opcao === valor ? 'selecionado' : ''} onClick={() => { onMudar(opcao); setAberto(false); }}>{texto}</button>)}
      </div>}
    </div>
  );
}

export function SeletorData({ rotulo, valor, onMudar }: { rotulo: string; valor: string; onMudar: (valor: string) => void }) {
  const hoje = new Date();
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState<Mes>(() => {
    const [ano, numeroMes] = valor ? valor.split('-').map(Number) : [hoje.getFullYear(), hoje.getMonth() + 1];
    return { ano, mes: numeroMes };
  });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fechar = (evento: MouseEvent) => { if (!ref.current?.contains(evento.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);
  const texto = valor ? valor.split('-').reverse().join('/') : 'Escolha uma data';

  return (
    <div ref={ref} className={`seletor-data${aberto ? ' aberto' : ''}`}>
      <span className="seletor-opcao-rotulo">{rotulo}</span>
      <button type="button" className="seletor-opcao-botao" aria-haspopup="dialog" aria-expanded={aberto} onClick={() => setAberto((atual) => !atual)}>
        <Icone nome="calendario" tamanho={16} /><span>{texto}</span><i aria-hidden="true" />
      </button>
      {aberto && <div className="seletor-data-menu" role="dialog" aria-label={rotulo}>
        <div className="seletor-data-topo">
          <button type="button" className="icone-botao" onClick={() => setMes(mesSeguinte(mes, -1))} aria-label="Mês anterior">‹</button>
          <strong>{mesAno(mes.ano, mes.mes)}</strong>
          <button type="button" className="icone-botao" onClick={() => setMes(mesSeguinte(mes, 1))} aria-label="Próximo mês">›</button>
        </div>
        <div className="seletor-data-semana">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dia, indice) => <span key={`${dia}-${indice}`}>{dia}</span>)}</div>
        <div className="seletor-data-grade">
          {diasDoMes(mes).map((dia) => <button key={dia.chave} type="button" className={`${dia.doMes ? '' : 'fora '}${dia.chave === valor ? 'selecionado' : ''}`} onClick={() => { if (dia.doMes) { onMudar(dia.chave); setAberto(false); } }}>{dia.dia}</button>)}
        </div>
        {valor && <button type="button" className="seletor-data-limpar" onClick={() => { onMudar(''); setAberto(false); }}>Limpar data</button>}
      </div>}
    </div>
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
