import { Link } from "react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type PersonalDataConsentProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  dark?: boolean;
  withOffer?: boolean;
  className?: string;
};

export default function PersonalDataConsent({
  checked,
  onCheckedChange,
  dark = false,
  withOffer = false,
  className,
}: PersonalDataConsentProps) {
  const mutedClass = dark ? "text-white/55" : "text-muted-foreground";
  const linkClass = dark
    ? "text-white/80 hover:text-[#05C3D4]"
    : "text-foreground hover:text-[#05C3D4]";

  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-2xl bg-muted/35 px-4 py-3 text-sm leading-6",
        dark && "bg-white/[0.04]",
        className
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={value => onCheckedChange(Boolean(value))}
        className="mt-0.5 border-[var(--tech-color-border)] data-[state=checked]:border-[#05C3D4] data-[state=checked]:bg-[#05C3D4] data-[state=checked]:text-black"
      />
      <span className={mutedClass}>
        Я даю согласие на обработку персональных данных и подтверждаю, что ознакомлен(а) с{" "}
        <Link to="/privacy-policy" className={linkClass}>
          политикой обработки персональных данных
        </Link>
        {withOffer ? (
          <>
            {" "}и принимаю условия{" "}
            <Link to="/offer" className={linkClass}>
              оферты
            </Link>
            .
          </>
        ) : (
          "."
        )}
      </span>
    </label>
  );
}
