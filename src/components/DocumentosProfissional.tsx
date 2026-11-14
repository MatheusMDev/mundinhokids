import { useState } from 'react';
import { Campo, Dialogo, SeletorOpcao } from './Formulario';
import { Icone } from './Icone';
import { useEstado } from '../lib/estado';
import {
  DOCUMENTOS_ARTISTAS_BUCKET, enviarDocumentoProfissional, MAX_DOCUMENTO_ARTISTA_BYTES,
  removerDocumentoProfissional, substituirDocumentoProfissional, TIPOS_DOCUMENTO_ARTISTA,
} from '../lib/acoes';
import type { DocumentoProfissional, Profissional, Usuario } from '../lib/tipos';

function tamanho(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function dataEnvio(data: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data));
}

export function DocumentosProfissional({ profissional, documentos, usuarios, podeGerenciar }: {
  profissional: Profissional;
  documentos: DocumentoProfissional[];
  usuarios: Usuario[];
  podeGerenciar: boolean;
}) {
  const { cliente, executar, avisar } = useEstado();
  const [janela, setJanela] = useState<{ documento?: DocumentoProfissional } | null>(null);
  const [tipo, setTipo] = useState<string>(TIPOS_DOCUMENTO_ARTISTA[0]);
  const [arquivo, setArquivo] = useState<File | null>(null);

  if (!podeGerenciar && !documentos.length) return null;

  const abrirJanela = (documento?: DocumentoProfissional) => {
    setTipo(documento?.tipo ?? TIPOS_DOCUMENTO_ARTISTA[0]);
    setArquivo(null);
    setJanela({ documento });
  };

  const abrirDocumento = async (documento: DocumentoProfissional) => {
    const novaAba = window.open('', '_blank');
    const { data, error } = await cliente.storage.from(DOCUMENTOS_ARTISTAS_BUCKET)
      .createSignedUrl(documento.storage_path, 300);
    if (error || !data?.signedUrl) {
      novaAba?.close();
      avisar('Não foi possível abrir o documento. Tente novamente.');
      return;
    }
    if (novaAba) novaAba.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  };

  return (
    <div className="documentos-artista">
      <div className="documentos-artista-topo">
        <span><Icone nome="arquivo" tamanho={15} /> <strong>Contrato e documentos</strong></span>
        {podeGerenciar && <button type="button" className="botao pequeno" onClick={() => abrirJanela()}><span aria-hidden="true">+</span> Anexar contrato</button>}
      </div>
      {documentos.length ? (
        <ul className="documentos-artista-lista">
          {documentos.map((documento) => (
            <li key={documento.id}>
              <div className="documento-artista-info">
                <strong>{documento.nome}</strong>
                <small>{documento.tipo} · {tamanho(documento.tamanho_bytes)} · enviado em {dataEnvio(documento.enviado_em)} por {usuarios.find((u) => u.id === documento.enviado_por)?.nome ?? 'usuário'}</small>
              </div>
              <div className="documento-artista-acoes">
                <button type="button" className="botao pequeno" onClick={() => void abrirDocumento(documento)}>Abrir</button>
                {podeGerenciar && <button type="button" className="botao pequeno" onClick={() => abrirJanela(documento)}>Substituir</button>}
                {podeGerenciar && <button type="button" className="botao pequeno texto-perigo" onClick={() => {
                  if (window.confirm(`Remover o documento “${documento.nome}”?`)) {
                    void executar(() => removerDocumentoProfissional(cliente, documento), 'Documento removido.');
                  }
                }}>Remover</button>}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="documentos-artista-vazio">Nenhum documento anexado.</p>}

      {janela && (
        <Dialogo
          className="documento-profissional-dialogo"
          titulo={janela.documento ? 'Substituir documento' : 'Anexar documento'}
          textoSalvar={janela.documento ? 'Substituir' : 'Anexar'}
          onFechar={() => setJanela(null)}
          validar={() => !arquivo ? 'Escolha um arquivo.' : null}
          onSalvar={() => executar(
            () => janela.documento
              ? substituirDocumentoProfissional(cliente, janela.documento, tipo, arquivo as File)
              : enviarDocumentoProfissional(cliente, profissional.id, tipo, arquivo as File),
            janela.documento ? 'Documento substituído.' : 'Documento anexado.',
          )}
        >
          <SeletorOpcao rotulo="Tipo de documento" valor={tipo} opcoes={TIPOS_DOCUMENTO_ARTISTA.map((item) => [item, item] as [string, string])} onMudar={setTipo} />
          <Campo rotulo="Arquivo" obrigatorio dica="PDF, JPG, PNG ou WEBP · máximo de 10 MB.">
            {(id) => <input id={id} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(evento) => setArquivo(evento.target.files?.[0] ?? null)} required />}
          </Campo>
          {arquivo && <p className="suave documento-artista-selecao">{arquivo.name} · {tamanho(arquivo.size)}</p>}
        <small className="suave">Somente Direção e Gerência podem anexar, substituir ou remover arquivos. Contratos ficam privados.</small>
          <span className="sr-only">Limite em bytes: {MAX_DOCUMENTO_ARTISTA_BYTES}</span>
        </Dialogo>
      )}
    </div>
  );
}
