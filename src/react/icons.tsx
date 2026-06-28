// Minimal inline SVG defaults so the package has no icon-library dependency.
// Every icon is overridable through the `icons` prop (e.g. pass lucide-react).
import type { ReactNode } from "react";
import type { IconProps } from "./types";

function svg(path: ReactNode, extraProps?: Record<string, unknown>) {
  return function Icon({ className, size = 16 }: IconProps) {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...extraProps}
      >
        {path}
      </svg>
    );
  };
}

export const SparklesIcon = svg(
  <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
);

export const BotIcon = svg(
  <>
    <rect x="4" y="8" width="16" height="11" rx="2" />
    <path d="M12 3v3M9 13h.01M15 13h.01" />
  </>
);

export const SendIcon = svg(<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />);

export const StopIcon = svg(
  <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" />
);

export const CloseIcon = svg(<path d="M18 6L6 18M6 6l12 12" />);

export const TrashIcon = svg(
  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
);

export const ArrowUpRightIcon = svg(<path d="M7 17L17 7M7 7h10v10" />);

export const SpinnerIcon = svg(
  <path d="M21 12a9 9 0 11-6.219-8.56" />
);

export const CheckIcon = svg(<path d="M20 6L9 17l-5-5" />);
