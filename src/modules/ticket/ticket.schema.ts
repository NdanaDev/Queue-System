import { z } from "zod";

export const createTicketBodySchema = z.object({
  queueId: z.uuid(),
  customerId: z.uuid(),
});

export type CreateTicketBody = z.infer<typeof createTicketBodySchema>;

export const ticketParamsSchema = z.object({
  id: z.uuid(),
});

export type TicketParams = z.infer<typeof ticketParamsSchema>;
