import type { Metadata } from "next";
import { ProductPage } from "@/components/marketing/ProductPage";
import { presencePage } from "@/content/marketing/products";

export const metadata: Metadata = presencePage.meta;

export default function PresencePage() {
  return <ProductPage product={presencePage} id="presence" />;
}
