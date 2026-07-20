export type ShelfTalkerFlavor = 'chicken' | 'salmon' | 'beef';
export type ShelfTalkerStatus = 'queued' | 'sent' | 'skipped';

export interface ShelfTalkerFulfillment {
  id: string;
  retailer_id: string;
  location_id?: string | null;
  flavor: ShelfTalkerFlavor;
  status: ShelfTalkerStatus;
  fulfilled_order_id?: string | null;
  qualified_at?: string;
  fulfilled_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface SupabaseLike {
  from: (table: string) => any;
}

interface ProductLike {
  name?: string | null;
  size?: string | null;
}

interface OrderItemRow {
  product?: ProductLike | ProductLike[] | null;
  order?: { status?: string | null; location_id?: string | null } | { status?: string | null; location_id?: string | null }[] | null;
}

const FLAVOR_LABELS: Record<ShelfTalkerFlavor, string> = {
  chicken: 'Chicken',
  salmon: 'Salmon',
  beef: 'Beef',
};

const FLAVORS: ShelfTalkerFlavor[] = ['chicken', 'salmon', 'beef'];

const normalizeText = (value?: string | null) => (value || '').toLowerCase().trim();
const normalizeSize = (value?: string | null) => normalizeText(value).replace(/\s+/g, '');

export const formatShelfTalkerFlavor = (flavor: string) =>
  flavor in FLAVOR_LABELS ? FLAVOR_LABELS[flavor as ShelfTalkerFlavor] : flavor;

export const formatShelfTalkerList = (flavors: string[]) =>
  flavors.map(formatShelfTalkerFlavor).join(', ');

export const getShelfTalkerProductMatch = (product?: ProductLike | null) => {
  const name = normalizeText(product?.name);
  const size = normalizeSize(product?.size);
  const flavor = FLAVORS.find((candidate) => name.includes(candidate));

  if (!flavor) return null;
  if (size.startsWith('6')) return { flavor, size: '6' as const };
  if (size.startsWith('12')) return { flavor, size: '12' as const };
  return null;
};

export const getQualifiedShelfTalkerFlavors = (products: ProductLike[]) => {
  const sizesByFlavor = new Map<ShelfTalkerFlavor, Set<'6' | '12'>>();

  products.forEach((product) => {
    const match = getShelfTalkerProductMatch(product);
    if (!match) return;

    const sizes = sizesByFlavor.get(match.flavor) || new Set<'6' | '12'>();
    sizes.add(match.size);
    sizesByFlavor.set(match.flavor, sizes);
  });

  return FLAVORS.filter((flavor) => {
    const sizes = sizesByFlavor.get(flavor);
    return Boolean(sizes?.has('6') && sizes?.has('12'));
  });
};

export async function queueShelfTalkersForOrder({
  adminClient,
  retailerId,
  locationId,
  orderId,
}: {
  adminClient: SupabaseLike;
  retailerId: string;
  locationId?: string | null;
  orderId: string;
}) {
  const itemsQuery = adminClient
    .from('order_items')
    .select('product:products(name, size), order:orders!inner(status, location_id, retailer_id)')
    .eq('order.retailer_id', retailerId);

  const { data: itemRows, error: itemsError } = await itemsQuery;
  if (itemsError) {
    throw itemsError;
  }

  const carriedProducts = ((itemRows || []) as OrderItemRow[])
    .filter((item) => {
      const order = Array.isArray(item.order) ? item.order[0] : item.order;
      if (order?.status === 'canceled') return false;
      if (!locationId) return !order?.location_id;
      return order?.location_id === locationId || !order?.location_id;
    })
    .map((item) => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product;
      return product || null;
    })
    .filter(Boolean) as ProductLike[];

  const qualifiedFlavors = getQualifiedShelfTalkerFlavors(carriedProducts);
  if (qualifiedFlavors.length === 0) {
    return [];
  }

  let existingQuery = adminClient
    .from('shelf_talker_fulfillments')
    .select('flavor, status')
    .eq('retailer_id', retailerId)
    .in('status', ['queued', 'sent']);

  if (locationId) {
    existingQuery = existingQuery.eq('location_id', locationId);
  } else {
    existingQuery = existingQuery.is('location_id', null);
  }

  const { data: existingRows, error: existingError } = await existingQuery;
  if (existingError) {
    throw existingError;
  }

  const existingFlavors = new Set((existingRows || []).map((row: { flavor: ShelfTalkerFlavor }) => row.flavor));
  const flavorsToQueue = qualifiedFlavors.filter((flavor) => !existingFlavors.has(flavor));

  if (flavorsToQueue.length === 0) {
    return [];
  }

  const now = new Date().toISOString();
  const { data: insertedRows, error: insertError } = await adminClient
    .from('shelf_talker_fulfillments')
    .insert(
      flavorsToQueue.map((flavor) => ({
        retailer_id: retailerId,
        location_id: locationId || null,
        flavor,
        status: 'queued',
        fulfilled_order_id: orderId,
        qualified_at: now,
      }))
    )
    .select('*');

  if (insertError) {
    throw insertError;
  }

  return (insertedRows || []) as ShelfTalkerFulfillment[];
}
