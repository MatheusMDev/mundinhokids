// Datas sempre no fuso de São Paulo, independente do aparelho.

const FUSO = 'America/Sao_Paulo';

const fmtPartes = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', weekday: 'long', hourCycle: 'h23',
});

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

interface Partes {
  ano: number;
  mes: number;      // 1 a 12
  dia: number;
  hora: number;
  minuto: number;
  diaSemana: number; // 0 = domingo
}

export function partes(iso: string): Partes {
  // Date-only ISO strings are parsed as UTC by browsers; noon keeps the calendar day
  // stable when it is formatted in Sao Paulo.
  const data = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  const p = Object.fromEntries(fmtPartes.formatToParts(data).map((x) => [x.type, x.value]));
  return {
    ano: Number(p.year), mes: Number(p.month), dia: Number(p.day),
    hora: Number(p.hour), minuto: Number(p.minute),
    diaSemana: DIAS_LONGOS.indexOf(String(p.weekday).toLowerCase()),
  };
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "2026-10-17" — chave do dia no fuso local */
export function chaveDia(iso: string): string {
  const p = partes(iso);
  return chaveDe(p.ano, p.mes, p.dia);
}
export const chaveDe = (ano: number, mes: number, dia: number) => `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;

/** Dia da semana de uma chave "2026-10-17" (0 = domingo) */
export function diaSemanaDaChave(chave: string): number {
  const [a, m, d] = chave.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** Soma dias a uma chave "2026-10-17" */
export function somarDias(chave: string, dias: number): string {
  const [a, m, d] = chave.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d + dias));
  return chaveDe(data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate());
}

/** "15h" ou "14h15" */
export function hora(iso: string): string {
  const p = partes(iso);
  return p.minuto ? `${p.hora}h${doisDigitos(p.minuto)}` : `${p.hora}h`;
}

/** "Sábado, 17 de outubro de 2026" (comAno) ou "Sábado, 17 de outubro" */
export function dataLonga(iso: string, comAno = true): string {
  const p = partes(iso);
  return `${maiuscula(DIAS_LONGOS[p.diaSemana])}, ${p.dia} de ${MESES[p.mes - 1]}${comAno ? ` de ${p.ano}` : ''}`;
}

export function dataLongaDaChave(chave: string): string {
  const [, m, d] = chave.split('-').map(Number);
  return `${maiuscula(DIAS_LONGOS[diaSemanaDaChave(chave)])}, ${d} de ${MESES[m - 1]}`;
}

/** "sáb 17" */
export function diaCurto(iso: string): string {
  const p = partes(iso);
  return `${DIAS_CURTOS[p.diaSemana]} ${p.dia}`;
}

/** "Hoje, 9h40" · "Ontem, 18h" · "12 out, 16h02" */
export function quando(iso: string, hojeIso: string): string {
  const dia = chaveDia(iso);
  const hoje = chaveDia(hojeIso);
  if (dia === hoje) return `Hoje, ${hora(iso)}`;
  if (dia === somarDias(hoje, -1)) return `Ontem, ${hora(iso)}`;
  const p = partes(iso);
  return `${p.dia} ${MESES[p.mes - 1].slice(0, 3)}, ${hora(iso)}`;
}

/** "Outubro 2026" */
export const mesAno = (ano: number, mes: number) => `${maiuscula(MESES[mes - 1])} ${ano}`;

const fmtMoedaInteira = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** "R$ 1.800" ou "R$ 45,50" */
export function moeda(valor: number): string {
  return (Number.isInteger(valor) ? fmtMoedaInteira : fmtMoeda).format(valor).replace(/ /g, ' ');
}

export const iniciais = (nome: string) => nome.trim().charAt(0).toUpperCase();

/** ISO → valores dos campos de data ("2026-10-24") e hora ("15:00"), no horário de São Paulo */
export function paraCampos(iso: string): { data: string; hora: string } {
  const p = partes(iso);
  return { data: chaveDe(p.ano, p.mes, p.dia), hora: `${doisDigitos(p.hora)}:${doisDigitos(p.minuto)}` };
}

/** Campos de data e hora → ISO com o fuso de São Paulo (-03:00, sem horário de verão desde 2019) */
export const deCampos = (data: string, horaCampo: string) => `${data}T${horaCampo}:00-03:00`;

/** "1.200,50", "R$ 45" ou "45.5" → número; vazio ou inválido → null */
export function lerValor(texto: string): number | null {
  let s = texto.replace(/[R$\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Data de hoje ("2026-10-20") no horário de São Paulo */
export const hojeCampo = () => paraCampos(new Date().toISOString()).data;

/** "2026-10-20" → "20/10" */
export const dataCurta = (data: string) => data.split('-').reverse().slice(0, 2).join('/');

/** Texto para busca: minúsculo e sem acentos ("Júlia" → "julia") */
export const semAcentos = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
