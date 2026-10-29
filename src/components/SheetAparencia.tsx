import { useState } from 'react'
import { salvarPerfil } from '../db'
import { useRotinas } from '../state/hooks'
import { Sheet, Chip, Switch, Btn } from './ui'
import { Icone } from './Icone'
import {
  CORES_TEMA, TEMA_PADRAO, temaDe, corDoDia,
  type Tema, type ModoTema, type FundoTema,
} from '../lib/tema'
import { diaCurto, diaLongo } from '../lib/format'
import type { Perfil } from '../db/types'

const MODOS: { id: ModoTema; nome: string; desc: string }[] = [
  { id: 'fixa', nome: 'Fixa', desc: 'Uma cor só, todo dia.' },
  {
    id: 'treino', nome: 'Do treino do dia',
    desc: 'A cor da rotina marcada pra cada dia na Minha semana - e a do treino em andamento, se você começar outro. Em dia de descanso, vale a cor escolhida abaixo.',
  },
  { id: 'semana', nome: 'Uma por dia', desc: 'Toque num dia e escolha a cor dele.' },
]

const FUNDOS: { id: FundoTema; nome: string; desc: string }[] = [
  { id: 'tingido', nome: 'Tingido', desc: 'Fundo escuro puxado pra cor do tema.' },
  { id: 'neutro', nome: 'Neutro', desc: 'Fundo cinza escuro. A cor fica só nos destaques.' },
  { id: 'preto', nome: 'Preto', desc: 'Preto de verdade - em tela OLED, gasta menos bateria.' },
]

function Rotulo({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">{children}</h3>
}

export function SheetAparencia({ aberto, fechar, perfil }: { aberto: boolean; fechar: () => void; perfil: Perfil }) {
  const tema = temaDe(perfil.tema)
  const rotinas = useRotinas()
  const hoje = new Date().getDay()
  /** Dia sendo editado no modo "uma por dia". */
  const [diaSel, setDiaSel] = useState(hoje)

  // cada toque ja salva: o app inteiro muda na hora, e a previa e ele mesmo
  const salvar = (patch: Partial<Tema>) => salvarPerfil({ tema: { ...tema, ...patch } })

  const rotinaDo = (d: number) => rotinas.find(r => r.dias?.includes(d))
  const porDia = Array.from({ length: 7 }, (_, d) => corDoDia(tema, { dia: d, corRotinaDoDia: rotinaDo(d)?.cor }))

  /** A cor que as amostras editam agora. */
  const editando = (tema.modo === 'semana' ? tema.semana?.[diaSel] : null) ?? tema.cor
  function escolher(cor: string) {
    if (tema.modo !== 'semana') return salvar({ cor })
    const semana = Array.from({ length: 7 }, (_, i) => tema.semana?.[i] ?? null)
    semana[diaSel] = cor
    salvar({ semana })
  }
  const personalizada = !CORES_TEMA.includes(editando.toLowerCase())
  const rotinaHoje = rotinaDo(hoje)

  return (
    <Sheet aberto={aberto} fechar={fechar} titulo="Aparência" alto>
      <Rotulo>Cor do tema</Rotulo>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {MODOS.map(m => (
          <Chip key={m.id} ativo={tema.modo === m.id} onClick={() => salvar({ modo: m.id })}>{m.nome}</Chip>
        ))}
      </div>
      <p className="text-[12px] text-muted leading-relaxed mb-3">
        {MODOS.find(m => m.id === tema.modo)?.desc}
      </p>

      {tema.modo !== 'fixa' && (
        <div className="grid grid-cols-7 gap-1 mb-3">
          {porDia.map((cor, d) => {
            const sel = tema.modo === 'semana' && d === diaSel
            return (
              <button key={d} disabled={tema.modo !== 'semana'} onClick={() => setDiaSel(d)}
                aria-label={`${diaLongo(d)}${sel ? ', escolhendo a cor' : ''}`}
                className={`flex flex-col items-center gap-1.5 py-2 rounded-xl border transition-colors ${
                  sel ? 'border-txt/50 bg-surface-2' : 'border-transparent'
                }`}>
                <span className={`text-[10.5px] font-semibold ${d === hoje ? 'text-txt' : 'text-muted'}`}>
                  {d === hoje ? 'Hoje' : diaCurto(d)}
                </span>
                <span className="w-7 h-7 rounded-full" style={{ background: cor }} />
              </button>
            )
          })}
        </div>
      )}
      {tema.modo === 'treino' && (
        <p className="text-[12px] text-muted leading-relaxed mb-4">
          {rotinaHoje
            ? <>Hoje: <b className="text-txt">{rotinaHoje.nome}</b>. A cor de cada rotina muda no editor dela, em Treino.</>
            : 'Hoje é dia de descanso na Minha semana.'}
        </p>
      )}

      <p className="text-[12px] font-semibold mb-2">
        {tema.modo === 'fixa' ? 'Cor'
          : tema.modo === 'treino' ? 'Cor dos dias de descanso'
            : `Cor de ${diaLongo(diaSel).toLowerCase()}`}
      </p>
      <div className="flex flex-wrap gap-2.5 mb-6">
        {CORES_TEMA.map(c => (
          <button key={c} onClick={() => escolher(c)} aria-label={`Cor ${c}`} aria-pressed={editando.toLowerCase() === c}
            className={`w-10 h-10 rounded-full transition-transform active:scale-90 ${
              editando.toLowerCase() === c ? 'ring-2 ring-txt ring-offset-2 ring-offset-bg-soft' : ''
            }`}
            style={{ background: c }} />
        ))}
        {/* qualquer outra cor: o seletor nativo do sistema */}
        <label className={`relative w-10 h-10 rounded-full flex items-center justify-center overflow-hidden cursor-pointer ${
          personalizada ? 'ring-2 ring-txt ring-offset-2 ring-offset-bg-soft' : 'bg-surface-2 border border-line text-muted'
        }`} style={personalizada ? { background: editando } : undefined}>
          <input type="color" value={editando} onChange={e => escolher(e.target.value)}
            aria-label="Escolher outra cor" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          {!personalizada && <Icone nome="mais" tamanho={18} />}
        </label>
      </div>

      <Rotulo>Fundo</Rotulo>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {FUNDOS.map(f => (
          <Chip key={f.id} ativo={tema.fundo === f.id} onClick={() => salvar({ fundo: f.id })}>{f.nome}</Chip>
        ))}
      </div>
      <p className="text-[12px] text-muted leading-relaxed mb-6">
        {FUNDOS.find(f => f.id === tema.fundo)?.desc}
      </p>

      <Rotulo>Seções</Rotulo>
      <div className="flex items-start gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold">Cada seção com a sua cor</p>
          <p className="text-[12px] text-muted leading-relaxed mt-0.5">
            Dieta verde, Progresso dourado, Perfil azul. Desligado, o app inteiro fica na cor do tema.
          </p>
        </div>
        <Switch ligado={tema.secoesColoridas} rotulo="Cada seção com a sua cor"
          onChange={v => salvar({ secoesColoridas: v })} />
      </div>

      <Btn variant="ghost" className="w-full" onClick={() => salvarPerfil({ tema: TEMA_PADRAO })}>
        Voltar ao padrão
      </Btn>
    </Sheet>
  )
}
