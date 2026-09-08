import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, isoDia } from '../db'
import { corGrupo, nomeGrupo, nomeEquip } from '../db/seedExercicios'
import { Cabecalho } from '../components/Cabecalho'
import { Card, Btn, Sheet, Campo, Input, Confirmar } from '../components/ui'
import { Grafico } from '../components/Grafico'
import { useUI } from '../state/ui'
import { youtubeId, dataNumerica, n0, peso } from '../lib/format'
import { Icone, BotaoFavorito } from '../components/Icone'
import { ImagemExercicio } from '../components/ImagemExercicio'
import { imagemExercicio } from '../db/imagensExercicios'

export default function DetalheExercicio() {
  const { id = '' } = useParams()
  const { toast } = useUI()
  const ex = useLiveQuery(() => db.exercicios.get(id), [id])
  const [editVideo, setEditVideo] = useState(false)
  const [url, setUrl] = useState('')
  const [apagar, setApagar] = useState(false)

  // historico: melhor carga por dia
  const historico = useLiveQuery(async () => {
    const sessoes = await db.sessoes.filter(s => s.concluida).toArray()
    const porDia = new Map<string, { carga: number; volume: number; reps: number }>()
    for (const s of sessoes) {
      const doEx = s.series.filter(g => g.exercicioId === id && g.feito && !g.aquecimento)
      if (!doEx.length) continue
      const dia = isoDia(new Date(s.inicio))
      const melhor = doEx.reduce((a, b) => (b.carga > a.carga ? b : a))
      const vol = doEx.reduce((t, g) => t + g.carga * g.reps, 0)
      const atual = porDia.get(dia)
      porDia.set(dia, {
        carga: Math.max(atual?.carga ?? 0, melhor.carga),
        volume: (atual?.volume ?? 0) + vol,
        reps: melhor.reps,
      })
    }
    return [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [id], []) ?? []

  if (!ex) return <div className="p-10 text-center text-muted text-sm">Carregando...</div>

  const yt = youtubeId(ex.videoUrl)
  const temIlustracao = !!imagemExercicio(ex.id)
  const recorde = historico.reduce((m, [, v]) => Math.max(m, v.carga), 0)
  const volumeTotal = historico.reduce((t, [, v]) => t + v.volume, 0)

  return (
    <div>
      <Cabecalho titulo={ex.nome} sub={`${nomeGrupo(ex.grupo)} - ${nomeEquip(ex.equipamento)}`}
        acao={
          <BotaoFavorito ativo={ex.favorito} className="w-9 h-9 rounded-xl"
            onClick={() => db.exercicios.update(id, { favorito: !ex.favorito })} />
        } />

      <div className="px-4 pt-4">
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
            style={{ background: corGrupo(ex.grupo) + '22', color: corGrupo(ex.grupo) }}>
            {nomeGrupo(ex.grupo)}
          </span>
          {ex.gruposSecundarios?.map(g => (
            <span key={g} className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-surface-2 text-muted">
              {nomeGrupo(g)}
            </span>
          ))}
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-surface-2 text-muted">
            {nomeEquip(ex.equipamento)}
          </span>
        </div>

        {/* -------- ilustracao da execucao -------- */}
        {temIlustracao && (
          <Card className="p-3 mb-3">
            <ImagemExercicio exercicioId={ex.id} />
            <p className="text-[11px] text-muted text-center mt-1">
              Inicio e fim do movimento
            </p>
          </Card>
        )}

        {/* -------- video -------- */}
        {yt ? (
          <div className="rounded-2xl overflow-hidden border border-line mb-3 bg-black">
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${yt}`}
                title={ex.nome}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen />
            </div>
          </div>
        ) : ex.videoUrl ? (
          <a href={ex.videoUrl} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-surface border border-line mb-3 text-[13px] font-semibold text-accent">
            Abrir video da execucao
            <Icone nome="link-externo" tamanho={15} />
          </a>
        ) : (
          <Card className="p-4 mb-3 text-center">
            <p className="text-[13px] text-muted mb-3">Nenhum video de execucao ainda.</p>
            <Btn size="sm" onClick={() => { setUrl(ex.videoUrl ?? ''); setEditVideo(true) }}>
              Colar link do YouTube
            </Btn>
          </Card>
        )}

        {ex.imagemUrl && (
          <img src={ex.imagemUrl} alt={ex.nome} className="w-full rounded-2xl border border-line mb-3" />
        )}

        {ex.videoUrl && (
          <button onClick={() => { setUrl(ex.videoUrl ?? ''); setEditVideo(true) }}
            className="text-[12px] text-muted mb-4 px-1">Trocar link do video</button>
        )}

        {/* -------- execucao -------- */}
        {ex.execucao.length > 0 && (
          <Card className="p-4 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">Como executar</h2>
            <ol className="space-y-2.5">
              {ex.execucao.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-5 h-5 shrink-0 rounded-md bg-accent/15 text-accent text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-[13.5px] leading-relaxed text-txt/90">{p}</span>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {/* -------- erros -------- */}
        {ex.erros && ex.erros.length > 0 && (
          <Card className="p-4 mb-3 border-bad/25">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-bad mb-3">Erros comuns</h2>
            <ul className="space-y-2">
              {ex.erros.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-txt/85">
                  <Icone nome="x" tamanho={14} traco={2.4} className="text-bad shrink-0 mt-[3px]" />{p}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* -------- evolucao -------- */}
        {historico.length > 0 && (
          <Card className="p-4 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">Sua evolucao</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Mini rotulo="Recorde" valor={`${n0(recorde)} kg`} destaque />
              <Mini rotulo="Sessoes" valor={String(historico.length)} />
              <Mini rotulo="Volume" valor={peso(volumeTotal)} />
            </div>
            {historico.length > 1 && (
              <Grafico
                pontos={historico.map(([dia, v]) => ({ x: dia, y: v.carga }))}
                cor={corGrupo(ex.grupo)} sufixo=" kg" altura={130} />
            )}
            <div className="mt-3 space-y-1">
              {[...historico].reverse().slice(0, 6).map(([dia, v]) => (
                <div key={dia} className="flex items-center justify-between text-[12.5px] py-1">
                  <span className="text-muted">{dataNumerica(dia)}</span>
                  <span className="font-semibold tabular-nums">{v.carga} kg x {v.reps}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {ex.custom && (
          <Btn variant="danger" className="w-full mb-4" onClick={() => setApagar(true)}>
            Apagar esse exercicio
          </Btn>
        )}
      </div>

      <Sheet aberto={editVideo} fechar={() => setEditVideo(false)} titulo="Link do video">
        <Campo label="URL" hint="YouTube toca aqui dentro. Outros links abrem em nova aba.">
          <Input value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..." autoFocus />
        </Campo>
        <div className="flex gap-2">
          {ex.videoUrl && (
            <Btn variant="ghost" className="flex-1" onClick={async () => {
              await db.exercicios.update(id, { videoUrl: undefined })
              setEditVideo(false); toast('Video removido', 'ok')
            }}>Remover</Btn>
          )}
          <Btn variant="primary" className="flex-1" onClick={async () => {
            await db.exercicios.update(id, { videoUrl: url.trim() || undefined })
            setEditVideo(false); toast('Video salvo', 'ok')
          }}>Salvar</Btn>
        </div>
      </Sheet>

      <Confirmar aberto={apagar} perigo titulo="Apagar exercicio?"
        texto="Ele sai do catalogo e das rotinas que o usam."
        onNao={() => setApagar(false)}
        onSim={async () => { await db.exercicios.delete(id); history.back() }} />
    </div>
  )
}

function Mini({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1">{rotulo}</p>
      <p className={`text-[15px] font-black tabular-nums ${destaque ? 'text-xp' : ''}`}>{valor}</p>
    </div>
  )
}
