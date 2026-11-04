// Paginação das listas (Eventos, Profissionais, Usuários): "Anterior · Página 1 de 3 · Próxima".

export function paginar<T>(itens: T[], pagina: number, porPagina: number) {
  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const atual = Math.min(Math.max(1, pagina), totalPaginas);
  return { itens: itens.slice((atual - 1) * porPagina, atual * porPagina), atual, totalPaginas };
}

export function Paginacao({ pagina, total, onMudar, rotulo = 'Paginação' }: {
  pagina: number; total: number; onMudar: (pagina: number) => void; rotulo?: string;
}) {
  if (total <= 1) return null;
  return (
    <nav className="paginacao-eventos" aria-label={rotulo}>
      <button type="button" className="paginacao-botao" disabled={pagina === 1} onClick={() => onMudar(pagina - 1)}>
        Anterior
      </button>
      <span>Página <strong>{pagina}</strong> de {total}</span>
      <button type="button" className="paginacao-botao" disabled={pagina === total} onClick={() => onMudar(pagina + 1)}>
        Próxima
      </button>
    </nav>
  );
}
