import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useExercicios } from '../state/hooks'
import { alternativasDe, FAMILIAS } from '../db/variacoes'
import { nomeEquip, nomeGrupo } from '../db/seedExercicios'
import { imagemExercicio } from '../db/imagensExercicios'
import { Sheet, Btn, Card, Select } from './ui'
import { ImagemExercicio } from './ImagemExercicio'
import { Icone } from './Icone'
import type { Exercicio } from '../db/types'

interface Ultima { carga: number; reps: number }

/**
 * Ultima carga de cada exercicio da lista. E o que decide a troca na pratica:
 * "na maquina eu fiz 40 kg" responde na hora quanto botar no pino.
 */
function useUltimas(ids: string[]): Map<string, Ultima> {
  const chave = ids.join(',')
  return useLiveQuery(async () => {
    const linhas = await db.melhores.bulkGet(chave ? chave.split(',') : [])
    return new Map(linhas.filter(m => m != null).map(m => [m.exercicioId, { carga: m.ultimaCarga, reps: m.ultimaReps }]))
  }, [chave]) ?? new Map()
}

function textoUltima(u?: Ultima) {
  if (!u) return null
  return u.carga > 0 ? `última: ${u.carga} kg x ${u.reps}` : `última: ${u.reps} reps`
}

/** Miniatura, nome, aparelho e ultima carga - igual na troca e na ficha. */
function ConteudoLinha({ ex, ultima, marca }: { ex: Exercicio; ultima?: Ultima; marca?: ReactNode }) {
  return (
    <>
      {imagemExercicio(ex.id)
        ? <ImagemExercicio exercicioId={ex.id} tamanho="mini" animar={false} />
        : (
          <div className="w-16 h-16 shrink-0 rounded-xl bg-surface-2/60 flex items-center justify-center text-muted">
            <Icone nome="halter" tamanho={22} />
          </div>
        )}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold leading-tight">{ex.nome}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
          <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-surface-2 text-txt/80">
            {nomeEquip(ex.equipamento)}
          </span>
          {ultima && <span className="text-[11.5px] text-muted tabular-nums">{textoUltima(ultima)}</span>}
        </div>
      </div>
      {marca}
    </>
  )
}

const LINHA = 'w-full flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-line/60 text-left active:bg-surface-2'

/* ------------------------------------------------------------------ */
/* TROCA NO MEIO DO TREINO                                             */
/* ------------------------------------------------------------------ */

/**
 * O aparelho esta ocupado: mostra primeiro o MESMO movimento noutro aparelho,
 * depois o mesmo musculo. O catalogo inteiro fica a um toque, mas e o ultimo
 * recurso - no meio do descanso ninguem quer rolar 170 exercicios.
 */
export function TrocarExercicio({ exercicioId, fechar, onEscolher, verTodos, noTreino = [], nota }: {
  /** O que vai sair do treino. null = fechado. */
  exercicioId: string | null
  fechar: () => void
  onEscolher: (ex: Exercicio) => void
  /** Abre o catalogo inteiro, pra quando nada daqui serve. */
  verTodos: () => void
  /** Ja estao no treino de hoje: aparecem marcados, mas da pra escolher. */
  noTreino?: string[]
  /** O que acontece com as series ja marcadas - quem sabe e o treino. */
  nota?: string
}) {
  const todos = useExercicios()
  const atual = todos.find(e => e.id === exercicioId)
  const alt = useMemo(() => (atual ? alternativasDe(atual, todos) : null), [atual, todos])
  const ultimas = useUltimas(alt ? [...alt.variacoes, ...alt.mesmoMusculo].map(e => e.id) : [])

  const linha = (ex: Exercicio) => (
    <button key={ex.id} onClick={() => onEscolher(ex)} className={LINHA}>
      <ConteudoLinha ex={ex} ultima={ultimas.get(ex.id)} marca={noTreino.includes(ex.id) && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-good/15 text-good shrink-0">NO TREINO</span>
      )} />
    </button>
  )

  return (
    <Sheet aberto={!!exercicioId} fechar={fechar} titulo="Trocar exercício" alto>
      {atual && alt && (
        <>
          <p className="text-[12.5px] text-muted leading-relaxed mb-4">
            No lugar de <b className="text-txt">{atual.nome}</b>.{nota ? ` ${nota}` : ''}
          </p>

          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">
            {alt.familia ? `Mesmo movimento - ${alt.familia.nome}` : 'Mesmo movimento'}
          </h3>
          {alt.variacoes.length ? (
            <div className="space-y-1.5 mb-5">{alt.variacoes.map(linha)}</div>
          ) : (
            <p className="text-[12.5px] text-muted mb-5">
              Nenhuma variação cadastrada pra esse exercício.
              {atual.custom ? ' Dá pra escolher o movimento dele na ficha do exercício.' : ''}
            </p>
          )}

          {alt.mesmoMusculo.length > 0 && (
            <>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">
                Outros de {nomeGrupo(atual.grupo).toLowerCase()}
              </h3>
              <div className="space-y-1.5 mb-5">{alt.mesmoMusculo.map(linha)}</div>
            </>
          )}
        </>
      )}
      <Btn className="w-full" onClick={verTodos}>Ver todos os exercícios</Btn>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/* FICHA DO EXERCICIO                                                  */
/* ------------------------------------------------------------------ */

/** Escolha da familia de um exercicio criado pelo usuario. */
export function SelectFamilia({ valor, onChange }: {
  valor?: string
  onChange: (familia: string | undefined) => void
}) {
  const ordenadas = useMemo(() => [...FAMILIAS].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [])
  return (
    <Select value={valor ?? ''} onChange={e => onChange(e.target.value || undefined)}>
      <option value="">Nenhum</option>
      {ordenadas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
    </Select>
  )
}

/**
 * As variacoes na ficha do exercicio, pra conhecer antes de precisar: ver a
 * execucao do supino na maquina em casa, nao com a fila do banco do lado.
 */
export function CardVariacoes({ ex }: { ex: Exercicio }) {
  const todos = useExercicios()
  const { familia, variacoes } = useMemo(() => alternativasDe(ex, todos), [ex, todos])
  const ultimas = useUltimas(variacoes.map(v => v.id))

  // do catalogo e sem familia (ex.: cadeira extensora): nao ha o que mostrar
  if (!familia && !ex.custom) return null

  return (
    <Card className="p-4 mb-3">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1">
        Variações{familia ? ` - ${familia.nome}` : ''}
      </h2>
      <p className="text-[12px] text-muted leading-relaxed mb-3">
        O mesmo movimento em outro aparelho, pra quando o seu estiver ocupado.
      </p>

      {variacoes.length > 0 && (
        <div className="space-y-1.5">
          {variacoes.map(v => (
            <Link key={v.id} to={`/exercicios/${v.id}`} className={LINHA}>
              <ConteudoLinha ex={v} ultima={ultimas.get(v.id)} />
            </Link>
          ))}
        </div>
      )}

      {ex.custom && (
        <div className={variacoes.length ? 'mt-4' : ''}>
          <p className="text-[12px] font-semibold mb-1.5">
            {familia ? 'Movimento deste exercício' : 'Qual movimento este exercício faz?'}
          </p>
          <SelectFamilia valor={ex.familia}
            onChange={familia => db.exercicios.update(ex.id, { familia, atualizadoEm: Date.now() })} />
        </div>
      )}
    </Card>
  )
}
