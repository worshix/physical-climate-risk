"use client";

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, FeatureGroup, GeoJSON, useMap } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface LeafletMapProps {
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  polygon?: any;
  children?: React.ReactNode;
  onPolygonCreated?: (polygon: any) => void;
  editable?: boolean;
  goToLocation?: { lat: number; lng: number } | null;
}

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

function GoToLocationHandler({ location }: { location: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.flyTo([location.lat, location.lng], 16, {
        duration: 1.5
      });
    }
  }, [map, location]);
  return null;
}

function FitBoundsToGeoJSON({ data }: { data: any }) {
  const map = useMap();
  useEffect(() => {
    try {
      const layer = L.geoJSON(data);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    } catch { /* ignore invalid polygon data */ }
  }, [map, data]);
  return null;
}

export default function LeafletMap({ 
  initialViewState, 
  polygon, 
  children, 
  onPolygonCreated,
  editable = false,
  goToLocation 
}: LeafletMapProps) {
  const featureGroupRef = useRef<L.FeatureGroup>(null);

  const defaultCenter: [number, number] = [
    initialViewState?.latitude ?? -17.83,
    initialViewState?.longitude ?? 31.05
  ];
  const defaultZoom = initialViewState?.zoom ?? 6;

  const handleCreated = (e: any) => {
    const layer = e.layer;
    const geoJSON = layer.toGeoJSON();
    if (onPolygonCreated) {
      onPolygonCreated({ features: [geoJSON] });
    }
  };

  const handleEdited = (e: any) => {
    const layers = e.layers;
    layers.eachLayer((layer: any) => {
      const geoJSON = layer.toGeoJSON();
      if (onPolygonCreated) {
        onPolygonCreated({ features: [geoJSON] });
      }
    });
  };

  const handleDeleted = (e: any) => {
    if (onPolygonCreated) {
      onPolygonCreated(null);
    }
  };

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ width: '100%', height: '100%' }}
        className="rounded-xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://stamen-tiles.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png"
          opacity={0.7}
        />

        <GoToLocationHandler location={goToLocation ?? null} />

        {editable && (
          <FeatureGroup ref={featureGroupRef}>
            <EditControl
              position="topright"
              onCreated={handleCreated}
              onEdited={handleEdited}
              onDeleted={handleDeleted}
              draw={{
                rectangle: false,
                circle: false,
                circlemarker: false,
                marker: false,
                polyline: false,
                polygon: {
                  allowIntersection: false,
                  shapeOptions: {
                    color: '#10b981',
                    fillColor: '#10b981',
                    fillOpacity: 0.4,
                  },
                },
              }}
            />
          </FeatureGroup>
        )}

        {polygon && !editable && (
          <>
            <GeoJSON
              data={polygon}
              style={{
                color: '#10b981',
                weight: 2,
                fillColor: '#10b981',
                fillOpacity: 0.4,
              }}
            />
            <FitBoundsToGeoJSON data={polygon} />
          </>
        )}

        {children}
      </MapContainer>
    </div>
  );
}
