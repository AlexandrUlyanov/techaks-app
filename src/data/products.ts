export interface Product {
  id: string;
  category: string;
  categorySlug: string;
  name: string;
  price: number;
  oldPrice?: number;
  badge?: "Акция" | "Хит" | "Новинка";
  image: string;
  description: string;
  specs: Record<string, string>;
  inStock: boolean;
  rating: number;
  reviewCount: number;
}

export const products: Product[] = [
  {
    id: "honor-x8b",
    category: "Аксессуары для телефонов",
    categorySlug: "phone-acc",
    name: "HONOR X8b 8GB/128GB",
    price: 19990,
    oldPrice: 22990,
    badge: "Акция",
    image: "/images/product-smartphone-1.jpg",
    description:
      'Смартфон HONOR X8b с 6.7" AMOLED дисплеем, 108 МП камерой и мощным процессором. 8 ГБ оперативной памяти и 128 ГБ встроенного хранилища обеспечивают плавную работу.',
    specs: {
      Экран: '6.7" AMOLED',
      Процессор: "Snapdragon 680",
      Память: "8GB/128GB",
      Камера: "108 МП",
      Батарея: "4500 мАч",
    },
    inStock: true,
    rating: 4.8,
    reviewCount: 12,
  },
  {
    id: "hoco-ew81",
    category: "Аудиотехника",
    categorySlug: "audio",
    name: "HOCO EW81 TWS",
    price: 2490,
    oldPrice: 2990,
    badge: "Хит",
    image: "/images/product-headphones-1.jpg",
    description:
      "Беспроводные наушники HOCO EW81 с активным шумоподавлением, чистым звуком и до 24 часов автономной работы с кейсом.",
    specs: {
      Тип: "TWS",
      Шумоподавление: "ANC",
      Автономность: "24ч",
      Зарядка: "USB-C",
      Влагозащита: "IPX4",
    },
    inStock: true,
    rating: 4.9,
    reviewCount: 24,
  },
  {
    id: "hoco-q6",
    category: "Аксессуары для телефонов",
    categorySlug: "phone-acc",
    name: "HOCO Q6 20W",
    price: 890,
    badge: "Новинка",
    image: "/images/product-charger-1.jpg",
    description:
      "Компактное зарядное устройство HOCO Q6 с поддержкой быстрой зарядки 20W через USB-C порт.",
    specs: {
      Мощность: "20W",
      Порты: "1x USB-C",
      "Быстрая зарядка": "PD 3.0",
      Размер: "40x40x25 мм",
    },
    inStock: true,
    rating: 4.7,
    reviewCount: 8,
  },
  {
    id: "case-iphone-15",
    category: "Аксессуары для телефонов",
    categorySlug: "phone-acc",
    name: "Чехол для iPhone 15 Pro",
    price: 1490,
    image: "/images/product-case-1.jpg",
    description:
      "Матовый силиконовый чехол премиум-класса для iPhone 15 Pro. Мягкая на ощупь поверхность, защита от царапин и падений.",
    specs: {
      Материал: "Силикон",
      Совместимость: "iPhone 15 Pro",
      Тип: "Накладка",
      Цвет: "Тёмно-синий",
    },
    inStock: true,
    rating: 4.6,
    reviewCount: 15,
  },
  {
    id: "isa-sw1",
    category: "Гаджеты",
    categorySlug: "gadgets",
    name: "ISA SW-1",
    price: 4990,
    oldPrice: 5990,
    badge: "Акция",
    image: "/images/product-watch-1.jpg",
    description:
      "Смарт-часы ISA SW-1 с круглым AMOLED дисплеем, пульсометром, шагомером и водозащитой IP68.",
    specs: {
      Экран: '1.43" AMOLED',
      Датчики: "Пульс, шаги, SpO2",
      Защита: "IP68",
      Автономность: "7 дней",
    },
    inStock: true,
    rating: 4.5,
    reviewCount: 6,
  },
  {
    id: "xiaomi-vacuum",
    category: "Умный дом",
    categorySlug: "smart-home",
    name: "Xiaomi Robot Vacuum",
    price: 24990,
    oldPrice: 29990,
    badge: "Акция",
    image: "/images/product-vacuum.jpg",
    description:
      "Робот-пылесос Xiaomi с лазерной навигацией, мощностью всасывания 4000 Па и поддержкой умного дома.",
    specs: {
      Мощность: "4000 Па",
      Навигация: "Лазерная LDS",
      "Ёмкость бака": "420 мл",
      Управление: "Приложение Mi Home",
    },
    inStock: true,
    rating: 4.8,
    reviewCount: 9,
  },
  {
    id: "hoco-gk1",
    category: "Аксессуары для компьютеров/ноутбуков",
    categorySlug: "pc-acc",
    name: "HOCO GK-1 Gaming Keyboard",
    price: 3490,
    image: "/images/product-keyboard.jpg",
    description:
      "Компактная игровая механическая клавиатура HOCO GK-1 с RGB-подсветкой и переключателями Blue Switch.",
    specs: {
      Тип: "Механическая",
      Переключатели: "Blue Switch",
      Подсветка: "RGB",
      Размер: "60%",
    },
    inStock: true,
    rating: 4.7,
    reviewCount: 11,
  },
  {
    id: "remax-rbm11",
    category: "Аудиотехника",
    categorySlug: "audio",
    name: "Remax RB-M11",
    price: 1790,
    oldPrice: 2290,
    badge: "Хит",
    image: "/images/product-speaker.jpg",
    description:
      "Портативная Bluetooth колонка Remax RB-M11 с мощным басом, водозащитой IPX5 и 12 часами автономности.",
    specs: {
      Мощность: "20W",
      Bluetooth: "5.3",
      Защита: "IPX5",
      Автономность: "12ч",
    },
    inStock: true,
    rating: 4.6,
    reviewCount: 18,
  },
  {
    id: "hoco-j88",
    category: "Аксессуары для телефонов",
    categorySlug: "phone-acc",
    name: "Power Bank HOCO J88 20000mAh",
    price: 2990,
    oldPrice: 3490,
    badge: "Хит",
    image: "/images/product-powerbank.jpg",
    description:
      "Мощный power bank HOCO J88 на 20000 мАч с поддержкой быстрой зарядки 22.5W и LED-дисплеем.",
    specs: {
      Ёмкость: "20000 мАч",
      Мощность: "22.5W",
      Порты: "2x USB-A, 1x USB-C",
      Дисплей: "LED",
    },
    inStock: true,
    rating: 4.8,
    reviewCount: 32,
  },
  {
    id: "redmi-note-13",
    category: "Аксессуары для телефонов",
    categorySlug: "phone-acc",
    name: "Xiaomi Redmi Note 13 8GB/256GB",
    price: 17990,
    badge: "Новинка",
    image: "/images/product-phone-2.jpg",
    description:
      "Xiaomi Redmi Note 13 с Super AMOLED дисплеем 120 Гц, камерой 108 МП и быстрой зарядкой 33W.",
    specs: {
      Экран: '6.67" AMOLED 120Hz',
      Процессор: "Snapdragon 685",
      Память: "8GB/256GB",
      Камера: "108 МП",
      Батарея: "5000 мАч",
    },
    inStock: true,
    rating: 4.7,
    reviewCount: 7,
  },
  {
    id: "glass-iphone-15",
    category: "Аксессуары для телефонов",
    categorySlug: "phone-acc",
    name: "Защитное стекло iPhone 15",
    price: 590,
    image: "/images/product-glass.jpg",
    description:
      "Закалённое защитное стекло премиум-класса для iPhone 15. Твёрдость 9H, олеофобное покрытие, лёгкая установка.",
    specs: {
      Твёрдость: "9H",
      Толщина: "0.33 мм",
      Покрытие: "Олеофобное",
      Совместимость: "iPhone 15",
    },
    inStock: true,
    rating: 4.5,
    reviewCount: 22,
  },
  {
    id: "hoco-dh08",
    category: "Умный дом",
    categorySlug: "smart-home",
    name: "Ирригатор HOCO DH08",
    price: 3290,
    oldPrice: 3990,
    badge: "Акция",
    image: "/images/product-irrigator.jpg",
    description:
      "Портативный ирригатор HOCO DH08 для ухода за полостью рта. 4 режима работы, 3 насадки в комплекте.",
    specs: {
      Режимы: "4 режима",
      Насадки: "3 шт",
      Ёмкость: "300 мл",
      Автономность: "21 день",
    },
    inStock: true,
    rating: 4.6,
    reviewCount: 5,
  },
];

export const categories = [
  { slug: "home-acc", name: "Аксессуары для дома" },
  { slug: "auto-moto", name: "Авто/Вело/Мототовары" },
  { slug: "pc-acc", name: "Аксессуары для компьютеров/ноутбуков" },
  { slug: "tv-acc", name: "Аксессуары для телевизоров" },
  { slug: "phone-acc", name: "Аксессуары для телефонов" },
  { slug: "audio", name: "Аудиотехника" },
  { slug: "gadgets", name: "Гаджеты" },
  { slug: "protection", name: "Защита устройств" },
  { slug: "tools", name: "Инструменты" },
  { slug: "climate", name: "Климатическая техника" },
  { slug: "beauty-health", name: "Красота и здоровье" },
  { slug: "leisure", name: "Отдых и развлечения" },
  { slug: "related", name: "Сопутствующий товар" },
  { slug: "electronics", name: "Техника" },
  { slug: "smart-home", name: "Умный дом" },
  { slug: "outlet", name: "Уцененный товар" },
  { slug: "merch", name: "Фирменный мерч" },
];

export const homeCategories = [
  {
    name: "Аксессуары для телефонов",
    icon: "Smartphone",
    description: "Чехлы, зарядки, кабели, адаптеры",
    slug: "phone-acc",
  },
  {
    name: "Аудиотехника",
    icon: "Headphones",
    description: "Наушники, колонки, гарнитуры",
    slug: "audio",
  },
  {
    name: "Защита устройств",
    icon: "Shield",
    description: "Стёкла, плёнки, защита камер",
    slug: "protection",
  },
  {
    name: "Гаджеты",
    icon: "Watch",
    description: "Смарт-часы, браслеты, трекеры",
    slug: "gadgets",
  },
  {
    name: "Умный дом",
    icon: "Home",
    description: "Роботы, лампы, датчики, розетки",
    slug: "smart-home",
  },
  {
    name: "Аксессуары для ПК",
    icon: "Gamepad2",
    description: "Мыши, клавиатуры, периферия",
    slug: "pc-acc",
  },
  {
    name: "Инструменты",
    icon: "Wrench",
    description: "Отвертки, тестеры, расходники",
    slug: "tools",
  },
  {
    name: "Красота и здоровье",
    icon: "Heart",
    description: "Фены, триммеры, ирригаторы",
    slug: "beauty-health",
  },
];
