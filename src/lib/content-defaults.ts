/**
 * Conteúdo padrão do site. Qualquer chave pode ser sobrescrita pelo admin
 * (tabela site_content). Imagens ficam vazias por padrão: são definidas pela
 * biblioteca de mídia — nenhuma URL de imagem crítica é fixa no código.
 */
export type ContentField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "image" | "boolean" | "select";
  options?: string[];
  default: string;
};

export type ContentGroup = { id: string; title: string; description?: string; fields: ContentField[] };

export const CONTENT_GROUPS: ContentGroup[] = [
  {
    id: "announcement",
    title: "Barra superior",
    fields: [
      { key: "announcement_enabled", label: "Exibir barra", type: "boolean", default: "true" },
      { key: "announcement_bar", label: "Texto", type: "text", default: "Frete grátis para todo o Brasil • 7 dias para trocar • PIX com confirmação na hora" },
    ],
  },
  {
    id: "hero",
    title: "Hero (topo da home)",
    fields: [
      { key: "hero_enabled", label: "Hero ativo", type: "boolean", default: "true" },
      { key: "hero_eyebrow", label: "Sobretítulo", type: "text", default: "Coleção MONTEZ Hotel 600" },
      { key: "hero_title", label: "Título", type: "text", default: "A sensação de hotel." },
      { key: "hero_title_2", label: "Título (linha 2)", type: "text", default: "No conforto da sua casa." },
      {
        key: "hero_subtitle",
        label: "Texto",
        type: "textarea",
        default:
          "Lembra daquela toalha grossa e macia do hotel, que abraça quando você sai do banho? Ela pode ser a sua, todos os dias. 600 g/m² de algodão penteado, em kits completos e dez cores para o seu banheiro.",
      },
      { key: "hero_cta", label: "CTA principal", type: "text", default: "Quero sentir essa diferença" },
      { key: "hero_cta_href", label: "Link do CTA principal", type: "text", default: "/#kits" },
      { key: "hero_cta_secondary", label: "CTA secundário", type: "text", default: "Ver as cores" },
      { key: "hero_cta_secondary_href", label: "Link do CTA secundário", type: "text", default: "/#cores" },
      { key: "hero_reassurance", label: "Frase de segurança abaixo dos botões", type: "text", default: "Frete grátis · 7 dias para trocar · Pague com PIX" },
      { key: "hero_text_position", label: "Posição do texto", type: "select", options: ["left", "center", "right"], default: "left" },
      { key: "hero_image_desktop", label: "Imagem desktop", type: "image", default: "" },
      { key: "hero_image_mobile", label: "Imagem mobile", type: "image", default: "" },
      { key: "hero_image_alt", label: "Texto alternativo da imagem", type: "text", default: "Toalhas MONTEZ dobradas em um banheiro claro" },
    ],
  },
  {
    id: "benefits",
    title: "Benefícios",
    fields: [
      { key: "benefit_1_title", label: "Card 1 — título", type: "text", default: "600 g/m²" },
      { key: "benefit_1_text", label: "Card 1 — texto", type: "text", default: "Grossa e pesada na mão, do jeito que toalha boa tem que ser." },
      { key: "benefit_2_title", label: "Card 2 — título", type: "text", default: "100% algodão" },
      { key: "benefit_2_text", label: "Card 2 — texto", type: "text", default: "Fibra natural, gostosa na pele e que seca de verdade." },
      { key: "benefit_3_title", label: "Card 3 — título", type: "text", default: "Fio penteado" },
      { key: "benefit_3_text", label: "Card 3 — texto", type: "text", default: "Toque mais macio e uniforme, sem aspereza." },
      { key: "benefit_4_title", label: "Card 4 — título", type: "text", default: "Kits completos" },
      { key: "benefit_4_text", label: "Card 4 — texto", type: "text", default: "Banho, rosto e piso na mesma cor. Você só escolhe o tom." },
    ],
  },
  {
    id: "kits",
    title: "Bloco de kits",
    fields: [
      { key: "kits_title", label: "Título", type: "text", default: "Escolha o kit do seu banheiro" },
      {
        key: "kits_subtitle",
        label: "Subtítulo",
        type: "textarea",
        default: "Do essencial ao banheiro completo: todas as peças vêm na mesma cor, para deixar o banheiro coordenado — ou para presentear alguém especial.",
      },
    ],
  },
  {
    id: "colors",
    title: "Bloco de cores",
    fields: [
      { key: "colors_title", label: "Título", type: "text", default: "Qual é a cor do seu banheiro?" },
      {
        key: "colors_subtitle",
        label: "Subtítulo",
        type: "textarea",
        default: "Toque numa cor e veja como fica. São dez tons pensados para combinar com o que você já tem — do branco de hotel ao rosa delicado.",
      },
    ],
  },
  {
    id: "experience",
    title: "Bloco de experiência",
    fields: [
      { key: "experience_title", label: "Título", type: "text", default: "Você sente a diferença no primeiro toque." },
      {
        key: "experience_text",
        label: "Texto",
        type: "textarea",
        default:
          "Tem toalha que só seca. E tem toalha que acolhe. A MONTEZ tem felpa densa, peso generoso e aquele toque macio que faz você querer ficar mais um minuto enrolado depois do banho.",
      },
      { key: "experience_image", label: "Imagem (macro da textura)", type: "image", default: "" },
      { key: "experience_point_1", label: "Ponto 1", type: "text", default: "Textura — felpa encorpada e uniforme" },
      { key: "experience_point_2", label: "Ponto 2", type: "text", default: "Espessura — 600 g/m² nas toalhas de banho e rosto" },
      { key: "experience_point_3", label: "Ponto 3", type: "text", default: "Acabamento — barra tecida e costuras reforçadas" },
      { key: "experience_point_4", label: "Ponto 4", type: "text", default: "Identidade — etiqueta MONTEZ em cada peça" },
    ],
  },
  {
    id: "hotel",
    title: "Bloco Hotel em casa",
    fields: [
      { key: "hotel_title", label: "Título", type: "text", default: "Seu banho merece outro nível de conforto." },
      {
        key: "hotel_text",
        label: "Texto",
        type: "textarea",
        default:
          "A gente acredita que conforto não é luxo de viagem. É o primeiro banho da manhã, o último da noite, o cheiro de toalha limpa no domingo. A MONTEZ nasceu para levar essa sensação de hotel para dentro da sua casa — e deixar ela ali, todos os dias.",
      },
      { key: "hotel_cta", label: "CTA", type: "text", default: "Quero esse conforto em casa" },
      { key: "hotel_cta_href", label: "Link do CTA", type: "text", default: "/#kits" },
      { key: "hotel_image", label: "Imagem lifestyle", type: "image", default: "" },
    ],
  },
  {
    id: "compare",
    title: "Bloco comparativo",
    fields: [
      { key: "compare_title", label: "Título", type: "text", default: "O que você recebe em cada peça" },
      {
        key: "compare_items",
        label: "Itens (um por linha)",
        type: "textarea",
        default: "600 g/m² nas toalhas de banho e rosto\n100% algodão\nFio penteado\nSeleção de 10 cores\nKits completos para o banheiro",
      },
    ],
  },
  {
    id: "choose",
    title: "Bloco Qual kit escolher?",
    fields: [{ key: "choose_title", label: "Título", type: "text", default: "Ainda em dúvida? Compare os kits" }],
  },
  {
    id: "moments",
    title: "Bloco Momentos (emocional)",
    fields: [
      { key: "moments_enabled", label: "Exibir bloco", type: "boolean", default: "true" },
      { key: "moments_title", label: "Título", type: "text", default: "Pequenos momentos que ficam melhores" },
      { key: "moment_1_title", label: "Momento 1 — título", type: "text", default: "Depois de um dia longo" },
      { key: "moment_1_text", label: "Momento 1 — texto", type: "textarea", default: "Banho quente, toalha grossa nos ombros e, por alguns minutos, nada mais importa." },
      { key: "moment_2_title", label: "Momento 2 — título", type: "text", default: "Domingo de manhã" },
      { key: "moment_2_text", label: "Momento 2 — texto", type: "textarea", default: "Sem pressa, sem despertador. Só você e aquela maciez que lembra férias." },
      { key: "moment_3_title", label: "Momento 3 — título", type: "text", default: "Quando chega visita" },
      { key: "moment_3_text", label: "Momento 3 — texto", type: "textarea", default: "Toalhas combinando, bem dobradas no banheiro. Aquele cuidado que todo mundo repara." },
      { key: "moment_image", label: "Imagem do bloco (opcional)", type: "image", default: "" },
    ],
  },
  {
    id: "gift",
    title: "Bloco Presente",
    fields: [
      { key: "gift_enabled", label: "Exibir bloco", type: "boolean", default: "true" },
      { key: "gift_title", label: "Título", type: "text", default: "Um presente que a pessoa usa todos os dias" },
      {
        key: "gift_text",
        label: "Texto",
        type: "textarea",
        default: "Casa nova, casamento, aniversário ou só porque sim. Um kit MONTEZ é aquele presente bonito de abrir e gostoso de usar — e a pessoa lembra de você a cada banho.",
      },
      { key: "gift_cta", label: "CTA", type: "text", default: "Escolher um kit para presentear" },
      { key: "gift_image", label: "Imagem (opcional)", type: "image", default: "" },
    ],
  },
  {
    id: "guarantee",
    title: "Bloco Compra sem risco",
    fields: [
      { key: "guarantee_title", label: "Título", type: "text", default: "Compre com tranquilidade" },
      { key: "guarantee_1", label: "Item 1", type: "text", default: "Frete grátis para todo o Brasil, com código de rastreio." },
      { key: "guarantee_2", label: "Item 2", type: "text", default: "Não amou? Você tem 7 dias após receber para devolver." },
      { key: "guarantee_3", label: "Item 3", type: "text", default: "PIX com confirmação automática, sem dados de cartão." },
      { key: "guarantee_4", label: "Item 4", type: "text", default: "Atendimento de gente de verdade, do pedido à entrega." },
    ],
  },
  {
    id: "reviews",
    title: "Avaliações",
    fields: [{ key: "reviews_title", label: "Título", type: "text", default: "Quem já tem MONTEZ em casa" }],
  },
  {
    id: "trust",
    title: "Selos de confiança (fatos reais)",
    fields: [
      { key: "trust_1", label: "Item 1", type: "text", default: "Pagamento via PIX com confirmação automática" },
      { key: "trust_2", label: "Item 2", type: "text", default: "Dados protegidos e checkout seguro" },
      { key: "trust_3", label: "Item 3", type: "text", default: "7 dias para arrependimento, conforme o CDC" },
      { key: "trust_4", label: "Item 4", type: "text", default: "Atendimento humano pelos nossos canais" },
    ],
  },
  {
    id: "final",
    title: "CTA final",
    fields: [
      { key: "final_title", label: "Título", type: "text", default: "Seu próximo banho pode ser diferente." },
      { key: "final_text", label: "Texto", type: "text", default: "Escolha o kit, a cor, pague com PIX — e em poucos dias a sensação de hotel chega na sua porta." },
      { key: "final_cta", label: "CTA", type: "text", default: "Escolher meu kit agora" },
      { key: "final_image", label: "Imagem de fundo", type: "image", default: "" },
    ],
  },
  {
    id: "footer",
    title: "Rodapé",
    fields: [
      { key: "footer_tagline", label: "Assinatura", type: "text", default: "Hotel Collection" },
      {
        key: "footer_text",
        label: "Texto institucional",
        type: "textarea",
        default: "Toalhas de 600 g/m² em 100% algodão e fio penteado. A sensação de hotel, no conforto da sua casa.",
      },
    ],
  },
  {
    id: "checkout",
    title: "Checkout e PIX",
    fields: [
      { key: "checkout_note", label: "Nota no checkout", type: "text", default: "Pagamento 100% via PIX, com confirmação automática." },
      { key: "pix_title", label: "Título da página PIX", type: "text", default: "Seu PIX está pronto." },
      {
        key: "pix_note",
        label: "Mensagem da página PIX",
        type: "text",
        default: "Após realizar o pagamento, esta página será atualizada automaticamente.",
      },
      { key: "success_title", label: "Título de sucesso", type: "text", default: "Pedido confirmado!" },
      { key: "success_text", label: "Mensagem de sucesso", type: "text", default: "Obrigado por escolher a MONTEZ. Seu kit já está sendo separado com carinho." },
    ],
  },
  {
    id: "pages",
    title: "Páginas institucionais",
    description: "Textos em formato simples: parágrafos separados por linha em branco; linhas iniciadas com ## viram subtítulos.",
    fields: [
      { key: "page_sobre", label: "Sobre", type: "textarea", default: "" },
      { key: "page_cuidados", label: "Cuidados", type: "textarea", default: "" },
      { key: "page_privacidade", label: "Política de privacidade", type: "textarea", default: "" },
      { key: "page_termos", label: "Termos de uso", type: "textarea", default: "" },
      { key: "page_trocas", label: "Trocas e devoluções", type: "textarea", default: "" },
    ],
  },
];

export const CONTENT_DEFAULTS: Record<string, string> = Object.fromEntries(
  CONTENT_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f.default]))
);

export type SettingField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "money" | "boolean" | "image";
  help?: string;
  default: string;
  group: string;
};

export const SETTING_FIELDS: SettingField[] = [
  { group: "Loja", key: "store_name", label: "Nome da loja", type: "text", default: "MONTEZ" },
  { group: "Loja", key: "store_legal_name", label: "Razão social", type: "text", default: "" },
  { group: "Loja", key: "store_cnpj", label: "CNPJ", type: "text", default: "", help: "Exibido no rodapé quando preenchido." },
  { group: "Loja", key: "store_logo", label: "Logo (opcional — padrão é o logotipo tipográfico)", type: "image", default: "" },
  { group: "Loja", key: "store_favicon", label: "Favicon (URL)", type: "image", default: "" },
  { group: "Contato", key: "contact_email", label: "E-mail de atendimento", type: "text", default: "" },
  { group: "Contato", key: "contact_whatsapp", label: "WhatsApp (somente números, com DDD)", type: "text", default: "" },
  { group: "Contato", key: "contact_instagram", label: "Instagram (@usuario)", type: "text", default: "" },
  { group: "Contato", key: "contact_address", label: "Endereço", type: "textarea", default: "" },
  { group: "Contato", key: "contact_hours", label: "Horário de atendimento", type: "text", default: "" },
  { group: "Pedidos", key: "shipping_flat_cents", label: "Frete fixo (R$)", type: "money", default: "0", help: "0 = frete grátis." },
  { group: "Pedidos", key: "shipping_note", label: "Texto sobre envio", type: "text", default: "Enviamos para todo o Brasil. O código de rastreio é enviado por e-mail." },
  { group: "Pagamento", key: "pix_expiration_minutes", label: "Validade do PIX (minutos)", type: "number", default: "60" },
  { group: "E-mail", key: "recovery_delay_minutes", label: "Recuperação de PIX após (minutos)", type: "number", default: "15" },
  { group: "E-mail", key: "confirmation_delay_minutes", label: "E-mail de confirmação após pagamento (minutos)", type: "number", default: "15" },
  { group: "E-mail", key: "recovery_enabled", label: "Enviar e-mail de recuperação de PIX", type: "boolean", default: "true" },
  { group: "E-mail", key: "confirmation_enabled", label: "Enviar e-mail de confirmação", type: "boolean", default: "true" },
  { group: "SEO", key: "seo_title", label: "Título padrão", type: "text", default: "MONTEZ | Toalhas 600 g/m² 100% algodão — A sensação de hotel em casa" },
  {
    group: "SEO",
    key: "seo_description",
    label: "Descrição padrão",
    type: "textarea",
    default: "Kits de toalhas MONTEZ Hotel 600: 600 g/m², 100% algodão e fio penteado, em 10 cores. Compre com PIX e confirmação automática.",
  },
  { group: "SEO", key: "seo_og_image", label: "Imagem de compartilhamento (Open Graph)", type: "image", default: "" },
  { group: "Tracking", key: "tracking_meta_enabled", label: "Meta Pixel/CAPI ativos", type: "boolean", default: "true", help: "Os IDs ficam em variáveis de ambiente." },
  { group: "Tracking", key: "tracking_ga_enabled", label: "Google Analytics ativo", type: "boolean", default: "true" },
];

export const SETTING_DEFAULTS: Record<string, string> = Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, f.default]));
