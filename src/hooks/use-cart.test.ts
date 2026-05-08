import { describe, it, expect, beforeEach } from "vitest";
import { useCart } from "./use-cart";

describe("useCart", () => {
  beforeEach(() => {
    useCart.getState().clearCart();
  });

  it("should add item to cart", () => {
    const product = {
      id: 1,
      slug: "test",
      name: "Test Product",
      price: 100,
      image: "img.jpg",
    };
    useCart.getState().addItem(product);

    const items = useCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(1);
    expect(items[0].name).toBe("Test Product");
  });

  it("should increment quantity if same item added twice", () => {
    const product = {
      id: 1,
      slug: "test",
      name: "Test Product",
      price: 100,
      image: "img.jpg",
    };
    useCart.getState().addItem(product);
    useCart.getState().addItem(product);

    const items = useCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it("should update quantity correctly", () => {
    const product = {
      id: 1,
      slug: "test",
      name: "Test Product",
      price: 100,
      image: "img.jpg",
    };
    useCart.getState().addItem(product);
    useCart.getState().updateQuantity(1, 5);

    expect(useCart.getState().items[0].quantity).toBe(5);
  });

  it("should remove item when quantity is set to 0", () => {
    const product = {
      id: 1,
      slug: "test",
      name: "Test Product",
      price: 100,
      image: "img.jpg",
    };
    useCart.getState().addItem(product);
    useCart.getState().updateQuantity(1, 0);

    expect(useCart.getState().items).toHaveLength(0);
  });

  it("should calculate total price correctly", () => {
    useCart
      .getState()
      .addItem({ id: 1, slug: "p1", name: "P1", price: 100, image: "img.jpg" });
    useCart
      .getState()
      .addItem({ id: 2, slug: "p2", name: "P2", price: 250, image: "img.jpg" });
    useCart.getState().updateQuantity(1, 2); // 200 + 250 = 450

    expect(useCart.getState().getTotalPrice()).toBe(450);
  });
});
