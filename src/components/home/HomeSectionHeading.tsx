import type { ReactNode } from "react";

type HomeSectionHeadingProps = {
  eyebrow: string;
  title: string;
  accent?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

function renderTitleWithAccent(title: string, accent?: string) {
  if (!accent) return title;

  const accentIndex = title.toLowerCase().lastIndexOf(accent.toLowerCase());
  if (accentIndex === -1) return title;

  const beforeAccent = title.slice(0, accentIndex);
  const accentText = title.slice(accentIndex, accentIndex + accent.length);
  const afterAccent = title.slice(accentIndex + accent.length);

  return (
    <>
      {beforeAccent}
      <span className="text-[#05C3D4]">{accentText}</span>
      {afterAccent}
    </>
  );
}

export default function HomeSectionHeading({
  eyebrow,
  title,
  accent,
  description,
  action,
  className = "",
}: HomeSectionHeadingProps) {
  return (
    <div className={`flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-12 ${className}`.trim()}>
      <div className="max-w-[760px]">
        <span className="block text-[11px] font-black uppercase tracking-[0.32em] text-[#05C3D4] sm:text-xs">
          {eyebrow}
        </span>
        <h2 className="mt-5 text-[2.5rem] font-black leading-[0.95] tracking-[-0.06em] text-[#111827] sm:text-[3rem] md:text-[3.6rem] lg:text-[4.3rem] lg:whitespace-nowrap">
          {renderTitleWithAccent(title, accent)}
        </h2>
        {description ? (
          <p className="mt-5 max-w-[38rem] text-[15px] leading-7 text-[#64748B] sm:text-[17px]">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="flex w-fit items-start lg:mt-6">{action}</div> : null}
    </div>
  );
}
