import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `prisma generate` no se conecta: si falta la variable (por ejemplo al instalar), usa un valor vacío.
    url: process.env.DATABASE_URL ?? "",
  },
});
