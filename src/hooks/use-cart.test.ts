import { describe, it, expect, beforeEach } from "vitest";
import { useCart } from "./use-cart";

describe("useCart", () => {
  beforeEach(() => {
    window.localStorage.clear();
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
    expect(items[0].cartKey).toBe("1:0");
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
    useCart.getState().updateQuantity("1:0", 5);

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
    useCart.getState().updateQuantity("1:0", 0);

    expect(useCart.getState().items).toHaveLength(0);
  });

  it("should calculate total price correctly", () => {
    useCart
      .getState()
      .addItem({ id: 1, slug: "p1", name: "P1", price: 100, image: "img.jpg" });
    useCart
      .getState()
      .addItem({ id: 2, slug: "p2", name: "P2", price: 250, image: "img.jpg" });
    useCart.getState().updateQuantity("1:0", 2); // 200 + 250 = 450

    expect(useCart.getState().getTotalPrice()).toBe(450);
  });

  it("should replace items with validated cart payload", () => {
    useCart
      .getState()
      .addItem({ id: 1, slug: "p1", name: "P1", price: 100, image: "img.jpg" });

    useCart.getState().replaceItems([
      {
        cartKey: "2:0",
        id: 2,
        slug: "p2",
        name: "P2",
        price: 250,
        image: "next.jpg",
        quantity: 3,
      },
    ]);

    expect(useCart.getState().items).toEqual([
      {
        cartKey: "2:0",
        id: 2,
        slug: "p2",
        name: "P2",
        price: 250,
        image: "next.jpg",
        quantity: 3,
      },
    ]);
  });

  it("should keep variants as separate cart lines", () => {
    useCart.getState().addItem({
      id: 1,
      variantId: 10,
      variantName: "128 GB / Black",
      slug: "phone",
      name: "Phone · 128 GB / Black",
      price: 100,
      image: "img.jpg",
    });
    useCart.getState().addItem({
      id: 1,
      variantId: 11,
      variantName: "256 GB / Blue",
      slug: "phone",
      name: "Phone · 256 GB / Blue",
      price: 120,
      image: "img.jpg",
    });

    expect(useCart.getState().items).toHaveLength(2);
    expect(useCart.getState().items.map(item => item.cartKey)).toEqual([
      "1:10",
      "1:11",
    ]);
  });

  it("should clear persisted cart storage", () => {
    useCart.getState().addItem({
      id: 1,
      slug: "test",
      name: "Test Product",
      price: 100,
      image: "img.jpg",
    });

    useCart.getState().clearCart();

    expect(useCart.getState().items).toHaveLength(0);
    expect(window.localStorage.getItem("techaks-cart")).toBeNull();
  });
});
