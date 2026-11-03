// Junta as migrações e o seed num arquivo só (supabase/subir_tudo.sql),
// para colar de uma vez no SQL Editor de um projeto de teste novo.
//
//   npm run banco:juntar

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pasta = (caminho) => fileURLToPath(new URL(caminho, import.meta.url));

const migracoes = readdirSync(pasta('./migrations')).filter((f) => f.endsWith('.sql')).sort();
const partes = [
  ...migracoes.map((f) => [`migrations/${f}`, readFileSync(pasta(`./migrations/${f}`), 'utf8')]),
  ['seed.sql', readFileSync(pasta('./seed.sql'), 'utf8')],
];

const cabecalho = `-- =====================================================================
-- Mundinho Kids — banco de TESTE completo, gerado por npm run banco:juntar
-- Não edite aqui: edite os arquivos de origem e gere de novo.
-- Rodar uma única vez, num projeto novo, no SQL Editor do Supabase.
-- Partes: ${partes.map(([nome]) => nome).join(', ')}
-- =====================================================================
`;

const corpo = partes.map(([nome, sql]) => `\n-- >>>>> ${nome}\n\n${sql.trim()}\n`).join('');
writeFileSync(pasta('./subir_tudo.sql'), cabecalho + corpo);
console.log(`supabase/subir_tudo.sql gerado com ${partes.length} partes`);
