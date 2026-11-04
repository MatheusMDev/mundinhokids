// Paginação simples para listas longas: "Mostrando 1–15 de 40" e anterior/próxima.

export function paginar<T>(itens: T[], pagina: number, porPagina: number) {
  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const atual = Math.min(Math.max(1, pagina), totalPaginas);
  return { itens: itens.slice((atual - 1) * porPagina, atual * porPagina), atual, totalPaginas };
}

export function Paginacao({ pagina, totalPaginas, total, porPagina, onMudar }: {
  pagina: number; totalPaginas: number; total: number; porPagina: number; onMudar: (pagina: number) => void;
}) {
  if (totalPaginas <= 1) return null;
  const inicio = (pagina - 1) * porPagina + 1;
  const fim = Math.min(pagina * porPagina, total);
  return (
    <nav className="paginacao" aria-label="Páginas">
      <span className="suave">Mostrando {inicio}–{fim} de {total}</span>
      <div className="paginacao-botoes">
        <button type="button" className="botao" onClick={() => onMudar(pagina - 1)} disabled={pagina <= 1}>Anterior</button>
        <span aria-current="page">{pagina} de {totalPaginas}</span>
        <button type="button" className="botao" onClick={() => onMudar(pagina + 1)} disabled={pagina >= totalPaginas}>Próxima</button>
      </div>
    </nav>
  );
}
