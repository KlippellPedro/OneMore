import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PROGRAMAS, NIVEIS, type Programa } from '../db/programas'
import { useMapaExercicios, useRotinas } from '../state/hooks'
import { aplicarPrograma } from '../lib/acoes'
import { Cabecalho } from '../components/Cabecalho'
import { Card, Btn, Chip, Sheet, Confirmar } from '../components/ui'
import { useUI, vibrar } from '../state/ui'
import { diaCurto, pl } from '../lib/format'

export default function Programas() {
  const nav = useNavigate()
  const { toast } = useUI()
  const mapaEx = useMapaExercicios()
  const rotinas = useRotinas()
  const [filtro, setFiltro] = useState<number | 'todos'>('todos')
  const [detalhe, setDetalhe] = useState<Programa | null>(null)
  const [confirmar, setConfirmar] = useState<{ prog: Programa; substituir: boolean } | null>(null)

  const lista = PROGRAMAS.filter(p => filtro === 'todos' || p.dias === filtro)
  const diasDisponiveis = [...new Set(PROGRAMAS.map(p => p.dias))].sort()

  async function usar(prog: Programa, substituir: boolean) {
    vibrar(20)
    await aplicarPrograma(prog, { substituir })
    setConfirmar(null)
    setDetalhe(null)
    toast(`${prog.nome} aplicado`, 'ok', `${pl(prog.treinos.length, 'treino')} na sua lista`)
    nav('/treinos')
  }

  return (
    <div>
      <Cabecalho titulo="Programas de treino" voltarPara="/treinos"
        sub="Escolha um pronto e ele vira suas rotinas" />

      <div className="px-4 pt-3">
        <p className="text-[12.5px] text-muted leading-relaxed mb-4">
          São os splits mais usados e testados. Aplicar um programa cria as rotinas
          com os exercícios, séries e descanso já definidos - depois você edita o que quiser.
        </p>

        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-3">
          <Chip ativo={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos</Chip>
          {diasDisponiveis.map(d => (
            <Chip key={d} ativo={filtro === d} onClick={() => setFiltro(d)}>
              {d}x por semana
            </Chip>
          ))}
        </div>

        <div className="space-y-3 pb-6">
          {lista.map(p => {
            const nivel = NIVEIS[p.nivel]
            const totalSeries = p.treinos.reduce(
              (t, d) => t + d.itens.reduce((x, i) => x + i.series, 0), 0)
            return (
              <Card key={p.id} className="p-4" onClick={() => setDetalhe(p)}>
                <div className="flex items-start gap-3 mb-2.5">
                  <div className="w-11 h-11 shrink-0 rounded-xl grad-accent flex items-center justify-center">
                    <span className="text-white font-black text-[15px]">{p.dias}x</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[15px] leading-tight">{p.nome}</p>
                    {p.apelido && p.apelido !== p.nome && (
                      <p className="text-[11px] text-muted mt-0.5">{p.apelido}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-md"
                    style={{ background: nivel.cor + '22', color: nivel.cor }}>
                    {nivel.nome.toUpperCase()}
                  </span>
                </div>

                <p className="text-[12.5px] text-txt/80 leading-relaxed mb-3">{p.resumo}</p>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                  <span>{p.foco}</span>
                  <span>{pl(p.treinos.length, 'treino')}</span>
                  <span>{totalSeries} séries na semana</span>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* -------- detalhe do programa -------- */}
      <Sheet aberto={!!detalhe} fechar={() => setDetalhe(null)} titulo={detalhe?.nome} alto>
        {detalhe && (
          <>
            <div className="flex flex-wrap gap-1.5 mb-4">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                style={{ background: NIVEIS[detalhe.nivel].cor + '22', color: NIVEIS[detalhe.nivel].cor }}>
                {NIVEIS[detalhe.nivel].nome}
              </span>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-surface-2 text-muted">
                {detalhe.dias}x por semana
              </span>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-surface-2 text-muted">
                {detalhe.foco}
              </span>
            </div>

            <Card className="p-4 mb-3">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-accent mb-2">
                Por que funciona
              </h3>
              <p className="text-[13px] leading-relaxed text-txt/85">{detalhe.porque}</p>
            </Card>

            {detalhe.cuidado && (
              <Card className="p-4 mb-3 border-warn/30">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-warn mb-2">
                  Antes de escolher
                </h3>
                <p className="text-[13px] leading-relaxed text-txt/85">{detalhe.cuidado}</p>
              </Card>
            )}

            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2 mt-5 px-1">
              Os treinos
            </h3>
            <div className="space-y-2 mb-5">
              {detalhe.treinos.map((t, i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-line/40">
                    <span className="w-1 h-8 rounded-full shrink-0" style={{ background: t.cor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-bold leading-tight">{t.nome}</p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {detalhe.sugestaoDias[i] != null ? diaCurto(detalhe.sugestaoDias[i]) + ' - ' : ''}
                        {pl(t.itens.length, 'exercício')}
                        {t.emCasa ? ' - em casa' : ''}
                      </p>
                    </div>
                  </div>
                  {t.descricao && (
                    <p className="text-[12px] text-muted leading-relaxed px-3.5 pt-2.5">{t.descricao}</p>
                  )}
                  <div className="px-3.5 py-2.5 space-y-1">
                    {t.itens.map((item, k) => (
                      <div key={k} className="flex items-baseline gap-2 text-[12.5px]">
                        <span className="flex-1 min-w-0 truncate text-txt/85">
                          {mapaEx.get(item.exercicioId)?.nome ?? item.exercicioId}
                        </span>
                        <span className="shrink-0 text-muted tabular-nums">
                          {item.series} x {item.repsAlvo}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>

            <div className="sticky bottom-0 -mx-5 px-5 py-3 bg-bg-soft border-t border-line">
              <Btn variant="primary" size="lg" className="w-full mb-2"
                onClick={() => setConfirmar({ prog: detalhe, substituir: rotinas.length > 0 })}>
                Usar esse programa
              </Btn>
              {rotinas.length > 0 && (
                <Btn className="w-full" onClick={() => setConfirmar({ prog: detalhe, substituir: false })}>
                  Adicionar sem tirar os meus
                </Btn>
              )}
            </div>
          </>
        )}
      </Sheet>

      <Confirmar
        aberto={!!confirmar}
        titulo={confirmar?.substituir ? 'Trocar seus treinos?' : 'Adicionar esses treinos?'}
        texto={confirmar?.substituir
          ? 'Suas rotinas atuais saem da lista, mas o histórico de treinos continua intacto - da pra recuperar depois.'
          : `${pl(confirmar?.prog.treinos.length ?? 0, 'treino')} entram na sua lista junto com os que você já tem.`}
        onNao={() => setConfirmar(null)}
        onSim={() => confirmar && usar(confirmar.prog, confirmar.substituir)} />
    </div>
  )
}
