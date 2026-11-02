import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth: sign-in (social or email), sign-up, password reset, sign-out, and
 * Settings → Account (password, sign-in methods, deleting the account).
 */
export const authClient = createAuthClient();

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
  changePassword,
  linkSocial,
  unlinkAccount,
  deleteUser,
} = authClient;
