import { 
  Antenna,
  Badge,
  Bike,
  Brush,
  CarFront,
  Cctv,
  Smartphone, 
  Laptop, 
  Headphones, 
  Watch as SmartWatchIcon, 
  Shield, 
  ShieldCheck,
  Zap, 
  Keyboard, 
  Mouse, 
  MousePointer2,
  HardDrive, 
  Home, 
  Sparkles, 
  Drill,
  Coffee, 
  Car, 
  Speaker, 
  Camera, 
  Wifi, 
  Gamepad, 
  Gamepad2,
  FolderTree,
  Cable,
  CircleParking,
  Clock,
  CookingPot,
  Dice5,
  Fan,
  Fuel,
  GlassWater,
  Hand,
  HandHeart,
  HeartPulse,
  KeyRound,
  Waves,
  Lightbulb,
  Gift,
  Scale,
  Monitor,
  MonitorUp,
  Package,
  PackageCheck,
  BatteryCharging,
  Plug,
  PlugZap,
  Mic,
  Printer,
  Radio,
  Radar,
  Scissors,
  Shirt,
  ShoppingBag,
  SprayCan,
  Tent,
  TreePine,
  Tv,
  Video,
  WalletCards,
  Webcam,
  Wind,
  Wine,
} from "lucide-react";

export function getCategoryIcon(name: string, slug: string) {
  const n = name.toLowerCase().replace(/ё/g, "е");
  const s = slug.toLowerCase();
  const text = `${n} ${s}`;
  const has = (...parts: string[]) => parts.some(part => text.includes(part));

  // Explicit top-level category mappings
  if (has("для дома", "dlya-doma")) return Home;
  if (has("отдых и развлеч", "otdyh-i-razvlechen")) return Tent;
  if (has("фирменная продукция", "firmennaya-produkciya", "firmenn")) return ShoppingBag;

  // Transport and car accessories
  if (has("вело", "мото")) return Bike;
  if (has("автокосмет", "уход-за-авто", "uhod-za-avto")) return SprayCan;
  if (has("автовизит", "парковоч")) return CircleParking;
  if (has("насос")) return Fuel;
  if (has("пылесос") && has("авто")) return CarFront;
  if (has("ароматизатор")) return Sparkles;
  if (has("видеорегистратор")) return Camera;
  if (has("радар")) return Radar;
  if (has("прикуривател")) return PlugZap;
  if (has("авто", "машин", "avto", "prikurivatel")) return Car;

  // Core devices
  if (has("телевизор", "тв пристав", "tv-pristav", "televizor")) return Tv;
  if (has("телефон", "iphone", "samsung", "smartfon", "смартфон")) return Smartphone;
  if (has("планшет")) return Monitor;
  if (has("ноутбук", "компьютер", "kompyuter")) return Laptop;
  
  // Audio, video, creator tools
  if (has("наушник", "air pods", "naushniki")) return Headphones;
  if (has("колонк", "саундбар", "динамик")) return Speaker;
  if (has("микрофон", "microfon")) return Mic;
  if (has("штатив", "монопод")) return Webcam;
  if (has("блогер", "съемок", "видео")) return Video;
  if (has("фотопринтер", "принтер")) return Printer;
  if (has("радиостанц")) return Antenna;
  if (has("радио", "transmitt")) return Radio;
  if (has("камер", "линз")) return Camera;
  
  // Wearables and personal accessories
  if (has("настенные", "настольные часы")) return Clock;
  if (has("часы", "watch", "браслет")) return SmartWatchIcon;
  if (has("ремешк")) return SmartWatchIcon;
  if (has("картхолдер", "magsafe")) return WalletCards;
  if (has("airtag")) return Badge;
  
  // Connectivity, power and computer accessories
  if (has("wi-fi", "router", "роутер", "усилитель")) return Wifi;
  if (has("hdmi", "vga", "патч", "удлинитель", "кабель", "kabel", "usb")) return Cable;
  if (has("адаптер", "переходник", "adapter")) return Plug;
  if (has("сетевые фильтры", "розет", "блоки питания", "питания")) return PlugZap;
  if (has("powerbank", "аккумулятор", "батаре", "battery")) return BatteryCharging;
  if (has("заряд")) return Zap;
  if (has("накопител", "флеш", "карт", "hard")) return HardDrive;
  
  // Input and gaming
  if (has("клавиатур", "klaviatura")) return Keyboard;
  if (has("коврик")) return MousePointer2;
  if (has("мыш", "mouse")) return Mouse;
  if (has("геймпад", "джойстик")) return Gamepad2;
  if (has("консол", "игр", "game")) return Gamepad;
  if (has("стилус")) return Hand;
  if (has("подставка")) return MonitorUp;
  
  // Holders, protection and cases
  if (has("держател", "holder", "липпер", "попсокет", "нательный")) return Hand;
  if (has("водонепроница")) return Waves;
  if (has("стекло", "пленк", "антишпион", "глянцев", "аппликатор", "линзы", "steklo")) return ShieldCheck;
  if (has("чехол", "chehol", "защит")) return Shield;
  
  // Home, appliances, climate
  if (has("умный дом")) return Home;
  if (has("камеры наблюдения")) return Cctv;
  if (has("метеостанц", "климат")) return Fan;
  if (has("освещение", "ламп", "лента", "фонар", "гирлянд", "свеч")) return Lightbulb;
  if (has("пылесос", "мойщик")) return Waves;
  if (has("утюг", "отпариватель")) return Zap;
  if (has("сушилки", "одежд", "обув")) return Shirt;
  if (has("катышк")) return Brush;

  // Kitchen
  if (has("кофе", "чайник")) return Coffee;
  if (has("кухонные весы", "весы")) return Scale;
  if (has("вино")) return Wine;
  if (has("тостер", "печь", "аэрогрил", "мясоруб", "блендер", "вакууматор", "мельниц", "ножеточ", "кухн")) return CookingPot;
  if (has("техника")) return Package;

  // Beauty and health
  if (has("красота", "здоровье", "уход за телом")) return HandHeart;
  if (has("массаж")) return HeartPulse;
  if (has("ирригатор", "щетк")) return Sparkles;
  if (has("бритв", "стрижк", "тример", "щипц")) return Scissors;
  if (has("фен", "выпрямитель")) return Wind;
  if (has("зеркал")) return Sparkles;
  
  // Outdoors, holidays and misc
  if (has("туризм", "активный отдых")) return Tent;
  if (has("бутылк", "термос", "термокруж")) return GlassWater;
  if (has("настольные игры")) return Dice5;
  if (has("брелк")) return KeyRound;
  if (has("праздник", "подарок")) return Gift;
  if (has("новогод", "елк")) return TreePine;
  if (has("инструмент")) return Drill;
  if (has("клей", "скотч", "изолент")) return PackageCheck;
  if (has("пакет")) return ShoppingBag;
  if (has("уцен")) return Package;
  if (has("мерч")) return ShoppingBag;
  if (has("сопутств")) return PackageCheck;
  if (has("разное", "аксессуар")) return Package;
  
  return FolderTree;
}

export const CategoryIcon = ({ name, slug, className, size = 24 }: { name: string, slug: string, className?: string, size?: number }) => {
  const IconComponent = getCategoryIcon(name, slug);
  return <IconComponent className={className} size={size} />;
};
