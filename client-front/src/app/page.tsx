import { cookies } from "next/headers";
import type { ReactElement } from "react";

import { SessionCard } from "@components/session.component";
import { SignIn } from "@components/signIn.component";
import type { Session } from "@shared/auth.types";

type HomePageProps = { searchParams: Promise<{ error?: string }> };

// A Server Component: it reads the httpOnly session cookie directly, which no
// script in the page could.
const HomePage = async ({ searchParams }: HomePageProps): Promise<ReactElement> => {
  const { error } = await searchParams;

  // The session the callback stored, if any. A tampered cookie counts as none.
  let session: Session | null = null;
  try {
    session = JSON.parse((await cookies()).get("session")?.value ?? "null");
  } catch {
    session = null;
  }

  return session ? <SessionCard session={session} /> : <SignIn error={error} />;
};

export default HomePage;
