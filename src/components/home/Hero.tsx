import Link from "next/link";
import { TowelStack } from "@/components/product/TowelStack";
import { IconArrow } from "@/components/icons";
import type { CatalogColor } from "@/types/catalog";

type Props = { c: Record<string, string>; colors: CatalogColor[] };

export function Hero({ c, colors }: Props) {
  const desktop = c.hero_image_desktop;
  const mobile = c.hero_image_mobile || desktop;
  const pos = c.hero_text_position;
  const align = pos === "center" ? "items-center text-center mx-auto" : pos === "right" ? "items-end text-right ml-auto" : "items-start text-left";

  const text = (onImage: boolean) => (
    <div className={`relative z-10 flex max-w-xl flex-col ${align} animate-fade-up`}>
      <p className={`eyebrow ${onImage ? "!text-ivory/80" : ""}`}>{c.hero_eyebrow}</p>
      <h1 className={`mt-4 font-serif text-[44px] font-medium leading-[0.98] sm:text-[60px] lg:text-[76px] ${onImage ? "text-ivory" : "text-ink"} text-balance`}>
        {c.hero_title}
        {c.hero_title_2 && <span className={`mt-2 block text-[26px] font-normal italic leading-tight sm:text-[34px] lg:text-[40px] ${onImage ? "text-ivory/90" : "text-taupe-dark"}`}>{c.hero_title_2}</span>}
      </h1>
      <p className={`mt-6 max-w-md text-[15px] leading-7 md:text-base ${onImage ? "text-ivory/85" : "text-graphite/80"} text-pretty`}>{c.hero_subtitle}</p>
      <div className={`mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row ${pos === "center" ? "sm:justify-center" : ""}`}>
        <Link href={c.hero_cta_href || "/kits"} className={onImage ? "btn-light" : "btn-primary"} data-cta="hero_primary">
          {c.hero_cta} <IconArrow size={18} />
        </Link>
        {c.hero_cta_secondary && (
          <Link href={c.hero_cta_secondary_href || "/#kits"} className={onImage ? "btn border border-ivory/60 text-ivory hover:bg-ivory hover:text-ink" : "btn-outline"} data-cta="hero_secondary">
            {c.hero_cta_secondary}
          </Link>
        )}
      </div>
      {c.hero_reassurance && <p className={`mt-4 text-[12.5px] font-medium tracking-wide ${onImage ? "text-ivory/80" : "text-taupe-dark"}`}>{c.hero_reassurance}</p>}
    </div>
  );

  if (desktop) {
    return (
      <section className="relative isolate flex min-h-[78svh] items-end overflow-hidden bg-graphite md:min-h-[640px] md:items-center" aria-label="Destaque">
        <picture className="absolute inset-0 -z-10">
          {mobile !== desktop && <source media="(max-width: 767px)" srcSet={mobile} />}
          <img src={desktop} alt={c.hero_image_alt} className="h-full w-full object-cover" fetchPriority="high" />
        </picture>
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/75 via-ink/30 to-transparent md:bg-gradient-to-r md:from-ink/65 md:via-ink/25" />
        <div className="container w-full py-14 md:py-24">{text(true)}</div>
      </section>
    );
  }

  // Sem imagem cadastrada: composição tipográfica + ilustração na paleta da coleção
  const pick = (slug: string, fallback: string) => colors.find((x) => x.slug === slug)?.hex ?? fallback;
  const stack = [pick("areia", "#DBC9AC"), pick("off-white", "#EEE7DA"), pick("verde-oliva", "#5D6543"), pick("caqui", "#A38D6C"), pick("branco", "#F6F4EF")];

  return (
    <section className="relative overflow-hidden bg-linen-texture" aria-label="Destaque">
      <div className="container grid items-center gap-10 py-12 md:grid-cols-[1.05fr_1fr] md:py-20 lg:py-24">
        {text(false)}
        <div className="relative mx-auto w-full max-w-[520px]">
          <div className="absolute inset-x-6 bottom-0 top-4 rounded-t-full bg-gradient-to-b from-white/80 via-white/40 to-transparent md:inset-x-10" aria-hidden="true" />
          <TowelStack colors={stack} pieces={["piso", "banho", "banho", "banho", "rosto", "rosto"]} className="relative mx-auto w-[92%] animate-fade-in" label="Toalhas MONTEZ empilhadas nas cores Areia, Off-White, Oliva, Caqui e Branco" />
        </div>
      </div>
    </section>
  );
}
