'use client';

import React from 'react';
import { Box, RefreshCw } from 'lucide-react';

interface Canvas3DErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  heightClass?: string;
}

interface Canvas3DErrorBoundaryState {
  hasError: boolean;
}

export class Canvas3DErrorBoundary extends React.Component<
  Canvas3DErrorBoundaryProps,
  Canvas3DErrorBoundaryState
> {
  constructor(props: Canvas3DErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): Canvas3DErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[Canvas3DErrorBoundary] WebGL fallback triggered:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={`w-full ${
            this.props.heightClass || 'h-[360px]'
          } rounded-2xl bg-[#0D1017] border border-[#242836] flex flex-col items-center justify-center p-6 text-center`}
          role="region"
          aria-label="Fallback Visualisasi 3D"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#F97316]/15 border border-[#F97316]/35 flex items-center justify-center mb-3">
            <Box className="w-6 h-6 text-[#F97316]" />
          </div>
          <p className="text-sm font-bold text-white">
            {this.props.title || 'Mode Pratinjau Hemat Daya Aktif'}
          </p>
          <p className="text-xs text-neutral-400 max-w-sm mt-1.5 leading-relaxed">
            {this.props.description ||
              'Konteks akselerasi 3D WebGL tidak tersedia sementara. Anda tetap dapat menggunakan peta otot 2D dan panduan langkah latihan.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 min-h-[44px] px-4 rounded-xl bg-[#1C1C24] hover:bg-[#272732] border border-[#323240] text-xs font-bold text-white inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Muat Ulang Canvas 3D</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
