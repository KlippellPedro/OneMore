import { useMemo, useState } from 'react'
import { db, uid, apagarLinha } from '../db'
import { restricoesDoPerfil, conflitos, textoConflito } from '../lib/restricoes'
import { useAlimentos, usePerfil } from '../state/hooks'
import { CATEGORIAS_ALIMENTO } from '../db/seedAlimentos'
import { normalizar } from '../components/SeletorExercicio'
import { Cabecalho } from '../components/Cabecalho'
import { Btn, Input, Chip, Sheet, Campo, Select, Confirmar, Card } from '../components/ui'
import { BotaoFavorito, Icone } from '../components/Icone'
import { useUI } from '../state/ui'
import { n0, n1 } from '../lib/format'
import type { Alimento, Medida } from '../db/types'

export default function Alimentos() {
  const todos = useAlimentos()
  const evitar = restricoesDoPerfil(usePerfil())
  const { toast } = useUI()
  const [busca, setBusca] = useState('')
  const [cat, setCat] = useState('todos')
  const [editar, setEditar] = useState<Alimento | 'novo' | null>(null)
  const [apagar, setApagar] = useState<string | null>(null)

  const lista = useMemo(() => {
    const q = normalizar(busca.trim())
    return todos
      .filter(a => {
        if (cat === 'favoritos' && !a.favorito) return false
        if (cat === 'meus' && !a.custom) return false
        if (cat !== 'todos' && cat !== 'favoritos' && cat !== 'meus' && a.categoria !== cat) return false
        if (!q) return true
        return normalizar(a.nome).includes(q)
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [todos, busca, cat])

  return (
    <div>
      <Cabecalho titulo="Alimentos" sub={`${todos.length} cadastrados`} voltarPara="/dieta"
        acao={<Btn size="sm" variant="primary" onClick={() => setEditar('novo')}>+ Criar</Btn>} />

      <div className="px-4 pt-3">
        <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." className="mb-3" />
        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-3">
          <Chip ativo={cat === 'todos'} onClick={() => setCat('todos')}>Todos</Chip>
          <Chip ativo={cat === 'favoritos'} onClick={() => setCat('favoritos')}>Favoritos</Chip>
          <Chip ativo={cat === 'meus'} onClick={() => setCat('meus')}>Meus</Chip>
          {CATEGORIAS_ALIMENTO.map(c => (
            <Chip key={c} ativo={cat === c} onClick={() => setCat(c)}>{c}</Chip>
          ))}
        </div>

        <p className="text-[11.5px] text-muted mb-3 px-1">
          Valores por 100 g (ou 100 ml). Toque para editar ou ver as medidas caseiras.
        </p>

        <div className="space-y-1.5 pb-4">
          {lista.map(a => (
            <div key={a.id} className="flex items-center gap-2">
              <button onClick={() => setEditar(a)}
                className="flex-1 min-w-0 flex items-center gap-3 p-3 rounded-xl bg-surface border border-line/60 text-left active:bg-surface-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">
                    {a.nome}
                    {a.custom && <span className="text-[10px] text-accent font-bold ml-1.5">MEU</span>}
                  </p>
                  <p className="text-[11px] text-muted truncate">
                    {n0(a.kcal)} kcal - P {n1(a.prot)} C {n1(a.carb)} G {n1(a.gord)}
                  </p>
                  {(() => {
                    const bate = conflitos(a.id, evitar)
                    if (!bate.length) return null
                    return (
                      <p className="text-[10.5px] font-semibold text-warn mt-0.5 truncate">
                        {textoConflito(bate)}
                      </p>
                    )
                  })()}
                </div>
              </button>
              <BotaoFavorito ativo={a.favorito} className="toque w-10 h-10 rounded-xl"
                onClick={() => db.alimentos.update(a.id, { favorito: !a.favorito })} />
            </div>
          ))}
          {lista.length === 0 && (
            <p className="text-center text-[13px] text-muted py-10">Nada encontrado.</p>
          )}
        </div>
      </div>

      <EditorAlimento alvo={editar} fechar={() => setEditar(null)}
        onApagar={id => { setEditar(null); setApagar(id) }}
        onSalvo={n => toast(`${n} salvo`, 'ok')} />

      <Confirmar aberto={!!apagar} perigo titulo="Apagar alimento?"
        texto="Registros ja feitos no diario ficam sem nome."
        onNao={() => setApagar(null)}
        onSim={async () => { await apagarLinha('alimentos', apagar!); setApagar(null) }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function EditorAlimento({ alvo, fechar, onSalvo, onApagar }: {
  alvo: Alimento | 'novo' | null
  fechar: () => void
  onSalvo: (nome: string) => void
  onApagar: (id: string) => void
}) {
  const { toast } = useUI()
  const novo = alvo === 'novo'
  const base = novo || !alvo ? null : alvo

  const [f, setF] = useState({
    nome: '', categoria: 'Proteinas', kcal: 0, prot: 0, carb: 0, gord: 0, fibra: 0,
    unidadeBase: 'g' as 'g' | 'ml',
  })
  const [medidas, setMedidas] = useState<Medida[]>([])
  const [chaveAberta, setChaveAberta] = useState<string | null>(null)

  // recarrega o formulario quando muda o alvo
  const chave = novo ? 'novo' : base?.id ?? ''
  if (chave !== chaveAberta) {
    setChaveAberta(chave)
    if (base) {
      setF({
        nome: base.nome, categoria: base.categoria, kcal: base.kcal, prot: base.prot,
        carb: base.carb, gord: base.gord, fibra: base.fibra ?? 0, unidadeBase: base.unidadeBase,
      })
      setMedidas(base.medidas)
    } else {
      setF({ nome: '', categoria: 'Proteinas', kcal: 0, prot: 0, carb: 0, gord: 0, fibra: 0, unidadeBase: 'g' })
      setMedidas([])
    }
  }

  if (!alvo) return null

  const kcalCalculada = f.prot * 4 + f.carb * 4 + f.gord * 9
  const divergencia = f.kcal > 0 && Math.abs(kcalCalculada - f.kcal) > Math.max(25, f.kcal * 0.15)

  async function salvar() {
    if (!f.nome.trim()) return toast('Da um nome pro alimento', 'erro')
    const id = base?.id ?? 'usr_' + uid()
    await db.alimentos.put({
      id,
      nome: f.nome.trim(),
      categoria: f.categoria,
      kcal: f.kcal || Math.round(kcalCalculada),
      prot: f.prot, carb: f.carb, gord: f.gord, fibra: f.fibra || undefined,
      unidadeBase: f.unidadeBase,
      medidas: medidas.filter(m => m.nome.trim() && m.gramas > 0),
      custom: base?.custom ?? true,
      favorito: base?.favorito,
      atualizadoEm: Date.now(),
    })
    onSalvo(f.nome.trim())
    fechar()
  }

  const num = (k: keyof typeof f) => ({
    type: 'number' as const, inputMode: 'decimal' as const,
    value: (f[k] as number) === 0 ? '' : String(f[k]),
    placeholder: '0',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setF(v => ({ ...v, [k]: Number(e.target.value || 0) })),
  })

  return (
    <Sheet aberto fechar={fechar} titulo={novo ? 'Novo alimento' : f.nome} alto>
      <Campo label="Nome">
        <Input value={f.nome} onChange={e => setF(v => ({ ...v, nome: e.target.value }))} autoFocus={novo} />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Categoria">
          <Select value={f.categoria} onChange={e => setF(v => ({ ...v, categoria: e.target.value }))}>
            {CATEGORIAS_ALIMENTO.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Campo>
        <Campo label="Base">
          <Select value={f.unidadeBase}
            onChange={e => setF(v => ({ ...v, unidadeBase: e.target.value as 'g' | 'ml' }))}>
            <option value="g">por 100 g</option>
            <option value="ml">por 100 ml</option>
          </Select>
        </Campo>
      </div>

      <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2 mt-1">
        Por 100 {f.unidadeBase}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Calorias (kcal)"><Input {...num('kcal')} /></Campo>
        <Campo label="Proteina (g)"><Input {...num('prot')} /></Campo>
        <Campo label="Carboidrato (g)"><Input {...num('carb')} /></Campo>
        <Campo label="Gordura (g)"><Input {...num('gord')} /></Campo>
        <Campo label="Fibra (g)"><Input {...num('fibra')} /></Campo>
      </div>

      {divergencia && (
        <Card className="p-3 mb-4 border-warn/30">
          <p className="text-[12px] text-warn leading-relaxed">
            Pelos macros, deveria dar ~{n0(kcalCalculada)} kcal. Confira o rotulo.
          </p>
        </Card>
      )}
      {f.kcal === 0 && kcalCalculada > 0 && (
        <p className="text-[11.5px] text-muted mb-4">
          Deixe as calorias em 0 e eu calculo pelos macros ({n0(kcalCalculada)} kcal).
        </p>
      )}

      {/* -------- medidas caseiras -------- */}
      <div className="flex items-center justify-between mb-2 mt-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted">Medidas caseiras</p>
        <button onClick={() => setMedidas(m => [...m, { nome: '', gramas: 0 }])}
          className="toque text-[12px] font-semibold text-accent">+ Adicionar</button>
      </div>
      <p className="text-[11px] text-muted mb-3 leading-relaxed">
        Ex: "colher de sopa" = 25 g. Assim voce registra sem pesar tudo.
      </p>

      <div className="space-y-2 mb-4">
        {medidas.map((m, i) => (
          <div key={i} className="flex gap-2">
            <Input className="flex-1" value={m.nome} placeholder="colher de sopa"
              onChange={e => setMedidas(v => v.map((x, k) => k === i ? { ...x, nome: e.target.value } : x))} />
            <Input className="w-24" type="number" inputMode="decimal"
              value={m.gramas === 0 ? '' : m.gramas} placeholder={f.unidadeBase}
              onChange={e => setMedidas(v => v.map((x, k) => k === i ? { ...x, gramas: Number(e.target.value || 0) } : x))} />
            <button onClick={() => setMedidas(v => v.filter((_, k) => k !== i))}
              aria-label="Remover medida"
              className="w-11 h-11 shrink-0 flex items-center justify-center text-muted active:text-bad">
              <Icone nome="lixeira" tamanho={16} />
            </button>
          </div>
        ))}
        {medidas.length === 0 && (
          <p className="text-[12px] text-muted/70 text-center py-3">Nenhuma medida cadastrada.</p>
        )}
      </div>

      <Btn variant="primary" size="lg" className="w-full mb-2" onClick={salvar}>Salvar</Btn>
      {base?.custom && (
        <Btn variant="danger" className="w-full" onClick={() => onApagar(base.id)}>Apagar alimento</Btn>
      )}
      {base && !base.custom && (
        <p className="text-[11.5px] text-muted text-center leading-relaxed">
          Esse e um alimento do catalogo. Suas edicoes valem, mas ele volta ao original se o catalogo for atualizado.
        </p>
      )}
    </Sheet>
  )
}
