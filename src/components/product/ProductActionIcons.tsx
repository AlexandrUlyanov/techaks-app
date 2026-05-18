import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

function BaseIcon({
  size = 20,
  children,
  className,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function CartIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M2.5 3.5H4.3L5.7 12.2C5.8 12.8 6.32 13.25 6.94 13.25H14.55C15.13 13.25 15.63 12.86 15.77 12.3L17.15 6.75H5.15"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.6" cy="16.1" r="1.1" fill="currentColor" />
      <circle cx="14.15" cy="16.1" r="1.1" fill="currentColor" />
    </BaseIcon>
  );
}

export function OneClickIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M10.7 2.6 5.55 10.1h3.35l-1.05 7.3 6.05-8.2H10.5l.2-6.6Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}

export function ReserveStoreIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M10 17.1s4.35-4.35 4.35-8.1A4.35 4.35 0 1 0 5.65 9c0 3.75 4.35 8.1 4.35 8.1Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m8.35 9.35 1.25 1.25 2.15-2.25"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}

export function ConfirmReserveIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle
        cx="10"
        cy="10"
        r="7"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="m6.9 10.2 2.1 2.1 4.15-4.3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}

export function CancelIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle
        cx="10"
        cy="10"
        r="7"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="m7.35 7.35 5.3 5.3M12.65 7.35l-5.3 5.3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}

export function ReservedIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M6.9 9V7.7a3.1 3.1 0 1 1 6.2 0V9"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <rect
        x="5.35"
        y="9"
        width="9.3"
        height="7.2"
        rx="1.8"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="m8.3 12.4 1.35 1.35 2.25-2.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.9" />
      <path
        d="M10 3.5a6.5 6.5 0 0 1 5.13 2.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}
