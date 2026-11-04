/**
 * Database schema (Drizzle). Better Auth's tables come from its generator (auth-schema.ts,
 * regenerate with `pnpm dlx auth generate`); FaceOn's own tables arrive with the features
 * that need them.
 */
export * from "./addon-schema";
export * from "./attempts-schema";
export * from "./auth-schema";
export * from "./hosting-schema";
export * from "./meetings-schema";
export * from "./usage-schema";
