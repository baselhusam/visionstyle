import type { SVGProps } from "react";

export type IconName =
  | "source"
  | "design"
  | "objects"
  | "export"
  | "reset"
  | "change"
  | "play"
  | "pause"
  | "detect"
  | "options"
  | "fit"
  | "actual"
  | "download"
  | "model"
  | "confidence"
  | "search"
  | "eye"
  | "eyeOff"
  | "copy"
  | "save"
  | "back"
  | "previous"
  | "next"
  | "chevron";

const paths: Record<IconName, JSX.Element> = {
  source: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m5.5 16 4.2-4.3 3.2 3.2 2.1-2.1 3.5 3.7M8 8.5h.01" /></>,
  design: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
  objects: <><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6" /><rect x="8" y="8" width="8" height="8" rx="1" /></>,
  export: <><path d="M12 15V3m0 0L8 7m4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></>,
  reset: <><path d="M4 7v5h5" /><path d="M5.6 16a8 8 0 1 0 .2-8.2L4 12" /></>,
  change: <><path d="M7 7h12l-3-3m3 3-3 3M17 17H5l3 3m-3-3 3-3" /></>,
  play: <path d="m9 6 9 6-9 6V6Z" />,
  pause: <path d="M9 6v12M15 6v12" />,
  detect: <><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /><circle cx="12" cy="12" r="2.5" /></>,
  options: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  fit: <path d="M9 4H4v5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  actual: <><rect x="5" y="5" width="14" height="14" rx="1" /><path d="M9 9h6v6H9z" /></>,
  download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M5 19h14" /></>,
  model: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
  confidence: <><path d="M5 18a8 8 0 1 1 14 0" /><path d="m12 13 4-4" /><circle cx="12" cy="13" r="1" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5" /></>,
  eye: <><path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z" /><circle cx="12" cy="12" r="2.5" /></>,
  eyeOff: <><path d="m4 4 16 16M9.5 7.4A10.6 10.6 0 0 1 12 7c5.8 0 9 5 9 5a15 15 0 0 1-2.2 2.6M14.4 16.7A10.8 10.8 0 0 1 12 17c-5.8 0-9-5-9-5a15.4 15.4 0 0 1 3-3.4" /></>,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  save: <><path d="M5 3h12l3 3v15H4V4a1 1 0 0 1 1-1Z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></>,
  back: <path d="m15 5-7 7 7 7M8 12h12" />,
  previous: <path d="m14.5 7-5 5 5 5" />,
  next: <path d="m9.5 7 5 5-5 5" />,
  chevron: <path d="m6 9 6 6 6-6" />,
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
