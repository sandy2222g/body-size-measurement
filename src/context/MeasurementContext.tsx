import React, { createContext, useContext, useState, ReactNode } from 'react';

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
}

interface MeasurementContextType {
  currentMeasurement: Measurements | null;
  setMeasurements: (measurements: Measurements) => void;
  clearMeasurements: () => void;
}

const MeasurementContext = createContext<MeasurementContextType | undefined>(undefined);

export const MeasurementProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentMeasurement, setCurrentMeasurement] = useState<Measurements | null>(null);

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
      clearMeasurements
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