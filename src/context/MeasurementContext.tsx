import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { Fit, Gender } from '../lib/sizing';

interface Measurements {
  chest: number;
  waist: number;
  hips: number;
  shoulder_width: number;
  arm_length: number;
  inseam: number;
  recommended_size: string;
  annotated_image?: string;
  confidence_score?: number;
  processing_notes?: string;
  underbust?: number;
  source?: 'photo' | 'manual';
}

export interface SizingPreferences {
  gender: Gender;
  fit: Fit;
}

interface MeasurementContextType {
  currentMeasurement: Measurements | null;
  setMeasurements: (measurements: Measurements) => void;
  clearMeasurements: () => void;
  preferences: SizingPreferences;
  setPreferences: (p: SizingPreferences) => void;
}

const MeasurementContext = createContext<MeasurementContextType | undefined>(undefined);

function loadPreferences(): SizingPreferences {
  const fallback: SizingPreferences = { gender: 'female', fit: 'regular' };
  try {
    const p = JSON.parse(localStorage.getItem('sizingPreferences') || 'null');
    if ((p?.gender === 'female' || p?.gender === 'male') && ['slim', 'regular', 'relaxed'].includes(p?.fit)) return p;
  } catch { /* ignore corrupt value */ }
  return fallback;
}

export const MeasurementProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentMeasurement, setCurrentMeasurement] = useState<Measurements | null>(null);

  const [preferences, setPreferencesState] = useState<SizingPreferences>(loadPreferences);

  const setPreferences = (p: SizingPreferences) => {
    setPreferencesState(p);
    try { localStorage.setItem('sizingPreferences', JSON.stringify(p)); } catch { /* storage unavailable */ }
  };

  const setMeasurements = (measurements: Measurements) => {
    setCurrentMeasurement(measurements);
  };

  const clearMeasurements = () => {
    setCurrentMeasurement(null);
  };

  return (
    <MeasurementContext.Provider value={{
      currentMeasurement,
      setMeasurements,
      clearMeasurements,
      preferences,
      setPreferences
    }}>
      {children}
    </MeasurementContext.Provider>
  );
};

export const useMeasurement = () => {
  const context = useContext(MeasurementContext);
  if (context === undefined) {
    throw new Error('useMeasurement must be used within a MeasurementProvider');
  }
  return context;
};