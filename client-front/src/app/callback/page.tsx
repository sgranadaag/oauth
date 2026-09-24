"use client";

import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

import { completeSignIn } from "@services/auth.service";

const CallbackPage = (): ReactElement => {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const failure = await completeSignIn(params);

      window.location.replace(failure ? `/?error=${failure}` : "/");
    })();
  }, []);

  return (
    <section className="card">
      <h1 className="card__title">Signing you in…</h1>
      <p className="card__description">Checking what the provider sent back.</p>
    </section>
  );
};

export default CallbackPage;
