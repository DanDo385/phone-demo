import type { Metadata } from "next";
import { ProductPage } from "@/components/marketing/ProductPage";
import { scribePage } from "@/content/marketing/products";

export const metadata: Metadata = scribePage.meta;

export default function ScribePage() {
  return <ProductPage product={scribePage} id="scribe" />;
}
