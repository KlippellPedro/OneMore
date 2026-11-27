import { useEffect, useState } from 'react'
import { db, uid } from '../db'
import { GRUPOS, EQUIPAMENTOS } from '../db/seedExercicios'
import { Btn, Sheet, Campo, Input, Select, Textarea } from './ui'
import { SelectFamilia } from './Variacoes'
import { useUI } from '../state/ui'
import { linkSeguro } from '../lib/format'
import type { Exercicio, GrupoMuscular, Equipamento } from '../db/types'

const linhas = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean)

/**
 * Cria um exercicio seu, ou edita um que voce criou. O mesmo formulario nos
 * dois casos: antes, depois de criado, nao dava pra corrigir nem um erro de
 * digitacao no nome - so apagar e criar de novo, e apagar tira o exercicio de
 * todas as rotinas.
 */
export function FormExercicio({ aberto, fechar, exercicio, nomeInicial, grupoInicial, onSalvo }: {
  aberto: boolean
  fechar: () => void
  /** Presente = editando esse. Ausente = criando um novo. */
  exercicio?: Exercicio
  /** Pra quem abriu a partir de uma busca que nao achou nada. */
  nomeInicial?: string
  grupoInicial?: GrupoMuscular
  onSalvo?: (ex: Exercicio) => void
}) {
  const { toast } = useUI()
  const [nome, setNome] = useState('')
  const [grupo, setGrupo] = useState<GrupoMuscular>('peito')
  const [equip, setEquip] = useState<Equipamento>('barra')
  const [familia, setFamilia] = useState<string | undefined>()
  const [exec, setExec] = useState('')
  const [erros, setErros] = useState('')
  const [video, setVideo] = useState('')

  useEffect(() => {
    if (!aberto) return
    setNome(exercicio?.nome ?? nomeInicial ?? '')
    setGrupo(exercicio?.grupo ?? grupoInicial ?? 'peito')
    setEquip(exercicio?.equipamento ?? 'barra')
    setFamilia(exercicio?.familia)
    setExec(exercicio?.execucao.join('\n') ?? '')
    setErros(exercicio?.erros?.join('\n') ?? '')
    setVideo(exercicio?.videoUrl ?? '')
  }, [aberto, exercicio?.id])

  async function salvar() {
    if (!nome.trim()) return toast('Dá um nome pro exercício', 'erro')
    if (video.trim() && !linkSeguro(video)) {
      return toast('Link do vídeo inválido', 'erro', 'Cole um endereço que comece com https://')
    }
    const campos = {
      nome: nome.trim(), grupo, equipamento: equip, familia,
      execucao: linhas(exec), erros: linhas(erros),
      videoUrl: linkSeguro(video),
      atualizadoEm: Date.now(),
    }
    let salvo: Exercicio
    if (exercicio) {
      await db.exercicios.update(exercicio.id, { ...campos, atualizadoEm: Date.now() })
      salvo = { ...exercicio, ...campos }
    } else {
      salvo = { id: 'usr_' + uid(), custom: true, ...campos }
      await db.exercicios.put(salvo)
    }
    onSalvo?.(salvo)
    fechar()
  }

  return (
    <Sheet aberto={aberto} fechar={fechar} titulo={exercicio ? 'Editar exercício' : 'Novo exercício'}>
      <Campo label="Nome"><Input value={nome} onChange={e => setNome(e.target.value)} autoFocus={!exercicio} /></Campo>
      <div className="grid grid-cols-2 gap-2">
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
      </div>
      <Campo label="Movimento" hint="Opcional. Faz ele aparecer como variação dos outros do mesmo movimento, e vice-versa.">
        <SelectFamilia valor={familia} onChange={setFamilia} />
      </Campo>
      <Campo label="Execução" hint="Uma etapa por linha.">
        <Textarea rows={4} value={exec} onChange={e => setExec(e.target.value)}
          placeholder={'Ajuste o banco\nDesça controlado\nEmpurre sem travar o cotovelo'} />
      </Campo>
      <Campo label="Erros comuns" hint="Opcional. Um por linha - aparece em vermelho na ficha.">
        <Textarea rows={2} value={erros} onChange={e => setErros(e.target.value)}
          placeholder="Tirar o quadril do banco" />
      </Campo>
      <Campo label="Link do vídeo" hint="Cole um link do YouTube e ele toca dentro do app.">
        <Input value={video} onChange={e => setVideo(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
      </Campo>
      <Btn variant="primary" size="lg" className="w-full mt-2" onClick={salvar}>
        {exercicio ? 'Salvar' : 'Criar exercício'}
      </Btn>
    </Sheet>
  )
}
