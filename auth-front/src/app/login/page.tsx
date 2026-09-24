"use client";

import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { LoginForm } from "@components/loginForm.component";
import { Notice } from "@components/notice.component";
import { findInteraction } from "@services/interaction.service";
import type { InteractionDetails } from "@shared/interaction.types";


// GET /login?interaction=<id> — where /oauth/authorize sends the browser. The
// URL carries nothing but the interaction id: who is asking, for which scopes
// and where the code goes are looked up on the server, so editing the address
// bar changes nothing.
//
// This app is a pure frontend: it holds no credential of any kind, so the
// lookup is a plain public read from the browser.
const LoginPage = (): ReactElement => {
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [details, setDetails] = useState<InteractionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("interaction");
    setInteractionId(id);

    if (!id) {
      setIsLoading(false);
      return;
    }

    void (async () => {
      setDetails(await findInteraction(id));
      setIsLoading(false);
    })();
  }, []);

  if (isLoading) {
    return <Notice title="Loading…" message="Looking up this sign-in." />;
  }

  if (!interactionId || !details) {
    return (
      <Notice
        title="This sign-in link is not valid"
        message="It may have expired or already been used. Go back to the application and start again."
      />
    );
  }

  return <LoginForm interactionId={interactionId} {...details} />;
};

export default LoginPage;
