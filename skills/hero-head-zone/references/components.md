# Components Reference

## Navigation Bar

```css
.hero-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem clamp(1.5rem, 5vw, 4rem);
}
.hero-nav.scrolled {
  background: rgba(5, 5, 16, 0.75);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.4s ease;
}
```

## Magnetic Button (JS)

```javascript
document.querySelectorAll(".magnetic").forEach(btn => {
  btn.addEventListener("mousemove", e => {
    const r = btn.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.35;
    const y = (e.clientY - r.top - r.height / 2) * 0.35;
    gsap.to(btn, { x, y, duration: 0.4, ease: "power2.out" });
  });
  btn.addEventListener("mouseleave", () => {
    gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" });
  });
});
```

## Scroll Indicator

```html
<div class="scroll-hint">
  <div class="scroll-line"></div>
  <span>Scroll</span>
</div>
```

```css
.scroll-hint {
  position: absolute;
  bottom: 2.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  opacity: 0.35;
  animation: scrollHintFade 3s ease 2.5s infinite;
}
.scroll-line {
  width: 1px;
  height: 56px;
  background: linear-gradient(to bottom, transparent, currentColor);
  animation: scrollPulse 2.2s ease-in-out infinite;
}
@keyframes scrollPulse {
  0%,
  100% {
    transform: scaleY(0.1) translateY(-50%);
    opacity: 0;
  }
  50% {
    transform: scaleY(1) translateY(0);
    opacity: 1;
  }
}
```
