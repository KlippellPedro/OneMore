import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, hoje, isoDia } from '../db'
import {
  useNivel, useRotinas, useSessaoAtiva, useRegistrosDoDia,
  useAguaDoDia, useMapaAlimentos, useMapaExercicios, useGlicemiaDoDia,
} from '../state/hooks'
import { totalDoDia } from '../lib/nutricao'
import { iniciarSessao, addAgua, volumeSessao } from '../lib/acoes'
import { multiplicadorStreak, streakVivo, XP } from '../lib/xp'
import { useUI, vibrar } from '../state/ui'
import { Card, Btn, Barra, Anel, Secao } from '../components/ui'
import { SheetGlicemia, LinhaGlicemia } from '../components/Glicemia'
import { Icone } from '../components/Icone'
import { n0, n1, pl, peso, dataCurta, duracao, clamp } from '../lib/format'

interface Missao {
  id: string
  icone: string
  nome: string
  ok: boolean
  xp: number
  prog?: number
  /** O ganho real e MAIOR que esse numero (series, recordes). Mostra "+". */
  aPartirDe?: boolean
}

export default function Home() {
  const nav = useNavigate()
  const { toast, celebrar } = useUI()
  const { nivel, rank, progresso, xpNoNivel, xpParaProximo, perfil } = useNivel()
  const rotinas = useRotinas()
  const sessaoAtiva = useSessaoAtiva()
  const registros = useRegistrosDoDia()
  const agua = useAguaDoDia()
  const mapaAl = useMapaAlimentos()
  const mapaEx = useMapaExercicios()
  const glicemias = useGlicemiaDoDia()
  const [medir, setMedir] = useState(false)
  const hj = hoje()
  // o streak do perfil so e recalculado quando cai XP: pra mostrar, vale o vivo
  const streak = streakVivo(perfil, hj)

  // pelo indice de `inicio`, de tras pra frente: o cursor para nas 3 primeiras
  // em vez de carregar o historico inteiro so pra jogar quase tudo fora
  const recentes = useLiveQuery(
    () => db.sessoes.orderBy('inicio').reverse().filter(x => x.concluida === 1).limit(3).toArray(),
    [], [],
  ) ?? []

  const pesoHoje = useLiveQuery(() => db.corpo.get(hj), [hj], undefined)

  const total = totalDoDia(registros, mapaAl)
  const restante = perfil.metaKcal - total.kcal
  const mlAgua = agua?.ml ?? 0

  const diaSemana = new Date().getDay()
  const sugerida =
    rotinas.find(r => r.dias?.includes(diaSemana)) ??
    rotinas[0]

  // idem: olha so o que comecou depois da meia-noite de hoje
  const treinouHoje = useLiveQuery(async () => {
    const meiaNoite = new Date(); meiaNoite.setHours(0, 0, 0, 0)
    const n = await db.sessoes.where('inicio').aboveOrEqual(meiaNoite.getTime())
      .filter(x => x.concluida === 1).count()
    return n > 0
  }, [hj], false)

  /* ---------------- missoes do dia ----------------
   * O XP vem da tabela em lib/xp.ts, nunca escrito na mao aqui: numero copiado
   * vira mentira no primeiro ajuste do balanceamento. O treino leva "+" porque
   * o valor cresce com as series e os recordes, e tudo ainda passa pelo
   * multiplicador de streak. */
  const missoes: Missao[] = [
    { id: 'treino', icone: 'halter', nome: 'Fazer o treino de hoje', ok: !!treinouHoje, xp: XP.TREINO, aPartirDe: true },
    { id: 'prot', icone: 'talheres', nome: `Bater ${perfil.metaProt} g de proteina`, ok: total.prot >= perfil.metaProt * 0.9, xp: XP.PROTEINA_OK, prog: total.prot / perfil.metaProt },
    { id: 'agua', icone: 'gota', nome: `Beber ${n1(perfil.metaAgua / 1000)} L de agua`, ok: mlAgua >= perfil.metaAgua, xp: XP.AGUA_OK, prog: mlAgua / perfil.metaAgua },
    { id: 'peso', icone: 'balanca', nome: 'Registrar o peso', ok: !!pesoHoje?.peso, xp: XP.PESO },
    ...(perfil.diabetesTipo1 === true
      ? [{ id: 'gli', icone: 'sangue', nome: 'Medir a glicemia (4x)', ok: glicemias.length >= 4, xp: XP.GLICEMIA, prog: glicemias.length / 4 }]
      : []),
  ]
  const feitas = missoes.filter(m => m.ok).length

  const hora = new Date().getHours()
  const saudacao = hora < 6 ? 'Boa madrugada' : hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  async function comecar() {
    if (sessaoAtiva) return nav(`/sessao/${sessaoAtiva.id}`)
    if (!sugerida) return nav('/treinos')
    vibrar(20)
    const id = await iniciarSessao(sugerida)
    nav(`/sessao/${id}`)
  }

  async function beber(ml: number) {
    vibrar()
    const g = await addAgua(ml)
    if (g) celebrar(g)
    else toast(`+${ml} ml`, 'ok')
  }

  return (
    <div className="px-4 pt-4 safe-t">
      {/* -------- cabecalho -------- */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[13px] text-muted">{saudacao},</p>
          <h1 className="text-[26px] font-black leading-tight tracking-tight">{perfil.nome}</h1>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-accent/12 border border-accent/25">
            <Icone nome="chama" tamanho={15} className="text-accent" />
            <span className="text-sm font-black text-accent">{streak}</span>
            <span className="text-[10px] text-accent/70 font-semibold">{streak === 1 ? 'dia' : 'dias'}</span>
          </div>
        )}
      </div>

      {/* -------- nivel -------- */}
      {/*
        destaque: o rank comeca em Ferro, que e cinza de proposito. Sem um fundo
        proprio, o primeiro card que a pessoa ve no app inteiro nascia sem cor
        nenhuma. O roxo da marca segura a tela; a cor do rank fica nos detalhes.
      */}
      <Card destaque className="p-4 mb-4 relative overflow-hidden">
        <div
          className="absolute -right-12 -top-12 w-44 h-44 rounded-full opacity-[0.16] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${rank.cor}, transparent 68%)` }}
        />
        <div className="flex items-center gap-4 mb-3.5">
          <div className="relative w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center border-2"
            style={{ borderColor: rank.cor, background: `${rank.cor}14` }}>
            <span className="text-2xl font-black" style={{ color: rank.cor }}>{nivel}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: rank.cor }}>
              Rank {rank.nome}
              <span className="font-mono px-1.5 rounded border" style={{ borderColor: rank.cor }}>{rank.letra}</span>
            </p>
            <p className="text-[15px] font-bold">Nivel {nivel}</p>
            <p className="text-[11.5px] text-muted">
              {n0(xpNoNivel)} / {n0(xpParaProximo)} XP para o nivel {nivel + 1}
            </p>
          </div>
          {streak > 1 && (
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted uppercase tracking-wide">Bonus</p>
              <p className="text-sm font-black text-xp">{multiplicadorStreak(streak).toFixed(2)}x</p>
            </div>
          )}
        </div>
        <Barra valor={progresso} cor={rank.cor} altura={10} brilho />
      </Card>

      {/* -------- treino -------- */}
      <Secao titulo="Treino de hoje" acao={
        <Link to="/treinos" className="toque text-[12px] font-semibold text-accent">Ver todos</Link>
      }>
        {sessaoAtiva ? (
          <Card className="p-4" onClick={() => nav(`/sessao/${sessaoAtiva.id}`)}>
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] truncate">{sessaoAtiva.nome}</p>
                <p className="text-[12px] text-muted">
                  Em andamento - {sessaoAtiva.series.filter(s => s.feito).length}/{sessaoAtiva.series.length} series
                </p>
              </div>
              <span className="text-accent font-bold text-sm">Continuar</span>
            </div>
          </Card>
        ) : sugerida ? (
          <Card className="p-4">
            <div className="flex items-start gap-3 mb-4">
              <span className="w-1.5 h-12 rounded-full shrink-0" style={{ background: sugerida.cor }} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] leading-tight">{sugerida.nome}</p>
                <p className="text-[12px] text-muted mt-1">
                  {pl(sugerida.itens.length, 'exercicio')} - {pl(sugerida.itens.reduce((t, i) => t + i.series, 0), 'serie')}
                </p>
              </div>
              {treinouHoje && (
                <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-good/15 text-good">
                  JA TREINOU
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {sugerida.itens.slice(0, 4).map((it, i) => (
                <span key={i} className="text-[11px] px-2 py-1 rounded-lg bg-surface-2 text-muted truncate max-w-[46%]">
                  {mapaEx.get(it.exercicioId)?.nome ?? 'Exercicio'}
                </span>
              ))}
              {sugerida.itens.length > 4 && (
                <span className="text-[11px] px-2 py-1 rounded-lg bg-surface-2 text-muted">
                  +{sugerida.itens.length - 4}
                </span>
              )}
            </div>
            <Btn variant="primary" size="lg" className="w-full" onClick={comecar}>
              Comecar treino
            </Btn>
          </Card>
        ) : (
          <Card className="p-5 text-center">
            <p className="text-[13px] text-muted mb-3">Voce ainda nao tem nenhuma rotina.</p>
            <Btn variant="primary" onClick={() => nav('/treinos')}>Criar meu primeiro treino</Btn>
          </Card>
        )}
      </Secao>

      {/* -------- dieta -------- */}
      <Secao titulo="Dieta de hoje" acao={
        <Link to="/dieta" className="toque text-[12px] font-semibold text-accent">Abrir</Link>
      }>
        <Card className="p-4" onClick={() => nav('/dieta')}>
          <div className="flex items-center gap-4 mb-4">
            <Anel valor={total.kcal / perfil.metaKcal} cor="var(--color-accent)" tamanho={76} espessura={7}>
              <span className="text-[17px] font-black leading-none">{n0(total.kcal)}</span>
              <span className="text-[9px] text-muted mt-0.5">de {n0(perfil.metaKcal)}</span>
            </Anel>
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-bold ${restante < -100 ? 'text-bad' : 'text-txt'}`}>
                {restante >= 0
                  ? `Faltam ${n0(restante)} kcal`
                  : `${n0(-restante)} kcal acima da meta`}
              </p>
              <p className="text-[11.5px] text-muted mt-0.5">{dataCurta(hj)}</p>
              {registros.length === 0 && (
                <p className="text-[11.5px] text-accent mt-1.5 font-semibold">Nada registrado ainda hoje</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MacroMini nome="Proteina" atual={total.prot} meta={perfil.metaProt} cor="var(--color-good)" />
            <MacroMini nome="Carbo" atual={total.carb} meta={perfil.metaCarb} cor="var(--color-warn)" />
            <MacroMini nome="Gordura" atual={total.gord} meta={perfil.metaGord} cor="#9b7fc7" />
          </div>
        </Card>
      </Secao>

      {/* -------- glicemia -------- */}
      {perfil.diabetesTipo1 === true && (
        <Secao titulo="Glicemia de hoje" acao={<Link to="/diario" className="toque text-[12.5px] font-semibold text-accent">Ver diario</Link>}>
          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                {glicemias.length ? (
                  <>
                    <p className="text-[15px] font-black tabular-nums">
                      {n0(glicemias[0].valor)}
                      <span className="text-[11px] text-muted font-medium ml-1">mg/dL agora</span>
                    </p>
                    <p className="text-[11.5px] text-muted">
                      {glicemias.length} medic{glicemias.length === 1 ? 'ao' : 'oes'} - media{' '}
                      {n0(glicemias.reduce((t, g) => t + g.valor, 0) / glicemias.length)}
                    </p>
                  </>
                ) : (
                  <p className="text-[13px] text-muted">Nenhuma medicao registrada hoje</p>
                )}
              </div>
              <Btn size="sm" variant="primary" onClick={() => setMedir(true)}>+ Medir</Btn>
            </div>
            {glicemias.slice(0, 3).map(g => <LinhaGlicemia key={g.id} r={g} />)}
          </Card>
        </Secao>
      )}

      {/* -------- agua -------- */}
      <Secao titulo="Agua">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[15px] font-bold">
              {n1(mlAgua / 1000)} <span className="text-muted text-[13px] font-medium">/ {n1(perfil.metaAgua / 1000)} L</span>
            </p>
            <div className="flex gap-1.5">
              {[200, 500].map(v => (
                <Btn key={v} size="sm" onClick={() => beber(v)}>+{v}ml</Btn>
              ))}
              {mlAgua > 0 && (
                <Btn size="sm" variant="ghost" onClick={() => beber(-200)}>-</Btn>
              )}
            </div>
          </div>
          <Barra valor={mlAgua / perfil.metaAgua} cor="var(--color-accent-2)" altura={9} />
        </Card>
      </Secao>

      {/* -------- missoes -------- */}
      <Secao titulo={`Missoes de hoje - ${feitas}/${missoes.length}`}>
        {feitas === missoes.length && (
          <div className="flex items-center gap-2.5 mb-2.5 px-3.5 py-2.5 rounded-2xl bg-xp/12 border border-xp/30 anim-pop">
            <Icone nome="trofeu" tamanho={18} className="text-xp shrink-0" />
            <p className="text-[12.5px] font-bold text-xp">Dia perfeito! Todas as missoes concluidas.</p>
          </div>
        )}
        <Card className={`p-2 ${feitas === missoes.length ? 'border-xp/30' : ''}`}>
          {missoes.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-2.5 py-2.5">
              <div className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center ${
                m.ok ? 'bg-good/15 text-good' : 'bg-surface-2 text-muted'
              }`}>
                <Icone nome={m.ok ? 'check' : m.icone} tamanho={16} traco={m.ok ? 2.4 : 1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[13.5px] font-medium truncate ${m.ok ? 'text-muted line-through' : 'text-txt'}`}>
                  {m.nome}
                </p>
                {m.prog != null && !m.ok && (
                  <div className="mt-1.5"><Barra valor={m.prog} altura={4} cor="var(--color-muted)" /></div>
                )}
              </div>
              <span className={`text-[12px] font-bold shrink-0 ${m.ok ? 'text-good' : 'text-muted'}`}>
                +{m.xp}{m.aPartirDe ? '+' : ''} XP
              </span>
            </div>
          ))}
        </Card>
      </Secao>

      {/* -------- historico -------- */}
      {recentes.length > 0 && (
        <Secao titulo="Ultimos treinos" acao={
          <Link to="/progresso" className="toque text-[12px] font-semibold text-accent">Historico</Link>
        }>
          <div className="space-y-2">
            {recentes.map(s => (
              <Card key={s.id} className="p-3.5 flex items-center gap-3"
                onClick={() => nav(`/historico/${s.id}`)}>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold truncate">{s.nome}</p>
                  <p className="text-[11.5px] text-muted">
                    {dataCurta(isoDia(new Date(s.inicio)))}
                    {s.fim ? ` - ${duracao(s.fim - s.inicio)}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-bold">{peso(volumeSessao(s))}</p>
                  <p className="text-[11px] text-xp font-semibold">+{s.xpGanho ?? 0} XP</p>
                </div>
                <span className="text-muted shrink-0">›</span>
              </Card>
            ))}
          </div>
        </Secao>
      )}

      <SheetGlicemia aberto={medir} fechar={() => setMedir(false)} />
    </div>
  )
}

function MacroMini({ nome, atual, meta, cor }: { nome: string; atual: number; meta: number; cor: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10.5px] text-muted font-medium">{nome}</span>
        <span className="text-[10.5px] text-muted">{n0(meta)}g</span>
      </div>
      <p className="text-[15px] font-bold leading-none mb-1.5">{n0(atual)}<span className="text-[10px] text-muted font-medium">g</span></p>
      <Barra valor={clamp(atual / meta, 0, 1.2)} cor={cor} altura={5} />
    </div>
  )
}
