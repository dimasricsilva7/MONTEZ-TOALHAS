import Link from "next/link";

export function Logo({ className = "", tagline = true, light = false }: { className?: string; tagline?: boolean; light?: boolean }) {
  return (
    <Link href="/" aria-label="MONTEZ — página inicial" className={`inline-flex flex-col items-center leading-none ${light ? "text-ivory" : "text-ink"} ${className}`}>
      <span className="font-serif text-[22px] font-medium tracking-brand md:text-[26px]" style={{ marginRight: "-0.42em" }}>
        MONTEZ
      </span>
      {tagline && <span className={`mt-1 text-[7.5px] font-semibold uppercase tracking-[0.5em] ${light ? "text-ivory/70" : "text-taupe-dark"}`} style={{ marginRight: "-0.5em" }}>Hotel Collection</span>}
    </Link>
  );
}
