import type { ReactElement } from "react";

import { LoginForm } from "@components/loginForm.component";
import { Notice } from "@components/notice.component";
import type { InteractionDetails } from "@shared/interaction.types";

type LoginPageProps = { searchParams: Promise<{ interaction?: string }> };

// GET /login?interaction=<id> — where /oauth/authorize sends the browser. The
// URL carries nothing but the interaction id: who is asking, for which scopes
// and where the code goes are looked up server side, so editing the address
// bar changes nothing.
const LoginPage = async ({ searchParams }: LoginPageProps): Promise<ReactElement> => {
  const { AUTH_SERVER_URL = "http://localhost:3000", AUTH_SERVER_ADMIN_KEY = "" } = process.env;
  const { interaction } = await searchParams;

  // 1. Ask the auth server about the pending sign-in, with this app's key. Only
  //    a 404 is a dead link; any other failure is this app's, and throws.
  let details: InteractionDetails | null = null;
  if (interaction) {
    const interactionUrl = new URL(`/oauth/interactions/${encodeURIComponent(interaction)}`, AUTH_SERVER_URL);
    const response = await fetch(interactionUrl, {
      headers: { "x-admin-key": AUTH_SERVER_ADMIN_KEY },
      cache: "no-store",
    });

    if (response.ok) {
      details = (await response.json()) as InteractionDetails;
    } else if (response.status !== 404) {
      throw new Error(`auth server answered ${response.status}`);
    }
  }

  // 2. No id, or a dead one: there is nothing to sign in to.
  if (!interaction || !details) {
    return (
      <Notice
        title="This sign-in link is not valid"
        message="It may have expired or already been used. Go back to the application and start again."
      />
    );
  }

  // 3. Show who is asking and for what.
  return <LoginForm interactionId={interaction} {...details} />;
};

export default LoginPage;
