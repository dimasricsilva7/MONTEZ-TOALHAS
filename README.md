# MONTEZ — E-commerce de toalhas premium

Loja própria da MONTEZ (linha **Hotel 600**: kits M4, M5 e M6 em 10 cores) com checkout próprio, PIX via **BravoPay**, confirmação automática, e-mails transacionais, tracking (Meta Pixel + Conversions API + analytics interno) e painel administrativo.

## Stack

| Camada | Tecnologia |
|---|---|
| App | Next.js 15 (App Router, Server Components, Server Actions), React 19, TypeScript |
| Estilo | Tailwind CSS 3 · fontes Cormorant Garamond + Manrope (self-hosted via `next/font`) |
| Banco | PostgreSQL (Neon) com Prisma 6 |
| Validação | Zod (todo input de servidor) |
| Pagamento | BravoPay API (`/transactions`, PIX) + webhooks HMAC-SHA256 |
| E-mail | Resend (REST) · SMTP (nodemailer) · console (dev) |
| Imagens | Vercel Blob (upload convertido para WebP no navegador) |
| Deploy | Vercel + GitHub |

Sem bibliotecas de UI ou de gráficos: ícones e gráficos do admin são SVG próprios (JS mínimo na loja).

## Estrutura

```
prisma/            schema, migrations, seed (catálogo inicial — sem dados falsos)
src/app/(store)    loja: home, kits, produto, carrinho, páginas institucionais, rastreio
src/app/(checkout) checkout, PIX pendente, sucesso/upsell (layout sem distrações)
src/app/admin      painel (login + área protegida)
src/app/api        checkout, status (polling), webhooks/bravopay, track, upsell, cron, admin
src/lib/payments   bravopay.ts — createPixTransaction, getTransaction, verifyTransaction, processWebhook
src/lib/email      provedor + agendamento (sendPurchaseConfirmation, sendPixRecovery, sendOrderStatus, sendManualEmail)
src/lib/analytics  tracking interno (trackEvent, trackPageView, trackPurchase, trackCheckout)
src/lib/meta       Conversions API
src/server         orders (criação, applyTransactionSnapshot, reconciliação), webhooks, jobs, catálogo, CMS, estatísticas
src/components     loja, carrinho, produto, admin
src/utils          formatação, validadores (CPF/telefone/CEP), canais, status
tests/             testes unitários (node:test)
scripts/           e2e de pagamento e admin, screenshots, hash de senha
```

## Fluxo de pagamento PIX

1. Checkout envia os dados com um `checkoutToken` (idempotência: duplo clique = mesmo pedido).
2. Servidor valida tudo (Zod), recalcula preços **do banco**, cria o pedido `PENDING_PAYMENT` com número `MONTEZ-AAAA-NNNNNN`.
3. `POST /transactions` na BravoPay (`method: "pix"`, `external_reference` = número do pedido, `metadata`, `utm`, `Idempotency-Key`).
4. QR Code (gerado no servidor) + copia e cola + timer. Polling com backoff (5s → 10s → 20s, para no pagamento/expiração/65 min). "Já paguei" só força nova consulta.
5. Webhook `/api/webhooks/bravopay`: assinatura `t=…,v1=HMAC(t.rawBody)` obrigatória, tolerância de 5 min, deduplicação por `event_id` (`WebhookEvent`).
6. `applyTransactionSnapshot` é o **único** ponto que muda status de pagamento: transição condicional (efeitos rodam uma vez), nunca regride um pedido pago, confere valor.
7. Pago → baixa de estoque, cancela recuperação, agenda confirmação (+15 min), evento `purchase`, CAPI `Purchase` com o mesmo `event_id` do Pixel da página de sucesso.
8. Reconciliação server-side (`/api/cron/reconcile`) consulta pendentes por `external_reference` e expira PIX vencidos.

Sem sandbox oficial na BravoPay: `BRAVOPAY_MODE=mock` gera PIX fictício para testes (bloqueado automaticamente em produção). Nenhum teste automatizado gera cobrança real.

## Jobs

`/api/cron/{all|emails|reconcile|cleanup}` protegidos por `Authorization: Bearer CRON_SECRET`:
- Vercel Cron diário (`vercel.json`, limite do plano Hobby);
- GitHub Actions a cada 10 min (`.github/workflows/jobs.yml` — requer secrets `SITE_URL` e `CRON_SECRET`);
- execução oportunista a partir do polling de status.

## Desenvolvimento

```bash
npm install
cp .env.example .env          # preencha DATABASE_URL etc. (BRAVOPAY_MODE=mock e EMAIL_PROVIDER=console)
npx prisma migrate deploy && npm run db:seed
npm run admin:hash -- "sua senha forte"   # cole em ADMIN_PASSWORD_HASH (escape os $ no .env)
npm run dev
```

Verificações: `npm run typecheck`, `npm run lint`, `npm test`, `npx tsx scripts/e2e-payment.ts` (servidor em modo mock), `npx tsx scripts/e2e-admin.ts`.

## Variáveis de ambiente

Veja `.env.example` (documentado linha a linha). Segredos ficam só na Vercel — nunca no código nem em `NEXT_PUBLIC_*`.

## Admin

`/admin` — login com bcrypt, sessão em banco (cookie HttpOnly, Secure, SameSite=Strict, 12h), bloqueio após 5 falhas/15 min. Dashboard com filtros de período, funil, origem do tráfego, pedidos (filtros, detalhe, reenvio de e-mail com anti-spam, envio/rastreio, soft delete), produtos, cores, biblioteca de imagens, CMS de textos/imagens, FAQ, avaliações (somente reais), order bumps, upsells, clientes, analytics, e-mails, configurações e auditoria.

## LGPD

CPF mascarado em listas; dados completos apenas no detalhe do pedido (acesso auditado). Analytics sem CPF/e-mail/telefone. Logs e payloads de webhook armazenados sem dados pessoais. IPs só como hash.
