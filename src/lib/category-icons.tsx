import { 
  Smartphone, 
  Laptop, 
  Headphones, 
  Watch as SmartWatchIcon, 
  Shield, 
  Zap, 
  Keyboard, 
  Mouse, 
  HardDrive, 
  Home, 
  Sparkles, 
  Hammer, 
  Coffee, 
  Car, 
  Speaker, 
  Camera, 
  Wifi, 
  Gamepad, 
  FolderTree,
  Cable,
  Waves,
  Lightbulb,
  Music,
  Gift,
  Scale,
  Monitor,
  Package,
  Battery,
  Plug,
  Mic,
} from "lucide-react";

export function getCategoryIcon(name: string, slug: string) {
  const n = name.toLowerCase();
  const s = slug.toLowerCase();

  // 1. Core devices
  if (n.includes("телефон") || n.includes("iphone") || n.includes("samsung") || s.includes("smartfon")) return Smartphone;
  if (n.includes("ноутбук") || n.includes("компьютер")) return Laptop;
  if (n.includes("планшет")) return Monitor;
  
  // 2. Audio & Video
  if (n.includes("наушник") || n.includes("air pods") || n.includes("naushniki")) return Headphones;
  if (n.includes("колонк") || n.includes("динамик")) return Speaker;
  if (n.includes("микрофон")) return Mic;
  if (n.includes("видео") || n.includes("камер") || n.includes("регистратор")) return Camera;
  if (n.includes("радио") || n.includes("transmitt")) return Music;
  
  // 3. Wearables
  if (n.includes("часы") || n.includes("watch")) return SmartWatchIcon;
  if (n.includes("браслет")) return SmartWatchIcon;
  
  // 4. Connectivity
  if (n.includes("кабель") || n.includes("kabel") || n.includes("usb")) return Cable;
  if (n.includes("адаптер") || n.includes("переходник") || n.includes("adapter")) return Plug;
  if (n.includes("wi-fi") || n.includes("router") || n.includes("роутер")) return Wifi;
  
  // 5. Input
  if (n.includes("клавиатур") || n.includes("klaviatura")) return Keyboard;
  if (n.includes("мыш") || n.includes("mouse") || n.includes("коврик")) return Mouse;
  if (n.includes("геймпад") || n.includes("джойстик") || n.includes("консол")) return Gamepad;
  if (n.includes("стилус")) return Hammer;
  
  // 6. Protection
  if (n.includes("чехол") || n.includes("chehol")) return Shield;
  if (n.includes("стекло") || n.includes("пленка") || n.includes("steklo") || n.includes("zashchita")) return Shield;
  
  // 7. Power
  if (n.includes("заряд") || n.includes("power") || n.includes("аккумулятор")) return Zap;
  if (n.includes("батарейк") || n.includes("pitaniya")) return Battery;
  
  // 8. Appliances & Beauty
  if (n.includes("фен") || n.includes("бритв") || n.includes("стрижк") || n.includes("бритв")) return Sparkles;
  if (n.includes("красота") || n.includes("здоровье") || n.includes("косметик")) return Sparkles;
  if (n.includes("утюг") || n.includes("отпариватель")) return Zap;
  if (n.includes("кофе") || n.includes("кухня") || n.includes("мельниц")) return Coffee;
  if (n.includes("весы")) return Scale;
  if (n.includes("пылесос")) return Waves;
  if (n.includes("умный дом")) return Home;
  
  // 9. Auto
  if (n.includes("авто") || n.includes("машин") || n.includes("prikurivatel")) return Car;
  
  // 10. Storage
  if (n.includes("накопител") || n.includes("флеш") || n.includes("карт")) return HardDrive;
  
  // 11. Misc
  if (n.includes("освещение") || n.includes("ламп") || n.includes("лента") || n.includes("фонар")) return Lightbulb;
  if (n.includes("инструмент")) return Hammer;
  if (n.includes("подарок") || n.includes("праздник") || n.includes("новогод")) return Gift;
  if (n.includes("уцен")) return Package;

  return FolderTree;
}

export const CategoryIcon = ({ name, slug, className, size = 24 }: { name: string, slug: string, className?: string, size?: number }) => {
  const IconComponent = getCategoryIcon(name, slug);
  return <IconComponent className={className} size={size} />;
};
