# Backgrounds Reference

## WebGL Noise Flow (Tech / AI)

Requires Three.js. Use a plane geometry with a custom shader material that animates noise over time.

## Grain Overlay (Luxury / Minimal)

```css
.grain-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.04;
}
```

## CSS Blob Animation (Startup)

```css
.blob {
  position: absolute;
  filter: blur(80px);
  z-index: 0;
  animation: blobFloat 20s infinite alternate cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes blobFloat {
  0% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -50px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
  100% {
    transform: translate(0, 0) scale(1);
  }
}
```
