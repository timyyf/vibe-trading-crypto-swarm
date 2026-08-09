import { z } from 'zod';
import rateLimit from 'express-rate-limit';

export const ALLOWED_DURATIONS = [1, 3, 5, 10, 15] as const;

export const swarmBodySchema = z.object({
  symbol: z.string().trim().min(1, 'symbol é obrigatório').max(20, 'symbol muito longo'),
  name: z.string().trim().max(60, 'name muito longo').optional(),
  price: z.coerce.number().finite('price deve ser finito').positive('price deve ser maior que zero'),
  change24h: z.coerce.number().finite().optional(),
  volume24h: z.coerce.number().finite().nonnegative().optional(),
  high24h: z.coerce.number().finite().positive().optional(),
  low24h: z.coerce.number().finite().positive().optional(),
  signalDurationMinutes: z.coerce
    .number()
    .int('signalDurationMinutes deve ser inteiro')
    .refine((v) => (ALLOWED_DURATIONS as readonly number[]).includes(v), {
      message: 'signalDurationMinutes deve ser 1, 3, 5, 10 ou 15',
    })
    .optional(),
});

export type SwarmBody = z.infer<typeof swarmBodySchema>;

export const journalBodySchema = z.object({
  entryId: z.string().trim().min(1, 'entryId é obrigatório').max(64, 'entryId muito longo'),
  symbol: z.string().trim().min(1, 'symbol é obrigatório').max(20, 'symbol muito longo'),
  type: z.enum(['COMPRA', 'VENDA', 'OBSERVAÇÃO']),
  status: z.enum(['EM_ANDAMENTO', 'LUCRO', 'PREJUÍZO', 'CANCELADO']),
  entryPrice: z.coerce.number().finite().positive().optional(),
  targetPrice: z.coerce.number().finite().positive().optional(),
  stopPrice: z.coerce.number().finite().positive().optional(),
  confidence: z.coerce.number().finite().min(0).max(100).optional(),
  notes: z.string().trim().max(4000, 'notes muito longo').optional(),
  timestamp: z.coerce.number().finite().nonnegative('timestamp inválido'),
  pnlPercent: z.coerce.number().finite().optional(),
});

export type JournalBody = z.infer<typeof journalBodySchema>;

export const swarmAnalyzeLimiter = rateLimit({
  windowMs: 15 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas requisições por segundo. Aguarde alguns instantes e tente novamente.' },
});

export const swarmTestLimiter = rateLimit({
  windowMs: 15 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Limite de requisições de teste excedido. Aguarde e tente novamente.' },
});
