import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Titulo } from '../components/Cabecalho'
import { Card } from '../components/ui'
import { CONTATO, RESPONSAVEL, POLITICA_ATUALIZADA_EM } from '../lib/privacidade'

/**
 * Politica de privacidade. Dois jeitos de chegar aqui, por isso dois exports:
 *
 *  - rota /privacidade (dentro do app, com Perfil e barra de abas);
 *  - a tela de entrada, que aparece ANTES do HashRouter existir - la nao da pra
 *    usar useNavigate, entao ela renderiza `Politica` direto com um onVoltar.
 *
 * O texto descreve o que o codigo FAZ hoje (servidor/ e src/lib/sync.ts). Se
 * mudar o que o app coleta, guarda ou manda pra fora, mude aqui junto e atualize
 * POLITICA_ATUALIZADA_EM em lib/privacidade.ts.
 */
export function Politica({ onVoltar, rotulo = 'Voltar' }: { onVoltar: () => void; rotulo?: string }) {
  const quem = RESPONSAVEL || 'o desenvolvedor do OneMore'

  return (
    <div className="min-h-full max-w-[560px] mx-auto pb-16">
      <div className="px-4 pt-4 safe-t">
        <button onClick={onVoltar}
          className="toque text-[13px] font-semibold text-accent py-1.5 -ml-1 px-1">
          {'<'} {rotulo}
        </button>
      </div>
      <Titulo titulo="Política de privacidade" sub={`Atualizada em ${POLITICA_ATUALIZADA_EM}`} />

      <div className="px-4 space-y-3">
        <Card className="p-4" destaque>
          <h2 className="text-[14px] font-bold mb-2">Em resumo</h2>
          <ul className="text-[13px] leading-relaxed space-y-1.5 list-disc pl-4">
            <li>Sem conta, <b>nada sai do seu aparelho</b>. O app funciona inteiro assim.</li>
            <li>Com conta, guardamos seu e-mail e um <b>backup dos seus dados</b> (inclusive de saúde, se você preencher) para você usar em mais de um aparelho.</li>
            <li>Não há anúncios, rastreadores nem análise de uso. <b>Não vendemos nem compartilhamos</b> seus dados para marketing.</li>
            <li>Você pode baixar tudo e <b>excluir a conta</b> quando quiser, no Perfil.</li>
          </ul>
        </Card>

        <Secao n={1} titulo="Quem é o responsável">
          <p>
            Quem decide como seus dados são tratados (o controlador, na LGPD) é {quem}.{' '}
            {CONTATO
              ? <>Para qualquer pedido sobre seus dados, escreva para <a href={`mailto:${CONTATO}`} className="text-accent font-semibold">{CONTATO}</a>.</>
              : <>Para qualquer pedido sobre seus dados, fale com quem lhe passou o app.</>}
          </p>
        </Secao>

        <Secao n={2} titulo="O que fica só no seu aparelho">
          <p>
            Perfil, treinos, histórico, dieta, água, medidas, glicemia, XP e preferências ficam
            no armazenamento do próprio navegador (IndexedDB e localStorage). Se você usa o app
            sem conta, <b>é só isso</b>: nenhum desses dados é enviado a nós. Apagar os dados do
            navegador ou usar &quot;Apagar tudo&quot; no Perfil remove tudo.
          </p>
        </Secao>

        <Secao n={3} titulo="O que guardamos quando você cria uma conta">
          <ul className="list-disc pl-4 space-y-1.5">
            <li><b>E-mail.</b> Serve para identificar a conta. Cada e-mail só pode ter uma conta.</li>
            <li><b>Senha e código de recuperação.</b> Guardamos apenas um <i>hash</i> (scrypt), nunca o texto. Nem nós conseguimos ver sua senha. Por isso, se você perder a senha e o código de recuperação, não há como recuperar a conta.</li>
            <li>
              <b>Backup dos seus dados</b>, enviado pelo app ao sincronizar: nome, sexo, data de
              nascimento ou idade, altura, peso, objetivo e metas, treinos e histórico, dieta e
              alimentos, água, medidas corporais, XP e conquistas. Se você ativar, também{' '}
              <b>dados de saúde</b>: diabetes tipo 1 e registros de glicemia, hipertensão e
              restrições alimentares (alergias e intolerâncias).
            </li>
            <li><b>Sessão.</b> Um cookie essencial (<code>onemore_sessao</code>), inacessível a scripts da página, mantém você conectado por até 90 dias. No servidor guardamos só um hash dele.</li>
            <li><b>Lembretes com o app fechado</b>, se você aceitar notificações: o endereço e as chaves de notificação do seu navegador e a agenda dos próximos lembretes (título e texto, como &quot;beber água&quot;).</li>
            <li><b>Registros técnicos.</b> O servidor anota, para cada requisição, o método, o caminho, o código de resposta e o tempo. Não anota e-mail, senha nem o conteúdo dos seus dados. O endereço IP é usado, só na memória, para limitar tentativas de login seguidas; a hospedagem pode registrar IPs na infraestrutura dela.</li>
          </ul>
          <p className="mt-2">
            Dados de saúde são <b>dados pessoais sensíveis</b>. Você escolhe se os preenche, e o
            app funciona sem eles.
          </p>
        </Secao>

        <Secao n={4} titulo="Para que usamos, e com qual base legal">
          <p>
            Usamos esses dados <b>apenas para fazer o app funcionar</b>: entrar na conta, guardar e
            sincronizar seu backup, enviar os lembretes que você ligou e proteger a conta contra
            abuso. A base legal é a execução do serviço que você pediu ao criar a conta (LGPD,
            art. 7º, V) e, para dados de saúde, o seu <b>consentimento</b> (art. 11, I), dado ao
            preenchê-los e sincronizá-los. Você pode retirar o consentimento a qualquer momento
            excluindo a conta ou os dados.
          </p>
        </Secao>

        <Secao n={5} titulo="Com quem os dados passam">
          <p className="mb-2">Não vendemos dados e não os usamos para publicidade. Para o app existir, alguns terceiros entram no caminho:</p>
          <ul className="list-disc pl-4 space-y-1.5">
            <li><b>Discloud</b> hospeda o site e o banco de dados onde ficam sua conta e seu backup.</li>
            <li><b>Serviços de notificação do navegador</b> (Google, Apple, Mozilla ou Microsoft, conforme seu aparelho) entregam os lembretes. O conteúdo viaja criptografado com a chave do seu aparelho; eles veem que existe uma notificação, não o texto.</li>
            <li><b>YouTube (Google).</b> Ao abrir a ficha de um exercício com vídeo, o player do YouTube é carregado e o Google pode receber seu IP e dados do navegador, conforme a política deles. Isso só acontece nessa tela.</li>
          </ul>
        </Secao>

        <Secao n={6} titulo="Como protegemos">
          <p>
            Conexão por HTTPS; senhas e códigos com hash forte; cookie de sessão protegido contra
            leitura por scripts; limite de tentativas de login; cabeçalhos de segurança no site.
            Seu backup fica no banco de dados <b>sem criptografia de ponta a ponta</b>: quem
            administra o banco tecnicamente teria acesso a ele, e esse acesso é restrito. Nenhum
            sistema é 100% seguro; se houver um incidente que possa lhe causar dano relevante,
            avisaremos você e a autoridade competente, como a lei manda.
          </p>
        </Secao>

        <Secao n={7} titulo="Por quanto tempo guardamos">
          <p>
            Enquanto a conta existir. Ao <b>excluir a conta</b> (Perfil &gt; Sua conta e sincronização &gt;
            Excluir minha conta), apagamos na hora a conta, o backup, as sessões e as inscrições de
            notificação. As sessões também vencem sozinhas em 90 dias. Os dados que estão no seu
            aparelho continuam nele até você apagá-los.
          </p>
        </Secao>

        <Secao n={8} titulo="Seus direitos">
          <p className="mb-2">Pela LGPD (art. 18), você pode:</p>
          <ul className="list-disc pl-4 space-y-1.5">
            <li><b>Acessar e levar seus dados</b>: Perfil &gt; Baixar backup gera um arquivo JSON com tudo.</li>
            <li><b>Corrigir</b>: edite no próprio app; a sincronização leva a correção para a conta.</li>
            <li><b>Eliminar</b>: &quot;Apagar tudo&quot; zera o conteúdo e &quot;Excluir minha conta&quot; remove a conta.</li>
            <li><b>Retirar o consentimento</b> e pedir informações sobre o tratamento e o compartilhamento.</li>
          </ul>
          <p className="mt-2">
            O que o app não resolver sozinho, peça pelo contato da seção 1; respondemos em até 15
            dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
        </Secao>

        <Secao n={9} titulo="Menores de idade">
          <p>
            O OneMore não é voltado a crianças. Se você tem menos de 18 anos, use o app com o
            conhecimento de um responsável, principalmente ao criar conta ou informar dados de saúde.
          </p>
        </Secao>

        <Secao n={10} titulo="Mudanças nesta política">
          <p>
            Se o que o app coleta ou compartilha mudar, atualizamos esta página e a data no topo.
          </p>
        </Secao>
      </div>
    </div>
  )
}

function Secao({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="text-[14px] font-bold mb-2">{n}. {titulo}</h2>
      <div className="text-[13px] leading-relaxed text-txt/90">{children}</div>
    </Card>
  )
}

/** A rota /privacidade: volta pro Perfil, de onde a pessoa veio. */
export default function Privacidade() {
  const ir = useNavigate()
  return <Politica onVoltar={() => ir('/perfil')} rotulo="Perfil" />
}
