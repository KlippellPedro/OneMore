import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { db } from '../db'
import { useAlimentos } from '../state/hooks'
import { CATEGORIAS_ALIMENTO } from '../db/seedAlimentos'
import { macrosDe, paraGramas } from '../lib/nutricao'
import { Sheet, Input, Chip, Btn, Campo, Stepper, useAutoFoco } from './ui'
import { BotaoFavorito } from './Icone'
import { normalizar } from './SeletorExercicio'
import { n0, n1 } from '../lib/format'
import type { Alimento } from '../db/types'

/** Passo 1: achar o alimento. */
export function SeletorAlimento({ aberto, fechar, onEscolher, titulo = 'Adicionar alimento' }: {
  aberto: boolean; fechar: () => void; onEscolher: (a: Alimento) => void; titulo?: string
}) {
  const todos = useAlimentos()
  const [busca, setBusca] = useState('')
  const [cat, setCat] = useState<string>('todos')
  const ref = useAutoFoco<HTMLInputElement>(aberto)

  const lista = useMemo(() => {
    const q = normalizar(busca.trim())
    return todos
      .filter(a => {
        if (cat === 'favoritos' && !a.favorito) return false
        if (cat !== 'todos' && cat !== 'favoritos' && a.categoria !== cat) return false
        if (!q) return true
        return normalizar(a.nome).includes(q) || normalizar(a.marca ?? '').includes(q)
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 120)
  }, [todos, busca, cat])

  return (
    <Sheet aberto={aberto} fechar={fechar} titulo={titulo} alto>
      <div className="sticky -top-4 -mx-5 px-5 pt-1 pb-3 bg-bg-soft z-10">
        <Input ref={ref} value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar alimento..." className="mb-3" />
        <div className="flex gap-1.5 overflow-x-auto -mx-5 px-5 pb-1">
          <Chip ativo={cat === 'todos'} onClick={() => setCat('todos')}>Todos</Chip>
          <Chip ativo={cat === 'favoritos'} onClick={() => setCat('favoritos')}>Favoritos</Chip>
          {CATEGORIAS_ALIMENTO.map(c => (
            <Chip key={c} ativo={cat === c} onClick={() => setCat(c)}>{c}</Chip>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="text-center text-[13px] text-muted py-10">
          Nada encontrado. Cadastre em Perfil {'>'} Alimentos.
        </p>
      ) : (
        <div className="space-y-1.5">
          {lista.map(a => (
            <div key={a.id} className="flex items-center gap-2">
              <button onClick={() => onEscolher(a)}
                className="flex-1 min-w-0 flex items-center gap-3 p-3 rounded-xl bg-surface border border-line/60 text-left active:bg-surface-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">{a.nome}</p>
                  <p className="text-[11px] text-muted truncate">
                    {n0(a.kcal)} kcal - P {n1(a.prot)} - C {n1(a.carb)} - G {n1(a.gord)} / 100 {a.unidadeBase}
                  </p>
                </div>
              </button>
              <BotaoFavorito ativo={a.favorito} className="w-9 h-9 rounded-xl"
                onClick={() => db.alimentos.update(a.id, { favorito: !a.favorito })} />
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}

/** Passo 2: dizer quanto. */
export function SheetQuantidade({ alimento, fechar, onConfirmar, qtdInicial, medidaInicial, textoBotao = 'Adicionar', onRemover, textoRemover = 'Remover', extra }: {
  alimento: Alimento | null
  fechar: () => void
  onConfirmar: (qtd: number, medida: string) => void
  qtdInicial?: number
  medidaInicial?: string
  textoBotao?: string
  /** Quando existe, a sheet ganha a acao de tirar o item de onde ele esta. */
  onRemover?: () => void
  textoRemover?: string
  /** Acao extra acima dos botoes - usada pra abrir os equivalentes. */
  extra?: ReactNode
}) {
  const [qtd, setQtd] = useState(100)
  const [medida, setMedida] = useState('g')

  useEffect(() => {
    if (!alimento) return
    if (medidaInicial) { setMedida(medidaInicial); setQtd(qtdInicial ?? 1); return }
    // abre ja na medida caseira mais util, se existir
    const primeira = alimento.medidas[0]
    if (primeira) { setMedida(primeira.nome); setQtd(1) }
    else { setMedida(alimento.unidadeBase); setQtd(100) }
  }, [alimento?.id])

  if (!alimento) return null

  const gramas = paraGramas(alimento, qtd, medida)
  const m = macrosDe(alimento, gramas)
  const emGramas = medida === 'g' || medida === 'ml'

  return (
    <Sheet aberto fechar={fechar} titulo={alimento.nome}>
      <Campo label="Medida">
        <div className="flex gap-1.5 flex-wrap">
          <Chip ativo={emGramas} onClick={() => { setMedida(alimento.unidadeBase); setQtd(100) }}>
            {alimento.unidadeBase}
          </Chip>
          {alimento.medidas.map(md => (
            <Chip key={md.nome} ativo={medida === md.nome}
              onClick={() => { setMedida(md.nome); setQtd(1) }}>
              {md.nome}
            </Chip>
          ))}
        </div>
      </Campo>

      <Campo label="Quantidade" hint={emGramas ? undefined : `${n0(gramas)} ${alimento.unidadeBase} no total`}>
        <Stepper valor={qtd} setValor={setQtd} largo
          passo={emGramas ? 10 : 0.5} max={5000}
          sufixo={emGramas ? alimento.unidadeBase : undefined} />
        {emGramas && (
          <div className="flex gap-1.5 flex-wrap mt-2">
            {[30, 50, 100, 150, 200, 250].map(v => (
              <Chip key={v} ativo={qtd === v} onClick={() => setQtd(v)}>{v}{alimento.unidadeBase}</Chip>
            ))}
          </div>
        )}
      </Campo>

      <div className="grid grid-cols-4 gap-2 my-4">
        <Bloco rotulo="kcal" valor={n0(m.kcal)} destaque />
        <Bloco rotulo="Prot" valor={n1(m.prot) + 'g'} />
        <Bloco rotulo="Carb" valor={n1(m.carb) + 'g'} />
        <Bloco rotulo="Gord" valor={n1(m.gord) + 'g'} />
      </div>

      {extra}

      <div className="flex gap-2">
        {onRemover && (
          <Btn variant="danger" size="lg" className="shrink-0 px-4"
            onClick={() => { onRemover(); fechar() }}>
            {textoRemover}
          </Btn>
        )}
        <Btn variant="primary" size="lg" className="flex-1"
          onClick={() => { onConfirmar(qtd, medida); fechar() }} disabled={qtd <= 0}>
          {textoBotao}
        </Btn>
      </div>
    </Sheet>
  )
}

function Bloco({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl bg-surface border border-line/60 p-2.5 text-center">
      <p className="text-[9.5px] uppercase tracking-wider text-muted font-semibold">{rotulo}</p>
      <p className={`text-[15px] font-black tabular-nums mt-0.5 ${destaque ? 'text-accent' : ''}`}>{valor}</p>
    </div>
  )
}
