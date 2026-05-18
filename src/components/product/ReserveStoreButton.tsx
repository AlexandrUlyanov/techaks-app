import { Button } from "@/components/ui/button";
import {
  ConfirmReserveIcon,
  ReserveStoreIcon,
  ReservedIcon,
  SpinnerIcon,
} from "./ProductActionIcons";

export default function ReserveStoreButton({
  singleStore = false,
  isReserved = false,
  isLoading = false,
  isAvailable = true,
  onClick,
}: {
  singleStore?: boolean;
  isReserved?: boolean;
  isLoading?: boolean;
  isAvailable?: boolean;
  onClick: () => void;
}) {
  const disabled = !isAvailable || isReserved || isLoading;

  return (
    <Button
      type="button"
      variant={isReserved ? "secondary" : "outline"}
      className={`product-action-button w-full sm:w-auto sm:min-w-[220px] ${
        isReserved
          ? "border-[#05C3D4]/20 bg-[#05C3D4]/10 text-[#047987] hover:bg-[#05C3D4]/10"
          : ""
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="product-action-icon product-action-icon-reserve">
        {isLoading ? (
          <SpinnerIcon className="animate-spin" />
        ) : isReserved ? (
          <ReservedIcon />
        ) : isAvailable ? (
          <ReserveStoreIcon />
        ) : (
          <ConfirmReserveIcon />
        )}
      </span>
      {isLoading
        ? "Резервируем..."
        : isReserved
          ? "В резерве"
          : isAvailable
            ? singleStore
              ? "Зарезервировать в магазине"
              : "Зарезервировать здесь"
            : "Нет в наличии"}
    </Button>
  );
}
