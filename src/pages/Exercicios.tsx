import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, uid } from '../db'
import { useExercicios } from '../state/hooks'
import { GRUPOS, EQUIPAMENTOS, corGrupo, nomeGrupo, nomeEquip } from '../db/seedExercicios'
import { normalizar } from '../components/SeletorExercicio'
import { Cabecalho } from '../components/Cabecalho'
import { Btn, Input, Chip, Sheet, Campo, Select, Textarea } from '../components/ui'
import { BotaoFavorito } from '../components/Icone'
import { ImagemExercicio } from '../components/ImagemExercicio'
import { CREDITO_IMAGENS } from '../db/imagensExercicios'
import { useUI } from '../state/ui'
import type { GrupoMuscular, Equipamento } from '../db/types'

export default function Exercicios() {
  const todos = useExercicios()
  const { toast } = useUI()
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState<GrupoMuscular | 'todos' | 'favoritos'>('todos')
  const [novo, setNovo] = useState(false)

  const lista = useMemo(() => {
    const q = normalizar(busca.trim())
    return todos
      .filter(e => {
        if (grupo === 'favoritos' && !e.favorito) return false
        if (grupo !== 'todos' && grupo !== 'favoritos' && e.grupo !== grupo) return false
        if (!q) return true
        return normalizar(e.nome).includes(q)
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [todos, busca, grupo])

  // agrupa por musculo pra ficar mais facil de varrer com o olho
  const porGrupo = useMemo(() => {
    const m = new Map<GrupoMuscular, typeof lista>()
    for (const e of lista) {
      if (!m.has(e.grupo)) m.set(e.grupo, [])
      m.get(e.grupo)!.push(e)
    }
    return [...m.entries()].sort((a, b) =>
      GRUPOS.findIndex(g => g.id === a[0]) - GRUPOS.findIndex(g => g.id === b[0]))
  }, [lista])

  return (
    <div>
      <Cabecalho titulo="Exercícios" sub={`${todos.length} no catalogo`}
        acao={<Btn size="sm" variant="primary" onClick={() => setNovo(true)}>+ Criar</Btn>} />

      <div className="px-4 pt-3">
        <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." className="mb-3" />
        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-3">
          <Chip ativo={grupo === 'todos'} onClick={() => setGrupo('todos')}>Todos</Chip>
          <Chip ativo={grupo === 'favoritos'} onClick={() => setGrupo('favoritos')}>Favoritos</Chip>
          {GRUPOS.map(g => (
            <Chip key={g.id} ativo={grupo === g.id} cor={g.cor} onClick={() => setGrupo(g.id)}>{g.nome}</Chip>
          ))}
        </div>

        {lista.length === 0 && (
          <p className="text-center text-[13px] text-muted py-12">Nada encontrado.</p>
        )}

        {porGrupo.map(([g, itens]) => (
          <section key={g} className="mb-5">
            <h2 className="text-[11px] font-bold uppercase tracking-widest mb-2 px-1"
              style={{ color: corGrupo(g) }}>
              {nomeGrupo(g)} <span className="text-muted font-medium">({itens.length})</span>
            </h2>
            <div className="space-y-1.5">
              {itens.map(e => (
                <div key={e.id} className="flex items-center gap-2">
                  <Link to={`/exercícios/${e.id}`}
                    className="flex-1 min-w-0 flex items-center gap-3 p-3 rounded-xl bg-surface border border-line/60 active:bg-surface-2">
                    <span className="w-1 h-9 rounded-full shrink-0" style={{ background: corGrupo(e.grupo) }} />
                    {/* sem animar: sao 126 na lista, animando todas trava a rolagem */}
                    <ImagemExercicio exercicioId={e.id} tamanho="mini" animar={false} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold truncate">{e.nome}</p>
                      <p className="text-[11.5px] text-muted truncate">
                        {nomeEquip(e.equipamento)}
                        {e.videoUrl ? ' - com vídeo' : ''}
                        {e.custom ? ' - meu' : ''}
                      </p>
                    </div>
                  </Link>
                  <BotaoFavorito ativo={e.favorito} className="toque w-10 h-10 rounded-xl"
                    onClick={() => db.exercicios.update(e.id, { favorito: !e.favorito, atualizadoEm: Date.now() })} />
                </div>
              ))}
            </div>
          </section>
        ))}

        <p className="text-[10.5px] text-muted/70 leading-relaxed text-center px-2 pb-4 pt-2">
          Ilustracoes de execução por{' '}
          <a href={CREDITO_IMAGENS.autorUrl} target="_blank" rel="noreferrer" className="underline inline-block py-1.5">
            {CREDITO_IMAGENS.autor}
          </a>{' '}
          a partir do{' '}
          <a href={CREDITO_IMAGENS.fonteUrl} target="_blank" rel="noreferrer" className="underline inline-block py-1.5">
            {CREDITO_IMAGENS.fonte}
          </a>
          , sob{' '}
          <a href={CREDITO_IMAGENS.licencaUrl} target="_blank" rel="noreferrer" className="underline inline-block py-1.5">
            {CREDITO_IMAGENS.licenca}
          </a>.
        </p>
      </div>

      <NovoExercicio aberto={novo} fechar={() => setNovo(false)} onCriado={n => toast(`${n} criado`, 'ok')} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function NovoExercicio({ aberto, fechar, onCriado }: {
  aberto: boolean; fechar: () => void; onCriado: (nome: string) => void
}) {
  const { toast } = useUI()
  const [nome, setNome] = useState('')
  const [grupo, setGrupo] = useState<GrupoMuscular>('peito')
  const [equip, setEquip] = useState<Equipamento>('barra')
  const [exec, setExec] = useState('')
  const [video, setVideo] = useState('')

  async function criar() {
    if (!nome.trim()) return toast('Da um nome pro exercício', 'erro')
    await db.exercicios.put({
      id: 'usr_' + uid(),
      nome: nome.trim(), grupo, equipamento: equip,
      execucao: exec.split('\n').map(s => s.trim()).filter(Boolean),
      erros: [],
      videoUrl: video.trim() || undefined,
      custom: true,
      atualizadoEm: Date.now(),
    })
    onCriado(nome.trim())
    setNome(''); setExec(''); setVideo('')
    fechar()
  }

  return (
    <Sheet aberto={aberto} fechar={fechar} titulo="Novo exercício">
      <Campo label="Nome"><Input value={nome} onChange={e => setNome(e.target.value)} autoFocus /></Campo>
      <Campo label="Músculo principal">
        <Select value={grupo} onChange={e => setGrupo(e.target.value as GrupoMuscular)}>
          {GRUPOS.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </Select>
      </Campo>
      <Campo label="Equipamento">
        <Select value={equip} onChange={e => setEquip(e.target.value as Equipamento)}>
          {EQUIPAMENTOS.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </Select>
      </Campo>
      <Campo label="Execução" hint="Uma etapa por linha.">
        <Textarea rows={4} value={exec} onChange={e => setExec(e.target.value)}
          placeholder={'Ajuste o banco\nDesca controlado\nEmpurre sem travar o cotovelo'} />
      </Campo>
      <Campo label="Link do vídeo" hint="Cole um link do YouTube e ele toca dentro do app.">
        <Input value={video} onChange={e => setVideo(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
      </Campo>
      <Btn variant="primary" size="lg" className="w-full mt-2" onClick={criar}>Criar exercício</Btn>
    </Sheet>
  )
}
