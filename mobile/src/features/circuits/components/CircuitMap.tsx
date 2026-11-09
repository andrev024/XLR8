import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibre,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import type { Circuit, CircuitDetail } from "../types";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

interface CircuitMapProps {
  circuits?: Circuit[];
  circuit?: CircuitDetail;
  height?: number;
}

export function CircuitMap({
  circuits = [],
  circuit,
  height = 280,
}: CircuitMapProps) {
  const camera = useRef<CameraRef>(null);
  const markers = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: circuits.flatMap((item) =>
        item.location
          ? [
              {
                type: "Feature" as const,
                properties: { id: item.id },
                geometry: {
                  type: "Point" as const,
                  coordinates: [item.location.lng, item.location.lat],
                },
              },
            ]
          : [],
      ),
    }),
    [circuits],
  );
  const paths = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: circuits.flatMap((item) =>
        item.referencePath
          ? [
              {
                type: "Feature" as const,
                properties: { id: item.id },
                geometry: item.referencePath,
              },
            ]
          : [],
      ),
    }),
    [circuits],
  );
  const reference = useMemo(
    () => lineFeature(circuit?.referencePath?.coordinates ?? []),
    [circuit?.referencePath],
  );
  const start = useMemo(
    () => lineFeature(circuit?.startLine.coordinates ?? []),
    [circuit?.startLine],
  );
  const finish = useMemo(
    () => lineFeature(circuit?.finishLine.coordinates ?? []),
    [circuit?.finishLine],
  );
  const bounds = useMemo(
    () => (circuit ? getCircuitBounds(circuit) : getLocationBounds(circuits)),
    [circuit, circuits],
  );

  useEffect(() => {
    if (bounds) {
      camera.current?.fitBounds(
        [bounds.west, bounds.south, bounds.east, bounds.north],
        {
          padding: { top: 36, right: 36, bottom: 36, left: 36 },
          duration: 300,
        },
      );
    }
  }, [bounds]);

  if (!circuit && circuits.length === 0) {
    return (
      <View
        accessibilityLabel="Mapa sin circuitos"
        style={[styles.container, { height }]}
      />
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <MapLibre style={styles.map} mapStyle={MAP_STYLE_URL} attribution logo>
        <Camera
          ref={camera}
          initialViewState={{
            center: circuit
              ? circuit.referencePath?.coordinates[0] ?? [-74.09, 4.64]
              : [circuits[0]?.location?.lng ?? -74.09, circuits[0]?.location?.lat ?? 4.64],
            zoom: circuit ? 13 : 10,
          }}
        />
        {!circuit && markers.features.length > 0 && (
          <GeoJSONSource id="xlr8-circuit-markers" data={markers}>
            <Layer
              type="circle"
              id="xlr8-circuit-marker"
              paint={{
                "circle-color": "#C6FF00",
                "circle-radius": 7,
                "circle-stroke-color": "#141925",
                "circle-stroke-width": 2,
              }}
            />
          </GeoJSONSource>
        )}
        {!circuit && paths.features.length > 0 && (
          <GeoJSONSource id="xlr8-circuit-paths" data={paths}>
            <Layer
              type="line"
              id="xlr8-circuit-path-line"
              paint={{
                "line-color": "#C6FF00",
                "line-width": 4,
                "line-opacity": 0.9,
              }}
            />
          </GeoJSONSource>
        )}
        {circuit && (
          <>
            <GeoJSONSource id="xlr8-circuit-reference" data={reference}>
              <Layer
                type="line"
                id="xlr8-circuit-reference-line"
                paint={{
                  "line-color": "#C6FF00",
                  "line-width": 5,
                  "line-opacity": 0.9,
                }}
              />
            </GeoJSONSource>
            <GeoJSONSource id="xlr8-circuit-start" data={start}>
              <Layer
                type="line"
                id="xlr8-circuit-start-line"
                paint={{ "line-color": "#55D187", "line-width": 5 }}
              />
            </GeoJSONSource>
            <GeoJSONSource id="xlr8-circuit-finish" data={finish}>
              <Layer
                type="line"
                id="xlr8-circuit-finish-line"
                paint={{ "line-color": "#F06C75", "line-width": 5 }}
              />
            </GeoJSONSource>
          </>
        )}
      </MapLibre>
    </View>
  );
}

function lineFeature(coordinates: [number, number][]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates,
    },
  };
}

function getCircuitBounds(circuit: CircuitDetail) {
  const coordinates = [
    ...(circuit.referencePath?.coordinates ?? []),
    ...circuit.startLine.coordinates,
    ...circuit.finishLine.coordinates,
  ];
  return getBounds(coordinates);
}

function getLocationBounds(circuits: Circuit[]) {
  return getBounds(
    circuits.flatMap((item) => [
      ...(item.referencePath?.coordinates ?? []),
      ...(item.location
        ? [[item.location.lng, item.location.lat] as [number, number]]
        : []),
    ]),
  );
}

function getBounds(coordinates: [number, number][]) {
  if (coordinates.length === 0) {
    return null;
  }
  return coordinates.reduce(
    (bounds, [longitude, latitude]) => ({
      west: Math.min(bounds.west, longitude),
      south: Math.min(bounds.south, latitude),
      east: Math.max(bounds.east, longitude),
      north: Math.max(bounds.north, latitude),
    }),
    {
      west: coordinates[0][0],
      south: coordinates[0][1],
      east: coordinates[0][0],
      north: coordinates[0][1],
    },
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#141925",
  },
  map: {
    flex: 1,
  },
});
