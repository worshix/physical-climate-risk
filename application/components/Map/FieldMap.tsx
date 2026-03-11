"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

interface FieldMapProps {
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

// Dynamic import to avoid SSR issues with Leaflet
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100">
      <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
    </div>
  ),
});

export default function FieldMap(props: FieldMapProps) {
  return <LeafletMap {...props} />;
}
