export const n0 = (v: number) => Math.round(v).toLocaleString('pt-BR')
export const n1 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
/** Quantidade: mostra 3 em vez de 3,0, mas mantem o 2,5 quando precisa. */
export const nq = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

export const n2 = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

/** 1250 -> "1,25 t" ; 800 -> "800 kg" */
export function peso(kg: number) {
  if (kg >= 1000) return n1(kg / 1000) + ' t'
  return n0(kg) + ' kg'
}

export function tempo(seg: number) {
  const m = Math.floor(seg / 60)
  const s = Math.floor(seg % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function duracao(ms: number) {
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}min`
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DIAS_LONGO = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export const diaCurto = (i: number) => DIAS[i]
export const diaLongo = (i: number) => DIAS_LONGO[i]

export function dataDe(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** "2026-09-07" -> "dom, 7 de set" */
export function dataCurta(iso: string) {
  const d = dataDe(iso)
  return `${DIAS[d.getDay()].toLowerCase()}, ${d.getDate()} de ${MESES[d.getMonth()]}`
}

export function dataNumerica(iso: string) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a.slice(2)}`
}

export function horaDe(ts: number) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Extrai o id de um video do YouTube de qualquer formato de link. */
export function youtubeId(url?: string): string | null {
  if (!url) return null
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  )
  return m ? m[1] : null
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

/** "1 dia" / "3 dias" - evita o "1 dias" que denuncia app mal acabado. */
export const pl = (n: number, singular: string, plural = singular + 's') =>
  `${n0(n)} ${Math.round(n) === 1 ? singular : plural}`

/**
 * Compara texto ignorando acento e caixa.
 *
 * Precisa existir porque dado JA SALVO no aparelho guarda o texto do jeito que
 * estava quando foi gravado. O catalogo passou a ter acento, mas o plano
 * alimentar e o diario de quem ja usava o app continuam com a forma antiga.
 * Comparar com === faria a medida nao resolver e a refeicao de ontem nao casar
 * com a do plano.
 */
export const semAcento = (s: string) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export const mesmoTexto = (a: string, b: string) => semAcento(a) === semAcento(b)
