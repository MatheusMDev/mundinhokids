// Formulários dos cadastros: profissionais, personagens, fantasias,
// contratantes, locais e veículos. Ninguém é apagado: quem sai fica inativo.

import { useState } from 'react';
import { Campo, Dialogo, Linha, Marcador, SeletorData, SeletorMultiplo, SeletorOpcao } from './Formulario';
import { useEstado } from '../lib/estado';
import {
  salvarContratante, salvarFantasia, salvarLocal, salvarPersonagem, salvarProfissional, salvarVeiculo, vazioParaNulo,
} from '../lib/acoes';
import { deCampos, paraCampos } from '../lib/formato';
import type {
  Contratante, Fantasia, FuncaoProfissional, Local, Personagem, Profissional, SituacaoFantasia, Veiculo,
} from '../lib/tipos';

interface Props<T> {
  item?: T;
  onFechar: () => void;
}

const FUNCOES: { valor: FuncaoProfissional; texto: string }[] = [
  { valor: 'artista', texto: 'Artista' },
  { valor: 'produtor', texto: 'Produção' },
  { valor: 'maquiador', texto: 'Maquiagem' },
  { valor: 'fantasias', texto: 'Responsável pelas fantasias' },
];

function mascaraTelefone(valor: string) {
  const numeros = valor.replace(/\D/g, '').slice(0, 11);
  if (!numeros) return '';
  if (numeros.length <= 2) return `(${numeros}`;
  if (numeros.length <= 6) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  const prefixo = numeros.length === 11 ? numeros.slice(2, 7) : numeros.slice(2, 6);
  const final = numeros.length === 11 ? numeros.slice(7) : numeros.slice(6);
  return `(${numeros.slice(0, 2)}) ${prefixo}-${final}`;
}

export const ROTULO_FANTASIA: Record<SituacaoFantasia, string> = {
  disponivel: 'Disponível', limpeza: 'Em limpeza', manutencao: 'Em manutenção', inativa: 'Inativa',
};

const TIPOS_LOCAL = [
  { valor: 'buffet', texto: 'Buffet' },
  { valor: 'casa', texto: 'Casa ou condomínio' },
  { valor: 'escola', texto: 'Escola' },
  { valor: 'outro', texto: 'Outro' },
];

// ---------------------------------------------------------------------

export function FormProfissional({ item, onFechar }: Props<Profissional>) {
  const { db, cliente, executar } = useEstado();
  const atuais = item ? db.profissional_personagens.filter((x) => x.profissional_id === item.id).map((x) => x.personagem_id) : [];
  const notaAtual = item ? db.profissionais_notas.find((n) => n.profissional_id === item.id)?.observacoes ?? '' : '';

  const [nome, setNome] = useState(item?.nome ?? '');
  const [telefone, setTelefone] = useState(mascaraTelefone(item?.telefone ?? ''));
  const [email, setEmail] = useState(item?.email ?? '');
  const [funcoes, setFuncoes] = useState<string[]>(item?.funcoes ?? ['artista']);
  const [personagens, setPersonagens] = useState<string[]>(atuais);
  const [disponibilidade, setDisponibilidade] = useState(item?.disponibilidade ?? '');
  const [nota, setNota] = useState(notaAtual);
  const [ativo, setAtivo] = useState(item?.ativo ?? true);

  const ehArtista = funcoes.includes('artista');

  return (
    <Dialogo
      titulo={item ? `Editar ${item.nome}` : 'Novo profissional'}
      onFechar={onFechar}
      validar={() => (!nome.trim() ? 'Informe o nome.' : !funcoes.length ? 'Marque pelo menos uma função.' : null)}
      onSalvar={() => executar(
        () => salvarProfissional(cliente, item?.id, {
          nome: nome.trim(), telefone: vazioParaNulo(telefone), email: vazioParaNulo(email),
          funcoes: funcoes as FuncaoProfissional[], disponibilidade: vazioParaNulo(disponibilidade), ativo,
        }, { atuais, novos: personagens }, vazioParaNulo(nota)),
        item ? 'Profissional atualizado.' : 'Profissional cadastrado.',
      )}
    >
      <Campo rotulo="Nome" obrigatorio>{(id) => <input id={id} value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />}</Campo>
      <Linha>
        <Campo rotulo="Telefone">{(id) => <input id={id} type="tel" inputMode="numeric" value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} placeholder="(11) 90000-0000" />}</Campo>
        <Campo rotulo="E-mail">{(id) => <input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Campo>
      </Linha>
      <SeletorMultiplo rotulo="Funções" opcoes={FUNCOES} marcados={funcoes} onMudar={setFuncoes} />
      {ehArtista && (
        <SeletorMultiplo
          rotulo="Personagens que pode fazer"
          opcoes={db.personagens.filter((p) => p.ativo || personagens.includes(p.id)).map((p) => ({ valor: p.id, texto: p.nome }))}
          marcados={personagens} onMudar={setPersonagens}
          vazio="Nenhum personagem cadastrado ainda."
        />
      )}
      <Campo rotulo="Disponibilidade" dica="Ex.: só fins de semana, não trabalha à noite.">
        {(id) => <input id={id} value={disponibilidade} onChange={(e) => setDisponibilidade(e.target.value)} />}
      </Campo>
      <Campo rotulo="Observações internas" dica="Só a direção, a gerente e a supervisora veem.">
        {(id) => <textarea id={id} value={nota} onChange={(e) => setNota(e.target.value)} />}
      </Campo>
      {item && <Marcador texto="Ativo" dica="Profissional inativo não aparece para escalar." marcado={ativo} onMudar={setAtivo} />}
    </Dialogo>
  );
}

// ---------------------------------------------------------------------

export function FormPersonagem({ item, onFechar }: Props<Personagem>) {
  const { cliente, executar } = useEstado();
  const [nome, setNome] = useState(item?.nome ?? '');
  const [descricao, setDescricao] = useState(item?.descricao ?? '');
  const [referencias, setReferencias] = useState(item?.referencias ?? '');
  const [orientacoes, setOrientacoes] = useState(item?.orientacoes ?? '');
  const [ativo, setAtivo] = useState(item?.ativo ?? true);

  return (
    <Dialogo
      titulo={item ? `Editar ${item.nome}` : 'Novo personagem'}
      onFechar={onFechar}
      validar={() => (!nome.trim() ? 'Informe o nome do personagem.' : null)}
      onSalvar={() => executar(
        () => salvarPersonagem(cliente, item?.id, {
          nome: nome.trim(), descricao: vazioParaNulo(descricao), referencias: vazioParaNulo(referencias),
          orientacoes: vazioParaNulo(orientacoes), ativo,
        }),
        item ? 'Personagem atualizado.' : 'Personagem cadastrado.',
      )}
    >
      <Campo rotulo="Nome" obrigatorio>{(id) => <input id={id} value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />}</Campo>
      <Campo rotulo="Descrição">{(id) => <input id={id} value={descricao} onChange={(e) => setDescricao(e.target.value)} />}</Campo>
      <Campo rotulo="Referências visuais" dica="Links de fotos ou vídeos, um por linha. O sistema não guarda arquivos.">
        {(id) => <textarea id={id} value={referencias} onChange={(e) => setReferencias(e.target.value)} />}
      </Campo>
      <Campo rotulo="Orientações para a apresentação">
        {(id) => <textarea id={id} value={orientacoes} onChange={(e) => setOrientacoes(e.target.value)} />}
      </Campo>
      {item && <Marcador texto="Ativo" marcado={ativo} onMudar={setAtivo} />}
    </Dialogo>
  );
}

// ---------------------------------------------------------------------

export function FormFantasia({ item, onFechar }: Props<Fantasia>) {
  const { db, cliente, executar } = useEstado();
  const previsao = item?.previsao_disponivel ? paraCampos(item.previsao_disponivel) : { data: '', hora: '12:00' };

  const [personagem, setPersonagem] = useState(item?.personagem_id ?? '');
  const [identificacao, setIdentificacao] = useState(item?.identificacao ?? '');
  const [tamanho, setTamanho] = useState(item?.tamanho ?? '');
  const [situacao, setSituacao] = useState<SituacaoFantasia>(item?.situacao ?? 'disponivel');
  const [dataVolta, setDataVolta] = useState(previsao.data);
  const [horaVolta, setHoraVolta] = useState(previsao.hora);
  const [observacoes, setObservacoes] = useState(item?.observacoes ?? '');

  const foraDeUso = situacao === 'limpeza' || situacao === 'manutencao';

  return (
    <Dialogo
      titulo={item ? `Editar ${item.identificacao} · ${item.tamanho ?? 'único'}` : 'Nova fantasia'}
      onFechar={onFechar}
      validar={() => (!personagem ? 'Escolha o personagem.' : !identificacao.trim() ? 'Informe a identificação da fantasia.' : null)}
      onSalvar={() => executar(
        () => salvarFantasia(cliente, item?.id, {
          personagem_id: personagem, identificacao: identificacao.trim(), tamanho: vazioParaNulo(tamanho),
          quantidade: item?.quantidade ?? 1, situacao,
          previsao_disponivel: foraDeUso && dataVolta ? deCampos(dataVolta, horaVolta || '12:00') : null,
          observacoes: vazioParaNulo(observacoes),
        }),
        item ? 'Fantasia atualizada.' : 'Fantasia cadastrada.',
      )}
    >
      <SeletorOpcao
        rotulo="Personagem *"
        valor={personagem}
        opcoes={[['', 'Escolha…'], ...db.personagens.filter((p) => p.ativo || p.id === personagem).map((p) => [p.id, p.nome] as [string, string])]}
        onMudar={(valor) => { setPersonagem(valor); if (!identificacao) setIdentificacao(db.personagens.find((p) => p.id === valor)?.nome ?? ''); }}
      />
      <Linha>
        <Campo rotulo="Identificação" obrigatorio dica="Ex.: Princesa do Gelo 1">
          {(id) => <input id={id} value={identificacao} onChange={(e) => setIdentificacao(e.target.value)} required />}
        </Campo>
        <Campo rotulo="Tamanho">{(id) => <input id={id} value={tamanho} onChange={(e) => setTamanho(e.target.value)} placeholder="P, M, G…" />}</Campo>
      </Linha>
      <SeletorOpcao rotulo="Situação" valor={situacao} opcoes={Object.entries(ROTULO_FANTASIA)} onMudar={(valor) => setSituacao(valor as SituacaoFantasia)} />
      {foraDeUso && (
        <Linha>
          <SeletorData rotulo="Previsão de volta" valor={dataVolta} onMudar={setDataVolta} />
          <Campo rotulo="Horário">{(id) => <input id={id} type="time" value={horaVolta} onChange={(e) => setHoraVolta(e.target.value)} />}</Campo>
        </Linha>
      )}
      <Campo rotulo="Observações" dica="Ex.: inclui coroa e luvas.">
        {(id) => <input id={id} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />}
      </Campo>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------

export function FormContratante({ item, onFechar }: Props<Contratante>) {
  const { db, cliente, executar } = useEstado();
  const [nome, setNome] = useState(item?.nome ?? '');
  const [telefone, setTelefone] = useState(item?.telefone ?? '');
  const [email, setEmail] = useState(item?.email ?? '');
  const [nota, setNota] = useState(item ? db.contratantes_notas.find((n) => n.contratante_id === item.id)?.observacoes ?? '' : '');

  return (
    <Dialogo
      titulo={item ? `Editar ${item.nome}` : 'Novo contratante'}
      onFechar={onFechar}
      validar={() => (!nome.trim() ? 'Informe o nome.' : null)}
      onSalvar={() => executar(
        () => salvarContratante(cliente, item?.id, {
          nome: nome.trim(), telefone: vazioParaNulo(telefone), email: vazioParaNulo(email),
        }, vazioParaNulo(nota)),
        item ? 'Contratante atualizado.' : 'Contratante cadastrado.',
      )}
    >
      <Campo rotulo="Nome" obrigatorio dica="Ex.: Mariana Souza (mãe)">
        {(id) => <input id={id} value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />}
      </Campo>
      <Linha>
        <Campo rotulo="Telefone">{(id) => <input id={id} type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />}</Campo>
        <Campo rotulo="E-mail">{(id) => <input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Campo>
      </Linha>
      <Campo rotulo="Observações internas" dica="A equipe dos eventos não vê.">
        {(id) => <textarea id={id} value={nota} onChange={(e) => setNota(e.target.value)} />}
      </Campo>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------

export function FormLocal({ item, onFechar }: Props<Local>) {
  const { cliente, executar } = useEstado();
  const [nome, setNome] = useState(item?.nome ?? '');
  const [tipo, setTipo] = useState(item?.tipo ?? 'buffet');
  const [endereco, setEndereco] = useState(item?.endereco ?? '');
  const [contato, setContato] = useState(item?.contato ?? '');
  const [link, setLink] = useState(item?.link_localizacao ?? '');
  const [acesso, setAcesso] = useState(item?.orientacoes_acesso ?? '');
  const [ativo, setAtivo] = useState(item?.ativo ?? true);

  return (
    <Dialogo
      titulo={item ? `Editar ${item.nome}` : 'Novo local'}
      onFechar={onFechar}
      validar={() => (!nome.trim() ? 'Informe o nome do local.' : null)}
      onSalvar={() => executar(
        () => salvarLocal(cliente, item?.id, {
          nome: nome.trim(), tipo, endereco: vazioParaNulo(endereco), contato: vazioParaNulo(contato),
          link_localizacao: vazioParaNulo(link), orientacoes_acesso: vazioParaNulo(acesso), ativo,
        }),
        item ? 'Local atualizado.' : 'Local cadastrado.',
      )}
    >
      <Linha>
        <Campo rotulo="Nome" obrigatorio>{(id) => <input id={id} value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />}</Campo>
        <Campo rotulo="Tipo">
          {(id) => (
            <select id={id} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_LOCAL.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
            </select>
          )}
        </Campo>
      </Linha>
      <Campo rotulo="Endereço">{(id) => <input id={id} value={endereco} onChange={(e) => setEndereco(e.target.value)} />}</Campo>
      <Linha>
        <Campo rotulo="Contato">{(id) => <input id={id} value={contato} onChange={(e) => setContato(e.target.value)} />}</Campo>
        <Campo rotulo="Link de localização" dica="Link do Google Maps ou Waze.">
          {(id) => <input id={id} type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />}
        </Campo>
      </Linha>
      <Campo rotulo="Orientações de acesso" dica="Vai para o PDF da equipe.">
        {(id) => <textarea id={id} value={acesso} onChange={(e) => setAcesso(e.target.value)} />}
      </Campo>
      {item && <Marcador texto="Ativo" marcado={ativo} onMudar={setAtivo} />}
    </Dialogo>
  );
}

// ---------------------------------------------------------------------

export function FormVeiculo({ item, onFechar }: Props<Veiculo>) {
  const { cliente, executar } = useEstado();
  const [nome, setNome] = useState(item?.nome ?? '');
  const [placa, setPlaca] = useState(item?.placa ?? '');
  const [observacoes, setObservacoes] = useState(item?.observacoes ?? '');
  const [ativo, setAtivo] = useState(item?.ativo ?? true);

  return (
    <Dialogo
      titulo={item ? `Editar ${item.nome}` : 'Novo veículo'}
      onFechar={onFechar}
      validar={() => (!nome.trim() ? 'Informe o nome do veículo.' : null)}
      onSalvar={() => executar(
        () => salvarVeiculo(cliente, item?.id, {
          nome: nome.trim(), placa: vazioParaNulo(placa.toUpperCase()), observacoes: vazioParaNulo(observacoes), ativo,
        }),
        item ? 'Veículo atualizado.' : 'Veículo cadastrado.',
      )}
    >
      <Linha>
        <Campo rotulo="Nome" obrigatorio>{(id) => <input id={id} value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />}</Campo>
        <Campo rotulo="Placa">{(id) => <input id={id} value={placa} onChange={(e) => setPlaca(e.target.value)} />}</Campo>
      </Linha>
      <Campo rotulo="Observações">{(id) => <textarea id={id} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />}</Campo>
      {item && <Marcador texto="Ativo" marcado={ativo} onMudar={setAtivo} />}
    </Dialogo>
  );
}
