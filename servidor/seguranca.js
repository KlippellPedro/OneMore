/**
 * Hardening basico de cabecalho HTTP, sem CSP: o app usa iframe do YouTube na
 * ficha do exercicio, script inline do Tailwind/Vite em dev e o manifest do
 * PWA - uma CSP restrita quebraria alguma coisa dessas sem uma auditoria
 * dedicada de cada origem. O que da pra ligar sem esse trabalho, sem custo
 * nenhum pro app funcionar, e o que esta aqui:
 *
 *   X-Content-Type-Options: o navegador as vezes "adivinha" o tipo real de um
 *     arquivo pelo conteudo, ignorando o Content-Type declarado - e como um
 *     .txt vira executado como .html. `nosniff` desliga esse adivinhar.
 *   X-Frame-Options: ninguem tem motivo legitimo pra abrir o OneMore dentro de
 *     um <iframe> de outro site - `DENY` fecha esse caminho de clickjacking.
 *   Referrer-Policy: nao manda a URL completa (que aqui pode ter parametro de
 *     consulta do diario, ex.: /diario/imprimir?dias=30) pra fora do site.
 *
 * Compartilhado entre servidor.js (arquivos estaticos) e servidor/api.js (as
 * respostas JSON) - os dois escrevem resposta HTTP, os dois precisam disto.
 */
export const CABECALHOS_SEGURANCA = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}
