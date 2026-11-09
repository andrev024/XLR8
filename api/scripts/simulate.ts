import 'dotenv/config';
import {
  generateRouteScenario,
  SIMULATION_SCENARIOS,
  type SimulationScenario,
} from '../src/simulation/route-generator';

const API_URL = (process.env.API_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);
const DEMO_PASSWORD = 'xlr8-demo-password';
const DEFAULT_USER = 'carlos.medio@xlr8.app';

interface CircuitListItem {
  id: string;
  name: string;
  lengthMeters: number;
}

interface GeoJsonLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

interface CircuitDetail extends CircuitListItem {
  startLine: GeoJsonLineString;
  finishLine: GeoJsonLineString;
  referencePath: GeoJsonLineString;
}

interface Vehicle {
  id: string;
  type: 'MOTORCYCLE' | 'CAR';
  brand: string;
  model: string;
  horsepower: number;
  powerCategory: 'LOW' | 'MID' | 'HIGH';
}

interface DetectedAttempt {
  id: string;
  circuitId: string;
  durationMs: number;
  isValid: boolean;
  invalidReason: string | null;
}

interface ActivityResponse {
  activity: { id: string };
  detectedAttempts: DetectedAttempt[];
}

interface CliOptions {
  circuit?: string;
  scenario?: SimulationScenario;
  user?: string;
  vehicle?: string;
  speed?: number;
  noise?: number;
  count?: number;
  populate?: number;
  suite: boolean;
}

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function requestJson<T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = await response.text();
  if (!response.ok) {
    throw new HttpError(
      `${response.status} ${response.statusText}: ${body}`,
      response.status,
    );
  }
  return (body ? JSON.parse(body) : undefined) as T;
}

async function login(email: string): Promise<string> {
  const result = await requestJson<{ accessToken: string }>('/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });
  return result.accessToken;
}

async function getCircuits(token: string): Promise<CircuitDetail[]> {
  const circuits = await requestJson<CircuitListItem[]>('/circuits', token);
  return Promise.all(
    circuits.map((circuit) =>
      requestJson<CircuitDetail>(`/circuits/${encodeURIComponent(circuit.id)}`, token),
    ),
  );
}

async function getVehicles(token: string): Promise<Vehicle[]> {
  return requestJson<Vehicle[]>('/vehicles', token);
}

function chooseVehicle(vehicles: Vehicle[], selector?: string): Vehicle {
  const selected = selector
    ? vehicles.find(
        (vehicle) =>
          vehicle.id === selector ||
          `${vehicle.brand} ${vehicle.model}`.toLowerCase() ===
            selector.toLowerCase(),
      )
    : vehicles[0];
  if (!selected) {
    throw new Error(
      selector
        ? `No se encontró el vehículo "${selector}".`
        : 'El usuario no tiene vehículos; crea uno antes de simular.',
    );
  }
  return selected;
}

async function runOne(
  token: string,
  circuit: CircuitDetail,
  vehicle: Vehicle,
  scenario: SimulationScenario,
  options: Pick<CliOptions, 'speed' | 'noise'>,
  startedAt = new Date(),
): Promise<{ passed: boolean; details: string; durationMs: number | null }> {
  const generated = generateRouteScenario(
    circuit.referencePath.coordinates.map(([lng, lat]) => ({ lat, lng })),
    {
      scenario,
      startLine: lineToGate(circuit.startLine),
      finishLine: lineToGate(circuit.finishLine),
      circuitLengthMeters: circuit.lengthMeters,
      startedAt,
      speedKmh: options.speed,
      maxSpeedKmh: options.speed,
      noiseMeters: options.noise,
      seed: scenarioSeed(circuit.id, scenario, startedAt),
    },
  );
  const activity = await requestJson<ActivityResponse>('/activities', token, {
    method: 'POST',
    body: JSON.stringify({
      vehicleId: vehicle.id,
      startedAt: generated.points[0].recordedAt.toISOString(),
      endedAt: generated.points[generated.points.length - 1].recordedAt.toISOString(),
      points: generated.points.map((point) => ({
        lat: point.lat,
        lng: point.lng,
        recordedAt: point.recordedAt.toISOString(),
        speedMs: point.speedMs,
        accuracy: 5,
      })),
    }),
  });

  const matching = activity.detectedAttempts.filter(
    (attempt) => attempt.circuitId === circuit.id,
  );
  const expected = generated.expectation.attempts;
  let passed =
    matching.length === expected.length &&
    matching.every(
      (attempt, index) =>
        attempt.isValid === expected[index].isValid &&
        attempt.invalidReason === expected[index].invalidReason,
    );
  let rankingPosition = '';
  if (matching.some((attempt) => attempt.isValid)) {
    const leaderboard = await requestJson<
      { position: number; attemptId: string }[]
    >(
      `/circuits/${encodeURIComponent(circuit.id)}/leaderboard?vehicleType=${vehicle.type}&powerCategory=${vehicle.powerCategory}`,
      token,
    );
    const attempt = matching.find((item) => item.isValid);
    const entry = attempt
      ? leaderboard.find((item) => item.attemptId === attempt.id)
      : undefined;
    rankingPosition = entry ? `top #${entry.position}` : 'fuera del top 3';
  }
  const actual = matching.length
    ? matching
        .map(
          (attempt) =>
            `${attempt.isValid ? 'válido' : attempt.invalidReason ?? 'inválido'}`,
        )
        .join(', ')
    : 'sin intento';
  if (!generated.expectation.detected && matching.length > 0) {
    passed = false;
  }
  return {
    passed,
    details: `${actual}${rankingPosition ? ` · ${rankingPosition}` : ''}`,
    durationMs: matching[0]?.durationMs ?? null,
  };
}

async function runSuite(options: CliOptions): Promise<boolean> {
  const email = options.user ?? DEFAULT_USER;
  const token = await login(email);
  const vehicles = await getVehicles(token);
  const vehicle = chooseVehicle(vehicles, options.vehicle);
  const circuits = await getCircuits(token);
  if (circuits.length === 0) {
    throw new Error('No hay circuitos disponibles en la API.');
  }

  const results: {
    circuit: string;
    scenario: SimulationScenario;
    passed: boolean;
    actual: string;
    expected: string;
  }[] = [];
  for (const circuit of circuits) {
    for (const scenario of SIMULATION_SCENARIOS) {
      const result = await runOne(
        token,
        circuit,
        vehicle,
        scenario,
        options,
      );
      const expected = scenario === 'DOUBLE_ATTEMPT'
        ? '2 válidos'
        : !result.durationMs && !['VALID', 'FAST_VALID'].includes(scenario)
          ? scenario === 'WRONG_DIRECTION' || scenario === 'NO_CROSSING'
            ? 'sin intento'
            : 'resultado inválido esperado'
          : scenario;
      results.push({
        circuit: circuit.name,
        scenario,
        passed: result.passed,
        actual: result.details,
        expected,
      });
    }
  }
  printResults(results);
  return results.every((result) => result.passed);
}

async function runSingle(options: CliOptions): Promise<boolean> {
  const token = await login(options.user ?? DEFAULT_USER);
  const vehicles = await getVehicles(token);
  const vehicle = chooseVehicle(vehicles, options.vehicle);
  const circuits = await getCircuits(token);
  const circuit = chooseCircuit(circuits, options.circuit);
  const scenario = options.scenario ?? 'VALID';
  let passed = true;
  for (let index = 0; index < (options.count ?? 1); index += 1) {
    const result = await runOne(token, circuit, vehicle, scenario, options);
    console.log(
      `${result.passed ? 'PASS' : 'FAIL'} ${circuit.name} / ${scenario}: ${result.details}`,
    );
    passed = passed && result.passed;
  }
  return passed;
}

async function populate(count: number): Promise<boolean> {
  const circuitsToken = await login(DEFAULT_USER);
  const circuits = await getCircuits(circuitsToken);
  const categories = [
    { type: 'MOTORCYCLE' as const, brand: 'Honda', model: 'XLR8 LOW', horsepower: 25 },
    { type: 'MOTORCYCLE' as const, brand: 'Yamaha', model: 'XLR8 MID', horsepower: 75 },
    { type: 'MOTORCYCLE' as const, brand: 'Kawasaki', model: 'XLR8 HIGH', horsepower: 150 },
    { type: 'CAR' as const, brand: 'Chevrolet', model: 'XLR8 LOW', horsepower: 80 },
    { type: 'CAR' as const, brand: 'Mazda', model: 'XLR8 MID', horsepower: 180 },
    { type: 'CAR' as const, brand: 'Porsche', model: 'XLR8 HIGH', horsepower: 320 },
  ];
  let passed = true;

  for (let userIndex = 0; userIndex < count; userIndex += 1) {
    const email = `xlr8.simulated.${userIndex + 1}@xlr8.app`;
    const token = await ensureSimulatedUser(email, userIndex);
    const category = categories[userIndex % categories.length];
    const vehicle = await ensureVehicle(token, category, userIndex);
    const activities = await requestJson<{
      items: { id: string; vehicleId: string; startedAt: string }[];
    }>('/activities?page=1&limit=100', token);
    for (let circuitIndex = 0; circuitIndex < circuits.length; circuitIndex += 1) {
      const circuit = circuits[circuitIndex];
      const startedAt = new Date(
        Date.UTC(2026, 0, 1, 0, userIndex, circuitIndex),
      );
      const existingActivity = activities.items.find(
        (item) =>
          item.vehicleId === vehicle.id &&
          new Date(item.startedAt).getTime() === startedAt.getTime(),
      );
      if (existingActivity) {
        const detail = await requestJson<{
          circuitAttempts: {
            isValid: boolean;
            circuit: { id: string };
          }[];
        }>(`/activities/${encodeURIComponent(existingActivity.id)}`, token);
        if (
          detail.circuitAttempts.some(
            (attempt) =>
              attempt.circuit.id === circuit.id && attempt.isValid,
          )
        ) {
          console.log(`SKIP ${email} / ${circuit.name}: ya poblado`);
          continue;
        }
        await requestJson(
          `/activities/${encodeURIComponent(existingActivity.id)}`,
          token,
          { method: 'DELETE' },
        );
      }
      const speed = 42 + (userIndex % 6) * 5 + circuitIndex * 1.5;
      const result = await runOne(
        token,
        circuit,
        vehicle,
        'VALID',
        { speed },
        startedAt,
      );
      console.log(
        `${result.passed ? 'PASS' : 'FAIL'} ${email} / ${circuit.name}: ${result.details}`,
      );
      passed = passed && result.passed;
    }
  }
  return passed;
}

async function ensureSimulatedUser(email: string, index: number): Promise<string> {
  try {
    await requestJson('/auth/register', undefined, {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: DEMO_PASSWORD,
        displayName: `Piloto Simulado ${index + 1}`,
      }),
    });
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 409) {
      throw error;
    }
  }
  return login(email);
}

async function ensureVehicle(
  token: string,
  category: {
    type: Vehicle['type'];
    brand: string;
    model: string;
    horsepower: number;
  },
  index: number,
): Promise<Vehicle> {
  const existing = await getVehicles(token);
  const match = existing.find(
    (vehicle) => vehicle.brand === category.brand && vehicle.model === category.model,
  );
  if (match) {
    return match;
  }
  return requestJson<Vehicle>('/vehicles', token, {
    method: 'POST',
    body: JSON.stringify({
      ...category,
      year: 2020 + (index % 7),
    }),
  });
}

function chooseCircuit(
  circuits: CircuitDetail[],
  selector?: string,
): CircuitDetail {
  const circuit = selector
    ? circuits.find((item) => item.id === selector || item.name === selector)
    : circuits[0];
  if (!circuit) {
    throw new Error(`No se encontró el circuito "${selector ?? ''}".`);
  }
  return circuit;
}

function lineToGate(line: GeoJsonLineString): [
  { lat: number; lng: number },
  { lat: number; lng: number },
] {
  const first = line.coordinates[0];
  const last = line.coordinates[line.coordinates.length - 1];
  return [
    { lat: first[1], lng: first[0] },
    { lat: last[1], lng: last[0] },
  ];
}

function scenarioSeed(
  circuitId: string,
  scenario: SimulationScenario,
  date: Date,
): number {
  return [...circuitId, ...scenario].reduce(
    (seed, character) => (seed * 31 + character.charCodeAt(0)) >>> 0,
    date.getTime() >>> 0,
  );
}

function printResults(
  results: {
    circuit: string;
    scenario: string;
    passed: boolean;
    actual: string;
    expected: string;
  }[],
): void {
  console.table(
    results.map((result) => ({
      Estado: result.passed ? 'PASS' : 'FAIL',
      Circuito: result.circuit,
      Escenario: result.scenario,
      Esperado: result.expected,
      Resultado: result.actual,
    })),
  );
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { suite: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--suite') {
      options.suite = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Falta un valor para ${argument}.`);
    }
    index += 1;
    switch (argument) {
      case '--circuit':
        options.circuit = value;
        break;
      case '--scenario':
        if (!SIMULATION_SCENARIOS.includes(value as SimulationScenario)) {
          throw new Error(`Escenario desconocido: ${value}.`);
        }
        options.scenario = value as SimulationScenario;
        break;
      case '--user':
        options.user = value;
        break;
      case '--vehicle':
        options.vehicle = value;
        break;
      case '--speed':
        options.speed = positiveNumber(argument, value);
        break;
      case '--noise':
        options.noise = nonNegativeNumber(argument, value);
        break;
      case '--count':
        options.count = integerAtLeast(argument, value, 1);
        break;
      case '--populate':
        options.populate = integerAtLeast(argument, value, 1);
        break;
      default:
        throw new Error(`Argumento desconocido: ${argument}.`);
    }
  }
  return options;
}

function positiveNumber(name: string, value: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${name} debe ser un número mayor que cero.`);
  }
  return number;
}

function nonNegativeNumber(name: string, value: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${name} debe ser un número no negativo.`);
  }
  return number;
}

function integerAtLeast(name: string, value: string, minimum: number): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum) {
    throw new Error(`${name} debe ser un entero mayor o igual que ${minimum}.`);
  }
  return number;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const passed = options.populate !== undefined
    ? await populate(options.populate)
    : options.suite
      ? await runSuite(options)
      : await runSingle(options);
  if (!passed) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
