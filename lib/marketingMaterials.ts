export type MarketingMaterialsType = 'shelf_talker' | 'table_tent' | 'both';

export const marketingMaterialsLabels: Record<MarketingMaterialsType, string> = {
  shelf_talker: 'Shelf talker',
  table_tent: 'Table tent',
  both: 'Shelf talker + table tent',
};

export const isMarketingMaterialsType = (value: unknown): value is MarketingMaterialsType =>
  typeof value === 'string' && value in marketingMaterialsLabels;

export const formatMarketingMaterialsLabel = (value?: string | null) =>
  value && value in marketingMaterialsLabels
    ? marketingMaterialsLabels[value as MarketingMaterialsType]
    : 'Marketing materials';
