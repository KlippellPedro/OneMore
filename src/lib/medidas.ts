/**
 * Faixas plausiveis do registro de corpo. Mesma ideia da glicemia: barrar o
 * que so pode ser erro de digitacao. O peso daqui vira o peso do perfil, que e
 * a base do gasto calorico e das metas - um "750" no lugar de "75,0" mudava o
 * cardapio inteiro.
 */
export const FAIXAS_CORPO = {
  peso: { min: 20, max: 400, nome: 'Peso', unidade: 'kg' },
  gorduraPct: { min: 2, max: 75, nome: 'Gordura corporal', unidade: '%' },
  peito: { min: 30, max: 250, nome: 'Peito', unidade: 'cm' },
  cintura: { min: 30, max: 250, nome: 'Cintura', unidade: 'cm' },
  braco: { min: 10, max: 100, nome: 'Braço', unidade: 'cm' },
  coxa: { min: 20, max: 150, nome: 'Coxa', unidade: 'cm' },
  quadril: { min: 30, max: 250, nome: 'Quadril', unidade: 'cm' },
} as const

export type CampoCorpo = keyof typeof FAIXAS_CORPO

/**
 * Le os campos digitados (texto, aceita virgula) e devolve os numeros, ou a
 * mensagem do primeiro problema. Campo vazio = nao medido.
 */
export function lerMedidas(
  campos: Partial<Record<CampoCorpo, string>>, data: string, hojeIso: string,
): { ok: true; dados: Partial<Record<CampoCorpo, number>> } | { ok: false; erro: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, erro: 'Escolha a data da medida.' }
  if (data > hojeIso) return { ok: false, erro: 'A data não pode ser no futuro.' }
  const dados: Partial<Record<CampoCorpo, number>> = {}
  for (const [k, faixa] of Object.entries(FAIXAS_CORPO) as [CampoCorpo, typeof FAIXAS_CORPO[CampoCorpo]][]) {
    const bruto = campos[k]?.trim()
    if (!bruto) continue
    const n = Number(bruto.replace(',', '.'))
    if (!Number.isFinite(n) || n < faixa.min || n > faixa.max) {
      return { ok: false, erro: `${faixa.nome}: use um valor entre ${faixa.min} e ${faixa.max} ${faixa.unidade}.` }
    }
    dados[k] = n
  }
  if (!Object.keys(dados).length) return { ok: false, erro: 'Preencha pelo menos o peso ou uma medida.' }
  return { ok: true, dados }
}
