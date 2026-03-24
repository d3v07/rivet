import { Router } from 'express';

interface GCPMachineType {
  name: string;
  vcpus: number;
  memoryGb: number;
  costPerHour: Record<string, number>;
}

const MACHINE_TYPES: readonly GCPMachineType[] = [
  {
    name: 'e2-micro',
    vcpus: 0.25,
    memoryGb: 1,
    costPerHour: {
      'us-central1': 0.00838,
      'europe-west1': 0.00922,
      'asia-east1': 0.00981,
      'europe-north1': 0.00922,
    },
  },
  {
    name: 'e2-small',
    vcpus: 0.5,
    memoryGb: 2,
    costPerHour: {
      'us-central1': 0.01675,
      'europe-west1': 0.01843,
      'asia-east1': 0.01961,
      'europe-north1': 0.01843,
    },
  },
  {
    name: 'e2-medium',
    vcpus: 1,
    memoryGb: 4,
    costPerHour: {
      'us-central1': 0.03351,
      'europe-west1': 0.03686,
      'asia-east1': 0.03923,
      'europe-north1': 0.03686,
    },
  },
  {
    name: 'e2-standard-2',
    vcpus: 2,
    memoryGb: 8,
    costPerHour: {
      'us-central1': 0.06701,
      'europe-west1': 0.07371,
      'asia-east1': 0.07845,
      'europe-north1': 0.07371,
    },
  },
  {
    name: 'e2-standard-4',
    vcpus: 4,
    memoryGb: 16,
    costPerHour: {
      'us-central1': 0.13402,
      'europe-west1': 0.14742,
      'asia-east1': 0.1569,
      'europe-north1': 0.14742,
    },
  },
] as const;

export const pricingRouter = Router();

pricingRouter.get('/', (_req, res) => {
  res.json(MACHINE_TYPES);
});
