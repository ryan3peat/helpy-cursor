import type { Metadata } from "next";
import PrivacyContent from "./PrivacyContent";

export const metadata: Metadata = {
  title: "Privacy Policy - Helpy",
  description: "Helpy Privacy Policy. Learn how we protect your family's data, what we collect, and how we use it.",
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
