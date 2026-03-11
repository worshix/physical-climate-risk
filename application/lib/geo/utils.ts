/**
 * Geographic utilities for polygon calculations
 */

// Calculate area of a polygon in hectares using the Shoelace formula
// Coordinates should be in [longitude, latitude] format (GeoJSON standard)
export function calculatePolygonArea(coordinates: number[][]): number {
  if (!coordinates || coordinates.length < 3) {
    return 0;
  }

  // Earth's radius in meters
  const R = 6371000;

  // Convert to radians
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // Get the centroid latitude for projection
  const centerLat = coordinates.reduce((sum, coord) => sum + coord[1], 0) / coordinates.length;

  // Convert coordinates to meters using equirectangular projection
  const convertToMeters = (coord: number[]) => {
    const x = R * toRad(coord[0]) * Math.cos(toRad(centerLat));
    const y = R * toRad(coord[1]);
    return [x, y];
  };

  const metersCoords = coordinates.map(convertToMeters);

  // Shoelace formula for polygon area
  let area = 0;
  const n = metersCoords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += metersCoords[i][0] * metersCoords[j][1];
    area -= metersCoords[j][0] * metersCoords[i][1];
  }
  area = Math.abs(area) / 2;

  // Convert from square meters to hectares (1 hectare = 10,000 m²)
  return area / 10000;
}

// Get the centroid of a polygon
export function getPolygonCentroid(coordinates: number[][]): { lat: number; lng: number } {
  if (!coordinates || coordinates.length === 0) {
    return { lat: 0, lng: 0 };
  }

  const sumLng = coordinates.reduce((sum, coord) => sum + coord[0], 0);
  const sumLat = coordinates.reduce((sum, coord) => sum + coord[1], 0);

  return {
    lng: sumLng / coordinates.length,
    lat: sumLat / coordinates.length,
  };
}

// Reverse geocode coordinates to get location name
// Uses OpenStreetMap Nominatim API (free, no API key required)
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
      {
        headers: {
          'User-Agent': 'AgriFin Risk Monitor/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const data = await response.json();
    
    // Try to get a meaningful location name
    const address = data.address;
    if (address) {
      // Prioritize: city/town > county/district > state > country
      return (
        address.city ||
        address.town ||
        address.village ||
        address.county ||
        address.state_district ||
        address.state ||
        address.country ||
        'Unknown Location'
      );
    }

    return data.display_name?.split(',')[0] || 'Unknown Location';
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return 'Unknown Location';
  }
}

// Extract coordinates from GeoJSON polygon
export function extractCoordinates(polygon: any): number[][] | null {
  try {
    // Handle different GeoJSON formats
    if (polygon.geometry?.coordinates) {
      // Standard GeoJSON Feature
      return polygon.geometry.coordinates[0];
    } else if (polygon.coordinates) {
      // Just geometry object
      return polygon.coordinates[0];
    } else if (Array.isArray(polygon) && polygon[0]?.length === 2) {
      // Raw coordinates array
      return polygon;
    }
    return null;
  } catch (error) {
    console.error('Error extracting coordinates:', error);
    return null;
  }
}
