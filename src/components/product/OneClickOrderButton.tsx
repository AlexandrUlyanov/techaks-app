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
      className="product-action-button h-14 rounded-2xl border-[#05C3D4]/25 bg-white text-[#464A50] hover:border-[#05C3D4] hover:text-[#05C3D4]"
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
