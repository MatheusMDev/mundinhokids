export function SkeletonEventos() {
  return (
    <main className="skeleton-tela" aria-busy="true" aria-label="Carregando eventos">
      <div className="skeleton-cabecalho">
        <div>
          <span className="skeleton-linha skeleton-data" />
          <span className="skeleton-linha skeleton-titulo" />
        </div>
        <span className="skeleton-botao" />
      </div>
      <div className="skeleton-numeros">
        {[1, 2, 3, 4].map((item) => (
          <div className="skeleton-bloco skeleton-numero" key={item}>
            <span className="skeleton-linha skeleton-label" />
            <span className="skeleton-linha skeleton-valor" />
            <span className="skeleton-linha skeleton-legenda" />
          </div>
        ))}
      </div>
      <div className="skeleton-conteudo">
        <div className="skeleton-bloco skeleton-calendario">
          <span className="skeleton-linha skeleton-subtitulo" />
          <div className="skeleton-grade">
            {Array.from({ length: 21 }, (_, item) => <span className="skeleton-dia" key={item} />)}
          </div>
        </div>
        <div className="skeleton-coluna">
          <div className="skeleton-bloco skeleton-lista">
            <span className="skeleton-linha skeleton-subtitulo" />
            {[1, 2, 3].map((item) => <span className="skeleton-evento" key={item} />)}
          </div>
          <div className="skeleton-bloco skeleton-lista skeleton-proximos">
            <span className="skeleton-linha skeleton-subtitulo" />
            {[1, 2].map((item) => <span className="skeleton-evento" key={item} />)}
          </div>
        </div>
      </div>
    </main>
  );
}
