// Chrome CDP em localhost:9223 e Vite preview em localhost:5174.
// Dados e sessão fictícios: não acessa nem altera o Supabase.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
await fs.mkdir(new URL('../../.mobile-check/',import.meta.url),{recursive:true});
let script = (await fs.readFile(new URL('./agenda-base.mjs',import.meta.url),'utf8')).replaceAll('5173','5174');
script=script.replace('  const enc = obj =>',String.raw`
  user.nome=profile==='artista'?'Júlia Martins':'Bruno Alves';
  db.profissionais[0].nome=user.nome;
  db.eventos[0].titulo='Festa da Laura';
  db.evento_escala[0].funcao=profile==='produtor'?'produtor':'artista';
  const ontem = new Date(start);ontem.setDate(ontem.getDate()-3);
  const ontemFim=new Date(ontem);ontemFim.setHours(18);
  db.eventos.push({...db.eventos[0],id:'passado',titulo:'Festa já realizada',inicio:ontem.toISOString(),fim:ontemFim.toISOString(),situacao:'realizado'});
  db.evento_escala.push({...db.evento_escala[0],id:'esc2',evento_id:'passado'});
  db.pagamentos_profissionais.push({id:'pago',evento_id:'passado',profissional_id:'p1',valor_combinado:200,situacao:'pago',pago_em:'2026-11-08'});
  db.profissionais.push({...db.profissionais[0],id:'alheio',usuario_id:null,nome:'Outro profissional'});
  db.eventos.push({...db.eventos[0],id:'alheio',titulo:'Evento secreto de outra pessoa'});
  db.evento_escala.push({...db.evento_escala[0],id:'esc3',evento_id:'alheio',profissional_id:'alheio'});
  db.pagamentos_profissionais.push({id:'alheio',evento_id:'alheio',profissional_id:'alheio',valor_combinado:99999,situacao:'pendente'});
  window.__agendaDb=db;
  const enc = obj =>`);
script=script.replace("const results = process.env.FUNCTIONAL_ONLY ? JSON.parse(await fs.readFile(new URL('resultado-parcial.json', out), 'utf8')).results.slice(0, 65) : [];",'const results = [];');
script+=String.raw`
const provas=[];
function passou(nome,perfil,width){provas.push({nome,perfil,width});console.log('ok '+perfil+' '+width+' '+nome);}
async function confereTela(){assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));assert(!(await evaluate('document.body.innerText.includes("Evento secreto") || document.body.innerText.includes("99.999")')));}
try {
for(const width of [320,375,768,1280]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:812,screenWidth:width,screenHeight:812,deviceScaleFactor:1,mobile:width<900});
 for(const perfil of ['artista','produtor']){
  await go('/',perfil);await until('document.querySelector("h1")?.textContent==="Minha agenda"');
  await confereTela();
  assert(await evaluate('document.body.innerText.includes("R$ 150") && document.body.innerText.includes("R$ 200")'));
  assert(await evaluate('document.body.innerText.includes("Festa da Laura") && !document.body.innerText.includes("Festa já realizada")'));
  assert(await evaluate('document.body.innerText.includes('+JSON.stringify(perfil==='artista'?'Artista · Princesa de teste':'Produção')+')'));
  if(width<900){const tela=await inspect(perfil+'-'+width);assert(tela.tabsVisible);assert(tela.tabs.some(t=>t.href==='/'&&t.active&&t.text.includes('Minha agenda')));}
  await screenshot('agenda29-'+perfil+'-'+width);
  passou('próximos, função, total próprio e navegação',perfil,width);
  await tap('.minha-agenda-abas a','Histórico1');
  assert(await evaluate('document.body.innerText.includes("Festa já realizada") && !document.body.innerText.includes("Festa da Laura")'));
  await confereTela();passou('histórico',perfil,width);
  await tap('.minha-agenda-abas a','Valores2');
  assert(await evaluate('document.body.innerText.includes("Festa já realizada") && document.body.innerText.includes("Festa da Laura") && document.body.innerText.includes("Recebido em")'));
  await confereTela();
  await tap('.minha-agenda-evento a','Festa da Laura');await until('location.pathname==="/eventos/e1"');
  await tap(width<900?'a.botao':'a.voltar',width<900?'Voltar':'Voltar à minha agenda');await until('location.pathname==="/" && new URLSearchParams(location.search).get("aba")==="valores"');
  passou('valores por evento e retorno ao mesmo filtro',perfil,width);
 }
}
await go('/','artista');await evaluate('__agendaDb.eventos=[];__agendaDb.pagamentos_profissionais=[];window.dispatchEvent(new Event("focus"))');
await until('document.body.innerText.includes("Nenhum compromisso")');assert(await evaluate('document.body.innerText.includes("R$ 0")'));
await tap('.minha-agenda-abas a','Histórico0');assert(await evaluate('document.body.innerText.includes("Nenhum evento no seu histórico")'));
await tap('.minha-agenda-abas a','Valores0');assert(await evaluate('document.body.innerText.includes("Nenhum valor registrado")'));
passou('vazios e valores zero','artista',1280);
await go('/','produtor');await evaluate('__agendaDb.profissionais[0].usuario_id=null;window.dispatchEvent(new Event("focus"))');
await until('document.body.innerText.includes("Seu cadastro ainda não está vinculado")');
assert(!(await evaluate('!!document.querySelector(".minha-agenda-resumo")')));
passou('cadastro sem vínculo','produtor',1280);
await go('/','artista');
await evaluate('for(let i=0;i<12;i++){__agendaDb.eventos.push({...__agendaDb.eventos[0],id:"longo"+i,titulo:"Próximo evento "+i});__agendaDb.evento_escala.push({...__agendaDb.evento_escala[0],id:"longa"+i,evento_id:"longo"+i});}window.dispatchEvent(new Event("focus"))');
await until('document.querySelectorAll(".minha-agenda-evento").length===10');
await tap('.paginacao-botao','Próxima');
assert.equal(await evaluate('document.querySelectorAll(".minha-agenda-evento").length'),3);
await tap('.minha-agenda-abas a','Histórico1');
assert(await evaluate('!new URLSearchParams(location.search).has("pagina")'));
passou('paginação e troca de seção','artista',1280);
assert.equal(errors.length,0,JSON.stringify(errors));
await fs.writeFile(new URL('agenda29-resultado.json',out),JSON.stringify({provas,errors},null,2));
console.log('TOTAL '+provas.length);
}catch(e){await screenshot('agenda29-falha');throw e;}finally{ws.close();}
`;
await fs.writeFile(new URL('../../.mobile-check/agenda29.executar.mjs',import.meta.url),script);
await import('../../.mobile-check/agenda29.executar.mjs?t='+Date.now());
