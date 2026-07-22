import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";

import { HttpError } from "./common/http-error";
import prismaPlugin from "./plugins/prisma";
import ticketRoutes from "./modules/ticket/ticket.routes";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors);
  app.register(prismaPlugin);
  app.register(ticketRoutes);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      reply.code(400).send({ error: "ValidationError", issues: error.issues });
      return;
    }

    if (error instanceof HttpError) {
      reply.code(error.statusCode).send({ error: error.message });
      return;
    }

    app.log.error(error);
    reply.code(500).send({ error: "Internal Server Error" });
  });

  return app;
}
