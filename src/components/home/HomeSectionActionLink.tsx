import { Link } from "react-router";

type HomeSectionActionLinkProps = {
  to: string;
  label: string;
  className?: string;
  onClick?: () => void;
};

export default function HomeSectionActionLink({
  to,
  label,
  className = "",
  onClick,
}: HomeSectionActionLinkProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-foreground transition-colors hover:text-[#05C3D4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:text-[#27E6F2] ${className}`.trim()}
    >
      <span>{label}</span>
      <span className="text-[#05C3D4] transition-transform duration-200 group-hover:translate-x-0.5 dark:text-[#27E6F2]">
        →
      </span>
    </Link>
  );
}
