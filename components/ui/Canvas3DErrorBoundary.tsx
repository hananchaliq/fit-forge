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
          } rounded-2xl bg-[#0D0F10] border border-[#23272A] flex flex-col items-center justify-center p-6 text-center`}
          role="region"
          aria-label="Fallback Visualisasi 3D"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#84E818]/15 border border-[#84E818]/35 flex items-center justify-center mb-3">
            <Box className="w-6 h-6 text-[#84E818]" />
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
            className="mt-4 min-h-[44px] px-4 rounded-xl bg-[#1A1D20] hover:bg-[#23272A] border border-[#2C3135] text-xs font-bold text-white inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#84E818]" />
            <span>Muat Ulang Canvas 3D</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
