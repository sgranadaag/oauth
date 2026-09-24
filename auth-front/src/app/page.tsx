import type { ReactElement } from "react";

import { Notice } from "@components/notice.component";

const HomePage = (): ReactElement => (
  <Notice
    title="Provider sign-in"
    message="This page is where you sign in when an application asks for your account. Open the application to start."
  />
);

export default HomePage;
