import { RiskZone, RouteData } from './types';

export const BOGOTA_CENTER: [number, number] = [4.6559, -74.0628];

export const INITIAL_RISK_ZONES: RiskZone[] = [
  {
    id: 1,
    name: "Chapinero (Líder Seguridad)",
    coords: [4.6585, -74.0615],
    radius: 280,
    baseRisk: 15,
    type: "segura",
    reportsSafe: 120,
    reportsUnsafe: 5,
    description: "Localidad con mejor puntaje integral (6.0). Alta recuperación comercial."
  },
  {
    id: 9,
    name: "Los Mártires (Riesgo Crítico)",
    coords: [4.6085, -74.0885],
    radius: 450,
    baseRisk: 95,
    type: "robo",
    reportsSafe: 2,
    reportsUnsafe: 85,
    description: "Puntaje más bajo (2.1). Deterioro estructural y alta variabilidad delictiva."
  },
  {
    id: 10,
    name: "Engativá (Desmejora 2024)",
    coords: [4.7100, -74.1150],
    radius: 400,
    baseRisk: 78,
    type: "robo",
    reportsSafe: 10,
    reportsUnsafe: 45,
    description: "Retroceso notable en seguridad (Puesto 18/19). Percepción de inseguridad en aumento."
  },
  {
    id: 11,
    name: "Ciudad Bolívar (Riesgo Estable)",
    coords: [4.5300, -74.1500],
    radius: 500,
    baseRisk: 82,
    type: "robo",
    reportsSafe: 12,
    reportsUnsafe: 55,
    description: "Comportamiento inestable sin mejoras estructurales (4.6)."
  },
  {
    id: 2,
    name: "Carrera 11 - Cruces de tráfico",
    coords: [4.6548, -74.0648],
    radius: 240,
    baseRisk: 62,
    type: "accidente",
    reportsSafe: 6,
    reportsUnsafe: 12,
    description: "Riesgo por cruces, velocidad y flujo vehicular."
  },
  {
    id: 3,
    name: "Zona iluminada Chapinero",
    coords: [4.6528, -74.0598],
    radius: 230,
    baseRisk: 28,
    type: "segura",
    reportsSafe: 21,
    reportsUnsafe: 4,
    description: "Zona con mejor iluminación y percepción de seguridad."
  },
  {
    id: 4,
    name: "Zona universitaria",
    coords: [4.6384, -74.0847],
    radius: 340,
    baseRisk: 55,
    type: "robo",
    reportsSafe: 9,
    reportsUnsafe: 13,
    description: "Alta movilidad estudiantil y riesgo variable por horario."
  },
  {
    id: 5,
    name: "Centro Internacional",
    coords: [4.6147, -74.0705],
    radius: 360,
    baseRisk: 68,
    type: "robo",
    reportsSafe: 7,
    reportsUnsafe: 16,
    description: "Zona de alto flujo laboral y comercial."
  },
  {
    id: 6,
    name: "La Candelaria",
    coords: [4.5981, -74.0758],
    radius: 420,
    baseRisk: 74,
    type: "robo",
    reportsSafe: 5,
    reportsUnsafe: 20,
    description: "Zona turística con variación fuerte entre día y noche."
  },
  {
    id: 7,
    name: "Parque de la 93",
    coords: [4.6769, -74.0486],
    radius: 300,
    baseRisk: 35,
    type: "segura",
    reportsSafe: 23,
    reportsUnsafe: 5,
    description: "Zona con alta presencia comercial y mejor percepción."
  },
  {
    id: 8,
    name: "Zona T",
    coords: [4.6663, -74.0537],
    radius: 320,
    baseRisk: 48,
    type: "robo",
    reportsSafe: 14,
    reportsUnsafe: 10,
    description: "Riesgo aumenta en horarios nocturnos por alta concentración de personas."
  }
];

export const PRESET_ROUTES: Record<'fast' | 'safe', RouteData> = {
  fast: {
    name: "Ruta rápida",
    time: 11,
    distance: 2.4,
    coords: [
      [4.6508, -74.0668],
      [4.6532, -74.0648],
      [4.6554, -74.0632],
      [4.6585, -74.0615],
      [4.6614, -74.0596]
    ],
    instructions: [
      "Avanza por la Carrera 13",
      "Gira a la derecha hacia Calle 72",
      "Continúa por zona de alto flujo",
      "Llegas al destino"
    ]
  },
  safe: {
    name: "Ruta segura",
    time: 15,
    distance: 2.9,
    coords: [
      [4.6508, -74.0668],
      [4.6522, -74.0638],
      [4.6528, -74.0598],
      [4.6562, -74.0584],
      [4.6614, -74.0596]
    ],
    instructions: [
      "Toma una vía alterna con menor riesgo",
      "Evita la zona roja de Calle 72",
      "Continúa por corredor más seguro",
      "Llegas al destino"
    ]
  }
};
