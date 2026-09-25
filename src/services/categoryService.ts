import { Category } from "../models/Category.js";
import { Product } from "../models/Product.js";
import { AppError } from "../middleware/errorMiddleware.js";
import { slugify } from "../utils/slugify.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import {
  CATEGORY_CATALOG,
  defaultCategoryDescription,
  findCatalogNode,
} from "../data/categoryCatalog.js";

export type CategoryUpsertInput = {
  name?: string;
  slug?: string;
  description?: string;
  image?: string;
  status?: "active" | "inactive";
  parentId?: string | null;
  children?: string[];
  createChildren?: boolean;
};

function nameQuery(name: string) {
  return { $regex: `^${escapeRegex(name.trim())}$`, $options: "i" };
}

export async function uniqueCategorySlug(base: string, excludeId?: string) {
  const root = slugify(base) || "category";
  let slug = root;
  let n = 2;
  while (true) {
    const clash = await Category.findOne({
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!clash) return slug;
    slug = `${root}-${n++}`;
  }
}

export async function mapCategory(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const parentId = obj.parentId ? String(obj.parentId) : null;
  const children = await Category.find({ parentId: obj._id }).select("name");
  const childNames = children.map((child) => child.name);
  const [productCount, parent] = await Promise.all([
    Product.countDocuments({
      category: { $in: [obj.name, ...childNames] },
      status: { $ne: "inactive" },
    }),
    parentId ? Category.findById(parentId).select("name") : null,
  ]);
  return {
    id: String(obj._id),
    name: obj.name,
    slug: obj.slug,
    description: obj.description,
    image: obj.image || "",
    status: obj.status,
    parentId,
    parentName: parent?.name || null,
    sortOrder: obj.sortOrder ?? 0,
    childCount: children.length,
    childNames,
    productCount,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

async function resolveParent(parentId?: string | null) {
  if (!parentId) return null;
  const parent = await Category.findById(parentId);
  if (!parent) throw new AppError("Parent category not found", 404);
  if (parent.parentId) {
    throw new AppError("Subcategories cannot have children. Choose a top-level parent.", 400);
  }
  return parent;
}

export async function upsertCategory(input: CategoryUpsertInput) {
  const name = (input.name || "").trim();
  if (!name) throw new AppError("Category name is required", 400);

  const parent = await resolveParent(input.parentId);
  const parentId = parent?._id ?? null;

  const existing = await Category.findOne({
    parentId,
    name: nameQuery(name),
  });

  const desiredSlug = slugify(input.slug || (parent ? `${parent.slug}-${name}` : name));
  const autoDescription = defaultCategoryDescription(name, parent?.name);
  let created = false;
  let item = existing;

  if (!item) {
    item = await Category.create({
      name,
      slug: await uniqueCategorySlug(desiredSlug),
      description: input.description?.trim() || autoDescription,
      image: input.image?.trim() || "",
      status: input.status || "active",
      parentId,
      sortOrder: 0,
    });
    created = true;
  } else {
    item.name = name;
    if (!item.description?.trim()) {
      item.description = input.description?.trim() || autoDescription;
    } else if (input.description?.trim()) {
      item.description = input.description.trim();
    }
    if (input.image?.trim()) {
      item.image = input.image.trim();
    }
    if (input.status) {
      item.status = input.status;
    }
    const canonicalSlug = await uniqueCategorySlug(desiredSlug, String(item._id));
    const legacySlug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const legacyPrefixed = parent ? `${parent.slug}-${legacySlug}` : legacySlug;
    if (input.slug || item.slug === legacySlug || item.slug === legacyPrefixed) {
      item.slug = canonicalSlug;
    }
    await item.save();
  }

  const shouldCreateChildren = input.createChildren !== false && !parentId;
  if (shouldCreateChildren) {
    const catalogChildren = findCatalogNode(name)?.children || [];
    const extra = (input.children || []).map((c) => c.trim()).filter(Boolean);
    const childNames = [...catalogChildren];
    for (const extraName of extra) {
      if (!childNames.some((c) => c.toLowerCase() === extraName.toLowerCase())) {
        childNames.push(extraName);
      }
    }
    await ensureChildCategories(item, childNames);
  }

  return { item, created };
}

export async function updateCategoryById(id: string, input: CategoryUpsertInput) {
  const item = await Category.findById(id);
  if (!item) throw new AppError("Category not found", 404);

  const name = (input.name ?? item.name).trim();
  if (!name) throw new AppError("Category name is required", 400);

  const requestedParent =
    input.parentId !== undefined
      ? input.parentId
      : item.parentId
        ? String(item.parentId)
        : null;

  if (requestedParent && requestedParent === String(item._id)) {
    throw new AppError("A category cannot be its own parent", 400);
  }

  const childCount = await Category.countDocuments({ parentId: item._id });
  if (requestedParent && childCount > 0) {
    throw new AppError("Move or delete subcategories before nesting this category", 400);
  }

  const parent = await resolveParent(requestedParent);
  const parentId = parent?._id ?? null;

  const clash = await Category.findOne({
    parentId,
    name: nameQuery(name),
    _id: { $ne: item._id },
  });
  if (clash) {
    throw new AppError("A category with this name already exists under the selected parent", 409);
  }

  const previousName = item.name;
  item.name = name;
  item.parentId = parentId;
  if (input.description !== undefined) {
    item.description = input.description.trim();
  } else if (!item.description?.trim()) {
    item.description = defaultCategoryDescription(name, parent?.name);
  }
  if (input.image?.trim()) {
    item.image = input.image.trim();
  }
  if (input.status) item.status = input.status;
  if (input.slug || name !== previousName) {
    const desiredSlug = slugify(input.slug || (parent ? `${parent.slug}-${name}` : name));
    item.slug = await uniqueCategorySlug(desiredSlug, String(item._id));
  }
  await item.save();

  if (input.createChildren && !parentId) {
    const catalogChildren = findCatalogNode(name)?.children || [];
    const extra = (input.children || []).map((c) => c.trim()).filter(Boolean);
    const childNames = [...catalogChildren];
    for (const extraName of extra) {
      if (!childNames.some((c) => c.toLowerCase() === extraName.toLowerCase())) {
        childNames.push(extraName);
      }
    }
    await ensureChildCategories(item, childNames);
  }

  return item;
}

export async function ensureChildCategories(parent: any, names: string[]) {
  for (let index = 0; index < names.length; index++) {
    const name = names[index].trim();
    if (!name) continue;
    const existing = await Category.findOne({
      parentId: parent._id,
      name: nameQuery(name),
    });
    if (existing) {
      existing.sortOrder = index;
      if (!existing.description?.trim()) {
        existing.description = defaultCategoryDescription(name, parent.name);
      }
      await existing.save();
      continue;
    }
    await Category.create({
      name,
      slug: await uniqueCategorySlug(`${parent.slug}-${name}`),
      description: defaultCategoryDescription(name, parent.name),
      image: "",
      status: "active",
      parentId: parent._id,
      sortOrder: index,
    });
  }
}

export async function syncCategoryCatalog() {
  const results: { name: string; created: boolean; id: string }[] = [];
  for (let index = 0; index < CATEGORY_CATALOG.length; index++) {
    const node = CATEGORY_CATALOG[index];
    const { item, created } = await upsertCategory({
      name: node.name,
      children: node.children,
      createChildren: true,
    });
    item.sortOrder = index;
    await item.save();
    results.push({ name: item.name, created, id: String(item._id) });
  }
  return results;
}

export async function productCategoryFilter(value: string): Promise<Record<string, unknown> | null> {
  if (!value) return null;
  const match = await Category.findOne({
    $or: [{ name: nameQuery(value) }, { slug: slugify(value) }],
  });
  if (!match) return { category: value };
  if (!match.parentId) {
    const children = await Category.find({ parentId: match._id }).select("name");
    return {
      category: { $in: [match.name, ...children.map((c) => c.name)] },
    };
  }
  return { category: match.name };
}
