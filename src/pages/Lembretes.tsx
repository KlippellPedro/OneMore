import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, hoje, isoDia } from '../db'
import { usePerfil, usePlanos } from '../state/hooks'
import {
  config, permissao, pedirPermissao, instalado,
  registrarSyncPeriodico, syncPeriodicoAtivo, salvarConfig, regerarAgenda, testar,
} from '../lib/lembretes'
import { Cabecalho } from '../components/Cabecalho'
import { Icone } from '../components/Icone'
import { Card, Btn, Chip, Switch, Input } from '../components/ui'
import { useUI, vibrar } from '../state/ui'
import { n1, diaCurto, horaDe } from '../lib/format'
import type { ConfigLembretes } from '../db/types'

const INTERVALOS = [
  { min: 60, rotulo: '1 em 1 h' },
  { min: 90, rotulo: '1h30' },
  { min: 120, rotulo: '2 em 2 h' },
  { min: 180, rotulo: '3 em 3 h' },
]

const ANTECEDENCIAS = [
  { min: 0, rotulo: 'Na hora' },
  { min: 10, rotulo: '10 min antes' },
  { min: 15, rotulo: '15 min antes' },
  { min: 30, rotulo: '30 min antes' },
]

export default function Lembretes() {
  const { toast } = useUI()
  const perfil = usePerfil()
  const planos = usePlanos()

  const [estado, setEstado] = useState(permissao())
  const [fechadoOk, setFechadoOk] = useState(false)
  const c = config(perfil)

  const agenda = useLiveQuery(async () => {
    const todos = await db.lembretes.toArray()
    return todos.filter(l => !l.disparadoEm && l.ts >= Date.now()).sort((a, b) => a.ts - b.ts).slice(0, 6)
  }, [], []) ?? []

  useEffect(() => {
    syncPeriodicoAtivo().then(setFechadoOk)
  }, [estado])

  async function mudar(patch: Partial<ConfigLembretes>) {
    await salvarConfig(patch)
    vibrar()
  }

  async function ativar() {
    const r = await pedirPermissao()
    setEstado(r)
    if (r === 'granted') {
      await salvarConfig({ ativo: true })
      setFechadoOk(await registrarSyncPeriodico())
      toast('Notificações ligadas', 'ok')
    } else if (r === 'denied') {
      toast('O celular bloqueou as notificacoes', 'erro')
    }
  }

  const podeUsar = estado === 'granted'

  return (
    <div>
      <Cabecalho titulo="Lembretes" voltarPara="/perfil"
        sub={perfil.diabetesTipo1
          ? 'Avisos de água, refeição, treino e glicemia'
          : 'Avisos de água, refeição e treino'} />

      <div className="px-4 pt-4">
        {/* -------- permissao -------- */}
        {estado === 'indisponivel' ? (
          <Card className="p-4 mb-4 border-warn/30">
            <p className="text-[13px] font-bold mb-1">Esse navegador não manda notificacao</p>
            <p className="text-[12px] text-muted leading-relaxed">
              Abra o OneMore no Chrome do Android pra usar os lembretes.
            </p>
          </Card>
        ) : !podeUsar ? (
          <Card className="p-4 mb-4 border-accent/30">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 shrink-0 rounded-xl grad-accent flex items-center justify-center text-white">
                <Icone nome="alerta" tamanho={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold">
                  {estado === 'denied' ? 'Notificações bloqueadas' : 'Ligar as notificacoes'}
                </p>
                <p className="text-[12px] text-muted leading-relaxed mt-1">
                  {estado === 'denied'
                    ? 'Você negou antes. Libere em Configurações do site > Notificações, no menu do navegador, e volte aqui.'
                    : 'O celular vai pedir sua autorizacao. Sem ela o app não consegue avisar nada.'}
                </p>
                {estado !== 'denied' && (
                  <Btn variant="primary" size="sm" className="mt-3" onClick={ativar}>Ativar</Btn>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4 mb-4 border-good/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 shrink-0 rounded-full bg-good/15 text-good flex items-center justify-center">
                <Icone nome="check" tamanho={18} traco={2.6} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-bold">Notificações liberadas</p>
                <p className="text-[11.5px] text-muted">
                  Com o app fechado: {fechadoOk ? 'ligado' : 'só com o app instalado'}
                </p>
              </div>
              <Btn size="sm" onClick={() => testar()}>Testar</Btn>
            </div>
          </Card>
        )}

        {/* -------- o que esperar de verdade -------- */}
        {podeUsar && (
          <Card className="p-4 mb-4">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">
              Como isso chega no celular
            </h2>
            <ul className="text-[12px] text-muted leading-relaxed space-y-1.5">
              <li>
                <span className="text-txt font-semibold">Com o app aberto</span>, o aviso sai
                no minuto certo.
              </li>
              <li>
                <span className="text-txt font-semibold">Com o app fechado</span>, quem decide a
                hora de acordar o OneMore e o Android - o aviso pode atrasar. Pra isso funcionar,
                o app precisa estar <span className="text-txt font-semibold">instalado na tela de
                início</span> (menu do Chrome {'>'} Instalar aplicativo).
                {!instalado() && (
                  <span className="text-warn"> Agora ele está aberto pelo navegador.</span>
                )}
              </li>
              <li>
                Aviso na hora exata com o app fechado só com um servidor de push - da pra fazer
                num segundo passo.
              </li>
            </ul>
          </Card>
        )}

        {/* -------- chave geral -------- */}
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold">Lembretes ligados</p>
              <p className="text-[11.5px] text-muted mt-0.5">
                Desliga tudo de uma vez sem perder os ajustes abaixo.
              </p>
            </div>
            <Switch ligado={c.ativo} rotulo="Lembretes ligados"
              onChange={v => mudar({ ativo: v })} />
          </div>
        </Card>

        <div className={c.ativo ? '' : 'opacity-50 pointer-events-none'}>
          {/* -------- agua -------- */}
          <Bloco icone="gota" titulo="Água"
            sub={`Meta de ${n1(perfil.metaAgua / 1000)} L por dia`}
            ligado={c.agua.ativo} onLigar={v => mudar({ agua: { ...c.agua, ativo: v } })}>
            <p className="text-[11px] font-semibold text-muted mb-1.5">De quanto em quanto tempo</p>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {INTERVALOS.map(i => (
                <Chip key={i.min} ativo={c.agua.intervaloMin === i.min}
                  onClick={() => mudar({ agua: { ...c.agua, intervaloMin: i.min } })}>
                  {i.rotulo}
                </Chip>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex-1">
                <span className="block text-[11px] font-semibold text-muted mb-1.5">Começa</span>
                <Input type="time" value={c.agua.inicio}
                  onChange={e => mudar({ agua: { ...c.agua, inicio: e.target.value } })} />
              </label>
              <label className="flex-1">
                <span className="block text-[11px] font-semibold text-muted mb-1.5">Para</span>
                <Input type="time" value={c.agua.fim}
                  onChange={e => mudar({ agua: { ...c.agua, fim: e.target.value } })} />
              </label>
            </div>
            <p className="text-[11px] text-muted mt-2.5 leading-relaxed">
              Se você já bateu a meta do dia, o aviso não sai. Quando sai, mostra quanto falta.
            </p>
          </Bloco>

          {/* -------- refeicoes -------- */}
          <Bloco icone="prato" titulo="Refeições"
            sub={planos.length
              ? `Nos horários do plano: ${planos.map(p => p.horario).join(', ')}`
              : 'Você ainda não tem plano alimentar'}
            ligado={c.refeicoes.ativo}
            onLigar={v => mudar({ refeicoes: { ...c.refeicoes, ativo: v } })}>
            <p className="text-[11px] font-semibold text-muted mb-1.5">Quando avisar</p>
            <div className="flex gap-1.5 flex-wrap">
              {ANTECEDENCIAS.map(a => (
                <Chip key={a.min} ativo={c.refeicoes.antecedenciaMin === a.min}
                  onClick={() => mudar({ refeicoes: { ...c.refeicoes, antecedenciaMin: a.min } })}>
                  {a.rotulo}
                </Chip>
              ))}
            </div>
            <p className="text-[11px] text-muted mt-2.5 leading-relaxed">
              Refeição que você já lancou no diário não gera aviso. Pra mudar os horários,
              edite o plano alimentar.
            </p>
          </Bloco>

          {/* -------- treino -------- */}
          <Bloco icone="halter" titulo="Treino"
            sub={c.treino.dias.length
              ? `${c.treino.dias.map(d => diaCurto(d)).join(', ')} as ${c.treino.horario}`
              : 'Nenhum dia escolhido'}
            ligado={c.treino.ativo} onLigar={v => mudar({ treino: { ...c.treino, ativo: v } })}>
            <p className="text-[11px] font-semibold text-muted mb-1.5">Dias</p>
            <div className="flex gap-1.5 mb-3">
              {[0, 1, 2, 3, 4, 5, 6].map(d => {
                const on = c.treino.dias.includes(d)
                return (
                  <button key={d}
                    onClick={() => mudar({
                      treino: {
                        ...c.treino,
                        dias: on ? c.treino.dias.filter(x => x !== d) : [...c.treino.dias, d].sort(),
                      },
                    })}
                    className={`flex-1 h-9 rounded-xl text-[12px] font-bold transition-colors ${
                      on ? 'grad-accent text-white' : 'bg-surface-2 border border-line text-muted'
                    }`}>
                    {diaCurto(d)[0]}
                  </button>
                )
              })}
            </div>
            <label className="block mb-3">
              <span className="block text-[11px] font-semibold text-muted mb-1.5">Horário do treino</span>
              <Input type="time" value={c.treino.horario}
                onChange={e => mudar({ treino: { ...c.treino, horario: e.target.value } })} />
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {ANTECEDENCIAS.map(a => (
                <Chip key={a.min} ativo={c.treino.antecedenciaMin === a.min}
                  onClick={() => mudar({ treino: { ...c.treino, antecedenciaMin: a.min } })}>
                  {a.rotulo}
                </Chip>
              ))}
            </div>
            <p className="text-[11px] text-muted mt-2.5 leading-relaxed">
              Se você já treinou naquele dia, o aviso não sai.
            </p>
          </Bloco>

          {/* -------- glicemia -------- */}
          {perfil.diabetesTipo1 && (
            <Bloco icone="sangue" titulo="Glicemia"
              sub={c.glicemia.horarios.length
                ? c.glicemia.horarios.join(', ')
                : 'Nenhum horário ainda'}
              ligado={c.glicemia.ativo}
              onLigar={v => mudar({ glicemia: { ...c.glicemia, ativo: v } })}>
              <p className="text-[11px] font-semibold text-muted mb-1.5">Horários pra medir</p>
              <div className="space-y-2">
                {c.glicemia.horarios.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input type="time" value={h} className="flex-1"
                      onChange={e => {
                        const horarios = [...c.glicemia.horarios]
                        horarios[i] = e.target.value
                        mudar({ glicemia: { ...c.glicemia, horarios: horarios.sort() } })
                      }} />
                    <button aria-label="Remover horário"
                      onClick={() => mudar({
                        glicemia: {
                          ...c.glicemia,
                          horarios: c.glicemia.horarios.filter((_, k) => k !== i),
                        },
                      })}
                      className="w-11 h-11 shrink-0 rounded-xl bg-surface-2 border border-line text-muted text-lg leading-none active:text-bad">
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <Btn size="sm" className="w-full mt-2"
                onClick={() => mudar({
                  glicemia: { ...c.glicemia, horarios: [...c.glicemia.horarios, '20:00'].sort() },
                })}>
                + Adicionar horário
              </Btn>
              <p className="text-[11px] text-muted mt-2.5 leading-relaxed">
                Se você já mediu perto daquele horário, o aviso não sai. O app só lembra -
                dose e com o seu medico.
              </p>
            </Bloco>
          )}
        </div>

        {/* -------- proximos -------- */}
        {podeUsar && c.ativo && (
          <>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2 px-1 mt-5">
              Próximos avisos
            </h2>
            <Card className="overflow-hidden mb-4">
              {agenda.length === 0 ? (
                <p className="px-4 py-4 text-[12.5px] text-muted text-center leading-relaxed">
                  Nada agendado pras proximas horas. Ligue pelo menos um lembrete acima.
                </p>
              ) : (
                agenda.map(l => (
                  <div key={l.id}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-line/40 last:border-0">
                    <span className="text-[12.5px] font-bold tabular-nums text-accent w-[68px] shrink-0">
                      {isoDia(new Date(l.ts)) === hoje() ? '' : `${diaCurto(new Date(l.ts).getDay())} `}
                      {horaDe(l.ts)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium truncate">{l.titulo}</span>
                      <span className="block text-[11px] text-muted truncate">{l.corpo}</span>
                    </span>
                  </div>
                ))
              )}
              <button onClick={async () => { await regerarAgenda(); toast('Agenda atualizada', 'ok') }}
                className="w-full h-10 text-[12.5px] font-semibold text-muted border-t border-line/40 active:bg-surface-2">
                Recalcular agenda
              </button>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

function Bloco({ icone, titulo, sub, ligado, onLigar, children }: {
  icone: string; titulo: string; sub: string
  ligado: boolean; onLigar: (v: boolean) => void; children: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden mb-3">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="w-9 h-9 shrink-0 rounded-xl bg-surface-2 flex items-center justify-center text-muted">
          <Icone nome={icone} tamanho={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold">{titulo}</p>
          <p className="text-[11.5px] text-muted truncate mt-0.5">{sub}</p>
        </div>
        <Switch ligado={ligado} onChange={onLigar} rotulo={titulo} />
      </div>
      {ligado && <div className="px-4 pb-4 pt-1 border-t border-line/40">{children}</div>}
    </Card>
  )
}
