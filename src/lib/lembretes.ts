import { db, hoje, isoDia, getPerfil, salvarPerfil } from '../db'
import { n0, n1, mesmoTexto } from './format'
import type { ConfigLembretes, Lembrete, Perfil, PlanoRefeicao } from '../db/types'

/**
 * Lembretes do celular: agua, refeicao, treino e glicemia.
 *
 * O app monta uma AGENDA (tabela `lembretes`) com o que precisa tocar nas
 * proximas horas. Quem dispara e um dos dois:
 *
 * - com o app aberto, o rodizio daqui (`iniciarLembretes`), a cada minuto;
 * - com o app fechado, o service worker (`public/lembretes-sw.js`), quando o
 *   Android o acorda pelo Periodic Background Sync.
 *
 * Por isso a agenda guarda titulo e corpo prontos: o service worker nao sabe
 * calcular nada, so confere se a coisa ja foi feita e mostra o aviso.
 */

export const LEMBRETES_PADRAO: ConfigLembretes = {
  ativo: false,
  agua: { ativo: true, intervaloMin: 120, inicio: '08:00', fim: '22:00' },
  refeicoes: { ativo: true, antecedenciaMin: 10 },
  treino: { ativo: false, horario: '19:00', dias: [1, 3, 5], antecedenciaMin: 30 },
  glicemia: { ativo: false, horarios: ['07:00', '12:00', '18:00', '22:00'] },
}

export const config = (p: Perfil): ConfigLembretes => ({
  ...LEMBRETES_PADRAO,
  ...(p.lembretes ?? {}),
  agua: { ...LEMBRETES_PADRAO.agua, ...(p.lembretes?.agua ?? {}) },
  refeicoes: { ...LEMBRETES_PADRAO.refeicoes, ...(p.lembretes?.refeicoes ?? {}) },
  treino: { ...LEMBRETES_PADRAO.treino, ...(p.lembretes?.treino ?? {}) },
  glicemia: { ...LEMBRETES_PADRAO.glicemia, ...(p.lembretes?.glicemia ?? {}) },
})

/* ------------------------------------------------------------------ */
/* SUPORTE E PERMISSAO                                                 */
/* ------------------------------------------------------------------ */

export const temNotificacao = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator

/** true quando o app esta rodando instalado (fora da aba do navegador). */
export const instalado = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as { standalone?: boolean }).standalone === true

export function permissao(): NotificationPermission | 'indisponivel' {
  if (!temNotificacao()) return 'indisponivel'
  return Notification.permission
}

export async function pedirPermissao(): Promise<NotificationPermission | 'indisponivel'> {
  if (!temNotificacao()) return 'indisponivel'
  const r = await Notification.requestPermission()
  if (r === 'granted') await registrarSyncPeriodico()
  return r
}

interface RegistroComSync extends ServiceWorkerRegistration {
  periodicSync?: {
    register(tag: string, opts: { minInterval: number }): Promise<void>
    getTags(): Promise<string[]>
  }
}

/**
 * Pede pro Android acordar o app de tempos em tempos. So existe no Chrome com
 * o app instalado - sem isso, os avisos so saem com o app aberto.
 */
export async function registrarSyncPeriodico(): Promise<boolean> {
  try {
    const reg = (await navigator.serviceWorker.ready) as RegistroComSync
    if (!reg.periodicSync) return false
    const p = await navigator.permissions.query({
      name: 'periodic-background-sync' as PermissionName,
    })
    if (p.state !== 'granted') return false
    await reg.periodicSync.register('lembretes', { minInterval: 60 * 60 * 1000 })
    return true
  } catch {
    return false
  }
}

export async function syncPeriodicoAtivo(): Promise<boolean> {
  try {
    const reg = (await navigator.serviceWorker.ready) as RegistroComSync
    if (!reg.periodicSync) return false
    return (await reg.periodicSync.getTags()).includes('lembretes')
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* AGENDA                                                              */
/* ------------------------------------------------------------------ */

const MIN = 60_000
const minutosDe = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Instante do dia `data` no horario "HH:MM". */
function quando(data: string, hhmm: string): number {
  const [a, m, d] = data.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  return new Date(a, m - 1, d, h, min || 0, 0, 0).getTime()
}

const hhmm = (ts: number) => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Monta os lembretes de um dia. Nao decide se vai tocar - isso e conferido na
 * hora, com o dado do dia (se ja bebeu, se ja comeu, se ja treinou).
 */
export function lembretesDoDia(
  data: string, perfil: Perfil, planos: PlanoRefeicao[],
): Lembrete[] {
  const c = config(perfil)
  if (!c.ativo) return []
  const lista: Lembrete[] = []
  const diaSemana = new Date(quando(data, '12:00')).getDay()

  if (c.agua.ativo && perfil.metaAgua > 0) {
    const ini = minutosDe(c.agua.inicio)
    const fim = minutosDe(c.agua.fim)
    const passo = Math.max(30, c.agua.intervaloMin)
    // o primeiro toque e um passo depois do inicio: acordar e ja cobrar agua irrita
    for (let m = ini + passo; m <= fim; m += passo) {
      const h = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
      lista.push({
        id: `água-${data}-${h}`,
        tipo: 'agua',
        ts: quando(data, h),
        data,
        titulo: 'Hora de beber água',
        corpo: `Meta do dia: ${n1(perfil.metaAgua / 1000)} L`,
        rota: '#/dieta',
        metaMl: perfil.metaAgua,
      })
    }
  }

  if (c.refeicoes.ativo) {
    for (const p of planos) {
      if (!p.itens.length) continue
      const ts = quando(data, p.horario) - c.refeicoes.antecedenciaMin * MIN
      lista.push({
        id: `refeição-${data}-${p.id}`,
        tipo: 'refeicao',
        ts,
        data,
        titulo: c.refeicoes.antecedenciaMin > 0
          ? `${p.nome} em ${c.refeicoes.antecedenciaMin} min`
          : `Hora do ${p.nome.toLowerCase()}`,
        corpo: `${p.horario} - ${p.itens.length} ite${p.itens.length === 1 ? 'm' : 'ns'} no plano`,
        rota: '#/dieta',
        ref: p.nome,
      })
    }
  }

  if (c.treino.ativo && c.treino.dias.includes(diaSemana)) {
    const ts = quando(data, c.treino.horario) - c.treino.antecedenciaMin * MIN
    lista.push({
      id: `treino-${data}`,
      tipo: 'treino',
      ts,
      data,
      titulo: c.treino.antecedenciaMin > 0
        ? `Treino em ${c.treino.antecedenciaMin} min`
        : 'Hora do treino',
      corpo: `Começa ${c.treino.horario}. Bora manter o streak.`,
      rota: '#/treinos',
    })
  }

  if (c.glicemia.ativo && perfil.diabetesTipo1) {
    for (const h of c.glicemia.horarios) {
      lista.push({
        id: `glicemia-${data}-${h}`,
        tipo: 'glicemia',
        ts: quando(data, h),
        data,
        titulo: 'Medir a glicemia',
        corpo: `Anota o valor das ${h} no diário`,
        rota: '#/diario',
      })
    }
  }

  return lista
}

/**
 * Regrava a agenda dos proximos dias. Mantem o que ja disparou (pra nao tocar
 * duas vezes) e joga fora o que ficou velho.
 */
export async function regerarAgenda(dias = 3): Promise<number> {
  const perfil = await getPerfil()
  const planos = await db.planos.toArray()
  planos.sort((a, b) => a.horario.localeCompare(b.horario))

  const agora = Date.now()
  const antigos = await db.lembretes.toArray()
  const disparados = new Map(antigos.filter(l => l.disparadoEm).map(l => [l.id, l.disparadoEm!]))
  const conhecidos = new Set(antigos.map(l => l.id))

  const novos: Lembrete[] = []
  for (let i = 0; i < dias; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    for (const l of lembretesDoDia(isoDia(d), perfil, planos)) {
      // aviso de horario que ja passou faz muito nao serve mais
      if (l.ts < agora - 60 * MIN) continue
      if (disparados.has(l.id)) {
        novos.push({ ...l, disparadoEm: disparados.get(l.id) })
        continue
      }
      // horario que ja passou e que so existe agora nasceu de uma mudanca de
      // ajuste: nasce silenciado, senao mexer na configuracao dispara na hora.
      // o que ja estava agendado e venceu com o app fechado ainda toca (catch-up)
      novos.push(l.ts < agora && !conhecidos.has(l.id) ? { ...l, disparadoEm: agora } : l)
    }
  }

  await db.lembretes.clear()
  if (novos.length) await db.lembretes.bulkPut(novos)
  return novos.length
}

/** Os proximos que ainda vao tocar - usado pra mostrar na tela de ajustes. */
export async function proximos(limite = 6): Promise<Lembrete[]> {
  const agora = Date.now()
  const todos = await db.lembretes.toArray()
  return todos
    .filter(l => !l.disparadoEm && l.ts >= agora)
    .sort((a, b) => a.ts - b.ts)
    .slice(0, limite)
}

/* ------------------------------------------------------------------ */
/* DISPARO (app aberto)                                                */
/* ------------------------------------------------------------------ */

/**
 * Confere se o aviso ainda faz sentido: nao cobra agua de quem ja bateu a meta
 * nem refeicao de quem ja comeu. Mesma regra do service worker.
 */
export async function aindaVale(l: Lembrete): Promise<{ vale: boolean; corpo: string }> {
  if (l.tipo === 'agua') {
    const a = await db.agua.get(l.data)
    const ml = a?.ml ?? 0
    const meta = l.metaMl ?? 0
    if (meta > 0 && ml >= meta) return { vale: false, corpo: l.corpo }
    const falta = meta - ml
    return {
      vale: true,
      corpo: ml > 0
        ? `Você bebeu ${n1(ml / 1000)} L - faltam ${falta >= 1000 ? `${n1(falta / 1000)} L` : `${n0(falta)} ml`}`
        : l.corpo,
    }
  }

  if (l.tipo === 'refeicao') {
    const doDia = await db.dieta.where('data').equals(l.data).toArray()
    return { vale: !doDia.some(r => mesmoTexto(r.refeicao, l.ref ?? '')), corpo: l.corpo }
  }

  if (l.tipo === 'treino') {
    // pelo indice de `início`, limitado ao dia - varrer todas as sessoes so pra
    // saber se treinou hoje custa o historico inteiro a cada checagem
    const ini = quando(l.data, '00:00')
    const treinou = await db.sessoes.where('inicio')
      .between(ini, ini + 24 * 60 * MIN, true, false)
      .filter(s => s.concluida === 1).count()
    return { vale: treinou === 0, corpo: l.corpo }
  }

  if (l.tipo === 'glicemia') {
    const doDia = await db.glicemia.where('data').equals(l.data).toArray()
    // ja mediu perto desse horario? entao nao enche o saco
    const perto = doDia.some(g => Math.abs(g.ts - l.ts) <= 60 * MIN)
    return { vale: !perto, corpo: l.corpo }
  }

  return { vale: true, corpo: l.corpo }
}

async function mostrar(l: Lembrete, corpo: string) {
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification(l.titulo, {
    body: corpo,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: l.tipo,
    data: { rota: l.rota },
  })
  await db.lembretes.update(l.id, { disparadoEm: Date.now() })
}

/** Toca o que venceu desde a ultima checada. Chamado pelo rodizio e ao abrir. */
export async function dispararPendentes(): Promise<number> {
  if (permissao() !== 'granted') return 0
  const perfil = await getPerfil()
  if (!config(perfil).ativo) return 0

  const agora = Date.now()
  const vencidos = (await db.lembretes.toArray())
    .filter(l => !l.disparadoEm && l.ts <= agora && l.ts > agora - 90 * MIN)
    .sort((a, b) => a.ts - b.ts)

  let n = 0
  for (const l of vencidos) {
    const { vale, corpo } = await aindaVale(l)
    if (vale) { await mostrar(l, corpo); n++ }
    else await db.lembretes.update(l.id, { disparadoEm: agora })
  }
  return n
}

/** Notificacao de teste, pra conferir que o celular deixa passar. */
export async function testar() {
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('Deu certo', {
    body: `Os lembretes do OneMore vao chegar assim. Agora são ${hhmm(Date.now())}.`,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: 'teste',
    data: { rota: '#/lembretes' },
  })
}

/**
 * Liga o rodizio enquanto o app estiver aberto. Retorna a funcao de desligar.
 */
export function iniciarLembretes() {
  let parado = false
  let giros = 0

  const rodar = async () => {
    if (parado || permissao() !== 'granted') return
    try {
      // a agenda muda pouco: refaz a cada 15 min (e sempre no primeiro giro)
      if (giros % 15 === 0) await regerarAgenda()
      giros++
      await dispararPendentes()
    } catch { /* banco fechado ou aba morrendo: tenta de novo no proximo giro */ }
  }

  rodar()
  const t = setInterval(rodar, MIN)
  const aoVoltar = () => { if (document.visibilityState === 'visible') rodar() }
  document.addEventListener('visibilitychange', aoVoltar)

  return () => {
    parado = true
    clearInterval(t)
    document.removeEventListener('visibilitychange', aoVoltar)
  }
}

/** Usado pela tela de ajustes pra salvar e ja refletir na agenda. */
export async function salvarConfig(patch: Partial<ConfigLembretes>) {
  const perfil = await getPerfil()
  const nova = { ...config(perfil), ...patch }
  await salvarPerfil({ lembretes: nova })
  await regerarAgenda()
  return nova
}

export const dataDeHoje = hoje
