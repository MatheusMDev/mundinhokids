export function SkeletonFinanceiro() {
  return <main className="skeleton-tela" aria-busy="true" aria-label="Carregando financeiro">
    <div className="skeleton-cabecalho"><div><span className="skeleton-linha skeleton-data" /><span className="skeleton-linha skeleton-titulo" /></div><span className="skeleton-botao" /></div>
    <div className="skeleton-numeros">{[1, 2, 3, 4].map((i) => <div className="skeleton-bloco skeleton-numero" key={i}><span className="skeleton-linha skeleton-label" /><span className="skeleton-linha skeleton-valor" /><span className="skeleton-linha skeleton-legenda" /></div>)}</div>
    <div className="skeleton-financeiro-abas">{[1, 2, 3].map((i) => <span className="skeleton-evento" key={i} />)}</div>
    <div className="financeiro-grade">{[1, 2, 3, 4].map((i) => <div className="skeleton-bloco" key={i}><span className="skeleton-linha skeleton-subtitulo" /><span className="skeleton-linha skeleton-label" /><span className="skeleton-evento" /><span className="skeleton-evento" /></div>)}</div>
  </main>;
}
