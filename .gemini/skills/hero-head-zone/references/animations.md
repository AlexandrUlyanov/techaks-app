# Animations Reference

## Standard GSAP Entrance

```javascript
const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
tl.from(".hero-nav", { y: -30, opacity: 0, duration: 0.8 })
  .from(".hero-label", { y: 20, opacity: 0, duration: 0.6 }, "-=0.3")
  .from(".hero-title", { y: 60, opacity: 0, duration: 1.0 }, "-=0.3")
  .from(".hero-sub", { y: 30, opacity: 0, duration: 0.7 }, "-=0.4")
  .from(".hero-ctas", { y: 20, opacity: 0, duration: 0.6 }, "-=0.3")
  .from(".scroll-hint", { opacity: 0, duration: 0.8 }, "-=0.2");
```

## Text Reveal (Lines/Words)

Use SplitText (if available) or a custom wrapper to wrap lines/words in `overflow: hidden` spans, then animate `y: "100%"` to `y: "0%"`.
