import { Button } from "@/components/ui/button";
import { OneClickIcon } from "./ProductActionIcons";

export default function OneClickOrderButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="product-action-button h-12 rounded-[14px] border-none bg-[var(--tech-color-surface-muted)] text-[var(--tech-color-text-main)] hover:brightness-95"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="product-action-icon product-action-icon-one-click">
        <OneClickIcon />
      </span>
      Купить в 1 клик
    </Button>
  );
}
