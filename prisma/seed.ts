/**
 * Seed idempotente do catálogo inicial MONTEZ.
 * Usa "create se não existir": rodar de novo NÃO sobrescreve edições do admin.
 * Não cria pedidos, avaliações ou métricas — nada de dados falsos.
 */
import { PrismaClient, Prisma } from "@prisma/client";

const db = new PrismaClient();

const COLORS = [
  { slug: "branco", internalName: "Branco", commercialName: "Branco Hotel", hex: "#F6F4EF" },
  { slug: "off-white", internalName: "Off-White", commercialName: "Off-White", hex: "#EEE7DA" },
  { slug: "areia", internalName: "Areia", commercialName: "Areia Natural", hex: "#DBC9AC" },
  { slug: "bege", internalName: "Bege", commercialName: "Bege Latte", hex: "#C6AA88" },
  { slug: "caqui", internalName: "Caqui", commercialName: "Caqui", hex: "#A38D6C" },
  { slug: "cinza", internalName: "Cinza", commercialName: "Cinza Mineral", hex: "#8D8C88" },
  { slug: "verde-oliva", internalName: "Verde Oliva", commercialName: "Oliva", hex: "#5D6543" },
  { slug: "preto", internalName: "Preto", commercialName: "Preto Ônix", hex: "#252423" },
  { slug: "marrom", internalName: "Marrom", commercialName: "Marrom Cacau", hex: "#5C4234" },
  { slug: "rosa-salmao", internalName: "Rosa Salmão Claro", commercialName: "Rosa Blush", hex: "#E8C3B3" },
];

const BANHO = {
  type: "banho",
  label: "Toalha de banho",
  dimensions: "90 × 150 cm",
  weight: "600 g/m²",
  composition: "100% algodão, fio penteado",
};
const ROSTO = {
  type: "rosto",
  label: "Toalha de rosto",
  dimensions: "50 × 80 cm",
  weight: "600 g/m²",
  composition: "100% algodão, fio penteado",
};
const PISO = {
  type: "piso",
  label: "Toalha de piso",
  dimensions: "50 × 70 cm",
  weight: "aprox. 400–440 g/m²",
  composition: "90% algodão, 10% fibra complementar",
};

const PRODUCTS = [
  {
    slug: "montez-m4",
    sku: "MTZ-M4",
    name: "MONTEZ M4",
    commercialName: "Kit Essencial",
    subtitle: "2 toalhas de banho + 2 toalhas de rosto",
    tagline: "Para renovar o essencial.",
    shortDescription: "O essencial da linha Hotel 600: duas toalhas de banho e duas de rosto em 100% algodão e fio penteado.",
    description:
      "O Kit Essencial reúne as peças que você usa todos os dias: duas toalhas de banho e duas toalhas de rosto da linha MONTEZ Hotel 600.\n\nCom 600 g/m², 100% algodão e fio penteado, são toalhas encorpadas, de toque macio e acabamento cuidadoso — para renovar o banheiro com a sensação de hotel.",
    priceCents: 9700,
    pieceCount: 4,
    pieces: [
      { ...BANHO, quantity: 2 },
      { ...ROSTO, quantity: 2 },
    ],
    featured: false,
    badge: null,
    sortOrder: 1,
  },
  {
    slug: "montez-m5",
    sku: "MTZ-M5",
    name: "MONTEZ M5",
    commercialName: "Kit Completo",
    subtitle: "2 banho + 2 rosto + 1 piso",
    tagline: "Para completar seu banheiro.",
    shortDescription: "Banho, rosto e piso na mesma cor: o conjunto completo para o seu banheiro.",
    description:
      "O Kit Completo soma à dupla de banho e rosto uma toalha de piso na mesma cor, para um banheiro coordenado do chão à bancada.\n\nToalhas de banho e rosto com 600 g/m², 100% algodão e fio penteado. Toalha de piso de 50 × 70 cm.",
    priceCents: 11990,
    pieceCount: 5,
    pieces: [
      { ...BANHO, quantity: 2 },
      { ...ROSTO, quantity: 2 },
      { ...PISO, quantity: 1 },
    ],
    featured: false,
    badge: null,
    sortOrder: 2,
  },
  {
    slug: "montez-m6",
    sku: "MTZ-M6",
    name: "MONTEZ M6",
    commercialName: "Kit Experiência MONTEZ",
    subtitle: "2 banho + 2 rosto + 2 piso",
    tagline: "Para viver a experiência MONTEZ completa.",
    shortDescription: "A experiência MONTEZ completa: seis peças coordenadas para transformar o banho de todos os dias.",
    description:
      "O Kit Experiência MONTEZ é o conjunto completo da linha Hotel 600: duas toalhas de banho, duas de rosto e duas de piso, todas na mesma cor.\n\nIdeal para quem quer o banheiro inteiro com a sensação de hotel — e sempre ter uma toalha de piso reserva enquanto a outra está na lavagem.",
    priceCents: 14990,
    pieceCount: 6,
    pieces: [
      { ...BANHO, quantity: 2 },
      { ...ROSTO, quantity: 2 },
      { ...PISO, quantity: 2 },
    ],
    featured: true,
    badge: "Mais vendido",
    sortOrder: 0,
  },
];

const FAQS: [string, string][] = [
  [
    "Qual a gramatura?",
    "As toalhas de banho e de rosto da linha MONTEZ Hotel 600 têm 600 g/m². A toalha de piso tem gramatura aproximada de 400 a 440 g/m².",
  ],
  [
    "As toalhas são 100% algodão?",
    "Sim, as toalhas de banho e de rosto são 100% algodão com fio penteado. A toalha de piso tem 90% algodão e 10% de fibra complementar.",
  ],
  [
    "O que significa 600 g/m²?",
    "É a gramatura: o peso do tecido por metro quadrado. Quanto maior a gramatura, mais algodão e mais felpa existem em cada área da toalha — o que resulta em uma peça mais encorpada.",
  ],
  [
    "O que é fio penteado?",
    "No fio penteado, o algodão passa por uma etapa extra que remove as fibras mais curtas e alinha as mais longas. O resultado é um fio mais uniforme, com toque mais macio e acabamento mais refinado.",
  ],
  [
    "Qual a diferença entre M4, M5 e M6?",
    "M4 (Kit Essencial): 2 toalhas de banho + 2 de rosto.\nM5 (Kit Completo): 2 de banho + 2 de rosto + 1 de piso.\nM6 (Kit Experiência MONTEZ): 2 de banho + 2 de rosto + 2 de piso.\nTodas as peças de um kit vêm na mesma cor.",
  ],
  [
    "Quais são as medidas?",
    "Toalha de banho: 90 × 150 cm.\nToalha de rosto: 50 × 80 cm.\nToalha de piso: 50 × 70 cm.",
  ],
  [
    "Quais cores estão disponíveis?",
    "A coleção tem 10 cores: Branco, Off-White, Areia, Bege, Caqui, Cinza, Verde Oliva, Preto, Marrom e Rosa Salmão Claro. Você escolhe a cor na página de cada kit.",
  ],
  [
    "Como lavar?",
    "Antes do primeiro uso, lave as toalhas separadamente. Prefira água fria ou morna e sabão neutro, evite alvejantes com cloro e use pouco amaciante (o excesso reduz a absorção). Seque à sombra ou em secadora em temperatura baixa e não passe ferro sobre a felpa. Siga sempre as instruções da etiqueta.",
  ],
  [
    "Como funciona o PIX?",
    "Ao finalizar o pedido, geramos um QR Code e um código PIX copia e cola. Basta pagar pelo app do seu banco: a confirmação é automática e a página do pedido é atualizada sozinha. O código tem validade limitada — se expirar, é só fazer um novo pedido.",
  ],
  [
    "Como acompanhar o pedido?",
    "Acesse a página Rastrear pedido e informe o número do pedido (ex.: MONTEZ-2026-000001) e o e-mail usado na compra. Quando o pedido for despachado, você também recebe o código de rastreio por e-mail.",
  ],
  [
    "Qual o prazo de entrega?",
    "O pedido é preparado após a confirmação do pagamento. O prazo de entrega varia conforme a sua região e é informado junto com o código de rastreio.",
  ],
  [
    "Como funciona troca/devolução?",
    "Você pode desistir da compra em até 7 dias corridos após o recebimento, conforme o artigo 49 do Código de Defesa do Consumidor. Para trocas, o produto deve estar sem uso e com etiquetas. Veja todos os detalhes na página Trocas e devoluções ou fale com nosso atendimento.",
  ],
];

const ORDER_BUMPS = [
  {
    sku: "MTZ-BUMP-ROSTO",
    title: "+ 1 toalha de rosto MONTEZ",
    description: "50 × 80 cm · 600 g/m² · na mesma cor do seu kit",
    priceCents: 2490,
    sortOrder: 0,
  },
  {
    sku: "MTZ-BUMP-BANHO",
    title: "+ 1 toalha de banho MONTEZ",
    description: "90 × 150 cm · 600 g/m² · na mesma cor do seu kit",
    priceCents: 3990,
    sortOrder: 1,
  },
  {
    sku: "MTZ-BUMP-PISO",
    title: "+ 1 toalha de piso MONTEZ",
    description: "50 × 70 cm · na mesma cor do seu kit",
    priceCents: 2990,
    sortOrder: 2,
  },
];

const UPSELLS = [
  {
    sku: "MTZ-UPSELL-BANHO2",
    headline: "Seu banheiro pode ficar ainda mais completo.",
    title: "+ 2 toalhas de banho MONTEZ",
    description: "Mais duas toalhas de banho de 90 × 150 cm, 600 g/m², na mesma cor do seu pedido. Pagamento separado via PIX — seu pedido original já está confirmado.",
    priceCents: 6990,
    sortOrder: 0,
  },
];

async function main() {
  for (const [i, c] of COLORS.entries()) {
    await db.color.upsert({ where: { slug: c.slug }, update: {}, create: { ...c, sortOrder: i } });
  }
  const colors = await db.color.findMany();

  for (const p of PRODUCTS) {
    const product = await db.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        ...p,
        kind: "KIT",
        pieces: p.pieces as unknown as Prisma.InputJsonValue,
        specs: [
          { label: "Linha", value: "MONTEZ Hotel 600" },
          { label: "Peças", value: `${p.pieceCount} peças` },
          { label: "Gramatura (banho e rosto)", value: "600 g/m²" },
          { label: "Composição (banho e rosto)", value: "100% algodão, fio penteado" },
        ],
        composition: "Banho e rosto: 100% algodão, fio penteado",
        weight: "600 g/m² (banho e rosto)",
        dimensions: p.pieces.map((x) => `${x.label}: ${x.dimensions}`).join(" · "),
        stockQuantity: 0,
        allowBackorder: true,
        lowStockThreshold: 5,
      },
    });
    for (const color of colors) {
      await db.productVariant.upsert({
        where: { productId_colorId: { productId: product.id, colorId: color.id } },
        update: {},
        create: { productId: product.id, colorId: color.id, sku: `${p.sku}-${color.slug.toUpperCase()}`, stockQuantity: 0 },
      });
    }
  }

  if ((await db.faq.count()) === 0) {
    await db.faq.createMany({ data: FAQS.map(([question, answer], i) => ({ question, answer, sortOrder: i })) });
  }
  for (const b of ORDER_BUMPS) await db.orderBump.upsert({ where: { sku: b.sku }, update: {}, create: b });
  for (const u of UPSELLS) await db.upsell.upsert({ where: { sku: u.sku }, update: {}, create: u });

  console.log("Seed concluído: cores, kits, variantes, FAQ, order bumps e upsell.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
