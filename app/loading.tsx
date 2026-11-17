import React from 'react';
import { BiomechanicalLoader } from '@/components/ui/BiomechanicalLoader';

export default function RootLoading() {
  return (
    <BiomechanicalLoader
      label="MEMUAT EKOSISTEM FITFORGE"
      sublabel="Menyiapkan Telemetri Latihan 3D, Rute GPS Kalman & Sinkronisasi Cloud..."
    />
  );
}
