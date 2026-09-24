"use client";

import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { SessionCard } from "@components/session.component";
import { SignIn } from "@components/signIn.component";
import { buildAuthorizeUrl, endSession, renewSession } from "@services/auth.service";
import { readSession } from "@utils/session.util";
import { SESSION_EXPIRED } from "@constants/session.constants";
import type { Session } from "@shared/auth.types";

const HomePage = (): ReactElement => {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setSession(readSession());

    const failure = new URLSearchParams(window.location.search).get("error");
    if (failure) setError(failure);
  }, []);

  const signIn = (): void => {
    window.location.assign(buildAuthorizeUrl());
  };

  const renew = async (): Promise<void> => {
    if (!session) return;

    const renewed = await renewSession(session);
    setSession(renewed);
    setError(renewed ? undefined : SESSION_EXPIRED);
  };

  const signOut = async (): Promise<void> => {
    if (session) await endSession(session);

    setSession(null);
    setError(undefined);
  };

  return session ? (
    <SessionCard session={session} error={error} onRenew={renew} onSignOut={signOut} />
  ) : (
    <SignIn error={error} onSignIn={signIn} />
  );
};

export default HomePage;
