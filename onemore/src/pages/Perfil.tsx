import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { salvarPerfil } from '../db'
import { usePerfil, useNivel } from '../state/hooks'
import { sugerirMetas, gastoDiario, tmb, idadeDe } from '../lib/nutricao'
import {
  baixarBackup, importar, apagarTudo, SQL_SUPABASE,
  salvarCredenciais, entrar, criarConta, sair, usuarioAtual,
  enviar, baixar, espiar, ultimoSync, type Backup,
} from '../lib/sync'
import { rodarSeed } from '../db/seed'
import { Titulo } from '../components/Cabecalho'
import { Card, Btn, Sheet, Campo, Input, Select, Confirmar, Barra, Chip } from '../components/ui'
import { useUI } from '../state/ui'
import { n0, n1 } from '../lib/format'
import type { Perfil as TPerfil } from '../db/types'

const ATIVIDADES = [
  { v: 1.2, nome: 'Sedentario', desc: 'Trabalho parado, sem exercicio' },
  { v: 1.375, nome: 'Leve', desc: 'Exercicio 1 a 3x por semana' },
  { v: 1.55, nome: 'Moderado', desc: 'Exercicio 3 a 5x por semana' },
  { v: 1.725, nome: 'Intenso', desc: 'Exercicio 6 a 7x por semana' },
  { v: 1.9, nome: 'Atleta', desc: 'Treino pesado 2x por dia' },
] as const

const OBJETIVOS = [
  { v: 'cutting', nome: 'Perder gordura', desc: '20% abaixo do gasto' },
  { v: 'manutencao', nome: 'Manter', desc: 'No gasto diario' },
  { v: 'bulking', nome: 'Ganhar massa', desc: '12% acima do gasto' },
] as const

export default function Perfil() {
  const { toast } = useUI()
  const perfil = usePerfil()
  const { nivel, rank, progresso, xpNoNivel, xpParaProximo } = useNivel()

  const [aberto, setAberto] = useState<null | 'dados' | 'metas' | 'nuvem' | 'saude'>(null)
  const [apagar, setApagar] = useState(false)
  const arquivo = useRef<HTMLInputElement>(null)

  async function importarArquivo(f: File) {
    try {
      const texto = await f.text()
      const r = await importar(JSON.parse(texto) as Backup)
      toast(`${r.registros} registros restaurados`, 'ok')
      setTimeout(() => location.reload(), 900)
    } catch (e) {
      toast('Nao consegui ler esse arquivo', 'erro', String((e as Error).message))
    }
  }

  return (
    <div>
      <Titulo titulo="Perfil" sub={`${perfil.nome} - Nivel ${nivel}`} />

      <div className="px-4">
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center border-2"
              style={{ borderColor: rank.cor, background: rank.cor + '14' }}>
              <span className="text-2xl font-black" style={{ color: rank.cor }}>{nivel}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Jogador</p>
              <p className="text-[16px] font-bold truncate leading-tight">{perfil.nome}</p>
              <p className="text-[12px]" style={{ color: rank.cor }}>Rank {rank.nome}</p>
              <p className="text-[11.5px] text-muted">
                {n0(perfil.xp)} XP - sequencia {perfil.streak} dia{perfil.streak === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <Barra valor={progresso} cor={rank.cor} altura={7} />
          <p className="text-[11px] text-muted mt-1.5">
            {n0(xpParaProximo - xpNoNivel)} XP para o nivel {nivel + 1}
          </p>
        </Card>

        <Grupo titulo="Voce">
          <Linha titulo="Meus dados" sub={`${perfil.sexo === 'M' ? 'Homem' : 'Mulher'} - ${perfil.alturaCm} cm - ${n1(perfil.pesoKg)} kg`}
            onClick={() => setAberto('dados')} />
          <Linha titulo="Metas de dieta"
            sub={`${n0(perfil.metaKcal)} kcal - P ${n0(perfil.metaProt)} C ${n0(perfil.metaCarb)} G ${n0(perfil.metaGord)}`}
            onClick={() => setAberto('metas')} />
        </Grupo>

        <Grupo titulo="Saude">
          <Linha titulo="Diabetes tipo 1"
            sub={perfil.diabetesTipo1
              ? 'Ligado - carboidrato em destaque e registro de glicemia'
              : 'Desligado'}
            onClick={() => setAberto('saude')} />
        </Grupo>

        <Grupo titulo="Catalogos">
          <LinhaLink to="/treinos/programas" titulo="Programas de treino" sub="PPL, Upper/Lower, Full Body, Arnold, 5x5" />
          <LinhaLink to="/exercicios" titulo="Exercicios" sub="Ver, favoritar, adicionar video, criar novos" />
          <LinhaLink to="/alimentos" titulo="Alimentos" sub="Macros e medidas caseiras" />
          <LinhaLink to="/dieta/plano" titulo="Plano alimentar" sub="Cardapio padrao das refeicoes" />
        </Grupo>

        <Grupo titulo="Seus dados">
          <Linha titulo="Sincronizar na nuvem"
            sub={ultimoSync() ? `Ultimo envio: ${ultimoSync()!.toLocaleString('pt-BR')}` : 'Supabase - nao configurado'}
            onClick={() => setAberto('nuvem')} />
          <Linha titulo="Baixar backup" sub="Arquivo JSON com tudo que esta no aparelho"
            onClick={async () => { await baixarBackup(); toast('Backup gerado', 'ok') }} />
          <Linha titulo="Restaurar backup" sub="Substitui tudo pelo conteudo do arquivo"
            onClick={() => arquivo.current?.click()} />
          <Linha titulo="Apagar tudo" sub="Zera treinos, dieta e XP deste aparelho" perigo
            onClick={() => setApagar(true)} />
        </Grupo>

        <input ref={arquivo} type="file" accept="application/json,.json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) importarArquivo(f); e.target.value = '' }} />

        <p className="text-center text-[11px] text-muted/60 py-6">
          OneMore - seus dados ficam no seu aparelho.
        </p>
      </div>

      <SheetDados aberto={aberto === 'dados'} fechar={() => setAberto(null)} perfil={perfil} />
      <SheetMetas aberto={aberto === 'metas'} fechar={() => setAberto(null)} perfil={perfil} />
      <SheetNuvem aberto={aberto === 'nuvem'} fechar={() => setAberto(null)} perfil={perfil} />
      <SheetSaude aberto={aberto === 'saude'} fechar={() => setAberto(null)} perfil={perfil} />

      <Confirmar aberto={apagar} perigo titulo="Apagar tudo mesmo?"
        texto="Treinos, dieta, medidas, XP e conquistas somem deste aparelho. Baixe um backup antes se tiver duvida."
        onNao={() => setApagar(false)}
        onSim={async () => {
          await apagarTudo(); await rodarSeed()
          setApagar(false); toast('Tudo apagado', 'ok')
          setTimeout(() => location.reload(), 700)
        }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2 px-1">{titulo}</h2>
      <Card className="overflow-hidden">{children}</Card>
    </section>
  )
}

function Linha({ titulo, sub, onClick, perigo }: {
  titulo: string; sub?: string; onClick?: () => void; perigo?: boolean
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-line/40 last:border-0 text-left active:bg-surface-2">
      <div className="flex-1 min-w-0">
        <p className={`text-[14px] font-semibold ${perigo ? 'text-bad' : ''}`}>{titulo}</p>
        {sub && <p className="text-[11.5px] text-muted truncate mt-0.5">{sub}</p>}
      </div>
      <span className="text-muted shrink-0">›</span>
    </button>
  )
}

function LinhaLink({ to, titulo, sub }: { to: string; titulo: string; sub?: string }) {
  return (
    <Link to={to} className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-line/40 last:border-0 active:bg-surface-2">
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold">{titulo}</p>
        {sub && <p className="text-[11.5px] text-muted truncate mt-0.5">{sub}</p>}
      </div>
      <span className="text-muted shrink-0">›</span>
    </Link>
  )
}

/* ------------------------------------------------------------------ */

function SheetDados({ aberto, fechar, perfil }: { aberto: boolean; fechar: () => void; perfil: TPerfil }) {
  const { toast } = useUI()
  const [f, setF] = useState(perfil)
  useEffect(() => { if (aberto) setF(perfil) }, [aberto])

  const gasto = gastoDiario(f)

  return (
    <Sheet aberto={aberto} fechar={fechar} titulo="Meus dados" alto>
      <Campo label="Nome">
        <Input value={f.nome} onChange={e => setF(v => ({ ...v, nome: e.target.value }))} />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Sexo">
          <Select value={f.sexo} onChange={e => setF(v => ({ ...v, sexo: e.target.value as 'M' | 'F' }))}>
            <option value="M">Homem</option>
            <option value="F">Mulher</option>
          </Select>
        </Campo>
        <Campo label="Nascimento">
          <Input type="date" value={f.nascimento ?? ''}
            onChange={e => setF(v => ({ ...v, nascimento: e.target.value }))} />
        </Campo>
        <Campo label="Altura (cm)">
          <Input type="number" inputMode="numeric" value={f.alturaCm || ''}
            onChange={e => setF(v => ({ ...v, alturaCm: Number(e.target.value || 0) }))} />
        </Campo>
        <Campo label="Peso (kg)">
          <Input type="number" inputMode="decimal" value={f.pesoKg || ''}
            onChange={e => setF(v => ({ ...v, pesoKg: Number(e.target.value || 0) }))} />
        </Campo>
      </div>

      <Campo label="Nivel de atividade">
        <div className="space-y-1.5">
          {ATIVIDADES.map(a => (
            <button key={a.v} onClick={() => setF(v => ({ ...v, atividade: a.v }))}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left ${
                f.atividade === a.v ? 'border-accent bg-accent/10' : 'border-line bg-surface'
              }`}>
              <div className="flex-1">
                <p className="text-[13.5px] font-semibold">{a.nome}</p>
                <p className="text-[11.5px] text-muted">{a.desc}</p>
              </div>
              {f.atividade === a.v && <span className="text-accent">✓</span>}
            </button>
          ))}
        </div>
      </Campo>

      <Campo label="Meta de treinos por semana">
        <div className="flex gap-1.5">
          {[2, 3, 4, 5, 6, 7].map(n => (
            <Chip key={n} ativo={f.metaTreinosSemana === n}
              onClick={() => setF(v => ({ ...v, metaTreinosSemana: n }))}>{n}x</Chip>
          ))}
        </div>
      </Campo>

      <Card className="p-3.5 mb-4">
        <p className="text-[12px] text-muted leading-relaxed">
          Com esses dados: metabolismo basal <b className="text-txt">{n0(tmb(f))} kcal</b>,
          gasto diario estimado <b className="text-txt">{n0(gasto)} kcal</b>
          {f.nascimento ? ` (${idadeDe(f.nascimento)} anos)` : ''}.
        </p>
      </Card>

      <Btn variant="primary" size="lg" className="w-full" onClick={async () => {
        await salvarPerfil({
          nome: f.nome.trim() || 'Atleta', sexo: f.sexo, nascimento: f.nascimento || undefined,
          alturaCm: f.alturaCm, pesoKg: f.pesoKg, atividade: f.atividade,
          metaTreinosSemana: f.metaTreinosSemana,
        })
        toast('Dados salvos', 'ok'); fechar()
      }}>Salvar</Btn>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */

function SheetMetas({ aberto, fechar, perfil }: { aberto: boolean; fechar: () => void; perfil: TPerfil }) {
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
              {f.objetivo === o.v && <span className="text-accent">✓</span>}
            </button>
          ))}
        </div>
      </Campo>

      <Card className="p-3.5 mb-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">Sugestao do app</p>
        <p className="text-[12.5px] text-muted leading-relaxed mb-3">
          Gasto {n0(sugestao.gasto)} kcal → meta <b className="text-txt">{n0(sugestao.kcal)} kcal</b>,
          P {n0(sugestao.prot)}g - C {n0(sugestao.carb)}g - G {n0(sugestao.gord)}g
        </p>
        <Btn size="sm" onClick={() => setF(v => ({
          ...v, metaKcal: sugestao.kcal, metaProt: sugestao.prot,
          metaCarb: sugestao.carb, metaGord: sugestao.gord,
        }))}>Usar essa sugestao</Btn>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Calorias (kcal)">
          <Input type="number" inputMode="numeric" value={f.metaKcal || ''}
            onChange={e => setF(v => ({ ...v, metaKcal: Number(e.target.value || 0) }))} />
        </Campo>
        <Campo label="Proteina (g)">
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
            Seus macros somam {n0(kcalDosMacros)} kcal, mas a meta esta em {n0(f.metaKcal)} kcal.
          </p>
        </Card>
      )}

      <Campo label="Meta de agua (ml)">
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

/* ------------------------------------------------------------------ */

function SheetNuvem({ aberto, fechar, perfil }: { aberto: boolean; fechar: () => void; perfil: TPerfil }) {
  const { toast } = useUI()
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [usuario, setUsuario] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [verSql, setVerSql] = useState(false)
  const [confirmarBaixar, setConfirmarBaixar] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setUrl(perfil.supabaseUrl ?? '')
    setKey(perfil.supabaseKey ?? '')
    usuarioAtual().then(u => setUsuario(u?.email ?? null)).catch(() => setUsuario(null))
  }, [aberto])

  const configurado = !!perfil.supabaseUrl && !!perfil.supabaseKey

  async function tentar(nome: string, fn: () => Promise<void>) {
    setOcupado(nome)
    try { await fn() } catch (e) { toast('Deu ruim', 'erro', (e as Error).message) }
    finally { setOcupado(null) }
  }

  return (
    <Sheet aberto={aberto} fechar={fechar} titulo="Sincronizar na nuvem" alto>
      <p className="text-[12.5px] text-muted leading-relaxed mb-4">
        O app funciona 100% offline. A nuvem serve pra ter backup e usar o mesmo perfil
        no celular e no PC. E o seu projeto Supabase - ninguem alem de voce acessa.
      </p>

      {/* passo 1 */}
      <Passo n={1} titulo="Conectar o projeto" feito={configurado}>
        <Campo label="URL do projeto" hint="Supabase → Project Settings → Data API">
          <Input value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://xxxx.supabase.co" autoComplete="off" />
        </Campo>
        <Campo label="Chave anon (publica)" hint="A chave 'anon public'. Nunca use a service_role aqui.">
          <Input value={key} onChange={e => setKey(e.target.value)}
            placeholder="eyJhbGci..." autoComplete="off" />
        </Campo>
        <div className="flex gap-2">
          <Btn className="flex-1" onClick={() => setVerSql(true)}>Ver SQL da tabela</Btn>
          <Btn variant="primary" className="flex-1" onClick={() => tentar('cred', async () => {
            await salvarCredenciais(url, key)
            toast('Projeto conectado', 'ok')
          })}>Salvar</Btn>
        </div>
      </Passo>

      {/* passo 2 */}
      <Passo n={2} titulo="Entrar na conta" feito={!!usuario} desabilitado={!configurado}>
        {usuario ? (
          <div className="flex items-center gap-3">
            <p className="flex-1 text-[13px] truncate">Conectado como <b>{usuario}</b></p>
            <Btn size="sm" onClick={() => tentar('sair', async () => {
              await sair(); setUsuario(null); toast('Voce saiu', 'ok')
            })}>Sair</Btn>
          </div>
        ) : (
          <>
            <Campo label="E-mail">
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email" placeholder="voce@email.com" />
            </Campo>
            <Campo label="Senha" hint="Minimo 6 caracteres.">
              <Input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                autoComplete="current-password" />
            </Campo>
            <div className="flex gap-2">
              <Btn className="flex-1" disabled={ocupado === 'conta'} onClick={() => tentar('conta', async () => {
                const u = await criarConta(email, senha)
                setUsuario(u?.email ?? null)
                toast('Conta criada', 'ok', u?.email ? undefined : 'Confirme o e-mail que voce recebeu')
              })}>Criar conta</Btn>
              <Btn variant="primary" className="flex-1" disabled={ocupado === 'entrar'}
                onClick={() => tentar('entrar', async () => {
                  const u = await entrar(email, senha)
                  setUsuario(u?.email ?? null); toast('Conectado', 'ok')
                })}>Entrar</Btn>
            </div>
          </>
        )}
      </Passo>

      {/* passo 3 */}
      <Passo n={3} titulo="Sincronizar" desabilitado={!usuario}>
        <p className="text-[12px] text-muted leading-relaxed mb-3">
          A sincronizacao troca o estado inteiro: enviar sobrescreve a nuvem,
          baixar sobrescreve este aparelho. Sempre use o mais recente.
        </p>
        <div className="flex gap-2">
          <Btn variant="primary" className="flex-1" disabled={ocupado === 'enviar'}
            onClick={() => tentar('enviar', async () => {
              const q = await enviar()
              toast('Enviado pra nuvem', 'ok', q.toLocaleString('pt-BR'))
            })}>
            {ocupado === 'enviar' ? 'Enviando...' : 'Enviar deste aparelho'}
          </Btn>
          <Btn className="flex-1" disabled={ocupado === 'espiar'}
            onClick={() => tentar('espiar', async () => {
              const n = await espiar()
              if (!n) return toast('Nada salvo na nuvem ainda', 'info')
              setConfirmarBaixar(true)
            })}>Baixar</Btn>
        </div>
        {ultimoSync() && (
          <p className="text-[11px] text-muted mt-2.5">
            Ultima sincronizacao: {ultimoSync()!.toLocaleString('pt-BR')}
          </p>
        )}
      </Passo>

      <Sheet aberto={verSql} fechar={() => setVerSql(false)} titulo="SQL da tabela" alto>
        <p className="text-[12.5px] text-muted leading-relaxed mb-3">
          No painel do Supabase, abra <b>SQL Editor</b>, cole isso e clique em Run.
          Cria a tabela e as regras que deixam so voce ler seus dados.
        </p>
        <pre className="text-[11px] leading-relaxed bg-bg border border-line rounded-xl p-3 overflow-x-auto whitespace-pre text-muted">
          {SQL_SUPABASE}
        </pre>
        <Btn className="w-full mt-3" onClick={async () => {
          try {
            await navigator.clipboard.writeText(SQL_SUPABASE)
            toast('SQL copiado', 'ok')
          } catch { toast('Copie manualmente', 'erro') }
        }}>Copiar SQL</Btn>
      </Sheet>

      <Confirmar aberto={confirmarBaixar} perigo titulo="Substituir os dados deste aparelho?"
        texto="Tudo que esta aqui sera trocado pelo que esta na nuvem."
        onNao={() => setConfirmarBaixar(false)}
        onSim={() => tentar('baixar', async () => {
          setConfirmarBaixar(false)
          const r = await baixar()
          toast(`${r.registros} registros baixados`, 'ok')
          setTimeout(() => location.reload(), 900)
        })} />
    </Sheet>
  )
}

function SheetSaude({ aberto, fechar, perfil }: { aberto: boolean; fechar: () => void; perfil: TPerfil }) {
  const { toast } = useUI()
  const ligado = perfil.diabetesTipo1 === true

  return (
    <Sheet aberto={aberto} fechar={fechar} titulo="Saude">
      <Card className="p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold">Diabetes tipo 1</p>
            <p className="text-[12px] text-muted leading-relaxed mt-1">
              Com isso ligado, o carboidrato aparece em destaque em cada refeicao
              e voce ganha o registro de glicemia e insulina.
            </p>
          </div>
          <button
            onClick={async () => {
              await salvarPerfil({ diabetesTipo1: !ligado })
              toast(ligado ? 'Desligado' : 'Ligado', 'ok')
            }}
            className={`w-12 h-7 shrink-0 rounded-full transition-colors relative ${
              ligado ? 'grad-accent' : 'bg-surface-2 border border-line'
            }`}>
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
              ligado ? 'left-6' : 'left-1'
            }`} />
          </button>
        </div>
      </Card>

      {ligado && (
        <>
          <Card className="p-4 mb-3">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-accent mb-2">
              O que o app faz
            </h3>
            <ul className="text-[12.5px] leading-relaxed text-txt/85 space-y-1.5">
              <li>Mostra o carboidrato de cada refeicao antes do total de calorias.</li>
              <li>Gera o cardapio com carboidrato parecido entre as refeicoes, pra dose ficar previsivel.</li>
              <li>Guarda glicemia, insulina aplicada e contexto, com historico e grafico.</li>
            </ul>
          </Card>

          <Card className="p-4 mb-3 border-warn/30">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-warn mb-2">
              O que o app nao faz
            </h3>
            <p className="text-[12.5px] leading-relaxed text-txt/85">
              Nao calcula dose de insulina, razao carboidrato/insulina nem fator de
              correcao, e nao avalia se um valor esta bom ou ruim. Isso e do seu
              endocrinologista. Leve o plano de treino e o cardapio pra ele e pro
              nutricionista antes de comecar - superavit calorico muda a necessidade
              de insulina.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">
              Na academia
            </h3>
            <p className="text-[12.5px] leading-relaxed text-txt/85">
              Leve carboidrato de acao rapida na mochila e meca antes e depois do
              treino - o app tem os momentos "pre-treino" e "pos-treino" prontos no
              registro justamente pra voce enxergar esse padrao com o tempo.
            </p>
          </Card>
        </>
      )}
    </Sheet>
  )
}

function Passo({ n, titulo, feito, desabilitado, children }: {
  n: number; titulo: string; feito?: boolean; desabilitado?: boolean; children: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl border p-4 mb-3 ${
      desabilitado ? 'border-line/40 opacity-45 pointer-events-none' : 'border-line bg-surface'
    }`}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`w-6 h-6 rounded-lg text-[12px] font-bold flex items-center justify-center ${
          feito ? 'bg-good text-[#0a0714]' : 'bg-surface-2 text-muted'
        }`}>{feito ? '✓' : n}</span>
        <p className="text-[13.5px] font-bold">{titulo}</p>
      </div>
      {children}
    </div>
  )
}
