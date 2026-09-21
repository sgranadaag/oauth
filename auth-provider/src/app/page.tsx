import type { ReactElement } from "react";

import { LoginForm } from "@components/loginForm.component";

// A Server Component that only composes: the form is a Client Component
// because it is the part that needs state and an event handler.
const HomePage = (): ReactElement => <LoginForm />;

export default HomePage;
