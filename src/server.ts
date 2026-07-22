import "dotenv/config";

import { buildApp } from "./app";
import { env } from "./config/env";

const host = process.env.HOST ?? "0.0.0.0";

const app = buildApp();

app.listen({ port: env.PORT, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
