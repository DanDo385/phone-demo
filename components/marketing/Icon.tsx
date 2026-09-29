// Line icons drawn inline so the public site loads no icon font or image.
const PATHS = {
  phone: "M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z",
  calendar: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 12h3v3H8z",
  invoice: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  key: "M14.5 10.5a4.5 4.5 0 1 0-4 0L4 17v3h3v-2h2v-2h2l3.5-3.5",
  search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4",
  voicemail: "M6.5 16a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zM17.5 16a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zM6.5 16h11",
  reminder: "M12 8v4l2.5 2.5M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}
