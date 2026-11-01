import { createAuthClient } from "better-auth/react";

/** Browser-side auth: sign-in (social or email), sign-up, password reset, sign-out. */
export const authClient = createAuthClient();

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
} = authClient;
