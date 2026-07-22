import type { FastifyInstance } from "fastify";

import { createTicketBodySchema, ticketParamsSchema } from "./ticket.schema";
import * as ticketService from "./ticket.service";

export default async function ticketRoutes(app: FastifyInstance) {
  app.post("/tickets", async (request, reply) => {
    const body = createTicketBodySchema.parse(request.body);
    const ticket = await ticketService.createTicket(app.prisma, body);
    reply.code(201);
    return ticket;
  });

  app.get("/tickets/:id", async (request) => {
    const params = ticketParamsSchema.parse(request.params);
    return ticketService.getTicketById(app.prisma, params.id);
  });
}
