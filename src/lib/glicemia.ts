/**
 * Faixas plausiveis do registro de glicemia. Nao e julgamento clinico - o app
 * nao diz se um valor e bom ou ruim. E so barrar o que nenhum aparelho mede:
 * um zero a mais digitado no celular entrava no historico e puxava a media,
 * o tempo no alvo e o grafico que vai pro endocrinologista.
 */

/** Glicosimetros medem de ~20 a ~600 mg/dL; fora disso mostram LO/HI. */
export const GLICEMIA_MIN = 20
export const GLICEMIA_MAX = 600
/** Uma aplicacao de insulina acima disso e quase certamente erro de digitacao. */
export const INSULINA_MAX = 150
export const CARBO_MAX = 1000

export interface ProblemaGlicemia { titulo: string; texto: string }

/** Devolve o problema, ou null se da pra salvar. Insulina e carbo vazios = nao informados. */
export function problemaNaGlicemia(valor: number, insulina = '', carbo = ''): ProblemaGlicemia | null {
  if (!Number.isFinite(valor) || valor < GLICEMIA_MIN || valor > GLICEMIA_MAX) {
    return {
      titulo: 'Confira o valor da glicemia',
      texto: `Glicosímetros medem de ${GLICEMIA_MIN} a ${GLICEMIA_MAX} mg/dL. Se o aparelho mostrou LO ou HI, anote ${GLICEMIA_MIN} ou ${GLICEMIA_MAX} e escreva na observação.`,
    }
  }
  if (insulina.trim()) {
    const u = Number(insulina.replace(',', '.'))
    if (!Number.isFinite(u) || u <= 0 || u > INSULINA_MAX) {
      return { titulo: 'Confira a insulina', texto: `Use um número entre 0,5 e ${INSULINA_MAX} unidades, ou deixe em branco.` }
    }
  }
  if (carbo.trim()) {
    const c = Number(carbo.replace(',', '.'))
    if (!Number.isFinite(c) || c < 0 || c > CARBO_MAX) {
      return { titulo: 'Confira o carboidrato', texto: `Use um número entre 0 e ${CARBO_MAX} g, ou deixe em branco.` }
    }
  }
  return null
}
