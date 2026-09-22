import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";

import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Provider sign-in",
  description: "The provider's sign-in page",
};

const RootLayout = ({ children }: { children: ReactNode }): ReactElement => (
  <html lang="en">
    <body className="provider">
      <main className="layout">{children}</main>
    </body>
  </html>
);

export default RootLayout;
