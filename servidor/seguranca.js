/**
 * Cabecalhos de seguranca HTTP.
 *
 *   X-Content-Type-Options: o navegador as vezes "adivinha" o tipo real de um
 *     arquivo pelo conteudo, ignorando o Content-Type declarado - e como um
 *     .txt vira executado como .html. `nosniff` desliga esse adivinhar.
 *   X-Frame-Options / frame-ancestors: ninguem tem motivo legitimo pra abrir o
 *     OneMore dentro de um <iframe> de outro site - fecha o clickjacking.
 *   Referrer-Policy: nao manda a URL completa (que aqui pode ter parametro de
 *     consulta do diario, ex.: /diario/imprimir?dias=30) pra fora do site.
 *   Strict-Transport-Security: o navegador passa a recusar http:// pro site -
 *     quem digita o endereco sem https nao manda o cookie de sessao em texto
 *     puro nem por um request. So em producao: no localhost (http) travaria o
 *     desenvolvimento.
 *   Permissions-Policy: o app nao usa camera, microfone, localizacao nem
 *     pagamento; desligar impede que um script injetado peca isso.
 *   Cross-Origin-Opener-Policy: isola a janela de qualquer pagina que a abra.
 *
 * Content-Security-Policy e a peca que faltava, e a mais importante: mesmo que
 * alguem consiga injetar HTML (um nome de exercicio, um campo importado de
 * backup), o navegador se recusa a executar script que nao seja do proprio
 * site. A lista abaixo e exatamente o que o app usa - cada linha tem o motivo:
 *
 *   script-src 'self'      todo o JS e do bundle; nao existe script inline
 *                          (o build do Vite/PWA so emite <script src>)
 *   style-src + inline     o app usa `style={...}` (cores de rank, barras de
 *                          progresso); inline so em ESTILO, nunca em script
 *   img-src https: data:   imagens de exercicio (local), icones e a URL de
 *                          imagem que a pessoa pode colar numa ficha
 *   frame-src youtube      o video da execucao na ficha do exercicio
 *   connect-src 'self'     o app so fala com a propria API (mesma origem)
 *   object-src 'none'      sem Flash/plugin; base-uri/form-action 'self'
 *                          impedem sequestrar <base> e formularios
 *   worker-src 'self'      o service worker (sw.js + lembretes-sw.js)
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob: data:",
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // em producao tudo e https; manda o navegador subir qualquer http:// perdido
  ...(process.env.PRODUCAO === '1' ? ['upgrade-insecure-requests'] : []),
].join('; ')

export const CABECALHOS_SEGURANCA = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': CSP,
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  ...(process.env.PRODUCAO === '1'
    ? { 'Strict-Transport-Security': 'max-age=31536000' }
    : {}),
}
