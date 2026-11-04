// Menu suspenso dos filtros das listas (Eventos, Usuários e acessos...).

import { useEffect, useRef, useState } from 'react';
import { Icone, type NomeIcone } from './Icone';

export function SeletorFiltro({ label, icon, value, options, onChange }: {
  label: string;
  icon: NomeIcone;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selecionado = options.find(([valor]) => valor === value)?.[1] ?? options[0]?.[1];

  useEffect(() => {
    const fechar = (evento: MouseEvent) => {
      if (!ref.current?.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  return (
    <div ref={ref} className={`filtro-select${value ? ' ativo' : ''}${aberto ? ' aberto' : ''}`}>
      <button
        type="button"
        className="filtro-select-botao"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => setAberto((atual) => !atual)}
        onKeyDown={(evento) => { if (evento.key === 'Escape') setAberto(false); }}
      >
        <Icone nome={icon} tamanho={16} />
        <span className="filtro-select-texto"><small>{label}</small><strong>{selecionado}</strong></span>
        <span className="filtro-seta" aria-hidden="true" />
      </button>
      {aberto && (
        <div className="filtro-menu" role="listbox" aria-label={label}>
          {options.map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              role="option"
              aria-selected={valor === value}
              className={valor === value ? 'selecionado' : ''}
              onClick={() => { onChange(valor); setAberto(false); }}
            >
              {rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
