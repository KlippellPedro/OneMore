/**
 * Carrega o .env. Existe como modulo separado por causa da ordem de avaliacao
 * do ESM: os `import` de um arquivo rodam ANTES do corpo dele, entao chamar
 * loadEnvFile() dentro do servidor.js acontecia depois de banco.js ja ter lido
 * process.env.DATABASE_URL - e encontrado vazio. Importado em primeiro lugar,
 * este arquivo roda antes de todo o resto.
 *
 * Node 20.12+ le .env sem dotenv. Sem o arquivo, segue com o ambiente do
 * processo - que e o caso de quem exporta as variaveis na mao.
 */
try {
  process.loadEnvFile()
} catch {
  /* sem .env, tudo bem */
}
