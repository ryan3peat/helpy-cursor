import type { Metadata } from "next";
import FeaturesContent from "./FeaturesContent";

export const metadata: Metadata = {
  title: "Helpy Features - Home Management App for Families & Helpers",
  description: "Explore Helpy features: meal planning, expense tracking, shared shopping lists, household chores, family notes, and training guides. The complete household planner app.",
};

export default function FeaturesPage() {
  return <FeaturesContent />;
}
