import { JobCategory, CostModel } from '../types';

export interface ISDEMeasureConfig {
  category: JobCategory;
  shortLabel: string;
  isISDE: boolean;
  unit: 'm²' | 'st.' | 'm1';
  singleRate: number;     // Subsidie per eenheid bij 1 maatregel
  doubleRate: number;     // Subsidie per eenheid bij 2 of meer maatregelen
  minQuantity: number;    // Minimale oppervlakte / aantal voor RVO subsidie
  maxQuantity?: number;   // Maximale gesubsidieerde oppervlakte
  rdValueRequirement: string; // Isolatiewaarde eise (bijv. Rd >= 3.5)
  rvoUrl: string;         // Directe bronlink RVO
  description: string;
  defaultCostModel: CostModel;
  defaultUnitPrice: number; // Gemiddelde marktprijs per m² of unit
  defaultFixedPrice: number;
}

export const ISDE_MEASURES: Record<string, ISDEMeasureConfig> = {
  '🍃 ISDE Dak- of zolderisolatie': {
    category: '🍃 ISDE Dak- of zolderisolatie',
    shortLabel: 'Dakisolatie',
    isISDE: true,
    unit: 'm²',
    singleRate: 16.25,
    doubleRate: 32.50,
    minQuantity: 20,
    maxQuantity: 200,
    rdValueRequirement: 'Rd ≥ 3,5 m²K/W',
    rvoUrl: 'https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/isolatiemaatregelen#voorwaarden-dakisolatie-of-zolder--of-vlieringvloerisolatie',
    description: 'Subsidie voor het isoleren van de dakconstructie of de zoldervloer door een erkend bouwbedrijf.',
    defaultCostModel: 'per_m2',
    defaultUnitPrice: 65,
    defaultFixedPrice: 0,
  },
  '🍃 ISDE Gevelisolatie': {
    category: '🍃 ISDE Gevelisolatie',
    shortLabel: 'Gevelisolatie',
    isISDE: true,
    unit: 'm²',
    singleRate: 20.25,
    doubleRate: 40.50,
    minQuantity: 10,
    maxQuantity: 170,
    rdValueRequirement: 'Rd ≥ 3,5 m²K/W',
    rvoUrl: 'https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/isolatiemaatregelen#voorwaarden-gevelisolatie',
    description: 'Buitengevel- of binnenmuurisolatie (voorzetwanden) met hoge isolatiewaarde.',
    defaultCostModel: 'per_m2',
    defaultUnitPrice: 110,
    defaultFixedPrice: 0,
  },
  '🍃 ISDE Spouwmuurisolatie': {
    category: '🍃 ISDE Spouwmuurisolatie',
    shortLabel: 'Spouwmuurisolatie',
    isISDE: true,
    unit: 'm²',
    singleRate: 5.25,
    doubleRate: 10.50,
    minQuantity: 10,
    maxQuantity: 170,
    rdValueRequirement: 'Rd ≥ 1,1 m²K/W',
    rvoUrl: 'https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/isolatiemaatregelen#voorwaarden-spouwmuurisolatie',
    description: 'Opvullen van de spouwmuur met isolatiemateriaal (wol, parels of schuim).',
    defaultCostModel: 'per_m2',
    defaultUnitPrice: 25,
    defaultFixedPrice: 0,
  },
  '🍃 ISDE Vloer- of bodemisolatie': {
    category: '🍃 ISDE Vloer- of bodemisolatie',
    shortLabel: 'Bodemisolatie',
    isISDE: true,
    unit: 'm²',
    singleRate: 3.00,
    doubleRate: 6.00,
    minQuantity: 20,
    maxQuantity: 130,
    rdValueRequirement: 'Vloerisolatie: Rd ≥ 3,5 m²K/W • Bodemisolatie: Rd ≥ 3,5 m²K/W',
    rvoUrl: 'https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/isolatiemaatregelen#voorwaarden-bodem--of-vloerisolatie',
    description: 'Isolatie aan de onderzijde van de begane grondvloer of op de kruipruimtebodem.',
    defaultCostModel: 'per_m2',
    defaultUnitPrice: 45,
    defaultFixedPrice: 0,
  },
// 1. Standaard isolatieglas (HR++, Vacuümglas óf Triple glas zonder nieuw kozijn)
'🍃 ISDE Glas (HR++ / Vacuüm / Triple excl. kozijn)': {
  category: '🍃 ISDE Glas (HR++ / Vacuüm / Triple excl. kozijn)',
  shortLabel: 'HR++ / Glas excl. kozijn',
  isISDE: true,
  unit: 'm²',
  singleRate: 25.00,
  doubleRate: 50.00,
  minQuantity: 3, // 8 m² indien uitgevoerd in 2023/2024
  maxQuantity: 45,
  rdValueRequirement: 'HR++: U ≤ 1,2 W/m²K • Triple/Vacuüm (zonder kozijn): U ≤ 0,7 W/m²K',
  rvoUrl: 'https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/isolatiemaatregelen#voorwaarden-glasisolatie,-deuren-en-panelen',
  description: 'HR++, vacuümglas of Triple glas geplaatst in bestaande kozijnen. Uitsluitend ter vervanging van bestaand glas.',
  defaultCostModel: 'per_m2',
  defaultUnitPrice: 150,
  defaultFixedPrice: 0,
},

// 2. Hoogwaardig isolatieglas met nieuw kozijn (Triple glas of Vacuümglas met kozijn)
'🍃 ISDE Triple / Vacuümglas (met nieuw kozijn)': {
  category: '🍃 ISDE Triple / Vacuümglas (met nieuw kozijn)',
  shortLabel: 'Triple / Vacuüm incl. kozijn',
  isISDE: true,
  unit: 'm²',
  singleRate: 111.00,
  doubleRate: 222.00,
  minQuantity: 3, // 8 m² indien uitgevoerd in 2023/2024
  maxQuantity: 45,
  rdValueRequirement: 'U ≤ 0,7 W/m²K + verplichte vervanging kozijnen (Vacuümglas via meldcode "overige")',
  rvoUrl: 'https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/isolatiemaatregelen#voorwaarden-glasisolatie,-deuren-en-panelen',
  description: 'Triple glas of vacuümglas inclusief nieuwe isolerende kozijnen. Vervanging kozijnen is verplicht voor dit tarief.',
  defaultCostModel: 'per_m2',
  defaultUnitPrice: 400,
  defaultFixedPrice: 0,
},

// 3. Isolerende deur (Lage isolatiewaarde / Standaard)
'🍃 ISDE Isolerende Deur (Standaard)': {
  category: '🍃 ISDE Isolerende Deur (Standaard)',
  shortLabel: 'Isolerende Deur (Ud ≤ 1,5)',
  isISDE: true,
  unit: 'm²',
  singleRate: 25.00,
  doubleRate: 50.00,
  minQuantity: 3,
  maxQuantity: 45,
  rdValueRequirement: 'Ud ≤ 1,5 W/m²K (en > 1,0 W/m²K). Verplicht i.c.m. HR++, Triple of vacuümglas.',
  rvoUrl: 'https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/isolatiemaatregelen#voorwaarden-glasisolatie,-deuren-en-panelen',
  description: 'Nieuwe isolerende buitendeur. Kan alleen aangevraagd worden in combinatie met isolatieglas.',
  defaultCostModel: 'per_m2',
  defaultUnitPrice: 300,
  defaultFixedPrice: 0,
},

// 4. Isolerende deur (Hoge isolatiewaarde)
'🍃 ISDE Isolerende Deur (Hoogwaardig)': {
  category: '🍃 ISDE Isolerende Deur (Hoogwaardig)',
  shortLabel: 'Isolerende Deur (Ud ≤ 1,0)',
  isISDE: true,
  unit: 'm²',
  singleRate: 111.00,
  doubleRate: 222.00,
  minQuantity: 3,
  maxQuantity: 45,
  rdValueRequirement: 'Ud ≤ 1,0 W/m²K + bouwbedrijfverklaring vereist. Verplicht i.c.m. HR++, Triple of vacuümglas.',
  rvoUrl: 'https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/isolatiemaatregelen#voorwaarden-glasisolatie,-deuren-en-panelen',
  description: 'Hoogwaardige isolerende deur. Ontvangt het hogere Triple-tarief. Verklaring bouwbedrijf verplicht.',
  defaultCostModel: 'per_m2',
  defaultUnitPrice: 600,
  defaultFixedPrice: 0,
},
  '🍃 ISDE (Hybride) Warmtepomp': {
    category: '🍃 ISDE (Hybride) Warmtepomp',
    shortLabel: 'Warmtepomp',
    isISDE: true,
    unit: 'st.',
    singleRate: 2800.00,
    doubleRate: 2800.00, // Fixed lump sum subsidie per installatie
    minQuantity: 1,
    maxQuantity: 2,
    rdValueRequirement: 'A++ Energielabel of hoger • Opgenomen in RVO meldcodelijst',
    rvoUrl: 'https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/warmtepomp',
    description: 'Hybride of volledig elektrische warmtepomp voor ruimteverwarming en warm water.',
    defaultCostModel: 'fixed',
    defaultUnitPrice: 0,
    defaultFixedPrice: 4500,
  },
  '🍃 ISDE Ventilatiesysteem': {
    category: '🍃 ISDE Ventilatiesysteem',
    shortLabel: 'Ventilatie (WTW)',
    isISDE: true,
    unit: 'st.',
    singleRate: 400.00,
    doubleRate: 400.00,
    minQuantity: 1,
    maxQuantity: 2,
    rdValueRequirement: 'Balansventilatie met WTW (Warmteterugwinning) of decentrale WTW-unit',
    rvoUrl: 'https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/ventilatie',
    description: 'Aanschaf en installatie van een energiezuinig ventilatiesysteem met warmteterugwinning.',
    defaultCostModel: 'fixed',
    defaultUnitPrice: 0,
    defaultFixedPrice: 2500,
  },
  '🍃 ISDE Zonneboiler': {
    category: '🍃 ISDE Zonneboiler',
    shortLabel: 'Zonneboiler',
    isISDE: true,
    unit: 'st.',
    singleRate: 1200.00,
    doubleRate: 1200.00,
    minQuantity: 1,
    maxQuantity: 2,
    rdValueRequirement: 'Zonnecollector + voorraadvat • Opgenomen in RVO meldcodelijst',
    rvoUrl: 'https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/zonneboiler',
    description: 'Zonnecollectoren op het dak voor duurzame opwekking van warm tapwater.',
    defaultCostModel: 'fixed',
    defaultUnitPrice: 0,
    defaultFixedPrice: 3200,
  },
  '🍃 ISDE Warmtenetaansluiting': {
    category: '🍃 ISDE Warmtenetaansluiting',
    shortLabel: 'Warmtenet',
    isISDE: true,
    unit: 'st.',
    singleRate: 3775.00,
    doubleRate: 3775.00,
    minQuantity: 1,
    maxQuantity: 1,
    rdValueRequirement: 'Aansluiting op een centraal warmtenet / stadsverwarming',
    rvoUrl: 'https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/aansluiting-warmtenet',
    description: 'Eenmalige tegemoetkoming voor het aansluiten van je woning op een lokaal warmtenet.',
    defaultCostModel: 'fixed',
    defaultUnitPrice: 0,
    defaultFixedPrice: 5000,
  },
  '🍃 ISDE Elektrische Kookvoorziening': {
    category: '🍃 ISDE Elektrische Kookvoorziening',
    shortLabel: 'Elektrisch Koken',
    isISDE: true,
    unit: 'st.',
    singleRate: 400.00,
    doubleRate: 400.00,
    minQuantity: 1,
    maxQuantity: 1,
    rdValueRequirement: 'Elektrische kookplaat / Inductie • Volledig verwijderen gasaansluiting voor koken • Aangesloten op een warmtenet',
    rvoUrl: 'https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/elektrische-kookvoorziening',
    description: 'Tegemoetkoming voor het laten verwijderen van de gasaansluiting en overstappen op inductie koken.',
    defaultCostModel: 'fixed',
    defaultUnitPrice: 0,
    defaultFixedPrice: 800,
  },
};

export const REGULAR_CATEGORIES: JobCategory[] = [
  '🔨 Stucen & Afwerking',
  '🎨 Schilderwerk',
  '⚡ Elektra & Verlichting',
  '🚰 Loodgieter & Sanitair',
  '🧹 Sloop- & Voorbereidingswerk',
  '🧱 Metsel- & Tegelwerk',
  '🪵 Timmerwerk & Afwerking',
  '📦 Vloer leggen & Afwerking',
  '🛠️ Diversen',
];

export const ALL_JOB_CATEGORIES: JobCategory[] = [
  ...Object.keys(ISDE_MEASURES) as JobCategory[],
  ...REGULAR_CATEGORIES,
];

export function getISDEConfig(category: string): ISDEMeasureConfig | null {
  return ISDE_MEASURES[category] || null;
}

export interface ISDEJobCalculation {
  isISDE: boolean;
  config: ISDEMeasureConfig | null;
  quantity: number;            // m² or count
  unit: string;
  rateUsed: number;            // € per m² or € lump sum
  isDoubleRateActive: boolean; // Is doubling bonus active
  subsidyAmount: number;       // Calculated ISDE payout €
  meetsMinimum: boolean;       // Is minQuantity achieved
  shortfall: number;           // Additional m² or units required to reach min
  maxCappedQuantity: number;   // Quantity capped at max
}

export function calculateJobISDESubsidy(
  category: JobCategory,
  quantity: number,
  totalActiveISDECount: number
): ISDEJobCalculation {
  const config = getISDEConfig(category);

  if (!config || !config.isISDE) {
    return {
      isISDE: false,
      config: null,
      quantity: 0,
      unit: '',
      rateUsed: 0,
      isDoubleRateActive: false,
      subsidyAmount: 0,
      meetsMinimum: true,
      shortfall: 0,
      maxCappedQuantity: 0,
    };
  }

  // 2 or more active ISDE measures triggers double rate for m² isolation measures!
  const isDoubleRateActive = totalActiveISDECount >= 2;
  const rateUsed = isDoubleRateActive ? config.doubleRate : config.singleRate;

  // Quantity capped at maxQuantity if specified by RVO
  let effectiveQty = quantity;
  if (config.maxQuantity && effectiveQty > config.maxQuantity) {
    effectiveQty = config.maxQuantity;
  }

  const meetsMinimum = quantity >= config.minQuantity;
  const shortfall = Math.max(0, config.minQuantity - quantity);

  // If minimum requirement is met, calculate payout. Otherwise payout is 0 until threshold is met.
  const subsidyAmount = meetsMinimum ? Math.round(effectiveQty * rateUsed * 100) / 100 : 0;

  return {
    isISDE: true,
    config,
    quantity,
    unit: config.unit,
    rateUsed,
    isDoubleRateActive,
    subsidyAmount,
    meetsMinimum,
    shortfall,
    maxCappedQuantity: effectiveQty,
  };
}
