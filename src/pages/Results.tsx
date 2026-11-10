import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMeasurement } from '../context/MeasurementContext';
import { 
  Ruler, 
  ShoppingBag, 
  Download, 
  Share2, 
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  AlertTriangle,
  Info
} from 'lucide-react';

const Results: React.FC = () => {
  const { currentMeasurement } = useMeasurement();
  const navigate = useNavigate();
  const [showAnnotatedImage, setShowAnnotatedImage] = useState(false);

  if (!currentMeasurement) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <Ruler className="mx-auto mb-4 text-gray-400" size={64} />
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            No Measurements Found
          </h2>
          <p className="text-gray-600 mb-6">
            You haven't taken any measurements yet. Start by capturing a photo.
          </p>
          <button
            onClick={() => navigate('/measurement')}
            className="btn-primary"
          >
            Take Measurement
          </button>
        </motion.div>
      </div>
    );
  }

  const measurements = [
    { label: 'Chest', value: currentMeasurement.chest, unit: 'cm', icon: '👕', description: 'Around the fullest part of chest' },
    { label: 'Waist', value: currentMeasurement.waist, unit: 'cm', icon: '📏', description: 'Around the narrowest part of waist' },
    { label: 'Hips', value: currentMeasurement.hips, unit: 'cm', icon: '📐', description: 'Around the fullest part of hips' },
    { label: 'Shoulder Width', value: currentMeasurement.shoulder_width, unit: 'cm', icon: '🤝', description: 'Distance between shoulder points' },
    { label: 'Arm Length', value: currentMeasurement.arm_length, unit: 'cm', icon: '💪', description: 'From shoulder to wrist' },
    { label: 'Inseam', value: currentMeasurement.inseam, unit: 'cm', icon: '👖', description: 'From crotch to ankle' },
  ];

  const handleDownload = () => {
    const data = {
      measurements: currentMeasurement,
      timestamp: new Date().toISOString(),
      confidence_score: currentMeasurement.confidence_score,
      processing_notes: currentMeasurement.processing_notes
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `measurements-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My AI Body Measurements',
          text: `My AI measurements: Chest: ${currentMeasurement.chest.toFixed(1)}cm, Waist: ${currentMeasurement.waist.toFixed(1)}cm, Recommended Size: ${currentMeasurement.recommended_size}`,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      const text = `My AI measurements: Chest: ${currentMeasurement.chest.toFixed(1)}cm, Waist: ${currentMeasurement.waist.toFixed(1)}cm, Recommended Size: ${currentMeasurement.recommended_size}`;
      navigator.clipboard.writeText(text);
      alert('Measurements copied to clipboard!');
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceText = (score: number) => {
    if (score >= 0.8) return 'High Confidence';
    if (score >= 0.6) return 'Medium Confidence';
    return 'Low Confidence';
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="flex items-center justify-center mb-4">
          <CheckCircle className="text-green-500 mr-3" size={32} />
          <h1 className="text-4xl font-bold text-gray-900">
            AI Measurement Complete!
          </h1>
        </div>
        <p className="text-xl text-gray-600">
          Here are your AI-calculated body measurements with pose detection analysis
        </p>
      </motion.div>

      {/* Confidence Score */}
      {currentMeasurement.confidence_score && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Info className="text-blue-600 mr-2" size={20} />
              <span className="font-semibold text-blue-900">Detection Quality:</span>
              <span className={`ml-2 font-bold ${getConfidenceColor(currentMeasurement.confidence_score)}`}>
                {getConfidenceText(currentMeasurement.confidence_score)} ({(currentMeasurement.confidence_score * 100).toFixed(0)}%)
              </span>
            </div>
            {currentMeasurement.annotated_image && (
              <button
                onClick={() => setShowAnnotatedImage(!showAnnotatedImage)}
                className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
              >
                {showAnnotatedImage ? <EyeOff size={20} /> : <Eye size={20} />}
                <span className="ml-1">{showAnnotatedImage ? 'Hide' : 'Show'} Pose Detection</span>
              </button>
            )}
          </div>
          {currentMeasurement.processing_notes && (
            <p className="text-blue-800 text-sm mt-2">{currentMeasurement.processing_notes}</p>
          )}
        </motion.div>
      )}

      <div className="grid lg:grid-cols-4 gap-8">
        {/* Annotated Image (if shown) */}
        {showAnnotatedImage && currentMeasurement.annotated_image && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Eye className="mr-2 text-primary-600" />
                Pose Detection
              </h3>
              <img
                src={currentMeasurement.annotated_image}
                alt="Pose detection visualization"
                className="w-full rounded-lg border border-gray-200"
              />
              <p className="text-sm text-gray-600 mt-2">
                Blue lines show detected body landmarks used for measurements
              </p>
            </div>
          </motion.div>
        )}

        {/* Measurements Grid */}
        <div className={showAnnotatedImage ? "lg:col-span-2" : "lg:col-span-3"}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card mb-6"
          >
            <h2 className="text-2xl font-semibold mb-6 flex items-center">
              <Ruler className="mr-3 text-primary-600" />
              Your AI Measurements
            </h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              {measurements.map((measurement, index) => (
                <motion.div
                  key={measurement.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="measurement-item group hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{measurement.icon}</span>
                    <div>
                      <p className="font-medium text-gray-900">{measurement.label}</p>
                      <p className="text-xs text-gray-500">{measurement.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-600">
                      {measurement.value.toFixed(1)}
                    </p>
                    <p className="text-sm text-gray-500">{measurement.unit}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-4"
          >
            <button
              onClick={() => navigate('/measurement')}
              className="btn-secondary flex items-center"
            >
              <ArrowLeft className="mr-2" size={20} />
              Take Another
            </button>
            <button
              onClick={handleDownload}
              className="btn-secondary flex items-center"
            >
              <Download className="mr-2" size={20} />
              Download Results
            </button>
            <button
              onClick={handleShare}
              className="btn-secondary flex items-center"
            >
              <Share2 className="mr-2" size={20} />
              Share Results
            </button>
          </motion.div>
        </div>

        {/* Size Recommendation & Info */}
        <div className={`space-y-6 ${showAnnotatedImage ? "lg:col-span-1" : "lg:col-span-1"}`}>
          {/* Size Recommendation */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card text-center"
          >
            <ShoppingBag className="mx-auto mb-4 text-primary-600" size={48} />
            <h3 className="text-xl font-semibold mb-2">Recommended Size</h3>
            <div className="text-4xl font-bold text-primary-600 mb-4">
              {currentMeasurement.recommended_size}
            </div>
            <p className="text-gray-600 mb-4">
              Based on your AI measurements, this size should provide the best fit.
            </p>
            <button className="btn-primary w-full">
              Shop Now
            </button>
          </motion.div>

          {/* Accuracy Information */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <AlertTriangle className="mr-2 text-yellow-600" />
              Accuracy Notes
            </h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start">
                <div className="w-2 h-2 bg-yellow-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p>AI measurements have ±2-3cm accuracy range</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-yellow-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p>Photo quality affects measurement precision</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-yellow-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p>Consider taking multiple photos for comparison</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-yellow-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p>For critical fits, verify with manual measurements</p>
              </div>
            </div>
          </motion.div>

          {/* Size Chart */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="card"
          >
            <h3 className="text-lg font-semibold mb-4">Size Chart Reference</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span>XS</span>
                <span>70-85 cm</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span>S</span>
                <span>85-92 cm</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span>M</span>
                <span>92-100 cm</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span>L</span>
                <span>100-108 cm</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span>XL</span>
                <span>108-116 cm</span>
              </div>
              <div className="flex justify-between py-1">
                <span>XXL</span>
                <span>116+ cm</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Results;