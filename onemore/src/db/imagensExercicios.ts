/**
 * Ilustracao de execucao de cada exercicio: id do OneMore -> nome do arquivo em
 * public/exercicios/<slug>-1.svg e -2.svg (inicio e fim do movimento).
 *
 * Arte: Bryl Lim (workout-guide), derivada do Everkinetic. CC BY-SA 4.0.
 * Exercicios diferentes que compartilham o mesmo movimento apontam pro mesmo
 * arquivo de proposito - nao duplica bytes.
 */
const SLUGS: Record<string, string> = {
  // peito
  'ex_supino-reto-com-barra': 'bench-press',
  'ex_supino-inclinado-com-barra': 'incline-bench-press',
  'ex_supino-declinado-com-barra': 'decline-bench-press',
  'ex_supino-reto-com-halteres': 'dumbbell-bench-press',
  'ex_supino-inclinado-com-halteres': 'incline-dumbbell-press',
  'ex_crucifixo-reto-com-halteres': 'dumbbell-fly',
  'ex_crucifixo-inclinado-com-halteres': 'dumbbell-fly',
  'ex_crossover-polia-alta': 'cable-fly',
  'ex_crossover-polia-baixa': 'incline-cable-fly',
  'ex_voador-peck-deck': 'pec-deck',
  'ex_supino-na-maquina': 'machine-chest-press',
  'ex_flexao-de-braco': 'push-up',
  'ex_flexao-com-pes-elevados': 'decline-push-up',
  'ex_mergulho-nas-paralelas': 'chest-dip',
  'ex_pullover-com-halter': 'straight-arm-pulldown',
  // costas
  'ex_barra-fixa-pronada': 'pull-up',
  'ex_barra-fixa-supinada': 'chin-up',
  'ex_encolhimento-com-halteres': 'dumbbell-shrug',
  'ex_levantamento-terra': 'deadlift',
  'ex_pulldown-com-bracos-estendidos': 'straight-arm-pulldown',
  'ex_puxada-com-triangulo': 'close-grip-lat-pulldown',
  'ex_puxada-frontal-na-polia': 'wide-grip-lat-pulldown',
  'ex_puxada-supinada-na-polia': 'lat-pulldown',
  'ex_remada-baixa-no-cabo': 'seated-row',
  'ex_remada-cavalinho-t-bar': 't-bar-row',
  'ex_remada-curvada-com-barra': 'barbell-row',
  'ex_remada-curvada-supinada': 'pendlay-row',
  'ex_remada-invertida': 'inverted-row',
  'ex_remada-na-maquina': 'machine-row',
  'ex_remada-unilateral-com-halter': 'one-arm-dumbbell-row',
  // ombro
  'ex_desenvolvimento-militar-com-barra': 'overhead-press',
  'ex_desenvolvimento-com-halteres': 'seated-dumbbell-press',
  'ex_desenvolvimento-arnold': 'arnold-press',
  'ex_desenvolvimento-na-maquina': 'machine-shoulder-press',
  'ex_elevacao-lateral-com-halteres': 'lateral-raise',
  'ex_elevacao-lateral-no-cabo': 'cable-lateral-raise',
  'ex_elevacao-frontal-com-halteres': 'front-raise',
  'ex_elevacao-frontal-com-anilha': 'plate-front-raise',
  'ex_crucifixo-inverso-com-halteres': 'rear-delt-fly',
  'ex_voador-inverso-na-maquina': 'reverse-pec-deck',
  'ex_face-pull-no-cabo': 'face-pull',
  'ex_remada-alta': 'upright-row',
  // biceps
  'ex_rosca-direta-com-barra': 'ez-bar-curl',
  'ex_rosca-direta-com-barra-w': 'ez-bar-curl',
  'ex_rosca-21': 'ez-bar-curl',
  'ex_rosca-alternada-com-halteres': 'bicep-curl',
  'ex_rosca-martelo': 'hammer-curl',
  'ex_rosca-concentrada': 'concentration-curl',
  'ex_rosca-scott': 'preacher-curl',
  'ex_rosca-no-cabo': 'cable-curl',
  'ex_rosca-inversa': 'reverse-curl',
  // triceps
  'ex_triceps-pulley-com-barra': 'tricep-pushdown',
  'ex_triceps-pulley-com-corda': 'rope-tricep-pushdown',
  'ex_triceps-testa-com-barra-w': 'skull-crusher',
  'ex_triceps-frances-com-halter': 'dumbbell-overhead-tricep-extension',
  'ex_triceps-coice': 'tricep-kickback',
  'ex_triceps-na-maquina': 'tricep-pushdown',
  'ex_supino-fechado': 'close-grip-bench-press',
  'ex_mergulho-no-banco': 'bench-dip',
  'ex_flexao-diamante': 'diamond-push-up',
  // antebraco
  'ex_rosca-de-punho': 'wrist-curl',
  'ex_rosca-de-punho-inversa': 'wrist-extension',
  'ex_caminhada-do-fazendeiro': 'farmer-carry',
  // quadriceps
  'ex_agachamento-livre': 'squat',
  'ex_agachamento-frontal': 'front-squat',
  'ex_agachamento-no-smith': 'smith-machine-squat',
  'ex_agachamento-goblet': 'goblet-squat',
  'ex_agachamento-peso-corporal': 'bodyweight-squat',
  'ex_agachamento-com-salto': 'jump-squat',
  'ex_agachamento-bulgaro': 'bulgarian-split-squat',
  'ex_hack-squat': 'hack-squat',
  'ex_leg-press-45': 'leg-press',
  'ex_cadeira-extensora': 'leg-extension',
  'ex_afundo-com-halteres': 'reverse-lunge',
  'ex_afundo-sem-peso': 'forward-lunge',
  'ex_passada-walking-lunge': 'walking-lunge',
  // posterior
  'ex_stiff-com-barra': 'romanian-deadlift',
  'ex_terra-romeno-com-halteres': 'dumbbell-romanian-deadlift',
  'ex_mesa-flexora': 'lying-leg-curl',
  'ex_cadeira-flexora-sentada': 'seated-leg-curl',
  'ex_bom-dia': 'good-morning',
  'ex_nordic-curl': 'nordic-hamstring-curl',
  // gluteo
  'ex_elevacao-pelvica-hip-thrust': 'hip-thrust',
  'ex_ponte-de-gluteo': 'glute-bridge',
  'ex_abducao-na-maquina': 'hip-abduction-machine',
  'ex_abducao-com-elastico': 'banded-standing-hip-abduction',
  'ex_coice-na-polia': 'cable-kickback',
  'ex_step-up-no-banco': 'step-up',
  'ex_agachamento-sumo-com-halter': 'dumbbell-sumo-squat',
  // panturrilha
  'ex_panturrilha-em-pe-na-maquina': 'standing-calf-raise',
  'ex_panturrilha-sentado': 'seated-calf-raise',
  'ex_panturrilha-no-leg-press': 'leg-press-calf-raise',
  'ex_panturrilha-em-pe-sem-peso': 'calf-raise',
  'ex_panturrilha-unilateral-com-halter': 'single-leg-calf-raise',
  // abdomen
  'ex_abdominal-supra-crunch': 'crunch',
  'ex_abdominal-bicicleta': 'bicycle-crunch',
  'ex_abdominal-na-polia-ajoelhado': 'cable-crunch',
  'ex_prancha': 'plank',
  'ex_prancha-lateral': 'side-plank',
  'ex_prancha-com-toque-no-ombro': 'plank-shoulder-tap',
  'ex_elevacao-de-pernas-deitado': 'lying-leg-raise',
  'ex_elevacao-de-pernas-na-barra': 'hanging-leg-raise',
  'ex_russian-twist': 'weighted-russian-twist',
  'ex_ab-wheel': 'ab-wheel',
  'ex_mountain-climber': 'mountain-climber',
  'ex_dead-bug': 'dead-bug',
  // lombar
  'ex_hiperextensao-lombar': 'back-extension',
  'ex_superman': 'superman',
  'ex_bird-dog': 'bird-dog',
  // cardio
  'ex_corrida-na-esteira': 'running',
  'ex_corrida-ao-ar-livre': 'running',
  'ex_caminhada-rapida': 'walking',
  'ex_caminhada-inclinada-na-esteira': 'treadmill-incline-walk',
  'ex_bicicleta-ergometrica': 'cycling',
  'ex_eliptico': 'elliptical',
  'ex_remo-ergometro': 'rowing',
  'ex_escada-stair': 'stair-climber',
  'ex_pular-corda': 'jump-rope',
  'ex_burpee': 'burpee',
  'ex_polichinelo': 'jumping-jack',
  'ex_elevacao-de-joelhos-no-lugar': 'high-knees',
  // corpo inteiro
  'ex_clean-and-press': 'push-press',
  'ex_snatch-com-halter': 'push-press',
  'ex_thruster': 'push-press',
  'ex_mobilidade-e-alongamento': 'worlds-greatest-stretch',
  'ex_kettlebell-swing': 'kettlebell-swing',
}

/**
 * Caminho do SVG do quadro pedido, ou null se o exercicio nao tem ilustracao.
 * Usa BASE_URL (e nao "/") pra continuar funcionando quando o app e publicado
 * num subcaminho, tipo usuario.github.io/onemore/.
 */
export function imagemExercicio(exercicioId: string, quadro: 1 | 2 = 1): string | null {
  const slug = SLUGS[exercicioId]
  return slug ? `${import.meta.env.BASE_URL}exercicios/${slug}-${quadro}.svg` : null
}

/** Quantos exercicios do catalogo tem ilustracao. */
export const TOTAL_COM_IMAGEM = Object.keys(SLUGS).length

export const CREDITO_IMAGENS = {
  autor: 'Bryl Lim',
  autorUrl: 'https://bryllim.com',
  fonte: 'Everkinetic',
  fonteUrl: 'https://github.com/everkinetic/data',
  licenca: 'CC BY-SA 4.0',
  licencaUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
}
