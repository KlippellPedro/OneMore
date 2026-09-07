import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, hoje, isoDia, diaMais } from '../db'
import { usePerfil, useNivel } from '../state/hooks'
import { coletarStats, CONQUISTAS, type StatsConquista } from '../lib/xp'
import { registrarCorpo, volumeSessao } from '../lib/acoes'
import { Grafico, Barras } from '../components/Grafico'
import { Titulo } from '../components/Cabecalho'
import { Card, Btn, Sheet, Campo, Input, Barra, Chip, Vazio } from '../components/ui'
import { useUI } from '../state/ui'
import { n0, n1, pl, peso, dataCurta, duracao, dataNumerica } from '../lib/format'

type Aba = 'treino' | 'corpo' | 'conquistas'

export default function Progresso() {
  const { celebrar, toast } = useUI()
  const perfil = usePerfil()
  const { nivel, rank, progresso, xpNoNivel, xpParaProximo } = useNivel()
  const [aba, setAba] = useState<Aba>('treino')
  const [registrarPeso, setRegistrarPeso] = useState(false)

  const stats = useLiveQuery(() => coletarStats(perfil), [perfil.xp, perfil.conquistas.length])
  const sessoes = useLiveQuery(async () => {
    const s = await db.sessoes.filter(x => x.concluida).toArray()
    return s.sort((a, b) => b.inicio - a.inicio)
  }, [], []) ?? []
  const corpo = useLiveQuery(() => db.corpo.orderBy('data').toArray(), [], []) ?? []

  /* -------- volume por semana (ultimas 8) -------- */
  const semanas = (() => {
    const out: { rotulo: string; valor: number }[] = []
    const hj = new Date()
    for (let s = 7; s >= 0; s--) {
      const fim = new Date(hj); fim.setDate(hj.getDate() - s * 7)
      const ini = new Date(fim); ini.setDate(fim.getDate() - 6)
      const a = isoDia(ini), b = isoDia(fim)
      const v = sessoes
        .filter(x => { const d = isoDia(new Date(x.inicio)); return d >= a && d <= b })
        .reduce((t, x) => t + volumeSessao(x), 0)
      out.push({ rotulo: s === 0 ? 'agora' : `${s}sem`, valor: v })
    }
    return out
  })()

  /* -------- frequencia dos ultimos 28 dias -------- */
  const diasTreinados = new Set(sessoes.map(s => isoDia(new Date(s.inicio))))
  const calendario = Array.from({ length: 28 }, (_, i) => {
    const d = diaMais(hoje(), -(27 - i))
    return { dia: d, treinou: diasTreinados.has(d) }
  })

  const pesoPontos = corpo.filter(c => c.peso).map(c => ({ x: c.data, y: c.peso! }))
  const variacaoPeso = pesoPontos.length > 1
    ? pesoPontos[pesoPontos.length - 1].y - pesoPontos[0].y
    : 0

  return (
    <div>
      <Titulo titulo="Progresso" sub={`Nivel ${nivel} - Rank ${rank.nome}`} />

      <div className="px-4">
        {/* -------- cartao de nivel -------- */}
        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold" style={{ color: rank.cor }}>
                Rank {rank.nome}
              </p>
              <p className="text-[22px] font-black leading-tight">Nivel {nivel}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted uppercase tracking-wide">XP total</p>
              <p className="text-[18px] font-black text-xp tabular-nums">{n0(perfil.xp)}</p>
            </div>
          </div>
          <Barra valor={progresso} cor={rank.cor} altura={9} brilho />
          <p className="text-[11px] text-muted mt-2">
            {n0(xpParaProximo - xpNoNivel)} XP para o nivel {nivel + 1}
          </p>
        </Card>

        {/* -------- numeros -------- */}
        {stats && (
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <Numero rotulo="Treinos" valor={n0(stats.treinos)} />
            <Numero rotulo="Series" valor={n0(stats.series)} />
            <Numero rotulo="Volume total" valor={peso(stats.volumeTotal)} />
            <Numero rotulo="Melhor sequencia" valor={pl(stats.melhorStreak, 'dia')} destaque={perfil.streak > 2} />
          </div>
        )}

        {/* -------- abas -------- */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto">
          <Chip ativo={aba === 'treino'} onClick={() => setAba('treino')}>Treino</Chip>
          <Chip ativo={aba === 'corpo'} onClick={() => setAba('corpo')}>Corpo</Chip>
          <Chip ativo={aba === 'conquistas'} onClick={() => setAba('conquistas')}>
            Conquistas {perfil.conquistas.length}/{CONQUISTAS.length}
          </Chip>
        </div>

        {/* ---------------- TREINO ---------------- */}
        {aba === 'treino' && (
          <>
            <Card className="p-4 mb-3">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">
                Volume por semana
              </h2>
              <Barras dados={semanas} altura={110} sufixo="kg levantados por semana" />
            </Card>

            <Card className="p-4 mb-3">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">
                Ultimos 28 dias
              </h2>
              <div className="grid grid-cols-7 gap-1.5">
                {calendario.map(d => (
                  <div key={d.dia}
                    className={`aspect-square rounded-md ${d.treinou ? 'bg-accent' : 'bg-surface-2'} ${
                      d.dia === hoje() ? 'ring-2 ring-txt/40' : ''
                    }`}
                    title={dataNumerica(d.dia)} />
                ))}
              </div>
              <p className="text-[11.5px] text-muted mt-3">
                {pl(calendario.filter(d => d.treinou).length, 'treino')} nas ultimas 4 semanas
                {' - '}meta {perfil.metaTreinosSemana * 4}
              </p>
            </Card>

            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2 px-1 mt-5">
              Historico
            </h2>
            {sessoes.length === 0 ? (
              <Vazio icone="📋" titulo="Nenhum treino registrado" texto="Faca o primeiro treino e ele aparece aqui." />
            ) : (
              <div className="space-y-2 pb-4">
                {sessoes.slice(0, 40).map(s => (
                  <Card key={s.id} className="p-3.5">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold truncate">{s.nome}</p>
                        <p className="text-[11.5px] text-muted">
                          {dataCurta(isoDia(new Date(s.inicio)))}
                          {s.fim ? ` - ${duracao(s.fim - s.inicio)}` : ''}
                          {' - '}{s.series.filter(g => g.feito).length} series
                        </p>
                        {s.notas && <p className="text-[11.5px] text-muted/80 mt-1 italic">{s.notas}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-bold">{peso(volumeSessao(s))}</p>
                        <p className="text-[11px] text-xp font-semibold">+{s.xpGanho ?? 0} XP</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---------------- CORPO ---------------- */}
        {aba === 'corpo' && (
          <>
            <Card className="p-4 mb-3">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted">Peso corporal</h2>
                  <p className="text-[24px] font-black leading-tight mt-1">
                    {n1(perfil.pesoKg)}<span className="text-[13px] text-muted font-medium ml-1">kg</span>
                  </p>
                  {pesoPontos.length > 1 && (
                    <p className={`text-[12px] font-semibold ${
                      variacaoPeso > 0 ? 'text-warn' : variacaoPeso < 0 ? 'text-good' : 'text-muted'
                    }`}>
                      {variacaoPeso > 0 ? '+' : ''}{n1(variacaoPeso)} kg desde o inicio
                    </p>
                  )}
                </div>
                <Btn size="sm" variant="primary" onClick={() => setRegistrarPeso(true)}>Registrar</Btn>
              </div>
              {pesoPontos.length > 1
                ? <Grafico pontos={pesoPontos} cor="var(--color-good)" sufixo=" kg" altura={150} />
                : <p className="text-[12.5px] text-muted py-6 text-center">
                    Registre seu peso alguns dias para ver a curva.
                  </p>}
            </Card>

            {corpo.length > 0 && (
              <Card className="overflow-hidden mb-4">
                {[...corpo].reverse().slice(0, 20).map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-line/40 last:border-0">
                    <span className="text-[12.5px] text-muted w-20 shrink-0">{dataNumerica(c.data)}</span>
                    <div className="flex-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px]">
                      {c.peso && <span className="font-semibold">{n1(c.peso)} kg</span>}
                      {c.gorduraPct && <span className="text-muted">{n1(c.gorduraPct)}% gord</span>}
                      {c.cintura && <span className="text-muted">cintura {n0(c.cintura)}</span>}
                      {c.braco && <span className="text-muted">braco {n0(c.braco)}</span>}
                      {c.peito && <span className="text-muted">peito {n0(c.peito)}</span>}
                      {c.coxa && <span className="text-muted">coxa {n0(c.coxa)}</span>}
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}

        {/* ---------------- CONQUISTAS ---------------- */}
        {aba === 'conquistas' && stats && (
          <div className="space-y-2 pb-4">
            {CONQUISTAS.map(q => {
              const feita = perfil.conquistas.includes(q.id)
              const atual = q.atual(stats as StatsConquista)
              return (
                <Card key={q.id} className={`p-3.5 ${feita ? 'border-xp/30' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-xl ${
                      feita ? 'bg-xp/15' : 'bg-surface-2 grayscale opacity-40'
                    }`}>
                      {q.icone}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`text-[13.5px] font-bold truncate ${feita ? 'text-xp' : ''}`}>{q.nome}</p>
                        {q.xp > 0 && (
                          <span className="text-[11px] font-bold text-muted shrink-0">+{q.xp} XP</span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-muted truncate">{q.desc}</p>
                      {!feita && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1"><Barra valor={atual / q.alvo} altura={4} cor="var(--color-muted)" /></div>
                          <span className="text-[10px] text-muted tabular-nums shrink-0">
                            {n0(Math.min(atual, q.alvo))}/{n0(q.alvo)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <SheetPeso aberto={registrarPeso} fechar={() => setRegistrarPeso(false)}
        pesoAtual={perfil.pesoKg}
        onSalvo={g => { if (g) celebrar(g); else toast('Registro atualizado', 'ok') }} />
    </div>
  )
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <Card className="p-3.5">
      <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1">{rotulo}</p>
      <p className={`text-[19px] font-black tabular-nums ${destaque ? 'text-accent' : ''}`}>{valor}</p>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function SheetPeso({ aberto, fechar, pesoAtual, onSalvo }: {
  aberto: boolean; fechar: () => void; pesoAtual: number
  onSalvo: (g: Awaited<ReturnType<typeof registrarCorpo>>) => void
}) {
  const [data, setData] = useState(hoje())
  const [f, setF] = useState({
    peso: String(pesoAtual), gorduraPct: '', cintura: '', braco: '', peito: '', coxa: '', quadril: '',
  })

  const campo = (k: keyof typeof f, label: string, ph: string) => (
    <Campo label={label}>
      <Input type="number" inputMode="decimal" value={f[k]} placeholder={ph}
        onChange={e => setF(v => ({ ...v, [k]: e.target.value }))} />
    </Campo>
  )

  const num = (s: string) => (s.trim() ? Number(s) : undefined)

  return (
    <Sheet aberto={aberto} fechar={fechar} titulo="Registrar medidas" alto>
      <Campo label="Data">
        <Input type="date" value={data} max={hoje()} onChange={e => setData(e.target.value)} />
      </Campo>
      {campo('peso', 'Peso (kg)', '75')}
      {campo('gorduraPct', 'Gordura corporal (%)', 'opcional')}

      <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2 mt-2">
        Medidas em cm (opcional)
      </p>
      <div className="grid grid-cols-2 gap-3">
        {campo('peito', 'Peito', '')}
        {campo('cintura', 'Cintura', '')}
        {campo('braco', 'Braco', '')}
        {campo('coxa', 'Coxa', '')}
        {campo('quadril', 'Quadril', '')}
      </div>

      <Btn variant="primary" size="lg" className="w-full mt-2" onClick={async () => {
        const g = await registrarCorpo(data, {
          peso: num(f.peso), gorduraPct: num(f.gorduraPct), cintura: num(f.cintura),
          braco: num(f.braco), peito: num(f.peito), coxa: num(f.coxa), quadril: num(f.quadril),
        })
        onSalvo(g)
        fechar()
      }}>Salvar</Btn>
    </Sheet>
  )
}
