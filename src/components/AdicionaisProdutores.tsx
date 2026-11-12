import { useState } from 'react';
import { Campo, Dialogo, SeletorOpcao } from './Formulario';
import { Icone } from './Icone';
import {
  ADICIONAIS_PRODUTORES_BUCKET, cancelarAdicionalProdutor, MAX_ADICIONAL_PRODUTOR_BYTES,
  salvarAdicionalProdutor,
} from '../lib/acoes';
import { useEstado } from '../lib/estado';
import { hojeCampo, lerValor, moeda } from '../lib/formato';
import type { AdicionalProdutor } from '../lib/tipos';

function tamanho(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function dataAdicional(data: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'short' }).format(new Date(`${data}T00:00:00Z`));
}

export function FormAdicionalProdutor({ item, onFechar }: { item?: AdicionalProdutor; onFechar: () => void }) {
  const { db, cliente, executar } = useEstado();
  const produtores = db.profissionais
    .filter((p) => p.funcoes.includes('produtor') && (p.ativo || p.id === item?.produtor_id))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const [produtor, setProdutor] = useState(item?.produtor_id ?? produtores[0]?.id ?? '');
  const [valor, setValor] = useState(item ? String(item.valor).replace('.', ',') : '');
  const [data, setData] = useState(item?.data ?? hojeCampo());
  const [descricao, setDescricao] = useState(item?.descricao ?? '');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const numero = lerValor(valor);

  return (
    <Dialogo
      titulo={item ? 'Alterar adicional do produtor' : 'Registrar adicional do produtor'}
      onFechar={onFechar}
      textoSalvar={item ? 'Salvar' : 'Registrar'}
      validar={() => (!produtor ? 'Escolha o produtor.' : numero === null || numero <= 0 ? 'Informe um valor maior que zero.'
        : !data ? 'Informe a data.' : !descricao.trim() ? 'Descreva o adicional.' : !item && !arquivo ? 'Escolha uma foto ou comprovante.' : null)}
      onSalvar={() => executar(() => salvarAdicionalProdutor(cliente, item?.id, {
        produtor_id: produtor, valor: numero!, data, descricao: descricao.trim(),
      }, arquivo, item?.foto_path), item ? 'Adicional atualizado.' : 'Adicional registrado.')}
    >
      <SeletorOpcao
        rotulo="Produtor *"
        valor={produtor}
        opcoes={produtores.map((p) => [p.id, p.nome] as [string, string])}
        onMudar={setProdutor}
      />
      <div className="linha-campos">
        <Campo rotulo="Valor (R$)" obrigatorio>{(id) => <input id={id} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="45" required />}</Campo>
        <Campo rotulo="Data" obrigatorio>{(id) => <input id={id} type="date" value={data} onChange={(e) => setData(e.target.value)} required />}</Campo>
      </div>
      <Campo rotulo="Descrição" obrigatorio dica="Ex.: compra de glitter, estacionamento ou material extra.">
        {(id) => <textarea id={id} value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} required />}
      </Campo>
      <Campo rotulo={item ? 'Trocar foto ou comprovante' : 'Foto ou comprovante *'} obrigatorio={!item} dica="JPG, PNG ou WEBP · máximo de 10 MB.">
        {(id) => <input id={id} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} required={!item} />}
      </Campo>
      {arquivo && <p className="suave adicional-arquivo-selecao">{arquivo.name} · {tamanho(arquivo.size)}</p>}
      {item && !arquivo && <p className="suave adicional-arquivo-selecao">Comprovante atual: {item.foto_nome} · {tamanho(item.foto_tamanho)}</p>}
      <span className="sr-only">Limite em bytes: {MAX_ADICIONAL_PRODUTOR_BYTES}</span>
    </Dialogo>
  );
}

export function AdicionaisProdutores({ adicionais, mostrarTopo = true }: { adicionais: AdicionalProdutor[]; mostrarTopo?: boolean }) {
  const { db, cliente, executar, permissoes, avisar } = useEstado();
  const [janela, setJanela] = useState<{ item?: AdicionalProdutor } | null>(null);

  const nomeProdutor = (id: string) => db.profissionais.find((p) => p.id === id)?.nome ?? 'Produtor não informado';
  const abrirFoto = async (item: AdicionalProdutor) => {
    const novaAba = window.open('', '_blank');
    const { data, error } = await cliente.storage.from(ADICIONAIS_PRODUTORES_BUCKET).createSignedUrl(item.foto_path, 300);
    if (error || !data?.signedUrl) {
      novaAba?.close();
      avisar('Não foi possível abrir o comprovante. Tente novamente.');
      return;
    }
    if (novaAba) novaAba.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  };

  return (
    <>
      {mostrarTopo && <div className="adicionais-topo">
        <div><h2>Adicionais gerais de produtores</h2><p>Comprovantes de valores fora de eventos, despesas e pagamentos da equipe.</p></div>
        {permissoes.gestao && <button type="button" className="botao primario" onClick={() => setJanela({})}><Icone nome="mais" /> Registrar adicional</button>}
      </div>}
      {adicionais.length ? <div className="financeiro-grade adicionais-grade">
        {adicionais.map((item) => (
          <article className={`financeiro-despesa adicional-produtor${item.cancelado_em ? ' adicional-cancelado' : ''}`} key={item.id}>
            <div className="financeiro-cartao-topo"><span className="financeiro-cartao-icone"><Icone nome="dinheiro" tamanho={19} /></span><span className={`selo ${item.cancelado_em ? 'neutro' : 'ok'}`}>{item.cancelado_em ? 'Cancelado' : 'Ativo'}</span></div>
            <strong className="financeiro-despesa-titulo">{item.descricao}</strong>
            <span className="financeiro-data">{nomeProdutor(item.produtor_id)} · {dataAdicional(item.data)}</span>
            <strong className="financeiro-despesa-valor">{moeda(item.valor)}</strong>
            <div className="financeiro-despesa-rodape">
              <button type="button" className="botao pequeno" onClick={() => void abrirFoto(item)}>Abrir comprovante</button>
              {permissoes.gestao && !item.cancelado_em && <span className="adicional-acoes">
                <button type="button" className="botao pequeno" onClick={() => setJanela({ item })}>Alterar</button>
                <button type="button" className="botao pequeno texto-perigo" onClick={() => {
                  if (window.confirm(`Cancelar o adicional de ${moeda(item.valor)} de ${nomeProdutor(item.produtor_id)}?`)) {
                    void executar(() => cancelarAdicionalProdutor(cliente, item.id), 'Adicional cancelado.');
                  }
                }}>Cancelar</button>
              </span>}
            </div>
          </article>
        ))}
      </div> : <div className="financeiro-vazio"><span className="financeiro-vazio-icone"><Icone nome="dinheiro" tamanho={24} /></span><h3>Nenhum adicional geral registrado</h3><p>Registre um valor extra com a foto do comprovante.</p></div>}
      {janela && <FormAdicionalProdutor item={janela.item} onFechar={() => setJanela(null)} />}
    </>
  );
}
