import Dexie from 'dexie'
import { db } from './index'

const NOME_ANTIGO = 'forja'
const MARCA = 'onemore:migrado-de-forja'

/**
 * O app se chamava Forja ate setembro de 2026. O IndexedDB e nomeado, entao
 * renomear o app deixaria os dados antigos orfaos - isso traz tudo pro banco
 * novo, uma vez so.
 *
 * Pode ser apagado quando todos os aparelhos ja tiverem aberto o app novo.
 */
export async function migrarDeForja() {
  if (localStorage.getItem(MARCA)) return
  // marca antes de tentar: se o banco antigo estiver corrompido, o app nao
  // pode ficar preso tentando migrar em toda abertura
  localStorage.setItem(MARCA, '1')

  if (!(await Dexie.exists(NOME_ANTIGO))) return

  const antigo = new Dexie(NOME_ANTIGO)
  try {
    await antigo.open()   // abre no schema que ja esta gravado, sem declarar versao
    let total = 0

    for (const tabela of antigo.tables) {
      const destino = (db as unknown as Record<string, {
        bulkPut(v: unknown[]): Promise<unknown>
      } | undefined>)[tabela.name]
      if (!destino) continue
      const linhas = await tabela.toArray()
      if (!linhas.length) continue
      await destino.bulkPut(linhas)
      total += linhas.length
    }

    if (total > 0) {
      // leva os marcadores junto, senao o seed trata como instalacao nova e
      // monta treino e cardapio por cima do que acabou de ser migrado
      const seed = localStorage.getItem('forja:seed')
      if (seed) localStorage.setItem('onemore:seed', seed)
      const sync = localStorage.getItem('forja:sync')
      if (sync) localStorage.setItem('onemore:sync', sync)
    }
  } catch {
    // banco antigo ilegivel: segue como instalacao limpa em vez de travar o app
  } finally {
    antigo.close()
  }
}
