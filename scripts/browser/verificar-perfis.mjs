import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
let script=(await fs.readFile(new URL('./base-perfis.mjs',import.meta.url),'utf8')).split(/try \{\r?\n  const paths/)[0].replaceAll('5173','5174');
script=script.replace('  const enc = obj =>',String.raw`
  user.nome = profile === 'produtor' ? 'Bruno' : profile === 'artista' ? 'Júlia' : 'Paula';
  db.profissionais[0].nome=user.nome;
  db.eventos[0].titulo='Festa da Laura';
  db.evento_escala[0].funcao=profile==='produtor'?'produtor':'artista';
  db.veiculos[0].nome='Doblò';
  db.evento_financeiro=[];
  if(profile==='fantasias') {
    db.pagamentos_profissionais=[];
    db.eventos.push({...db.eventos[0],id:'e2',titulo:'Festa do Theo'});
    db.profissionais[0].usuario_id=null;
  }
  window.__perfilDb=db;
  const enc = obj =>`);
script=script.replace("      else if (method !== 'GET' && !url.pathname.includes('/rpc/')) {",String.raw`
      else if(url.pathname.endsWith('/rpc/profissionais_disponiveis')) result=db.profissionais.map(p=>({id:p.id}));
      else if (method !== 'GET' && !url.pathname.includes('/rpc/')) {`);
script=script.replace('({ id: `novo-${i}`, ...r })','({ id: `novo-${i}`, criado_em: new Date().toISOString(), ativo:true, ...r })');
script=script.replace("const results = process.env.FUNCTIONAL_ONLY ? JSON.parse(await fs.readFile(new URL('resultado-parcial.json', out), 'utf8')).results.slice(0, 65) : [];",'const results = [];');
script+=String.raw`
const evidencias=[];
function ok(caso,perfil,width){evidencias.push({caso,perfil,width});console.log('ok '+perfil+' '+width+' '+caso);}
async function fecha(){await tap('dialog button[aria-label="Fechar"]');}
async function campo(rotulo,valor){await evaluate('(()=>{const c=[...document.querySelectorAll("dialog .campo")].find(c=>c.querySelector("label")?.textContent.startsWith('+JSON.stringify(rotulo)+'));const e=c.querySelector("input");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,'+JSON.stringify(valor)+');e.dispatchEvent(new Event("input",{bubbles:true}));})()');}
try{
for(const width of [1280,375]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:812,screenWidth:width,screenHeight:812,deviceScaleFactor:1,mobile:width<900});
 for(const perfil of ['produtor','artista','fantasias']){
  await go('/eventos',perfil);
  assert(await evaluate('document.body.innerText.includes("Festa da Laura")'));
  assert.equal(await evaluate('document.body.innerText.includes("Festa do Theo")'),perfil==='fantasias');
  assert(!(await evaluate('document.body.innerText.includes("Novo evento")')));
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  if(width===375)assert(await evaluate('!!document.querySelector(".abas")'));
  ok('agenda, ausência de criação e largura da tela',perfil,width);
  await go('/eventos/e1',perfil);
  assert(!(await evaluate('document.body.innerText.includes("Valor contratado")')));
  if(perfil!=='fantasias')assert(await evaluate('document.body.innerText.includes("R$ 150")'));
  await screenshot('perfil26-'+perfil+'-'+width);
  ok('detalhe acessível e somente valor próprio',perfil,width);
  if(perfil==='produtor'){
   await tap('button','Reservar');await until('!!document.querySelector("dialog[open]")');
   assert(await evaluate('document.querySelector("dialog").innerText.includes("Doblò")'));
   await tap('dialog button[type=submit]');await until('!document.querySelector("dialog[open]")');
   assert(await evaluate('__mobileWrites.some(w=>w.path.endsWith("/reservas_veiculo") && JSON.parse(w.body).responsavel_id==="p1")'));
   await tap('button','Lançar');await until('!!document.querySelector("dialog[open]")');
   await campo('Valor','20');await campo('Descrição','Balões teste');
   await tap('dialog button[type=submit]');await until('!document.querySelector("dialog[open]")');
   assert(await evaluate('__mobileWrites.some(w=>w.path.endsWith("/despesas") && JSON.parse(w.body).valor===20)'));
   ok('reserva Doblò e grava despesa',perfil,width);
  }else if(perfil==='artista'){
   await tap('button',width<900?'Trocar':'Pedir troca');await until('!!document.querySelector("dialog[open]")');await fecha();
   assert(!(await evaluate('[...document.querySelectorAll("button")].some(e=>e.textContent.trim()==="Reservar")')));
   ok('pedido de troca e reserva indisponível',perfil,width);
  }else{
   await go('/fantasias',perfil);await tap('[role=button]');await until('!!document.querySelector("dialog[open]")');
   await tap('dialog button[type=submit]');await until('!document.querySelector("dialog[open]")');
   assert(await evaluate('__mobileWrites.some(w=>w.path.endsWith("/fantasias"))'));
   await go('/eventos/e1',perfil);
   await evaluate('__perfilDb.eventos[0].situacao="realizado"; window.dispatchEvent(new Event("focus"))');await pause(250);
   const botoes=await evaluate('[...document.querySelectorAll("button")].map(e=>e.textContent.trim())');
   assert(botoes.some(t=>t.includes('Conferir')));
   await tap('button',botoes.find(t=>t.includes('Conferir')));await until('!!document.querySelector("dialog[open]")');
   await tap('dialog button[type=submit]');await until('!document.querySelector("dialog[open]")');
   assert(await evaluate('__mobileWrites.some(w=>w.path.endsWith("/conferencias_fantasia"))'));
   ok('edita fantasia e salva conferência',perfil,width);
  }
  for(const rota of ['/financeiro','/usuarios','/configuracoes']){
   await go(rota,perfil);assert(!(await evaluate('!!document.querySelector("form, .financeiro-resumo")')));
   assert(await evaluate('document.body.innerText.includes("Página fora do seu acesso")'));
  }
  ok('acesso direto às três telas restritas bloqueado',perfil,width);
 }
}
assert.equal(errors.length,0,JSON.stringify(errors));
await fs.writeFile(new URL('perfis26-resultado.json',out),JSON.stringify({evidencias,errors},null,2));
console.log('TOTAL '+evidencias.length);
}catch(e){await screenshot('perfis26-falha');throw e;}finally{ws.close();}
`;
await fs.writeFile(new URL('../../.mobile-check/perfis.executar.mjs',import.meta.url),script);
await import('../../.mobile-check/perfis.executar.mjs?t='+Date.now());

