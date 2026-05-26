import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { CartIcon } from "./ProductActionIcons";

type ProductMobileStickyBuyProps = {
  disabled?: boolean;
  inCart?: boolean;
  onAddToCart: () => boolean | void;
  visible?: boolean;
};

export default function ProductMobileStickyBuy({
  disabled = false,
  inCart = false,
  onAddToCart,
  visible = true,
}: ProductMobileStickyBuyProps) {
  const [isAdded, setIsAdded] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) setIsAdded(false);

    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [visible]);

  if (!visible || disabled) return null;

  const handleAddToCart = () => {
    const result = onAddToCart();
    if (result === false) return;

    setIsAdded(true);
    hideTimerRef.current = window.setTimeout(() => {
      setIsAdded(false);
    }, 520);
  };

  return (
    <div className="fixed inset-x-0 bottom-[72px] z-50 flex justify-center px-4 py-3 md:hidden">
      <div
        className={`rounded-[18px] bg-white/[0.92] p-2 shadow-[0_12px_34px_rgba(15,23,42,0.08)] backdrop-blur-[14px] transition-[opacity,transform] duration-300 motion-reduce:transition-none ${
          isAdded ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        {inCart && !isAdded ? (
          <div className="flex items-center gap-2">
            <div className="flex h-[50px] w-[54px] items-center justify-center rounded-[14px] bg-[rgba(5,195,212,0.14)] text-[#047E8A]">
              <CartIcon size={21} />
            </div>
            <Link
              to="/checkout"
              aria-label="Оформить покупку"
              className="flex h-[50px] items-center justify-center rounded-[14px] bg-[rgba(5,195,212,0.14)] px-4 text-[11px] font-black uppercase tracking-[0.08em] text-[#047E8A] transition-[background,transform,color] duration-300 hover:bg-[rgba(5,195,212,0.2)] active:scale-[0.98] motion-reduce:transition-none"
            >
              Оформить покупку
            </Link>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isAdded}
            aria-label="Положить в корзину"
            className="flex h-[62px] min-w-[124px] flex-col items-center justify-center gap-1 rounded-[14px] bg-[rgba(5,195,212,0.14)] px-4 text-[#047E8A] transition-[background,transform,color] duration-300 hover:bg-[rgba(5,195,212,0.2)] active:scale-[0.98] disabled:pointer-events-none motion-reduce:transition-none"
          >
            <span className="max-w-[96px] text-center text-[10px] font-black uppercase leading-tight tracking-[0.08em]">
              {isAdded ? "Добавлено" : "Положить в корзину"}
            </span>
            <CartIcon size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
