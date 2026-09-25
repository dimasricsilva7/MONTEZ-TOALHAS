/**
 * Textos padrão das páginas institucionais. O admin pode substituí-los em
 * Conteúdo → Páginas institucionais. Formato: parágrafos separados por linha
 * em branco, "## " para subtítulos e "- " para listas.
 * Revise com seu jurídico antes de publicar: {LOJA}, {CNPJ} e {EMAIL} são
 * preenchidos automaticamente a partir das Configurações.
 */
export const PAGE_DEFAULTS: Record<string, string> = {
  page_sobre: `A MONTEZ nasceu de uma ideia simples: levar para dentro de casa aquela sensação especial de chegar a um bom hotel e encontrar toalhas macias, encorpadas e impecáveis.

## A linha Hotel 600
Nossa primeira coleção reúne toalhas de banho e de rosto com 600 g/m², em 100% algodão e fio penteado, além de toalhas de piso coordenadas. São peças pensadas para o uso diário — secam bem, têm toque macio e mantêm a presença no banheiro.

## Menos excesso, mais cuidado
Preferimos poucas escolhas bem-feitas: três kits, dez cores e especificações claras. Tudo o que você precisa saber sobre cada peça está na página do produto — gramatura, composição e medidas.

## Fale com a gente
Dúvidas sobre produtos, pedidos ou entregas? Nosso atendimento responde pelos canais informados na página de contato.`,

  page_cuidados: `Toalhas bem cuidadas mantêm a maciez e a absorção por muito mais tempo. Estas orientações gerais valem para a linha MONTEZ Hotel 600 — em caso de diferença, siga sempre a etiqueta da peça.

## Antes do primeiro uso
- Lave as toalhas antes de usar. A primeira lavagem remove resíduos do processo de fabricação e melhora a absorção.
- Lave cores escuras separadamente nas primeiras lavagens.

## Lavagem
- Prefira água fria ou morna e sabão neutro.
- Evite alvejantes com cloro, que desbotam e enfraquecem as fibras.
- Use pouco ou nenhum amaciante: o excesso forma uma película que reduz a absorção.
- Não sobrecarregue a máquina — as toalhas precisam de espaço para enxaguar bem.

## Secagem
- Seque à sombra ou em secadora em temperatura baixa.
- Sacuda a toalha antes de estender para soltar a felpa.
- Não passe ferro sobre a felpa.

## Fios puxados
Se um fio da felpa puxar, não o arranque: corte-o rente com uma tesoura. Isso é normal em toalhas felpudas e não compromete a peça.`,

  page_privacidade: `Esta política explica como {LOJA} trata os dados pessoais de quem visita o site e compra nossos produtos, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).

## Quais dados coletamos
- Dados de identificação e contato: nome, CPF, e-mail e telefone, informados no checkout.
- Endereço de entrega.
- Dados do pedido e do pagamento (valor, status e identificador da transação). Não coletamos nem armazenamos dados bancários.
- Dados de navegação: páginas visitadas, origem do acesso (como parâmetros UTM), tipo de dispositivo e navegador, por meio de cookies e identificadores anônimos.

## Para que usamos
- Processar o pedido, gerar o pagamento PIX, emitir documentos fiscais e realizar a entrega.
- Enviar comunicações sobre o pedido (confirmação, lembrete de pagamento pendente e atualizações de entrega).
- Prevenir fraudes e garantir a segurança do site.
- Medir e melhorar o desempenho do site e das nossas campanhas.

## Com quem compartilhamos
- Processador de pagamentos (para gerar e confirmar o PIX).
- Transportadoras e operadores logísticos (para a entrega).
- Provedores de e-mail e de hospedagem.
- Plataformas de publicidade e análise (como Meta e Google), com dados de contato criptografados (hash) quando aplicável, para medição de campanhas.
Não vendemos dados pessoais.

## Por quanto tempo guardamos
Mantemos os dados pelo tempo necessário para cumprir as finalidades acima e as obrigações legais e fiscais aplicáveis.

## Seus direitos
Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade ou eliminação dos seus dados, além de informações sobre compartilhamento e revogação de consentimento, nos termos do art. 18 da LGPD.

## Cookies
Usamos cookies essenciais (carrinho e sessão) e cookies de medição e publicidade. Você pode gerenciá-los nas configurações do seu navegador.

## Contato
Para exercer seus direitos ou tirar dúvidas: {EMAIL}.
{LOJA} {CNPJ}`,

  page_termos: `Ao usar este site e realizar compras, você concorda com estes termos.

## Produtos e preços
As informações dos produtos (medidas, gramatura e composição) são apresentadas com o máximo cuidado. Pequenas variações de tonalidade podem ocorrer entre a tela e o produto real. Os preços válidos são os exibidos no momento da finalização do pedido.

## Pedidos e pagamento
O pagamento é feito via PIX. O pedido é confirmado somente após a compensação do pagamento, que é identificada automaticamente. Um código PIX tem validade limitada; após expirar, é necessário gerar um novo pedido.

## Entrega
O pedido é preparado após a confirmação do pagamento. O prazo de entrega varia conforme a região e é informado junto com o código de rastreio.

## Trocas, devoluções e arrependimento
Consulte a página Trocas e devoluções. Seus direitos previstos no Código de Defesa do Consumidor são sempre garantidos.

## Uso do site
É proibido utilizar o site para fins ilícitos, tentar acessar áreas restritas ou interferir no seu funcionamento.

## Contato
{LOJA} {CNPJ} · {EMAIL}`,

  page_trocas: `Queremos que você fique satisfeito com a sua compra. Veja como funcionam trocas e devoluções.

## Direito de arrependimento (7 dias)
Em compras feitas pela internet, você pode desistir da compra em até 7 dias corridos a partir do recebimento, conforme o artigo 49 do Código de Defesa do Consumidor. O valor pago é devolvido integralmente.

## Troca por cor ou kit
Para trocar a cor ou o kit, entre em contato dentro do prazo de 7 dias após o recebimento. O produto deve estar sem uso, sem lavagem e com as etiquetas.

## Produto com defeito
Se identificar algum defeito, fale com a gente dentro do prazo legal previsto no Código de Defesa do Consumidor (art. 26). Vamos avaliar e resolver com troca, reparo ou devolução do valor, conforme a lei.

## Como solicitar
Envie um e-mail para {EMAIL} com o número do pedido (ex.: MONTEZ-2026-000001), o motivo e, em caso de defeito, fotos do produto. Nossa equipe responde com as instruções de envio.

## Reembolso
Reembolsos de pagamentos via PIX são feitos por transferência para a conta de origem do pagamento, após o recebimento e a conferência do produto.`,
};

export function fillPlaceholders(text: string, settings: Record<string, string>) {
  return text
    .replace(/\{LOJA\}/g, settings.store_legal_name || settings.store_name || "MONTEZ")
    .replace(/\{CNPJ\}/g, settings.store_cnpj ? `· CNPJ ${settings.store_cnpj}` : "")
    .replace(/\{EMAIL\}/g, settings.contact_email || "nossos canais de atendimento");
}
