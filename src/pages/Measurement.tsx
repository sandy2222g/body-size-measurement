import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Camera, Upload, User, Ruler, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useMeasurement } from '../context/MeasurementContext';
import { useNavigate } from 'react-router-dom';

const Measurement: React.FC = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [height, setHeight] = useState<number>(170);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setMeasurements } = useMeasurement();
  const navigate = useNavigate();

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Unable to access camera. Please check permissions and try again.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCapturing(false);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (context) {
        context.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageData);
        stopCamera();
        setError(null);
      }
    }
  }, [stopCamera]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file.');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image file is too large. Please upload an image smaller than 10MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedImage(e.target?.result as string);
        setError(null);
      };
      reader.onerror = () => {
        setError('Failed to read the image file. Please try again.');
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const processMeasurement = useCallback(async () => {
    if (!capturedImage) return;

    // Validate height input
    if (height < 100 || height > 250) {
      setError('Please enter a valid height between 100-250 cm.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProcessingStep('Analyzing image...');

    try {
      setTimeout(() => setProcessingStep('Detecting pose landmarks...'), 1000);
      
      const response = await fetch('/api/measure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: capturedImage,
          height: height
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setProcessingStep('Calculating measurements...');
        setTimeout(() => {
          setMeasurements({
            ...data.measurements,
            annotated_image: data.annotated_image,
            confidence_score: data.confidence_score,
            processing_notes: data.processing_notes
          });
          navigate('/results');
        }, 500);
      } else {
        setError(data.error || 'Failed to process measurement');
      }
    } catch (error) {
      console.error('Error processing measurement:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  }, [capturedImage, height, setMeasurements, navigate]);

  const resetCapture = useCallback(() => {
    setCapturedImage(null);
    setError(null);
    stopCamera();
  }, [stopCamera]);

  return (
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          AI Body Measurement
        </h1>
        <p className="text-xl text-gray-600">
          Capture or upload your photo for accurate measurements using advanced pose detection
        </p>
      </motion.div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start"
        >
          <AlertCircle className="text-red-500 mr-3 mt-0.5 flex-shrink-0" size={20} />
          <div>
            <h3 className="text-red-800 font-semibold mb-1">Measurement Error</h3>
            <p className="text-red-700 whitespace-pre-line">{error}</p>
          </div>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Camera/Upload Section */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card"
          >
            <h2 className="text-2xl font-semibold mb-6 flex items-center">
              <Camera className="mr-3 text-primary-600" />
              Capture Photo
            </h2>

            <div className="camera-container bg-gray-100 rounded-lg mb-6 relative">
              {!capturedImage ? (
                <>
                  {isCapturing ? (
                    <div className="relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-96 object-cover rounded-lg"
                      />
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
                        <button
                          onClick={capturePhoto}
                          className="bg-white text-primary-600 px-8 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
                        >
                          <Camera className="inline mr-2" size={20} />
                          Capture
                        </button>
                        <button
                          onClick={stopCamera}
                          className="bg-red-500 text-white px-6 py-3 rounded-full shadow-lg hover:bg-red-600 transition-colors"
                        >
                          Stop
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-96 flex items-center justify-center">
                      <div className="text-center">
                        <Camera className="mx-auto mb-4 text-gray-400" size={64} />
                        <p className="text-gray-500 mb-6 text-lg">Ready to capture your measurement photo</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                          <button
                            onClick={startCamera}
                            className="btn-primary flex items-center justify-center"
                          >
                            <Camera className="mr-2" size={20} />
                            Start Camera
                          </button>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="btn-secondary flex items-center justify-center"
                          >
                            <Upload className="mr-2" size={20} />
                            Upload Photo
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="relative">
                  <img
                    src={capturedImage}
                    alt="Captured for measurement"
                    className="w-full h-96 object-cover rounded-lg"
                  />
                  <div className="absolute top-4 right-4 flex space-x-2">
                    <button
                      onClick={resetCapture}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors shadow-lg"
                    >
                      Retake
                    </button>
                  </div>
                  <div className="absolute bottom-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center">
                    <CheckCircle className="mr-1" size={16} />
                    Photo Ready
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        </div>

        {/* Settings and Guidelines Section */}
        <div className="space-y-6">
          {/* Height Input */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <User className="mr-3 text-primary-600" />
              Your Information
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Height (cm) *
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="input-field"
                min="100"
                max="250"
                placeholder="Enter your height"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Accurate height is crucial for precise measurements
              </p>
            </div>
          </motion.div>

          {/* Enhanced Photo Guidelines */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center text-blue-900">
              <Info className="mr-2 text-blue-600" />
              Photo Guidelines
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p><strong>Stand straight</strong> with arms slightly away from your body (about 15-20cm)</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p><strong>Face the camera directly</strong> - avoid side angles or tilting</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p><strong>Wear fitted clothing</strong> or minimal clothing for best accuracy</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p><strong>Ensure full body visibility</strong> from head to feet in the frame</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p><strong>Use good lighting</strong> and a plain, contrasting background</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p><strong>Stand 2-3 meters</strong> away from the camera for optimal results</p>
              </div>
            </div>
          </motion.div>

          {/* Processing Button */}
          {capturedImage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card"
            >
              <button
                onClick={processMeasurement}
                disabled={isProcessing}
                className="w-full btn-primary flex items-center justify-center text-lg py-4"
              >
                {isProcessing ? (
                  <>
                    <div className="loading-spinner mr-3"></div>
                    {processingStep || 'Processing...'}
                  </>
                ) : (
                  <>
                    <Ruler className="mr-2" size={24} />
                    Get AI Measurements
                  </>
                )}
              </button>
              
              {isProcessing && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <Info className="inline mr-1" size={16} />
                    AI is analyzing your photo using advanced pose detection...
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Accuracy Information */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="card bg-gradient-to-r from-green-50 to-blue-50 border-green-200"
          >
            <h3 className="text-lg font-semibold mb-3 text-green-900">
              Measurement Accuracy
            </h3>
            <div className="space-y-2 text-sm text-green-800">
              <p>• <strong>Expected accuracy:</strong> ±2-3cm for most measurements</p>
              <p>• <strong>Best results:</strong> Follow photo guidelines carefully</p>
              <p>• <strong>Multiple attempts:</strong> Take several photos for comparison</p>
              <p>• <strong>Professional alternative:</strong> For critical fits, consider professional tailoring</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Measurement;