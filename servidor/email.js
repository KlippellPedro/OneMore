/**
 * Quem e "a mesma pessoa" pelo e-mail. Modulo proprio (e sem import nenhum)
 * porque banco.js (migracao) e auth.js (cadastro/login) precisam da MESMA
 * regra, e auth.js ja importa banco.js - o contrario seria import circular.
 *
 * So `trim().toLowerCase()` nao basta pra garantir uma conta por e-mail: pro
 * Gmail, `pedro@gmail.com`, `p.edro@gmail.com` e `pedro+qualquer@gmail.com`
 * caem na MESMA caixa de entrada, e quem quisesse uma segunda conta so
 * precisava inventar uma variacao. Por isso a unicidade e checada pela forma
 * CANONICA, e a que a pessoa digitou fica guardada como esta (e e a que o
 * app mostra de volta).
 */

/** Gmail ignora ponto no nome e trata googlemail.com como gmail.com. */
const DOMINIOS_GMAIL = new Set(['gmail.com', 'googlemail.com'])

/** "A@x.com " e "a@x.com" sao o mesmo e-mail. NFKC junta formas Unicode equivalentes. */
export const normalizarEmail = e => String(e ?? '').normalize('NFKC').trim().toLowerCase()

/**
 * Forma usada SO pra decidir se duas contas colidem. Remove o "+etiqueta"
 * (a@x.com e a+treino@x.com entregam na mesma caixa em praticamente todo
 * provedor) e, no Gmail, os pontos.
 */
export function emailCanonico(email) {
  const e = normalizarEmail(email)
  const arroba = e.lastIndexOf('@')
  if (arroba < 1) return e
  let local = e.slice(0, arroba)
  let dominio = e.slice(arroba + 1)
  const mais = local.indexOf('+')
  // "+abc@x.com" (nada antes do +) nao tem o que preservar: fica como esta
  if (mais > 0) local = local.slice(0, mais)
  if (DOMINIOS_GMAIL.has(dominio)) {
    local = local.replace(/\./g, '')
    dominio = 'gmail.com'
  }
  return `${local}@${dominio}`
}

/**
 * Formato razoavel, sem tentar ser o RFC inteiro (ninguem consegue): uma
 * arroba, sem espaco nem caractere de controle, dominio com ponto e sem pontos
 * seguidos. Quem decide se o endereco existe e o provedor, nao uma regex.
 */
export const emailValido = e =>
  typeof e === 'string'
  && e.length <= 254
  // eslint-disable-next-line no-control-regex
  && !/[\s\u0000-\u001f\u007f]/.test(e)
  && /^[^@]{1,64}@[^@]+\.[^@.]{2,}$/.test(e)
  && !e.includes('..')
  && !e.startsWith('.')
  && !e.split('@')[1].startsWith('.')
  && !e.split('@')[0].endsWith('.')
