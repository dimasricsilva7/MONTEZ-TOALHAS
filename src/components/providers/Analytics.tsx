"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { captureAttribution, getIds, metaEvent, track } from "@/lib/client/tracking";

/**
 * Meta Pixel (principal + secundário opcional) e GA4 são carregados apenas
 * quando os IDs existem nas variáveis de ambiente públicas. Nenhum ID é fixo no código.
 */
const PIXEL_IDS = [process.env.NEXT_PUBLIC_META_PIXEL_ID, process.env.NEXT_PUBLIC_META_PIXEL_ID_SECONDARY].filter(
  (v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i && /^\d{5,20}$/.test(v as string)
);
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const GA_VALID = GA_ID && /^G-[A-Z0-9]{4,15}$/.test(GA_ID);

function PageTracker({ metaEnabled }: { metaEnabled: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const last = useRef<string>("");

  useEffect(() => {
    const key = `${pathname}?${search?.toString() ?? ""}`;
    if (last.current === key) return;
    last.current = key;
    captureAttribution();
    getIds();
    if (metaEnabled && PIXEL_IDS.length) {
      metaEvent("PageView", {}, { mirror: true, internal: { name: "page_view" } });
    } else {
      track("page_view");
    }
    if (GA_VALID && window.gtag) window.gtag("event", "page_view", { page_path: pathname });
  }, [pathname, search, metaEnabled]);

  // Cliques em CTAs (elementos com data-cta): comprar, checkout, navegação principal
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-cta]");
      if (el) track("cta_click", { props: { cta: el.dataset.cta ?? null, label: el.textContent?.trim().slice(0, 60) ?? null } });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}

export function Analytics({ metaEnabled = true, gaEnabled = true }: { metaEnabled?: boolean; gaEnabled?: boolean }) {
  const loadMeta = metaEnabled && PIXEL_IDS.length > 0;
  const loadGa = gaEnabled && GA_VALID;
  return (
    <>
      {loadMeta && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
${PIXEL_IDS.map((id) => `fbq('init','${id}');`).join("")}`}
        </Script>
      )}
      {loadGa && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});`}
          </Script>
        </>
      )}
      <Suspense fallback={null}>
        <PageTracker metaEnabled={loadMeta} />
      </Suspense>
    </>
  );
}
