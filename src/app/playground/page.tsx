import type { Metadata } from "next";
import Playground from "./Playground";

export const metadata: Metadata = {
  title: "Character physics lab — Xiang playground",
  description:
    "Tear reviewed character components apart, feel the magnetic pull, and guide them back together.",
};
export default function Page() {
  return <Playground />;
}
