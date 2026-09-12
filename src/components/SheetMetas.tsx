import { useEffect, useState } from 'react'
import { salvarPerfil } from '../db'
import { sugerirMetas } from '../lib/nutricao'
import { Card, Btn, Sheet, Campo, Input } from './ui'
import { Icone } from './Icone'
import { useUI } from '../state/ui'
import { n0 } from '../lib/format'
import type { Perfil } from '../db/types'

const OBJETIVOS = [
  { v: 'cutting', nome: 'Perder gordura', desc: '20% abaixo do gasto' },
  { v: 'manutencao', nome: 'Manter', desc: 'No gasto diário' },
  { v: 'bulking', nome: 'Ganhar massa', desc: '12% acima do gasto' },
] as const

/**
 * Editor das metas do dia (objetivo, calorias, macros e agua). Fica aqui, e nao
 * dentro do Perfil, porque tambem se edita direto das telas de dieta - e onde
 * bate a vontade de mexer no numero.
 */
export function SheetMetas({ aberto, fechar, perfil }: {
  aberto: boolean; fechar: () => void; perfil: Perfil
}) {
  const { toast } = useUI()
  const [f, setF] = useState(perfil)
  useEffect(() => { if (aberto) setF(perfil) }, [aberto])

  const sugestao = sugerirMetas(f)
  const kcalDosMacros = f.metaProt * 4 + f.metaCarb * 4 + f.metaGord * 9

  return (
    <Sheet aberto={aberto} fechar={fechar} titulo="Metas de dieta" alto>
      <Campo label="Objetivo">
        <div className="space-y-1.5">
          {OBJETIVOS.map(o => (
            <button key={o.v} onClick={() => setF(v => ({ ...v, objetivo: o.v }))}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left ${
                f.objetivo === o.v ? 'border-accent bg-accent/10' : 'border-line bg-surface'
              }`}>
              <div className="flex-1">
                <p className="text-[13.5px] font-semibold">{o.nome}</p>
                <p className="text-[11.5px] text-muted">{o.desc}</p>
              </div>
              {f.objetivo === o.v && <Icone nome="check" tamanho={17} traco={2.4} className="text-accent shrink-0" />}
            </button>
          ))}
        </div>
      </Campo>

      <Card className="p-3.5 mb-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">Sugestão do app</p>
        <p className="text-[12.5px] text-muted leading-relaxed mb-3">
          Gasto {n0(sugestao.gasto)} kcal → meta <b className="text-txt">{n0(sugestao.kcal)} kcal</b>,
          P {n0(sugestao.prot)}g - C {n0(sugestao.carb)}g - G {n0(sugestao.gord)}g
        </p>
        <Btn size="sm" onClick={() => setF(v => ({
          ...v, metaKcal: sugestao.kcal, metaProt: sugestao.prot,
          metaCarb: sugestao.carb, metaGord: sugestao.gord,
        }))}>Usar essa sugestão</Btn>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Calorias (kcal)">
          <Input type="number" inputMode="numeric" value={f.metaKcal || ''}
            onChange={e => setF(v => ({ ...v, metaKcal: Number(e.target.value || 0) }))} />
        </Campo>
        <Campo label="Proteína (g)">
          <Input type="number" inputMode="numeric" value={f.metaProt || ''}
            onChange={e => setF(v => ({ ...v, metaProt: Number(e.target.value || 0) }))} />
        </Campo>
        <Campo label="Carboidrato (g)">
          <Input type="number" inputMode="numeric" value={f.metaCarb || ''}
            onChange={e => setF(v => ({ ...v, metaCarb: Number(e.target.value || 0) }))} />
        </Campo>
        <Campo label="Gordura (g)">
          <Input type="number" inputMode="numeric" value={f.metaGord || ''}
            onChange={e => setF(v => ({ ...v, metaGord: Number(e.target.value || 0) }))} />
        </Campo>
      </div>

      {Math.abs(kcalDosMacros - f.metaKcal) > 60 && (
        <Card className="p-3 mb-4 border-warn/30">
          <p className="text-[12px] text-warn leading-relaxed">
            Seus macros somam {n0(kcalDosMacros)} kcal, mas a meta está em {n0(f.metaKcal)} kcal.
          </p>
        </Card>
      )}

      <Campo label="Meta de água (ml)">
        <Input type="number" inputMode="numeric" value={f.metaAgua || ''}
          onChange={e => setF(v => ({ ...v, metaAgua: Number(e.target.value || 0) }))} />
      </Campo>

      <Btn variant="primary" size="lg" className="w-full" onClick={async () => {
        await salvarPerfil({
          objetivo: f.objetivo, metaKcal: f.metaKcal, metaProt: f.metaProt,
          metaCarb: f.metaCarb, metaGord: f.metaGord, metaAgua: f.metaAgua,
        })
        toast('Metas salvas', 'ok'); fechar()
      }}>Salvar metas</Btn>
    </Sheet>
  )
}
