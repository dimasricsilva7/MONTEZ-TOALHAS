import { getContent, getSettings } from "@/server/content";
import { PAGE_DEFAULTS, fillPlaceholders } from "@/lib/page-defaults";
import { RichText } from "./RichText";

export async function InfoPage({ contentKey, eyebrow, title, children }: { contentKey: string; eyebrow: string; title: string; children?: React.ReactNode }) {
  const [c, s] = await Promise.all([getContent(), getSettings()]);
  const text = fillPlaceholders(c[contentKey]?.trim() || PAGE_DEFAULTS[contentKey] || "", s);
  return (
    <>
      <section className="border-b border-line bg-linen-texture">
        <div className="container max-w-3xl py-12 md:py-16">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 font-serif text-[40px] leading-tight text-ink md:text-[54px]">{title}</h1>
        </div>
      </section>
      <div className="container max-w-3xl py-12 md:py-16">
        <RichText text={text} />
        {children}
      </div>
    </>
  );
}
