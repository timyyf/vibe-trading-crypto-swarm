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
