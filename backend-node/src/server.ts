/** Server entrypoint. */
import { buildApp } from "./app.js";
import { env } from "./env.js";

const app = await buildApp();

try {
  await app.listen({ host: "0.0.0.0", port: env.PORT });
  app.log.info(`VANI API (Node) listening on :${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
