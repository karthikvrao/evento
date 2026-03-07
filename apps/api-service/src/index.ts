import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });

// Register CORS for frontend access
await app.register(cors, {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
});

// Health check route
app.get("/health", async () => {
  return { status: "ok", service: "evento-api" };
});

// Start the server
const PORT = Number(process.env.PORT) || 3001;

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`🚀 Evento API running on http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
