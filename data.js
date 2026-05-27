const supportData = [
  {
    id: "script-greeting-a",
    type: "script",
    brand: "Pearl Garden",
    category: "Greeting",
    title: "Warm welcome",
    content:
      "Hello, thank you for contacting Pearl Garden. How can I help you today?",
    tags: ["welcome", "first reply", "general"],
    updatedAt: "2026-05-20"
  },
  {
    id: "script-late-delivery-a",
    type: "script",
    brand: "Pearl Garden",
    category: "Delivery",
    title: "Late delivery apology",
    content:
      "We are sorry your order is taking longer than expected. Please share your order code and phone number so we can check with the store right away.",
    tags: ["delivery", "delay", "order code"],
    updatedAt: "2026-05-22"
  },
  {
    id: "script-refund-b",
    type: "script",
    brand: "Moon Cup",
    category: "Complaint",
    title: "Refund request",
    content:
      "I understand the issue. Please send us your order code, a photo of the item, and the phone number used for the order. We will review it and update you as soon as possible.",
    tags: ["refund", "complaint", "photo"],
    updatedAt: "2026-05-21"
  },
  {
    id: "script-out-of-stock-c",
    type: "script",
    brand: "Taro Lane",
    category: "Product",
    title: "Item unavailable",
    content:
      "This drink is currently unavailable at the selected store. You may choose another drink, or we can help check availability at a nearby branch.",
    tags: ["stock", "unavailable", "menu"],
    updatedAt: "2026-05-18"
  },
  {
    id: "promo-pearl-may",
    type: "promotion",
    brand: "Pearl Garden",
    title: "Buy 2 Get 1 Pearl Milk Tea",
    content:
      "Buy any 2 regular Pearl Milk Tea drinks and receive 1 regular Pearl Milk Tea for free. Applies to in-store purchases only.",
    startDate: "2026-05-25",
    endDate: "2026-06-02",
    channels: ["In-store"],
    tags: ["buy 2 get 1", "milk tea"],
    updatedAt: "2026-05-25"
  },
  {
    id: "promo-moon-june",
    type: "promotion",
    brand: "Moon Cup",
    title: "Free topping weekend",
    content:
      "Customers can choose one free topping for any large drink. Not combinable with other discounts.",
    startDate: "2026-06-06",
    endDate: "2026-06-08",
    channels: ["Grab", "ShopeeFood", "In-store"],
    tags: ["topping", "weekend", "large drink"],
    updatedAt: "2026-05-26"
  },
  {
    id: "store-pearl-d1",
    type: "store",
    brand: "Pearl Garden",
    title: "Pearl Garden District 1",
    managerName: "Store Manager",
    managerPhone: "0901 111 222",
    storePhone1: "0901 111 223",
    address: "12 Nguyen Hue, District 1, Ho Chi Minh City",
    hours: "09:00 - 22:00",
    notes: "Busiest after 19:00. Call store for large group orders.",
    tags: ["district 1", "nguyen hue", "phone"],
    updatedAt: "2026-05-17"
  },
  {
    id: "store-moon-d3",
    type: "store",
    brand: "Moon Cup",
    title: "Moon Cup District 3",
    managerName: "Store Manager",
    managerPhone: "0902 333 444",
    storePhone1: "0902 333 445",
    storePhone2: "0902 333 446",
    address: "48 Vo Van Tan, District 3, Ho Chi Minh City",
    hours: "08:30 - 21:30",
    notes: "Usually runs out of brown sugar pearls after 20:00.",
    tags: ["district 3", "vo van tan", "brown sugar"],
    updatedAt: "2026-05-16"
  },
  {
    id: "menu-pearl",
    type: "menu",
    brand: "Pearl Garden",
    title: "Main Drink Menu",
    content:
      "Core drinks: Pearl Milk Tea, Jasmine Milk Tea, Matcha Latte, Brown Sugar Fresh Milk. Add toppings: pearls, pudding, grass jelly, cheese foam.",
    imageLabel: "Place your real menu image in images/pearl-garden-menu.jpg",
    tags: ["menu", "matcha", "brown sugar", "toppings"],
    updatedAt: "2026-05-19"
  },
  {
    id: "menu-taro",
    type: "menu",
    brand: "Taro Lane",
    title: "Taro Specials Menu",
    content:
      "Popular drinks: Taro Milk Tea, Taro Cream Latte, Purple Rice Milk, Coconut Taro Smoothie.",
    imageLabel: "Place your real menu image in images/taro-lane-menu.jpg",
    tags: ["menu", "taro", "smoothie", "purple rice"],
    updatedAt: "2026-05-19"
  }
];
