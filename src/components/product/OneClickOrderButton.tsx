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
      className="product-action-button h-12 rounded-[14px] border-none bg-[#F4F5F6] text-[#464A50] hover:bg-[#ECEFF1] hover:text-[#1F2328]"
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
