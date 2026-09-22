import type { ReactElement } from "react";

interface NoticeProps {
  title: string;
  message: string;
}

export const Notice = ({ title, message }: NoticeProps): ReactElement => (
  <section className="card">
    <h1 className="card__title">{title}</h1>
    <p className="card__description">{message}</p>
  </section>
);
