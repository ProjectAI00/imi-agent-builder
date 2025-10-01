export default {
  schema: "./src/lib/auth-schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./.data/auth.db",
  },
};
