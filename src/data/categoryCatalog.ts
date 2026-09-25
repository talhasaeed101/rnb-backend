export type CategoryCatalogNode = {
  name: string;
  children?: string[];
};

/**
 * Canonical store hierarchy. Idempotent seed/create uses this list.
 * Extend here (or pass `children` on create) without changing category APIs.
 */
export const CATEGORY_CATALOG: CategoryCatalogNode[] = [
  { name: "Wallets" },
  {
    name: "Bags",
    children: [
      "Duffle Bags",
      "Shoulder Bags",
      "Side Bags",
      "Laptop Bags",
      "School Bags",
      "Leather Bags",
    ],
  },
  {
    name: "Bottles",
    children: ["Water Bottles", "Gym Bottles"],
  },
  {
    name: "Accessories",
    children: ["Belts"],
  },
  {
    name: "Men's Wear",
    children: ["T-Shirts", "Polo Shirts"],
  },
  {
    name: "Pants",
    children: [
      "Gurgyaa Pants",
      "Cotton Pants",
      "Active Wear Trousers",
      "Cotton Trousers",
      "Micro Trousers",
      "Linen Trousers",
    ],
  },
  {
    name: "Shirts",
    children: [
      "Full Sleeve Shirts",
      "Dress Shirts",
      "Basic T-Shirts",
      "Polo Shirts",
      "Jerseys",
      "Dry Fit Shirts",
    ],
  },
  {
    name: "Tracksuits",
    children: ["Safari Suits", "Active Wear Tracksuits", "Zipper Tracksuits"],
  },
  {
    name: "Shorts (Men)",
    children: ["Cotton Shorts", "Dry Fit Shorts", "Micro Fabric Shorts", "Jean Shorts"],
  },
  {
    name: "Four Season Uppers",
    children: ["Dry Fit Uppers"],
  },
  { name: "Under Garments" },
];

export function findCatalogNode(name: string): CategoryCatalogNode | undefined {
  const key = name.trim().toLowerCase();
  return CATEGORY_CATALOG.find((node) => node.name.toLowerCase() === key);
}

export function defaultCategoryDescription(name: string, parentName?: string): string {
  const trimmed = name.trim();
  if (parentName) {
    return `Shop ${trimmed} in our ${parentName.trim()} range — practical pieces chosen for everyday use.`;
  }
  return `Explore our ${trimmed} collection, selected for quality, comfort, and everyday wear.`;
}
