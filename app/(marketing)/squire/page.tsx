import type { Metadata } from "next";
import { ProductPage } from "@/components/marketing/ProductPage";
import { squirePage } from "@/content/marketing/products";

export const metadata: Metadata = squirePage.meta;

export default function SquirePage() {
  return <ProductPage product={squirePage} id="squire" />;
}
