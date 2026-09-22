import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";

import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Client",
  description: "Signs in against the auth server",
};

const RootLayout = ({ children }: { children: ReactNode }): ReactElement => (
  <html lang="en">
    <body>
      <main className="layout">{children}</main>
    </body>
  </html>
);

export default RootLayout;
