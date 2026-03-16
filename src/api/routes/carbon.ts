import { Router } from 'express';

interface GCPRegionData {
  region: string;
  displayName: string;
  lat: number;
  lng: number;
  carbonIntensity: number;
  costPerHour: number;
  available: boolean;
}

interface CarbonForecastPoint {
  date: string;
  region: string;
  predicted: number;
  lower: number;
  upper: number;
}

interface RegionComparison {
  region: string;
  carbon: number;
  cost: number;
  compositeScore: number;
}

const REGIONS: readonly GCPRegionData[] = [
  { region: 'us-central1', displayName: 'Iowa', lat: 41.26, lng: -95.86, carbonIntensity: 430, costPerHour: 0.0340, available: true },
  { region: 'us-east1', displayName: 'South Carolina', lat: 33.84, lng: -81.16, carbonIntensity: 380, costPerHour: 0.0340, available: true },
  { region: 'us-west1', displayName: 'Oregon', lat: 45.59, lng: -122.59, carbonIntensity: 90, costPerHour: 0.0340, available: true },
  { region: 'europe-west1', displayName: 'Belgium', lat: 50.45, lng: 3.82, carbonIntensity: 160, costPerHour: 0.0380, available: true },
  { region: 'europe-west4', displayName: 'Netherlands', lat: 53.45, lng: 6.73, carbonIntensity: 340, costPerHour: 0.0380, available: true },
  { region: 'europe-north1', displayName: 'Finland', lat: 60.57, lng: 27.01, carbonIntensity: 70, costPerHour: 0.0366, available: true },
  { region: 'asia-east1', displayName: 'Taiwan', lat: 24.05, lng: 120.69, carbonIntensity: 510, costPerHour: 0.0372, available: true },
  { region: 'asia-southeast1', displayName: 'Singapore', lat: 1.34, lng: 103.84, carbonIntensity: 410, costPerHour: 0.0400, available: true },
  { region: 'australia-southeast1', displayName: 'Sydney', lat: -33.86, lng: 151.21, carbonIntensity: 530, costPerHour: 0.0420, available: true },
  { region: 'southamerica-east1', displayName: 'Sao Paulo', lat: -23.55, lng: -46.63, carbonIntensity: 60, costPerHour: 0.0460, available: true },
] as const;

const FORECAST_REGIONS = ['us-west1', 'europe-north1', 'asia-east1'] as const;

function buildForecast(): readonly CarbonForecastPoint[] {
  const baseIntensity: Record<string, number> = {
    'us-west1': 90,
    'europe-north1': 70,
    'asia-east1': 510,
  };

  const today = new Date();
  return FORECAST_REGIONS.flatMap((region) => {
    const base = baseIntensity[region];
    return Array.from({ length: 7 }, (_, dayOffset) => {
      const date = new Date(today);
      date.setDate(today.getDate() + dayOffset);
      // Deterministic variation based on day offset and region hash
      const hash = region.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const drift = Math.sin((dayOffset + hash) * 0.7) * base * 0.15;
      const predicted = Math.round(base + drift);
      return {
        date: date.toISOString().split('T')[0],
        region,
        predicted,
        lower: Math.round(predicted * 0.82),
        upper: Math.round(predicted * 1.18),
      };
    });
  });
}

function buildComparisons(): readonly RegionComparison[] {
  const maxCarbon = Math.max(...REGIONS.map((r) => r.carbonIntensity));
  const maxCost = Math.max(...REGIONS.map((r) => r.costPerHour));

  const scored = REGIONS.map((r) => {
    const normalizedCarbon = r.carbonIntensity / maxCarbon;
    const normalizedCost = r.costPerHour / maxCost;
    return {
      region: r.region,
      carbon: r.carbonIntensity,
      cost: r.costPerHour,
      compositeScore: Math.round((normalizedCarbon * 0.7 + normalizedCost * 0.3) * 100) / 100,
    };
  });

  return [...scored].sort((a, b) => a.compositeScore - b.compositeScore);
}

export const carbonRouter = Router();

carbonRouter.get('/regions', (_req, res) => {
  res.json(REGIONS);
});

carbonRouter.get('/forecast', (_req, res) => {
  res.json(buildForecast());
});

carbonRouter.get('/budget', (_req, res) => {
  res.json({
    used: 142.57,
    limit: 500,
    percentage: 28.51,
    unit: 'kgCO2e',
  });
});

carbonRouter.get('/comparisons', (_req, res) => {
  res.json(buildComparisons());
});
