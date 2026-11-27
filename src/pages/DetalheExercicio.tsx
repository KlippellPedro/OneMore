import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, isoDia } from '../db'
import { apagarExercicio, ondeUsam } from '../lib/acoes'
import { corGrupo, nomeGrupo, nomeEquip } from '../db/seedExercicios'
import { Cabecalho } from '../components/Cabecalho'
import { Card, Btn, Vazio, Sheet, Campo, Input, Confirmar } from '../components/ui'
import { Grafico } from '../components/Grafico'
import { useUI } from '../state/ui'
import { youtubeId, dataNumerica, n0, peso, pl, linkSeguro, imagemSegura } from '../lib/format'
import { Icone, BotaoFavorito } from '../components/Icone'
import { ImagemExercicio } from '../components/ImagemExercicio'
import { CardVariacoes } from '../components/Variacoes'
import { FormExercicio } from '../components/FormExercicio'
import { imagemExercicio } from '../db/imagensExercicios'
import { CalculadoraAnilhas } from '../components/Anilhas'
import { melhorUmRM, ZONAS_RM, arredondarCarga } from '../lib/treino'
import { nq } from '../lib/format'

export default function DetalheExercicio() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { toast } = useUI()
  // `?? null` separa "carregando" de "não existe" - ver DetalheSessao
  const ex = useLiveQuery(() => db.exercicios.get(id).then(e => e ?? null), [id])
  const [editVideo, setEditVideo] = useState(false)
  const [url, setUrl] = useState('')
  const [apagar, setApagar] = useState(false)
  const [editar, setEditar] = useState(false)
  const [anilhas, setAnilhas] = useState(false)
  const usos = useLiveQuery(() => (apagar ? ondeUsam(id) : undefined), [apagar, id])

  // historico: melhor carga por dia
  const historico = useLiveQuery(async () => {
    const sessoes = await db.sessoes.where('concluida').equals(1).toArray()
    const porDia = new Map<string, { carga: number; volume: number; reps: number; rm: number | null }>()
    for (const s of sessoes) {
      const doEx = s.series.filter(g => g.exercicioId === id && g.feito && !g.aquecimento)
      if (!doEx.length) continue
      const dia = isoDia(new Date(s.inicio))
      const melhor = doEx.reduce((a, b) => (b.carga > a.carga ? b : a))
      const vol = doEx.reduce((t, g) => t + g.carga * g.reps, 0)
      const atual = porDia.get(dia)
      const rm = melhorUmRM(doEx)
      porDia.set(dia, {
        carga: Math.max(atual?.carga ?? 0, melhor.carga),
        volume: (atual?.volume ?? 0) + vol,
        reps: melhor.reps,
        rm: Math.max(atual?.rm ?? 0, rm ?? 0) || null,
      })
    }
    return [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [id], []) ?? []

  if (ex === undefined) return <div className="p-10 text-center text-muted text-sm">Carregando...</div>
  if (ex === null) {
    return (
      <div>
        <Cabecalho titulo="Exercício" voltarPara="/exercicios" />
        <Vazio icone="halter" titulo="Exercício não encontrado"
          texto="Ele pode ter sido apagado do catálogo." />
      </div>
    )
  }

  const yt = youtubeId(ex.videoUrl)
  const temIlustracao = !!imagemExercicio(ex.id)
  const recorde = historico.reduce((m, [, v]) => Math.max(m, v.carga), 0)
  const volumeTotal = historico.reduce((t, [, v]) => t + v.volume, 0)
  // 1RM estimado: o melhor dos ultimos 90 dias - forca de hoje, nao a de um ano atras
  const desde = isoDia(new Date(Date.now() - 90 * 86400000))
  const rmAtual = historico.filter(([d]) => d >= desde).reduce((m, [, v]) => Math.max(m, v.rm ?? 0), 0)
  const temCarga = !['peso-corporal', 'cardio', 'elastico'].includes(ex.equipamento)

  return (
    <div>
      <Cabecalho titulo={ex.nome} sub={`${nomeGrupo(ex.grupo)} - ${nomeEquip(ex.equipamento)}`}
        acao={
          <BotaoFavorito ativo={ex.favorito} className="toque w-9 h-9 rounded-xl"
            onClick={() => db.exercicios.update(id, { favorito: !ex.favorito, atualizadoEm: Date.now() })} />
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
              Início e fim do movimento
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
        ) : linkSeguro(ex.videoUrl) ? (
          <a href={linkSeguro(ex.videoUrl)} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-surface border border-line mb-3 text-[13px] font-semibold text-accent">
            Abrir vídeo da execução
            <Icone nome="link-externo" tamanho={15} />
          </a>
        ) : (
          <Card className="p-4 mb-3 text-center">
            <p className="text-[13px] text-muted mb-3">Nenhum vídeo de execução ainda.</p>
            <Btn size="sm" onClick={() => { setUrl(ex.videoUrl ?? ''); setEditVideo(true) }}>
              Colar link do YouTube
            </Btn>
          </Card>
        )}

        {imagemSegura(ex.imagemUrl) && (
          <img src={imagemSegura(ex.imagemUrl)} alt={ex.nome} referrerPolicy="no-referrer"
            className="w-full rounded-2xl border border-line mb-3" />
        )}

        {ex.videoUrl && (
          <button onClick={() => { setUrl(ex.videoUrl ?? ''); setEditVideo(true) }}
            className="text-[12px] text-muted mb-4 px-1">Trocar link do vídeo</button>
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

        <CardVariacoes ex={ex} />

        {/* -------- evolucao -------- */}
        {historico.length > 0 && (
          <Card className="p-4 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">Sua evolução</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Mini rotulo="Recorde" valor={`${n0(recorde)} kg`} destaque />
              <Mini rotulo="Sessões" valor={String(historico.length)} />
              <Mini rotulo="Volume" valor={peso(volumeTotal)} />
            </div>
            {temCarga && rmAtual > 0 && (
              <div className="rounded-xl bg-bg-soft border border-line p-3 mb-4">
                <div className="flex items-baseline justify-between gap-2 mb-2.5">
                  <p className="text-[12px] font-semibold">
                    1RM estimado <span className="text-muted font-normal">- o máximo pra 1 repetição</span>
                  </p>
                  <p className="text-[17px] font-black tabular-nums text-accent shrink-0">{nq(rmAtual)} kg</p>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {ZONAS_RM.map(z => (
                    <div key={z.pct} className="rounded-lg bg-surface-2/70 px-1.5 py-2 text-center">
                      <p className="text-[10px] text-muted font-semibold">{z.pct}%</p>
                      <p className="text-[13px] font-bold tabular-nums">{nq(arredondarCarga(rmAtual * z.pct / 100))}</p>
                      <p className="text-[9.5px] text-muted">{z.reps} reps</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10.5px] text-muted mt-2 leading-snug">
                  Calculado das suas séries dos últimos 90 dias (fórmula de Epley). É estimativa - não precisa testar o máximo.
                </p>
              </div>
            )}
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

        {ex.equipamento === 'barra' && (
          <Btn className="w-full mb-3" onClick={() => setAnilhas(true)}>
            <Icone nome="anilha" tamanho={16} /> Calcular anilhas na barra
          </Btn>
        )}

        {ex.custom && (
          <div className="mb-4 space-y-2">
            <Btn className="w-full" onClick={() => setEditar(true)}>
              <Icone nome="lapis" tamanho={16} /> Editar nome, músculo e execução
            </Btn>
            <Btn variant="danger" className="w-full" onClick={() => setApagar(true)}>
              Apagar esse exercício
            </Btn>
          </div>
        )}
      </div>

      <Sheet aberto={editVideo} fechar={() => setEditVideo(false)} titulo="Link do vídeo">
        <Campo label="URL" hint="YouTube toca aqui dentro. Outros links abrem em nova aba.">
          <Input value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..." autoFocus />
        </Campo>
        <div className="flex gap-2">
          {ex.videoUrl && (
            <Btn variant="ghost" className="flex-1" onClick={async () => {
              await db.exercicios.update(id, { videoUrl: undefined, atualizadoEm: Date.now() })
              setEditVideo(false); toast('Vídeo removido', 'ok')
            }}>Remover</Btn>
          )}
          <Btn variant="primary" className="flex-1" onClick={async () => {
            const link = linkSeguro(url)
            if (url.trim() && !link) return toast('Link inválido', 'erro', 'Cole um endereço que comece com https://')
            await db.exercicios.update(id, { videoUrl: link, atualizadoEm: Date.now() })
            setEditVideo(false); toast('Vídeo salvo', 'ok')
          }}>Salvar</Btn>
        </div>
      </Sheet>

      <CalculadoraAnilhas aberto={anilhas} fechar={() => setAnilhas(false)}
        carga={historico.length ? historico[historico.length - 1][1].carga : 0} />

      <FormExercicio aberto={editar} fechar={() => setEditar(false)} exercicio={ex}
        onSalvo={e => toast(`${e.nome} salvo`, 'ok')} />

      <Confirmar aberto={apagar} perigo titulo="Apagar exercício?"
        texto={textoApagar(usos)}
        onNao={() => setApagar(false)}
        onSim={async () => {
          await apagarExercicio(id)
          toast(`${ex.nome} apagado`, 'ok')
          // replace: voltar depois nao pode cair de novo na pagina de um exercicio que nao existe.
          // E nao history.back(): aberto por link, isso saia do app
          nav('/exercicios', { replace: true })
        }} />
    </div>
  )
}

const FIM = 'Os treinos já registrados no histórico continuam lá.'

/** Diz de onde o exercicio vai sumir, com o numero na frente: "das rotinas que
 *  usam" era vago demais pra decidir se pode apagar. */
function textoApagar(usos?: { rotinas: number; sessoesAbertas: number }) {
  if (!usos) return `Ele sai do catálogo. ${FIM}`
  const partes = ['do catálogo']
  if (usos.rotinas > 0) partes.push(`de ${pl(usos.rotinas, 'rotina')}`)
  if (usos.sessoesAbertas > 0) partes.push('do treino em andamento')
  const ultimo = partes.pop()!
  const onde = partes.length ? `${partes.join(', ')} e ${ultimo}` : ultimo
  return `Ele sai ${onde}. ${FIM}`
}

function Mini({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1">{rotulo}</p>
      <p className={`text-[15px] font-black tabular-nums ${destaque ? 'text-xp' : ''}`}>{valor}</p>
    </div>
  )
}
