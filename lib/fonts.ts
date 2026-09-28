import { Fraunces, Outfit } from "next/font/google";

// The families named in brand.fonts. next/font only accepts literal calls, so a font
// change touches both files.
export const displayFont = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
export const textFont = Outfit({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const fontVariables = `${displayFont.variable} ${textFont.variable}`;
