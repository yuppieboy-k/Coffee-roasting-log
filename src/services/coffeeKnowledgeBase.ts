import { GreenBean } from '../types';

export interface OriginKnowledge {
  country: string;
  regions: string[];
  typicalAltitudeRange: string;
  commonVarieties: string[];
  commonProcesses: string[];
  generalFlavors: string[];
  roastingCharacteristics: string;
  densityNotes: string;
}

export interface VarietalKnowledge {
  name: string;
  cupProfile: string[];
  altitudePreference: string;
  densityLevel: 'Very High' | 'High' | 'Medium' | 'Low';
  roastRecommendations: string;
}

export interface SuggestedRoastProfile {
  chargeTempC: number;
  chargeTempF: number;
  turningPointTargetSec: string;
  dryingPhaseTargetPercent: string;
  maillardPhaseTargetPercent: string;
  developmentPhaseRatioTarget: string; // DTR%
  targetDropTempC: number;
  targetDropTempF: number;
  targetTotalTime: string;
  heatApplicationStrategy: string;
  airFlowStrategy: string;
  watchOuts: string[];
  idealBrewMethods: string[];
}

export interface BeanResearchReport {
  bean: GreenBean;
  originInfo?: OriginKnowledge;
  varietalInfo?: VarietalKnowledge;
  altitudeAnalysis: {
    classification: 'Strictly High Grown (SHG)' | 'High Grown (HG)' | 'Medium Altitude' | 'Lowland / Soft';
    densityImpact: string;
    acidityPotential: string;
    thermalTolerance: string;
  };
  flavorDescriptors: string[];
  processingNuances: string;
  suggestedProfile: SuggestedRoastProfile;
}

export const ORIGIN_DATABASE: Record<string, OriginKnowledge> = {
  Ethiopia: {
    country: 'Ethiopia',
    regions: ['Yirgacheffe', 'Guji', 'Sidama', 'Harrar', 'Jimma', 'Kaffa'],
    typicalAltitudeRange: '1,800 - 2,200 MASL',
    commonVarieties: ['Kurume', 'Dega', 'Wolisho', 'Heirloom Landraces'],
    commonProcesses: ['Washed', 'Natural', 'Anaerobic'],
    generalFlavors: ['Bergamot', 'Jasmine', 'Peach', 'Apricot', 'Black Tea', 'Blueberry (Natural)'],
    roastingCharacteristics: 'Small, dense beans with high moisture uniformity. Can absorb significant energy at charge. Preserves volatile floral terpenes best with rapid, clean development.',
    densityNotes: 'Very high density (SHG). Cells are tightly packed due to cool high-altitude nights.'
  },
  Colombia: {
    country: 'Colombia',
    regions: ['Huila', 'Nariño', 'Cauca', 'Tolima', 'Antioquia', 'Santander'],
    typicalAltitudeRange: '1,400 - 2,100 MASL',
    commonVarieties: ['Castillo', 'Caturra', 'Colombia', 'Pink Bourbon', 'Geisha', 'Typica'],
    commonProcesses: ['Washed', 'Extended Fermentation', 'Honey'],
    generalFlavors: ['Red Apple', 'Caramel', 'Panela', 'Citrus', 'Stone Fruit', 'Dark Chocolate'],
    roastingCharacteristics: 'Well-balanced density and versatile thermal response. For washed Huila/Nariño, maintain a smooth declining RoR for sparkling malic and citric acidity.',
    densityNotes: 'High density at high elevation (1700+ MASL). Takes heat evenly without tipping.'
  },
  Kenya: {
    country: 'Kenya',
    regions: ['Nyeri', 'Kirinyaga', 'Murang\'a', 'Kiambu', 'Embu'],
    typicalAltitudeRange: '1,600 - 2,100 MASL',
    commonVarieties: ['SL28', 'SL34', 'Ruiru 11', 'Batian'],
    commonProcesses: ['Double Washed (Kenya 72hr soak)', 'Natural (rare)'],
    generalFlavors: ['Blackcurrant', 'Grapefruit', 'Tomato Leaf / Savory Sweet', 'Phosphoric Brightness', 'Cranberry'],
    roastingCharacteristics: 'Massive density and rich organic acid content (phosphoric, malic). High thermal capacity requires robust energy early on to avoid stalling in mid-roast.',
    densityNotes: 'Extremely dense with screen sizes AA and AB. High cell wall integrity.'
  },
  Guatemala: {
    country: 'Guatemala',
    regions: ['Antigua', 'Huehuetenango', 'Cobán', 'Fraijanes', 'Atitlán'],
    typicalAltitudeRange: '1,300 - 2,000 MASL',
    commonVarieties: ['Bourbon', 'Caturra', 'Catuai', 'Typica', 'Pacamara'],
    commonProcesses: ['Washed', 'Honey'],
    generalFlavors: ['Milk Chocolate', 'Orange Peel', 'Spiced Apple', 'Toffee', 'Floral'],
    roastingCharacteristics: 'Volcanic soils yield mineral complexity. Excellent for both pour-over filter and sweet espresso bases. Handles medium development gracefully.',
    densityNotes: 'Hard bean (SHB) with uniform moisture content.'
  },
  CostaRica: {
    country: 'Costa Rica',
    regions: ['Tarrazú', 'Central Valley', 'West Valley', 'Brunca'],
    typicalAltitudeRange: '1,300 - 1,950 MASL',
    commonVarieties: ['Caturra', 'Catuai', 'Villa Sarchi', 'Geisha', 'SL28'],
    commonProcesses: ['White/Yellow/Red/Black Honey', 'Anaerobic', 'Washed'],
    generalFlavors: ['Honey', 'Brown Sugar', 'Crisp Green Apple', 'Tropical Fruits', 'Caramel'],
    roastingCharacteristics: 'Honey and anaerobic lots have high residual sugars that caramelize quickly. Lower charge temp slightly to prevent scorching bean faces.',
    densityNotes: 'Medium-high to high density. Sugar-rich mucilage layer requires gentle heat post-yellowing.'
  },
  Brazil: {
    country: 'Brazil',
    regions: ['Sul de Minas', 'Cerrado Mineiro', 'Mogiana', 'Espírito Santo', 'Matas de Minas'],
    typicalAltitudeRange: '900 - 1,350 MASL',
    commonVarieties: ['Yellow Bourbon', 'Mundo Novo', 'Catuai', 'Catucai'],
    commonProcesses: ['Pulped Natural', 'Natural'],
    generalFlavors: ['Hazelnut', 'Milk Chocolate', 'Peanut Butter', 'Molasses', 'Low Acidity / Heavy Body'],
    roastingCharacteristics: 'Softer bean with lower density. Sensitive to high charge temperatures which can cause tipping or scorched faces. Gentle conductive heat recommended.',
    densityNotes: 'Medium to low density due to lower altitudes. Heats up quickly from inside out.'
  },
  Indonesia: {
    country: 'Indonesia',
    regions: ['Sumatra (Aceh, Lake Toba)', 'Java', 'Sulawesi (Toraja)', 'Bali'],
    typicalAltitudeRange: '1,100 - 1,700 MASL',
    commonVarieties: ['Tim Tim', 'Ateng', 'Typica', 'Jember'],
    commonProcesses: ['Wet-Hulled (Giling Basah)', 'Washed', 'Anaerobic Natural'],
    generalFlavors: ['Cedar', 'Dark Cacao', 'Pipe Tobacco', 'Grapefruit', 'Herbal / Earthy', 'Syrupy Body'],
    roastingCharacteristics: 'Wet-hulled beans have irregular green/blue color and varying moisture. Require prolonged gentle drying phase to equalize moisture before ramping heat.',
    densityNotes: 'Irregular cellular density caused by hulling at high moisture content (30-50%).'
  },
  Panama: {
    country: 'Panama',
    regions: ['Boquete', 'Volcán', 'Piedra Candela'],
    typicalAltitudeRange: '1,600 - 2,100 MASL',
    commonVarieties: ['Geisha (Gesha)', 'Typica', 'Catuai'],
    commonProcesses: ['Washed', 'Natural', 'Slow Dry Anaerobic'],
    generalFlavors: ['Bergamot', 'Jasmine Blossom', 'Lemongrass', 'Papaya', 'White Peach', 'Champagne Sweetness'],
    roastingCharacteristics: 'Elongated, elegant bean structure. Roasting target is typically ultra-clean Nordic/Light style to accentuate supreme floral aromatics.',
    densityNotes: 'High density with delicate cellular membrane. Avoid baked profiles at all costs.'
  }
};

export const VARIETAL_DATABASE: Record<string, VarietalKnowledge> = {
  Geisha: {
    name: 'Geisha (Gesha)',
    cupProfile: ['Jasmine', 'Bergamot', 'Peach', 'Lemongrass', 'Floral Tea'],
    altitudePreference: 'Very High (> 1,700 MASL)',
    densityLevel: 'High',
    roastRecommendations: 'Roast light and fast with a short development ratio (11-14% DTR). Drop immediately as first crack subsides to retain ethereal floral terpenes.'
  },
  'Pink Bourbon': {
    name: 'Pink Bourbon',
    cupProfile: ['Pink Grapefruit', 'Papaya', 'White Peach', 'Honeysuckle', 'Cane Sugar'],
    altitudePreference: 'High (1,600 - 2,000 MASL)',
    densityLevel: 'Very High',
    roastRecommendations: 'High charge temperature tolerance. Give a moderate Maillard phase to balance its bright phosphoric acidity with brown-sugar sweetness.'
  },
  SL28: {
    name: 'SL-28',
    cupProfile: ['Blackcurrant', 'Rhubarb', 'Sparkling Citrus', 'Complex Tomato/Savory Sweet'],
    altitudePreference: 'High (1,500 - 2,100 MASL)',
    densityLevel: 'Very High',
    roastRecommendations: 'Strong energy throughout drying and early yellowing. Keep RoR declining smoothly into first crack to prevent sour, underdeveloped center.'
  },
  Bourbon: {
    name: 'Bourbon',
    cupProfile: ['Sweet Caramel', 'Red Apple', 'Chocolate', 'Clean Acidity'],
    altitudePreference: 'Medium-High (1,200 - 1,800 MASL)',
    densityLevel: 'High',
    roastRecommendations: 'Highly forgiving varietal with rich sweetness potential. Responds well to standard 14-17% DTR.'
  },
  Caturra: {
    name: 'Caturra / Catuai',
    cupProfile: ['Citrus', 'Milk Chocolate', 'Nutty Sweetness', 'Medium Body'],
    altitudePreference: 'Medium (1,100 - 1,700 MASL)',
    densityLevel: 'Medium',
    roastRecommendations: 'Standard heat transfer profile. Watch for flat RoR towards end of roast.'
  },
  Heirloom: {
    name: 'Ethiopian Heirloom / Landraces',
    cupProfile: ['Floral', 'Citrus Peel', 'Stone Fruit', 'Black Tea'],
    altitudePreference: 'Very High (1,800 - 2,200 MASL)',
    densityLevel: 'Very High',
    roastRecommendations: 'High initial thermal energy, gentle air management to avoid blowing tiny beans out, fast turnaround.'
  }
};

/**
 * Generates an automated, highly specific research report and suggested roast profile for a given green bean.
 */
export function generateBeanResearchReport(bean: GreenBean): BeanResearchReport {
  // 1. Match origin
  const originKey = Object.keys(ORIGIN_DATABASE).find(k =>
    bean.origin.toLowerCase().includes(k.toLowerCase())
  );
  const originInfo = originKey ? ORIGIN_DATABASE[originKey] : undefined;

  // 2. Match varietal
  const varietalKey = Object.keys(VARIETAL_DATABASE).find(k =>
    bean.variety ? bean.variety.toLowerCase().includes(k.toLowerCase()) : false
  );
  const varietalInfo = varietalKey ? VARIETAL_DATABASE[varietalKey] : undefined;

  // 3. Altitude analysis
  const alt = bean.altitude || 1600;
  let classification: BeanResearchReport['altitudeAnalysis']['classification'] = 'High Grown (HG)';
  let densityImpact = 'High cell density. Good thermal conductivity.';
  let acidityPotential = 'Bright, clean citric and malic acids.';
  let thermalTolerance = 'Moderate-high charge temperature tolerance.';

  if (alt >= 1900) {
    classification = 'Strictly High Grown (SHG)';
    densityImpact = 'Extremely dense cellular structure. Beans shrink tightly and have narrow fissures.';
    acidityPotential = 'Vibrant phosphoric, malic, and complex tartaric acidity potential.';
    thermalTolerance = 'Can absorb high initial thermal energy without risk of scorching.';
  } else if (alt < 1300) {
    classification = 'Lowland / Soft';
    densityImpact = 'Soft, porous cellular structure with lower density.';
    acidityPotential = 'Mellow, low acidity; heavy body and caramelized notes.';
    thermalTolerance = 'Lower thermal tolerance; risk of tipping or face scorch if charged above 195°C.';
  }

  // 4. Processing impact
  let processingNuances = 'Washed processing provides a clean, transparent canvas emphasizing origin character.';
  if (bean.process === 'Natural') {
    processingNuances = 'Natural dried-in-cherry coffee retains high fructose/glucose content. Caramels begin forming up to 10°C earlier. Reduce heat before first crack to prevent thermal runaway.';
  } else if (bean.process === 'Honey') {
    processingNuances = 'Residual mucilage increases sweetness and body. Requires watchful RoR management during the Maillard stage.';
  } else if (bean.process === 'Anaerobic') {
    processingNuances = 'Fermentation produces volatile wine/fruit esters. Roast gently with a light drop temperature (204-207°C) to keep delicate esters intact.';
  } else if (bean.process === 'Wet-Hulled') {
    processingNuances = 'High moisture variance. Extend the drying phase by 30-45 seconds to thoroughly dry the core before ramping heat.';
  }

  // 5. Build suggested roast profile
  let chargeTempC = 200;
  if (alt >= 1900) chargeTempC = 210;
  else if (alt < 1300) chargeTempC = 190;
  if (bean.process === 'Natural' || bean.process === 'Anaerobic') chargeTempC -= 6;

  let targetDropTempC = 208;
  if (bean.process === 'Anaerobic' || bean.variety?.toLowerCase().includes('geisha')) targetDropTempC = 205;
  if (alt < 1300) targetDropTempC = 214;

  const chargeTempF = Math.round((chargeTempC * 9) / 5 + 32);
  const targetDropTempF = Math.round((targetDropTempC * 9) / 5 + 32);

  const watchOuts: string[] = [];
  if (bean.process === 'Natural' || bean.process === 'Honey') {
    watchOuts.push('Watch for rapid caramelization post-yellowing due to elevated bean sugars.');
    watchOuts.push('Reduce gas/heat 30-45 seconds before first crack to avoid an uncontrolled temperature spike.');
  }
  if (alt >= 1900) {
    watchOuts.push('Extremely dense bean: ensure sufficient early heat penetration to avoid underdeveloped grassy cores.');
  }
  if (alt < 1300) {
    watchOuts.push('Soft bean structure: start with a moderate charge temperature to prevent surface tipping.');
  }
  watchOuts.push('Maintain a continuously declining Bean RoR throughout development to eliminate baked or ashy off-flavors.');

  // Flavor descriptors
  const flavors = new Set<string>();
  if (bean.flavorProfile) bean.flavorProfile.forEach(f => flavors.add(f));
  if (originInfo) originInfo.generalFlavors.forEach(f => flavors.add(f));
  if (varietalInfo) varietalInfo.cupProfile.forEach(f => flavors.add(f));

  return {
    bean,
    originInfo,
    varietalInfo,
    altitudeAnalysis: {
      classification,
      densityImpact,
      acidityPotential,
      thermalTolerance
    },
    flavorDescriptors: Array.from(flavors).slice(0, 8),
    processingNuances,
    suggestedProfile: {
      chargeTempC,
      chargeTempF,
      turningPointTargetSec: '1:10 - 1:25 (70-85s)',
      dryingPhaseTargetPercent: '42% - 46%',
      maillardPhaseTargetPercent: '36% - 40%',
      developmentPhaseRatioTarget: bean.variety?.toLowerCase().includes('geisha') ? '11% - 13%' : '13% - 16%',
      targetDropTempC,
      targetDropTempF,
      targetTotalTime: '8:45 - 10:15',
      heatApplicationStrategy: alt >= 1800
        ? 'High initial thermal energy (80-90% power), steadily stepped down in 3-4 increments as Bean Temp rises.'
        : 'Moderate initial energy (70% power), allowing gradual heat absorption without shocking softer bean cells.',
      airFlowStrategy: 'Low airflow during drying phase to conserve drum heat; increase to medium at yellowing to exhaust chaff and moisture; high airflow post-first crack to clear smoke.',
      watchOuts,
      idealBrewMethods: ['V60 / Kalita Pour-over', 'AeroPress', 'Modern Light Roast Espresso', 'Cupping']
    }
  };
}

