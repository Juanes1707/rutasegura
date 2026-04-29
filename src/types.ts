export enum VehicleType {
  CARRO = "carro",
  MOTO = "moto",
  BICICLETA = "bicicleta",
  PEATON = "peaton"
}

export enum RoutePriority {
  SEGURA = "segura",
  RAPIDA = "rapida",
  EQUILIBRADA = "equilibrada"
}

export enum TimeMode {
  DIA = "dia",
  NOCHE = "noche"
}

export interface RiskZone {
  id: number;
  name: string;
  coords: [number, number];
  radius: number;
  baseRisk: number;
  type: "robo" | "accidente" | "segura";
  reportsSafe: number;
  reportsUnsafe: number;
  description: string;
}

export interface RouteData {
  name: string;
  time: number;
  distance: number;
  coords: [number, number][];
  instructions: string[];
}

export interface IncidentReport {
  id: string;
  type: string;
  coords: [number, number];
  timestamp: number;
  description: string;
}
