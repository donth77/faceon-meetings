import { z } from "zod";

/** Whether text is an email address: one rule for sign-in, sign-up and invitations. */
export const isEmailAddress = (text: string) =>
  z.email().safeParse(text.trim()).success;
