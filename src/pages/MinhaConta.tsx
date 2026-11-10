import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Campo, Linha } from '../components/Formulario';
import { BotaoMinhaSenha } from '../components/MinhaSenha';
import { Icone } from '../components/Icone';
import { PreferenciasNotificacao } from '../components/PreferenciasNotificacao';
import { useEstado } from '../lib/estado';
import { atualizarMeuEmail, atualizarMinhaConta, enviarFotoPerfil, removerFotoPerfil } from '../lib/acoes';
import { iniciais } from '../lib/formato';

const LIMITE_FOTO = 5 * 1024 * 1024;

export function MinhaConta() {
  const { db, usuario, cliente, executar, avisar } = useEstado();
  const conta = db.usuarios.find((item) => item.id === usuario.id);
  const profissional = db.profissionais.find((item) => item.usuario_id === usuario.id && item.ativo);
  const [nome, setNome] = useState(conta?.nome ?? usuario.nome);
  const [telefone, setTelefone] = useState(conta?.telefone ?? profissional?.telefone ?? '');
  const [disponibilidade, setDisponibilidade] = useState(profissional?.disponibilidade ?? '');
  const [email, setEmail] = useState(conta?.email ?? '');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previsao, setPrevisao] = useState<string | null>(null);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [salvandoFoto, setSalvandoFoto] = useState(false);
  const [salvandoEmail, setSalvandoEmail] = useState(false);

  useEffect(() => () => { if (previsao) URL.revokeObjectURL(previsao); }, [previsao]);

  const fotoUrl = (caminho: string | null | undefined) => caminho
    ? cliente.storage.from('avatares').getPublicUrl(caminho).data.publicUrl
    : null;
  const fotoAtual = fotoUrl(conta?.foto_path);
  const fotoExibida = previsao ?? fotoAtual;

  function selecionarFoto(evento: ChangeEvent<HTMLInputElement>) {
    const nova = evento.target.files?.[0];
    evento.target.value = '';
    if (!nova) return;
    if (!nova.type.startsWith('image/')) { avisar('Escolha uma imagem JPG, PNG ou WebP.'); return; }
    if (nova.size > LIMITE_FOTO) { avisar('A foto precisa ter no máximo 5 MB.'); return; }
    if (previsao) URL.revokeObjectURL(previsao);
    setArquivo(nova);
    setPrevisao(URL.createObjectURL(nova));
  }

  function cancelarFoto() {
    if (previsao) URL.revokeObjectURL(previsao);
    setArquivo(null);
    setPrevisao(null);
  }

  async function salvarPerfil(evento: FormEvent) {
    evento.preventDefault();
    if (!nome.trim()) { avisar('Informe seu nome.'); return; }
    setSalvandoPerfil(true);
    const resultado = await executar(
      () => atualizarMinhaConta(cliente, { nome: nome.trim(), telefone: telefone.trim() || null, disponibilidade: disponibilidade.trim() || null }),
      'Dados atualizados.',
    );
    setSalvandoPerfil(false);
    if (resultado !== true) avisar(resultado);
  }

  async function salvarEmail(evento: FormEvent) {
    evento.preventDefault();
    const novo = email.trim().toLowerCase();
    if (!novo || !novo.includes('@')) { avisar('Informe um e-mail válido.'); return; }
    if (novo === conta?.email?.toLowerCase()) { avisar('Este já é o e-mail atual.'); return; }
    setSalvandoEmail(true);
    const resultado = await executar(() => atualizarMeuEmail(cliente, novo), 'Confira o link de confirmação no novo e-mail.');
    setSalvandoEmail(false);
    if (resultado !== true) avisar(resultado);
  }

  async function salvarFoto() {
    if (!arquivo || !conta) return;
    setSalvandoFoto(true);
    const resultado = await executar(() => enviarFotoPerfil(cliente, conta.id, arquivo, conta.foto_path), 'Foto atualizada.');
    setSalvandoFoto(false);
    if (resultado === true) cancelarFoto();
    else avisar(resultado);
  }

  async function apagarFoto() {
    if (!conta?.foto_path) return;
    setSalvandoFoto(true);
    const resultado = await executar(() => removerFotoPerfil(cliente, conta.foto_path as string), 'Foto removida.');
    setSalvandoFoto(false);
    if (resultado !== true) avisar(resultado);
  }

  return (
    <Layout tituloMobile="Minha conta">
      <Link to="/" className="voltar"><Icone nome="esquerda" /> Voltar ao calendário</Link>
      <div className="lista-topo conta-cabecalho">
        <div><h1>Minha conta</h1><p>Atualize seus dados de contato e sua identificação no sistema.</p></div>
      </div>

      <div className="conta-grade">
        <section className="cartao conta-foto">
          <div className="conta-foto-preview">
            {fotoExibida ? <img src={fotoExibida} alt={`Foto de ${nome}`} /> : <span className="avatar laranja">{iniciais(nome)}</span>}
          </div>
          <div>
            <h2>Foto de perfil</h2>
            <p className="suave">Aparece no menu e ajuda a identificar sua conta.</p>
            <div className="acoes-linha">
              <label className="botao primario conta-arquivo">
                {fotoAtual ? 'Trocar foto' : 'Adicionar foto'}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selecionarFoto} />
              </label>
              {fotoAtual && !arquivo && <button type="button" className="botao" onClick={() => void apagarFoto()} disabled={salvandoFoto}>Remover</button>}
            </div>
            {arquivo && <div className="acoes-linha conta-foto-acoes"><button type="button" className="botao primario" onClick={() => void salvarFoto()} disabled={salvandoFoto}>{salvandoFoto ? 'Enviando…' : 'Salvar foto'}</button><button type="button" className="botao" onClick={cancelarFoto} disabled={salvandoFoto}>Cancelar</button></div>}
            <small className="suave">JPG, PNG ou WebP · até 5 MB</small>
          </div>
        </section>

        <form className="cartao" onSubmit={salvarPerfil}>
          <div className="cartao-topo"><h2>Dados pessoais</h2><span className="selo ok">Editável por você</span></div>
          <Linha><Campo rotulo="Nome" obrigatorio>{(id) => <input id={id} value={nome} onChange={(evento) => setNome(evento.target.value)} required />}</Campo></Linha>
          <Linha><Campo rotulo="Telefone" dica="Usado para contato sobre eventos.">{(id) => <input id={id} type="tel" value={telefone} onChange={(evento) => setTelefone(evento.target.value)} />}</Campo></Linha>
          {profissional && <Linha><Campo rotulo="Disponibilidade" dica="Ex.: só fins de semana, manhãs ou regiões atendidas.">{(id) => <input id={id} value={disponibilidade} onChange={(evento) => setDisponibilidade(evento.target.value)} />}</Campo></Linha>}
          <button type="submit" className="botao primario" disabled={salvandoPerfil}>{salvandoPerfil ? 'Salvando…' : 'Salvar dados'}</button>
        </form>

        <form className="cartao" onSubmit={salvarEmail}>
          <div className="cartao-topo"><h2>E-mail de acesso</h2><span className="selo alerta">Confirmação obrigatória</span></div>
          <p className="suave conta-dica">Ao trocar o e-mail, enviaremos um link para o novo endereço. A alteração só vale depois da confirmação.</p>
          <Campo rotulo="Novo e-mail" obrigatorio>{(id) => <input id={id} type="email" autoComplete="email" value={email} onChange={(evento) => setEmail(evento.target.value)} required />}</Campo>
          <button type="submit" className="botao primario" disabled={salvandoEmail}>{salvandoEmail ? 'Enviando…' : 'Trocar e-mail'}</button>
        </form>

        <section className="cartao">
          <div className="cartao-topo"><h2>Senha</h2></div>
          <p className="suave conta-dica">Troque sua senha sempre que quiser. O perfil e as permissões continuam sob controle da gestão.</p>
          <BotaoMinhaSenha className="botao" />
        </section>

      </div>
      <PreferenciasNotificacao />
    </Layout>
  );
}
