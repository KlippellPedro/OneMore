import { useEffect, useState } from 'react'
import { registrarGlicemia, classificarGlicemia, FAIXA_ALVO } from '../lib/acoes'
import { useUI, vibrar } from '../state/ui'
import { Sheet, Campo, Input, Btn, Chip, Card } from './ui'
import { n0, horaDe } from '../lib/format'
import type { MomentoGlicemia, RegistroGlicemia } from '../db/types'

export const MOMENTOS: { id: MomentoGlicemia; nome: string }[] = [
  { id: 'jejum', nome: 'Jejum' },
  { id: 'antes-refeicao', nome: 'Antes de comer' },
  { id: 'depois-refeicao', nome: 'Depois de comer' },
  { id: 'pre-treino', nome: 'Pre-treino' },
  { id: 'durante-treino', nome: 'Durante o treino' },
  { id: 'pos-treino', nome: 'Pos-treino' },
  { id: 'antes-dormir', nome: 'Antes de dormir' },
  { id: 'madrugada', nome: 'Madrugada' },
  { id: 'hipo', nome: 'Hipo' },
  { id: 'outro', nome: 'Outro' },
]

export const nomeMomento = (m: MomentoGlicemia) =>
  MOMENTOS.find(x => x.id === m)?.nome ?? m

/**
 * Formulario de glicemia. O app anota o que aconteceu - valor, contexto e,
 * se voce quiser, a insulina que aplicou. Ele nao sugere dose nenhuma.
 */
export function SheetGlicemia({ aberto, fechar, momentoInicial, carboSugerido }: {
  aberto: boolean
  fechar: () => void
  momentoInicial?: MomentoGlicemia
  /** Carbo da refeicao que originou o registro, so pra ja vir preenchido. */
  carboSugerido?: number
}) {
  const { celebrar, toast } = useUI()
  const [valor, setValor] = useState('')
  const [momento, setMomento] = useState<MomentoGlicemia>('antes-refeicao')
  const [unidades, setUnidades] = useState('')
  const [tipo, setTipo] = useState<'rapida' | 'basal'>('rapida')
  const [carbo, setCarbo] = useState('')
  const [obs, setObs] = useState('')

  useEffect(() => {
    if (!aberto) return
    setValor(''); setUnidades(''); setObs('')
    setMomento(momentoInicial ?? sugerirMomento())
    setCarbo(carboSugerido ? String(Math.round(carboSugerido)) : '')
  }, [aberto])

  const num = Number(valor)
  const cls = num > 0 ? classificarGlicemia(num) : null

  async function salvar() {
    if (!(num > 0)) return toast('Digite o valor da glicemia', 'erro')
    vibrar()
    const g = await registrarGlicemia({
      valor: num,
      momento,
      insulinaUnidades: unidades.trim() ? Number(unidades) : undefined,
      insulinaTipo: unidades.trim() ? tipo : undefined,
      carboG: carbo.trim() ? Number(carbo) : undefined,
      obs: obs.trim() || undefined,
    })
    if (g) celebrar(g)
    else toast('Glicemia registrada', 'ok')
    fechar()
  }

  return (
    <Sheet aberto={aberto} fechar={fechar} titulo="Registrar glicemia" alto>
      <Campo label="Glicemia (mg/dL)">
        <Input type="number" inputMode="numeric" value={valor} autoFocus
          placeholder="110" className="h-14 text-2xl font-black text-center"
          onChange={e => setValor(e.target.value)} />
      </Campo>

      {cls && (
        <div className="flex items-center gap-2 mb-4 -mt-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: cls.cor }} />
          <span className="text-[13px] font-bold" style={{ color: cls.cor }}>{cls.rotulo}</span>
          <span className="text-[11.5px] text-muted">
            faixa de referencia {FAIXA_ALVO.min}-{FAIXA_ALVO.max}
          </span>
        </div>
      )}

      <Campo label="Momento">
        <div className="flex gap-1.5 flex-wrap">
          {MOMENTOS.map(m => (
            <Chip key={m.id} ativo={momento === m.id} onClick={() => setMomento(m.id)}>
              {m.nome}
            </Chip>
          ))}
        </div>
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Insulina (unidades)">
          <Input type="number" inputMode="decimal" value={unidades} placeholder="opcional"
            onChange={e => setUnidades(e.target.value)} />
        </Campo>
        <Campo label="Carboidrato (g)">
          <Input type="number" inputMode="numeric" value={carbo} placeholder="opcional"
            onChange={e => setCarbo(e.target.value)} />
        </Campo>
      </div>

      {unidades.trim() !== '' && (
        <Campo label="Tipo de insulina">
          <div className="flex gap-1.5">
            <Chip ativo={tipo === 'rapida'} onClick={() => setTipo('rapida')}>Rapida / bolus</Chip>
            <Chip ativo={tipo === 'basal'} onClick={() => setTipo('basal')}>Basal / lenta</Chip>
          </div>
        </Campo>
      )}

      <Campo label="Observação">
        <Input value={obs} onChange={e => setObs(e.target.value)}
          placeholder="Ex: cai depois do treino de perna" />
      </Campo>

      <Card className="p-3 mb-4">
        <p className="text-[11.5px] text-muted leading-relaxed">
          O app só anota e mostra o histórico. Dose de insulina, razao e correcao
          sao com você e seu endocrinologista.
        </p>
      </Card>

      <Btn variant="primary" size="lg" className="w-full" onClick={salvar}>Salvar</Btn>
    </Sheet>
  )
}

/** Chuta o contexto pelo horario, so pra economizar um toque. */
function sugerirMomento(): MomentoGlicemia {
  const h = new Date().getHours()
  if (h < 6) return 'madrugada'
  if (h < 9) return 'jejum'
  if (h >= 22) return 'antes-dormir'
  return 'antes-refeicao'
}

/** Linha de um registro, usada no diario e no historico. */
export function LinhaGlicemia({ r, onClick }: { r: RegistroGlicemia; onClick?: () => void }) {
  const cls = classificarGlicemia(r.valor)
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 border-b border-line/40 last:border-0 text-left active:bg-surface-2">
      <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: cls.cor }} />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold tabular-nums">
          {n0(r.valor)} <span className="text-[10px] text-muted font-medium">mg/dL</span>
        </p>
        <p className="text-[11px] text-muted truncate">
          {horaDe(r.ts)} - {nomeMomento(r.momento)}
          {r.insulinaUnidades ? ` - ${r.insulinaUnidades}u ${r.insulinaTipo === 'basal' ? 'basal' : 'rapida'}` : ''}
          {r.carboG ? ` - ${n0(r.carboG)} g carbo` : ''}
        </p>
        {r.obs && <p className="text-[11px] text-muted/80 italic truncate">{r.obs}</p>}
      </div>
      <span className="text-[10.5px] font-bold shrink-0" style={{ color: cls.cor }}>{cls.rotulo}</span>
    </button>
  )
}
