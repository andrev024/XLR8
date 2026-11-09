import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibre,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import type { TrackPoint } from "../features/recording/recording-logic";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const MIN_CAMERA_SPAN_METERS = 80;

interface RouteMapProps {
  points: Pick<TrackPoint, "lat" | "lng">[];
  followLatest?: boolean;
  height?: number;
}

export function RouteMap({
  points,
  followLatest = false,
  height = 260,
}: RouteMapProps) {
  const camera = useRef<CameraRef>(null);
  const route = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: points.map((point) => [point.lng, point.lat]),
      },
    }),
    [points],
  );
  const latest = points[points.length - 1];
  const latestLatitude = latest?.lat;
  const latestLongitude = latest?.lng;
  const bounds = useMemo(() => {
    if (points.length < 2) {
      return null;
    }
    const rawBounds = points.reduce(
      (current, point) => ({
        west: Math.min(current.west, point.lng),
        south: Math.min(current.south, point.lat),
        east: Math.max(current.east, point.lng),
        north: Math.max(current.north, point.lat),
      }),
      {
        west: points[0].lng,
        south: points[0].lat,
        east: points[0].lng,
        north: points[0].lat,
      },
    );
    const centerLatitude = (rawBounds.north + rawBounds.south) / 2;
    const minLatitudeSpan = MIN_CAMERA_SPAN_METERS / 111_320;
    const minLongitudeSpan =
      MIN_CAMERA_SPAN_METERS /
      (111_320 * Math.cos((centerLatitude * Math.PI) / 180));
    const latitudePadding = Math.max(
      0,
      (minLatitudeSpan - (rawBounds.north - rawBounds.south)) / 2,
    );
    const longitudePadding = Math.max(
      0,
      (minLongitudeSpan - (rawBounds.east - rawBounds.west)) / 2,
    );
    return {
      west: rawBounds.west - longitudePadding,
      south: rawBounds.south - latitudePadding,
      east: rawBounds.east + longitudePadding,
      north: rawBounds.north + latitudePadding,
    };
  }, [points]);

  useEffect(() => {
    if (
      followLatest &&
      latestLatitude !== undefined &&
      latestLongitude !== undefined
    ) {
      camera.current?.easeTo({
        center: [latestLongitude, latestLatitude],
        zoom: 15.5,
        duration: 300,
      });
    } else if (!followLatest && bounds) {
      camera.current?.fitBounds(
        [bounds.west, bounds.south, bounds.east, bounds.north],
        {
          padding: { top: 28, right: 28, bottom: 28, left: 28 },
          duration: 300,
        },
      );
    }
  }, [followLatest, latestLatitude, latestLongitude, bounds]);

  const center: [number, number] = latest
    ? [latest.lng, latest.lat]
    : [-74.09, 4.64];

  return (
    <View style={[styles.container, { height }]}>
      <MapLibre style={styles.map} mapStyle={MAP_STYLE_URL} attribution logo>
        <Camera
          ref={camera}
          initialViewState={{ center, zoom: points.length > 0 ? 14 : 11 }}
        />
        {points.length > 1 && (
          <GeoJSONSource id="xlr8-route" data={route}>
            <Layer
              type="line"
              id="xlr8-route-line"
              paint={{
                "line-color": "#C6FF00",
                "line-width": 5,
                "line-opacity": 0.9,
              }}
            />
          </GeoJSONSource>
        )}
      </MapLibre>
    </View>
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
