import { Link } from 'react-router-dom';
import { Logo } from '../components/Icone';

export function TelaErro({ paginaNaoEncontrada = false }: { paginaNaoEncontrada?: boolean }) {
  return (
    <main className="tela-erro">
      <div className="tela-erro-marca">
        <Logo tamanho={42} />
        <span><strong>Mundinho Kids</strong><small>Gestão de eventos</small></span>
      </div>
      <div className="tela-erro-conteudo">
        <section className="tela-erro-mensagem">
          <p className="tela-erro-codigo">Erro <span>/</span> {paginaNaoEncontrada ? '404' : '500'}</p>
          <h1>{paginaNaoEncontrada ? <>Essa página<br />saiu do mapa.</> : <>Ops! Essa tela<br />deu uma pausa.</>}</h1>
          <p className="tela-erro-texto">
            {paginaNaoEncontrada
              ? 'O endereço pode estar incorreto ou a página pode ter mudado de lugar.'
              : 'Algo inesperado aconteceu por aqui. Vamos tentar colocar tudo no lugar?'}
          </p>
          <div className="tela-erro-acoes">
            {!paginaNaoEncontrada && (
              <button type="button" className="botao primario" onClick={() => window.location.reload()}>
                Tentar de novo
              </button>
            )}
            <Link to="/" className={`botao${paginaNaoEncontrada ? ' primario' : ''}`}>
              Voltar para o início
            </Link>
          </div>
        </section>
        <div className="tela-erro-ilustracao">
          <div className="tela-erro-brilho" />
          <img src="/icon-3d-error.png" alt="Ilustração de uma peça quebrada" />
          <span className="tela-erro-legenda">Até os melhores caminhos<br />podem ter um desvio.</span>
        </div>
      </div>
    </main>
  );
}
