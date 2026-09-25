import { z } from "zod";
import { isValidCep, isValidCpf, isValidPhone, onlyDigits, UF_LIST } from "@/utils/validators";

const str = (max: number) => z.string().trim().max(max);
const optStr = (max: number) => z.string().trim().max(max).optional().nullable();

const touchSchema = z
  .object({
    source: optStr(200),
    medium: optStr(200),
    campaign: optStr(200),
    content: optStr(200),
    term: optStr(200),
    at: z.number().optional(),
  })
  .partial()
  .nullable()
  .optional();

export const clientContextSchema = z
  .object({
    sessionId: optStr(64),
    visitorId: optStr(64),
    fbp: optStr(200),
    fbc: optStr(500),
    attribution: z
      .object({
        first: touchSchema,
        last: touchSchema,
        fbclid: optStr(500),
        gclid: optStr(500),
        ttclid: optStr(500),
        landingPage: optStr(500),
        referrer: optStr(500),
      })
      .partial()
      .nullable()
      .optional(),
  })
  .partial();

export const customerSchema = z.object({
  name: str(120)
    .min(5, "Informe seu nome completo")
    .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, "Informe nome e sobrenome"),
  email: str(160).toLowerCase().email("E-mail inválido"),
  cpf: z.string().transform(onlyDigits).refine(isValidCpf, "CPF inválido"),
  phone: z.string().transform(onlyDigits).refine(isValidPhone, "Telefone inválido"),
});

export const addressSchema = z.object({
  cep: z.string().transform(onlyDigits).refine(isValidCep, "CEP inválido"),
  street: str(160).min(2, "Informe o endereço"),
  number: str(20).min(1, "Informe o número"),
  complement: optStr(80),
  district: str(80).min(1, "Informe o bairro"),
  city: str(80).min(2, "Informe a cidade"),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => (UF_LIST as readonly string[]).includes(v), "UF inválida"),
});

export const checkoutSchema = z.object({
  checkoutToken: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  customer: customerSchema,
  address: addressSchema,
  items: z
    .array(z.object({ productId: z.string().min(1).max(40), colorId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(10) }))
    .min(1, "Carrinho vazio")
    .max(10),
  bumpIds: z.array(z.string().max(40)).max(5).default([]),
  paymentEventId: optStr(80),
  context: clientContextSchema.optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
