import { RiskZone, VehicleType, TimeMode, RoutePriority } from '../types';

export function calculateZoneRisk(zone: RiskZone, vehicleType: VehicleType, timeMode: TimeMode): number {
  let risk = zone.baseRisk;

  // Time adjustment
  if (timeMode === TimeMode.NOCHE) {
    risk += 15;
  }

  // Vehicle adjustment
  switch (vehicleType) {
    case VehicleType.CARRO:
      if (zone.type === "accidente") risk += 10;
      break;
    case VehicleType.MOTO:
      if (zone.type === "robo") risk += 15;
      if (zone.type === "accidente") risk += 10;
      break;
    case VehicleType.BICICLETA:
      if (zone.type === "accidente") risk += 15;
      break;
    case VehicleType.PEATON:
      if (zone.type === "robo") risk += 20;
      break;
  }

  return Math.min(risk, 100);
}

export function calculateDynamicRiskScore(vehicleType: VehicleType, timeMode: TimeMode, priority: RoutePriority): number {
  let risk = 45;

  if (timeMode === TimeMode.NOCHE) risk += 20;
  if (vehicleType === VehicleType.MOTO) risk += 15;
  if (vehicleType === VehicleType.PEATON) risk += 18;
  
  if (priority === RoutePriority.SEGURA) risk -= 20;
  if (priority === RoutePriority.RAPIDA) risk += 10;

  return Math.max(5, Math.min(100, risk));
}
