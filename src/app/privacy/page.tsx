import type { Metadata } from "next";
import PrivacyContent from "./PrivacyContent";

export const metadata: Metadata = {
  title: "Privacy — Xiang",
  description: "What Xiang and its GitHub Pages host do with visitor data.",
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
