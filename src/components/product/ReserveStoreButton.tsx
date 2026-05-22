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
      variant="ghost"
      className={`product-action-button w-full border-0 sm:w-auto sm:min-w-[220px] ${
        isReserved
          ? "bg-[#E8FAFC] text-[#047987] hover:bg-[#E8FAFC]"
          : isAvailable
            ? "bg-[#F4F5F6] text-[#1F2328] hover:bg-[#E9ECEF]"
            : "bg-[#F4F5F6] text-[#A0A7AE] hover:bg-[#F4F5F6]"
      } ${
        disabled
          ? "cursor-not-allowed opacity-100"
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
