"use client";

// This component is now deprecated - drawing functionality is built into LeafletMap
// Kept for backwards compatibility

interface PolygonDrawerProps {
  onUpdate?: (event: any) => void;
  onCreate?: (event: any) => void;
  onDelete?: (event: any) => void;
}

export default function PolygonDrawer(props: PolygonDrawerProps) {
  // Drawing is now handled directly by FieldMap with editable={true}
  return null;
}
