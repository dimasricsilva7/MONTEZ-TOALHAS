/**
 * Atualiza as descrições dos kits para a copy humanizada (out/2026).
 * Só altera campos que ainda têm o texto original do seed — nunca sobrescreve
 * edições feitas pelo admin. Também lista conteúdos do CMS salvos no banco
 * (que têm prioridade sobre os textos padrão do código).
 *   DATABASE_URL=... npx tsx scripts/update-copy-2026-10.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

const COPY: Record<string, { old: { shortDescription: string; descriptionStart: string }; shortDescription: string; description: string }> = {
  "montez-m4": {
    old: { shortDescription: "O essencial da linha Hotel 600: duas toalhas de banho e duas de rosto em 100% algodão e fio penteado.", descriptionStart: "O Kit Essencial reúne as peças" },
    shortDescription: "Duas toalhas de banho e duas de rosto, grossas e macias, para transformar o banho de todo dia sem complicar.",
    description:
      "Sabe quando a toalha antiga já não seca direito e ficou áspera? O Kit Essencial resolve isso de um jeito simples: duas toalhas de banho e duas de rosto da linha Hotel 600, em 100% algodão com fio penteado.\n\nSão 600 g/m² — você sente o peso na mão e a maciez na pele. Ideal para renovar o banheiro, para quem mora sozinho ou a dois, ou para dar de presente.",
  },
  "montez-m5": {
    old: { shortDescription: "Banho, rosto e piso na mesma cor: o conjunto completo para o seu banheiro.", descriptionStart: "O Kit Completo soma" },
    shortDescription: "Banho, rosto e piso na mesma cor. O banheiro inteiro coordenado, do chão à bancada.",
    description:
      "O Kit Completo é para quem quer aquele banheiro arrumado, com cara de hotel: duas toalhas de banho, duas de rosto e uma toalha de piso, todas no mesmo tom.\n\nSair do banho e pisar numa toalha macia, se enrolar numa toalha grossa de 600 g/m², secar o rosto com o mesmo cuidado. São detalhes pequenos que mudam a sua rotina.",
  },
  "montez-m6": {
    old: { shortDescription: "A experiência MONTEZ completa: seis peças coordenadas para transformar o banho de todos os dias.", descriptionStart: "O Kit Experiência MONTEZ é o conjunto completo" },
    shortDescription: "Seis peças coordenadas — a experiência MONTEZ completa, com toalha de piso reserva para nunca ficar sem.",
    description:
      "O Kit Experiência MONTEZ é o nosso conjunto mais completo: duas toalhas de banho, duas de rosto e duas de piso, todas na mesma cor.\n\nCom duas toalhas de piso, uma está sempre limpa enquanto a outra vai para a lavagem — e o banheiro nunca perde a cara de hotel. É o kit para quem quer resolver tudo de uma vez, e um presente que impressiona em casamentos e casas novas.",
  },
};

async function main() {
  for (const [slug, c] of Object.entries(COPY)) {
    const p = await db.product.findUnique({ where: { slug }, select: { id: true, shortDescription: true, description: true } });
    if (!p) {
      console.log(`- ${slug}: não encontrado`);
      continue;
    }
    const data: { shortDescription?: string; description?: string } = {};
    if (p.shortDescription === c.old.shortDescription) data.shortDescription = c.shortDescription;
    if (p.description?.startsWith(c.old.descriptionStart)) data.description = c.description;
    console.log(`- ${slug}: ${Object.keys(data).length ? `atualizar ${Object.keys(data).join(", ")}` : "já personalizado/atualizado — mantido"}`);
    if (apply && Object.keys(data).length) await db.product.update({ where: { id: p.id }, data });
  }
  const rows = await db.siteContent.findMany({ select: { key: true, value: true } });
  console.log(`\nConteúdos do CMS salvos no banco (sobrescrevem o texto padrão): ${rows.length ? rows.map((r) => r.key).join(", ") : "nenhum"}`);
  console.log(apply ? "\nAplicado." : "\nSimulação. Rode com --apply para gravar.");
}

main().finally(() => db.$disconnect());
