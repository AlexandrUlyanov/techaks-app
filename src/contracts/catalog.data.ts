import type { Category } from "./catalog.types";

export const catalogData: Category[] = [
  {
    id: "electronics",
    title: "Электроника",
    slug: "electronics",
    icon: "Smartphone",
    href: "/catalog/electronics",
    featured: true,
    children: [
      {
        id: "phones-acc",
        title: "Смартфоны и аксессуары",
        items: [
          {
            id: "smartphones",
            title: "Смартфоны",
            href: "/catalog/smartphones",
            badge: "popular",
          },
          { id: "cases", title: "Чехлы", href: "/catalog/cases" },
          {
            id: "glasses",
            title: "Защитные стекла",
            href: "/catalog/protection",
          },
          {
            id: "chargers",
            title: "Зарядные устройства",
            href: "/catalog/chargers",
          },
          {
            id: "powerbanks",
            title: "Power Bank",
            href: "/catalog/power-banks",
            badge: "sale",
          },
        ],
      },
      {
        id: "audio",
        title: "Аудиотехника",
        items: [
          {
            id: "headphones",
            title: "Наушники",
            href: "/catalog/audio?sub=headphones",
          },
          {
            id: "speakers",
            title: "Bluetooth-колонки",
            href: "/catalog/audio?sub=speakers",
          },
          { id: "mics", title: "Микрофоны", href: "/catalog/audio?sub=mics" },
          {
            id: "audio-adapters",
            title: "Аудиоадаптеры",
            href: "/catalog/audio?sub=adapters",
          },
        ],
      },
      {
        id: "smart-devices",
        title: "Умные устройства",
        items: [
          { id: "watches", title: "Умные часы", href: "/catalog/gadgets" },
          {
            id: "bands",
            title: "Фитнес-браслеты",
            href: "/catalog/gadgets?sub=bands",
          },
          { id: "smart-home", title: "Умный дом", href: "/catalog/smart-home" },
          {
            id: "security",
            title: "Камеры наблюдения",
            href: "/catalog/smart-home?sub=security",
          },
        ],
      },
    ],
    brands: [
      { id: "apple", title: "Apple", href: "/catalog/brand/apple" },
      { id: "samsung", title: "Samsung", href: "/catalog/brand/samsung" },
      { id: "xiaomi", title: "Xiaomi", href: "/catalog/brand/xiaomi" },
      { id: "hoco", title: "HOCO", href: "/catalog/brand/hoco" },
    ],
    promo: [
      {
        id: "promo-1",
        title: "Скидки на электронику",
        subtitle: "До -30% на все гаджеты",
        href: "/promotions/electronics-sale",
        theme: "accent",
        cta: "Смотреть",
      },
    ],
  },
  {
    id: "auto-moto",
    title: "Авто/Вело/Мототовары",
    slug: "auto-moto",
    icon: "Car",
    href: "/catalog/auto-moto",
    children: [
      {
        id: "car-gadgets",
        title: "Автоэлектроника",
        items: [
          {
            id: "fm-transmitters",
            title: "FM трансмиттеры",
            href: "/catalog/auto?sub=fm",
          },
          {
            id: "dash-cams",
            title: "Видеорегистраторы",
            href: "/catalog/auto?sub=dash",
          },
          {
            id: "jump-starters",
            title: "Пуско-зарядные устройства",
            href: "/catalog/auto?sub=jump",
          },
        ],
      },
      {
        id: "car-holders",
        title: "Держатели и зарядки",
        items: [
          {
            id: "phone-holders",
            title: "Держатели для телефонов",
            href: "/catalog/auto?sub=holders",
          },
          {
            id: "car-chargers",
            title: "Автомобильные зарядки",
            href: "/catalog/auto?sub=chargers",
          },
        ],
      },
    ],
  },
  {
    id: "home-acc",
    title: "Аксессуары для дома",
    slug: "home-acc",
    icon: "Home",
    href: "/catalog/home-acc",
    children: [
      {
        id: "kitchen",
        title: "Для кухни",
        items: [
          {
            id: "kettles",
            title: "Чайники",
            href: "/catalog/home?sub=kettles",
          },
          { id: "scales", title: "Весы", href: "/catalog/home?sub=scales" },
        ],
      },
    ],
  },
  {
    id: "pc-acc",
    title: "Аксессуары для ПК",
    slug: "pc-acc",
    icon: "Laptop",
    href: "/catalog/pc-acc",
  },
  {
    id: "tv-acc",
    title: "Аксессуары для ТВ",
    slug: "tv-acc",
    icon: "Tv",
    href: "/catalog/tv-acc",
  },
  {
    id: "gadgets",
    title: "Гаджеты",
    slug: "gadgets",
    icon: "Watch",
    href: "/catalog/gadgets",
  },
  {
    id: "beauty-health",
    title: "Красота и здоровье",
    slug: "beauty-health",
    icon: "Heart",
    href: "/catalog/beauty-health",
  },
  {
    id: "tools",
    title: "Инструменты",
    slug: "tools",
    icon: "Wrench",
    href: "/catalog/tools",
  },
  {
    id: "climate",
    title: "Климатическая техника",
    slug: "climate",
    icon: "Wind",
    href: "/catalog/climate",
  },
  {
    id: "leisure",
    title: "Отдых и развлечения",
    slug: "leisure",
    icon: "Gamepad2",
    href: "/catalog/leisure",
  },
  {
    id: "merch",
    title: "Фирменный мерч",
    slug: "merch",
    icon: "Star",
    href: "/catalog/merch",
  },
  {
    id: "outlet",
    title: "Распродажа",
    slug: "outlet",
    icon: "Tag",
    href: "/catalog/outlet",
    featured: true,
  },
];
