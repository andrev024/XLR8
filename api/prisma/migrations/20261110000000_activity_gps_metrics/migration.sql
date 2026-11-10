ALTER TABLE "Activity"
  ADD COLUMN "movingDurationSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stoppedDurationSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "elevationGainMeters" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "averageAccuracyMeters" DOUBLE PRECISION,
  ADD COLUMN "estimatedFuelLiters" DOUBLE PRECISION,
  ADD COLUMN "responsibleDrivingConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "responsibleDrivingDurationSeconds" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Vehicle"
  ADD COLUMN "engineDisplacementCc" INTEGER,
  ADD COLUMN "engineType" TEXT,
  ADD COLUMN "weightKg" DOUBLE PRECISION,
  ADD COLUMN "fuelConsumptionLitersPer100Km" DOUBLE PRECISION;

ALTER TABLE "TrackPoint"
  ADD COLUMN "accuracyMeters" DOUBLE PRECISION,
  ADD COLUMN "altitudeMeters" DOUBLE PRECISION;

ALTER TABLE "Circuit"
  ADD COLUMN "isAuthorizedClosed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CircuitAttempt"
  ADD COLUMN "horsepower" INTEGER NOT NULL DEFAULT 0;
