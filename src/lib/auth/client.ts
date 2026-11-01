import { createAuthClient } from "better-auth/react";

/** Browser-side auth: social sign-in, sign-out and the session hook. */
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
