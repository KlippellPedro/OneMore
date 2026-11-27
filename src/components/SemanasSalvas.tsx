import { useMemo, useRef, useState } from 'react'
import { useSemanas } from '../state/hooks'
import {
  salvarSemana, atualizarSemana, restaurarSemana, apagarSemana, baixarSemana, importarSemana,
} from '../lib/acoes'
import { mesmaSemana, resumoSemana, retratoDaSemana } from '../lib/semana'
import { Card, Btn, Sheet, Campo, Input, Confirmar } from './ui'
import { Icone } from './Icone'
import { SheetEnviar } from './SheetEnviar'
import { pacoteDeTreino } from '../lib/pacotes'
import { useUI, vibrar } from '../state/ui'
import { diaCurto, pl } from '../lib/format'
import type { Rotina, SemanaSalva } from '../db/types'

/** Semana comecando na segunda, igual a tela de Treino. */
const SEMANA = [1, 2, 3, 4, 5, 6, 0]

const quando = (ts: number) => new Date(ts).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})

const nomePadrao = () => `Semana de ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`

/**
 * O "save" da semana de treino: guarda as rotinas, os exercicios de cada uma e
 * os dias, pra voltar tudo com um toque se algo der errado. Mora dentro do
 * banco (vai pra nuvem com a conta) e sai em arquivo, que e a copia que
 * sobrevive ate a perder o celular.
 */
export function SemanasSalvas({ rotinas }: { rotinas: Rotina[] }) {
  const { toast } = useUI()
  const semanas = useSemanas()
  const arquivo = useRef<HTMLInputElement>(null)

  const [salvarNome, setSalvarNome] = useState<string | null>(null)
  const [abertaId, setAbertaId] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<null | 'restaurar' | 'atualizar' | 'apagar'>(null)
  const [mandar, setMandar] = useState<SemanaSalva | null>(null)

  const aberta = semanas.find(s => s.id === abertaId) ?? null
  const atual = useMemo(() => retratoDaSemana(rotinas, []), [rotinas])
  const emUso = (s: SemanaSalva) => mesmaSemana(s, atual)

  async function salvar() {
    const nome = salvarNome?.trim()
    if (!nome) return toast('Dá um nome pra semana', 'erro')
    const s = await salvarSemana(nome)
    setSalvarNome(null)
    if (!s) return toast('Não há treino pra salvar', 'erro', 'Monte as rotinas da semana primeiro')
    vibrar()
    toast(`"${s.nome}" salva`, 'ok', pl(s.rotinas.length, 'treino'))
  }

  async function abrirArquivo(f: File) {
    try {
      const s = await importarSemana(f)
      vibrar()
      toast('Semana lida do arquivo', 'ok', `${pl(s.rotinas.length, 'treino')} - confira e restaure`)
      setAbertaId(s.id)
    } catch (e) {
      toast('Não consegui ler esse arquivo', 'erro', (e as Error).message)
    }
  }

  async function executar() {
    const s = aberta
    const acao = confirmar
    setConfirmar(null)
    if (!s || !acao) return
    if (acao === 'restaurar') {
      const plano = await restaurarSemana(s)
      setAbertaId(null)
      vibrar(20)
      toast(`"${s.nome}" restaurada`, 'ok', plano.arquivar.length
        ? `${pl(plano.arquivar.length, 'treino')} de antes foi pros Arquivados`
        : undefined)
    } else if (acao === 'atualizar') {
      await atualizarSemana(s.id)
      toast(`"${s.nome}" atualizada com a semana de agora`, 'ok')
    } else {
      await apagarSemana(s.id)
      setAbertaId(null)
      toast('Semana apagada', 'ok')
    }
  }

  return (
    <section className="mb-6">
      <div className="flex items-end justify-between mb-2 px-1">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted">Semanas salvas</h2>
        {rotinas.length > 0 && (
          <button onClick={() => setSalvarNome(nomePadrao())}
            className="toque text-[12px] font-semibold text-accent">
            Salvar esta semana
          </button>
        )}
      </div>

      <Card className="overflow-hidden">
        {semanas.length === 0 ? (
          <p className="px-4 py-4 text-[12.5px] text-muted leading-relaxed border-b border-line/40">
            Salve a semana do jeito que está - os treinos, os exercícios de cada um, as
            séries e os dias. Se você apagar algo sem querer ou aplicar um programa por
            cima, ela volta com um toque.
          </p>
        ) : (
          semanas.map(s => {
            const r = resumoSemana(s)
            const usando = emUso(s)
            return (
              <button key={s.id} onClick={() => setAbertaId(s.id)}
                className="w-full flex items-center gap-3 px-3.5 py-3 border-b border-line/40 text-left active:bg-surface-2">
                <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${
                  s.auto ? 'bg-surface-2 text-muted' : 'bg-accent/12 text-accent'}`}>
                  <Icone nome={s.auto ? 'escudo' : 'calendario'} tamanho={17} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold truncate">{s.nome}</p>
                  <p className="text-[11px] text-muted truncate">
                    {pl(r.treinos, 'treino')} - {pl(r.exercicios, 'exercício')} - {quando(s.atualizadoEm)}
                  </p>
                </div>
                {usando ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-good/15 text-good shrink-0">EM USO</span>
                ) : s.auto ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-2 text-muted shrink-0">AUTOMÁTICA</span>
                ) : null}
              </button>
            )
          })
        )}
        <div className="grid grid-cols-2">
          <button onClick={async () => {
            if (!rotinas.length) return toast('Não há treino pra baixar', 'erro')
            await baixarSemana()
            toast('Arquivo da semana gerado', 'ok', 'Guarde fora do celular: Drive, e-mail, WhatsApp')
          }}
            className="h-11 text-[12.5px] font-semibold text-accent border-r border-line/40 active:bg-surface-2">
            Baixar arquivo
          </button>
          <button onClick={() => arquivo.current?.click()}
            className="h-11 text-[12.5px] font-semibold text-accent active:bg-surface-2">
            Abrir arquivo
          </button>
        </div>
      </Card>
      <p className="text-[11px] text-muted/80 leading-relaxed mt-2 px-1">
        Fica salvo no aparelho e, com conta, na nuvem. O arquivo é a cópia que você guarda fora do app.
      </p>

      <input ref={arquivo} type="file" accept="application/json,.json" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) abrirArquivo(f); e.target.value = '' }} />

      {/* -------- salvar -------- */}
      <Sheet aberto={salvarNome != null} fechar={() => setSalvarNome(null)} titulo="Salvar a semana">
        <Campo label="Nome" hint="Ex: Semana PPL, Antes da viagem, Volta das férias">
          <Input value={salvarNome ?? ''} onChange={e => setSalvarNome(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') salvar() }} />
        </Campo>
        <p className="text-[12px] text-muted leading-relaxed mb-4">
          Guarda {pl(rotinas.length, 'treino')} com os exercícios, séries, descanso e o dia de
          cada um. Mexer nos treinos depois não muda o que foi salvo.
        </p>
        <Btn variant="primary" size="lg" className="w-full" onClick={salvar}>Salvar</Btn>
      </Sheet>

      {/* -------- ver uma semana -------- */}
      <Sheet aberto={!!aberta} fechar={() => setAbertaId(null)} titulo={aberta?.nome}>
        {aberta && <DetalheSemana semana={aberta} usando={emUso(aberta)}
          restaurar={() => setConfirmar('restaurar')}
          atualizar={() => setConfirmar('atualizar')}
          apagar={() => setConfirmar('apagar')}
          mandar={() => { setMandar(aberta); setAbertaId(null) }}
          baixar={async () => { await baixarSemana(aberta); toast('Arquivo gerado', 'ok') }} />}
      </Sheet>

      <Confirmar aberto={confirmar != null} perigo={confirmar === 'apagar'}
        titulo={{ restaurar: 'Restaurar esta semana?', atualizar: 'Trocar pelo que está agora?', apagar: 'Apagar semana salva?' }[confirmar ?? 'apagar']}
        texto={confirmar === 'restaurar'
          ? 'Os treinos voltam como estavam, com os dias de cada um. Os de agora que não fazem parte dela vão pros Arquivados, e a semana atual fica guardada como cópia automática - dá pra desfazer.'
          : confirmar === 'atualizar'
            ? `O que está salvo em "${aberta?.nome}" é trocado pela semana de agora.`
            : 'Só a cópia salva some. Os treinos que estão em uso continuam.'}
        onNao={() => setConfirmar(null)} onSim={executar} />

      <SheetEnviar aberto={!!mandar} fechar={() => setMandar(null)} tipo="treino"
        titulo="Mandar semana pra amigo" nomeInicial={mandar?.nome ?? 'Semana de treino'}
        montar={async nome => pacoteDeTreino(nome, mandar!)} />
    </section>
  )
}

function DetalheSemana({ semana, usando, restaurar, atualizar, apagar, baixar, mandar }: {
  semana: SemanaSalva; usando: boolean
  restaurar: () => void; atualizar: () => void; apagar: () => void; baixar: () => void; mandar: () => void
}) {
  const r = resumoSemana(semana)
  const semDia = semana.rotinas.filter(x => !x.dias?.length)
  return (
    <>
      <p className="text-[12px] text-muted mb-3 -mt-1">
        {semana.auto ? 'Cópia automática' : 'Salva'} em {quando(semana.criadoEm)}
        {semana.atualizadoEm !== semana.criadoEm ? ` - atualizada em ${quando(semana.atualizadoEm)}` : ''}
        {' - '}{pl(r.series, 'série')}
      </p>

      <Card className="overflow-hidden mb-3">
        {SEMANA.map(d => {
          const rot = r.porDia.get(d)
          return (
            <div key={d} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-line/40 last:border-0">
              <span className="w-9 shrink-0 text-[12px] font-bold text-muted">{diaCurto(d)}</span>
              {rot ? (
                <>
                  <span className="w-1 self-stretch rounded-full shrink-0 min-h-[28px]" style={{ background: rot.cor }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold leading-tight truncate">{rot.nome}</p>
                    <p className="text-[11px] text-muted">{pl(rot.itens.length, 'exercício')}</p>
                  </div>
                </>
              ) : (
                <span className="flex-1 text-[12.5px] text-muted/60">Descanso</span>
              )}
            </div>
          )
        })}
      </Card>

      {semDia.length > 0 && (
        <p className="text-[12px] text-muted leading-relaxed mb-3 px-1">
          Sem dia fixo: {semDia.map(x => x.nome).join(', ')}
        </p>
      )}

      {usando ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-good/10 text-good text-[12.5px] font-semibold mb-2">
          <Icone nome="check" tamanho={16} traco={2.4} />
          É a semana que está em uso agora
        </div>
      ) : (
        <Btn variant="primary" size="lg" className="w-full mb-2" onClick={restaurar}>
          Restaurar esta semana
        </Btn>
      )}
      <Btn className="w-full mb-2" onClick={mandar}>
        <Icone nome="compartilhar" tamanho={16} /> Mandar pra amigo
      </Btn>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Btn onClick={baixar}>Baixar arquivo</Btn>
        <Btn onClick={atualizar} disabled={usando}>Trocar pela de agora</Btn>
      </div>
      <Btn variant="danger" className="w-full" onClick={apagar}>Apagar esta cópia</Btn>
    </>
  )
}
