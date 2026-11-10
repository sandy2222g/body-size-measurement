import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Upload, User, Ruler, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useMeasurement } from '../context/MeasurementContext';
import { useNavigate } from 'react-router-dom';
import { applyCalibration, loadCalibration } from '../lib/calibration';
import { GARMENTS, recommendSize, type Fit, type Gender } from '../lib/sizing';

const Measurement: React.FC = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [height, setHeight] = useState<number>(170);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setMeasurements, preferences, setPreferences } = useMeasurement();
  const [mode, setMode] = useState<'photo' | 'manual'>('photo');
  const [manual, setManual] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCapturing(false);
  }, []);

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
      streamRef.current = stream;
      // The <video> element only mounts once isCapturing is true; the effect below attaches the stream.
      setIsCapturing(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Unable to access camera. Please check permissions and try again.');
    }
  }, []);

  useEffect(() => {
    if (isCapturing && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCapturing]);

  // Release the camera and pending timers when leaving the page.
  const timersRef = useRef<number[]>([]);
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    timersRef.current.forEach(window.clearTimeout);
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
        setCapturedImages((prevImages) => [...prevImages, imageData].slice(0, 3));
        stopCamera();
        setError(null);
      }
    }
  }, [stopCamera]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      const validFiles = fileArray.filter(file => {
        if (!file.type.startsWith('image/')) {
          setError('Please upload valid image files.');
          return false;
        }
        if (file.size > 10 * 1024 * 1024) {
          setError('Image file is too large. Please upload images smaller than 10MB.');
          return false;
        }
        return true;
      });

      if (capturedImages.length + validFiles.length > 3) {
        setError('You can upload a maximum of 3 images.');
        return;
      }

      validFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setCapturedImages((prevImages) => [...prevImages, e.target?.result as string]);
          setError(null);
        };
        reader.onerror = () => {
          setError('Failed to read an image file. Please try again.');
        };
        reader.readAsDataURL(file);
      });
    }
  }, [capturedImages.length]);

  const processMeasurement = useCallback(async () => {
    if (capturedImages.length === 0) return;

    // Validate height input
    if (!Number.isFinite(height) || height < 100 || height > 250) {
      setError('Please enter a valid height between 100-250 cm.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProcessingStep('Analyzing image...');

    try {
      timersRef.current.push(window.setTimeout(() => setProcessingStep('Detecting pose landmarks...'), 1000));
      
      const response = await fetch('/api/measure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: capturedImages,
          height: height
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setProcessingStep('Calculating measurements...');
        timersRef.current.push(window.setTimeout(() => {
          // Keep the raw estimate so Results can offer calibration against a tape measure.
          const calibrated = applyCalibration(data.measurements, loadCalibration());
          setMeasurements({
            ...calibrated,
            raw_estimate: { chest: data.measurements.chest, waist: data.measurements.waist, hips: data.measurements.hips },
            annotated_image: data.annotated_image,
            confidence_score: data.confidence_score,
            processing_notes: data.processing_notes,
            source: 'photo'
          });
          navigate('/results');
        }, 500));
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
  }, [capturedImages, height, setMeasurements, navigate]);

  const MANUAL_FIELDS: Array<{ key: string; label: string; hint: string; required: boolean; min: number; max: number }> = [
    { key: 'chest', label: 'Chest / bust', hint: 'Around the fullest part', required: true, min: 60, max: 180 },
    { key: 'waist', label: 'Waist', hint: 'Around the narrowest part', required: true, min: 45, max: 180 },
    { key: 'hips', label: 'Hips', hint: 'Around the fullest part', required: true, min: 60, max: 190 },
    { key: 'shoulder_width', label: 'Shoulder width', hint: 'Shoulder point to shoulder point', required: true, min: 25, max: 70 },
    { key: 'arm_length', label: 'Arm length', hint: 'Shoulder to wrist', required: true, min: 40, max: 90 },
    { key: 'inseam', label: 'Inseam', hint: 'Crotch to ankle', required: true, min: 50, max: 110 },
    { key: 'underbust', label: 'Underbust (optional)', hint: 'Snug, directly under the bust; enables bra cup size', required: false, min: 55, max: 140 },
  ];

  const submitManual = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    const values: Record<string, number> = {};
    for (const f of MANUAL_FIELDS) {
      const raw = manual[f.key];
      if (!raw) {
        if (f.required) { setError(`Please enter ${f.label.toLowerCase()}.`); return; }
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < f.min || n > f.max) {
        setError(`${f.label} must be between ${f.min} and ${f.max} cm.`);
        return;
      }
      values[f.key] = n;
    }
    setError(null);
    setMeasurements({
      chest: values.chest, waist: values.waist, hips: values.hips,
      shoulder_width: values.shoulder_width, arm_length: values.arm_length, inseam: values.inseam,
      recommended_size: recommendSize(GARMENTS[0], { chest: values.chest, waist: values.waist, hips: values.hips, shoulder_width: values.shoulder_width, arm_length: values.arm_length, inseam: values.inseam }, preferences.gender, preferences.fit)?.size ?? '',
      underbust: values.underbust,
      source: 'manual',
    });
    navigate('/results');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual, preferences, setMeasurements, navigate]);

  const resetCapture = useCallback(() => {
    setCapturedImages([]);
    setError(null);
    stopCamera();
  }, [stopCamera]);

  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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

      <div className="flex justify-center mb-6" role="tablist" aria-label="Input method">
        {(['photo', 'manual'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => { setMode(m); setError(null); }}
            className={`px-5 py-2 first:rounded-l-lg last:rounded-r-lg border text-sm font-medium ${
              mode === m ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {m === 'photo' ? 'Photo (AI)' : 'Manual entry'}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Camera/Upload Section */}
        <div className="lg:col-span-2">
          {mode === 'manual' ? (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card"
          >
            <h2 className="text-2xl font-semibold mb-2 flex items-center">
              <Ruler className="mr-3 text-primary-600" />
              Enter Your Measurements
            </h2>
            <p className="text-gray-600 mb-6">
              Use a soft tape measure (in cm). No photo needed — you will get the same size recommendations.
            </p>
            <form onSubmit={submitManual} className="grid sm:grid-cols-2 gap-4" noValidate>
              {MANUAL_FIELDS.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`m-${f.key}`} className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input
                    id={`m-${f.key}`}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={f.min}
                    max={f.max}
                    value={manual[f.key] ?? ''}
                    onChange={(e) => setManual((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className="input-field"
                    placeholder="cm"
                  />
                  <p className="text-xs text-gray-500 mt-1">{f.hint}</p>
                </div>
              ))}
              <div className="sm:col-span-2">
                <button type="submit" className="btn-primary w-full flex items-center justify-center">
                  <Ruler className="mr-2" size={20} />
                  Get My Sizes
                </button>
              </div>
            </form>
          </motion.div>
          ) : (
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
              {capturedImages.length === 0 ? (
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
                            onClick={triggerFileUpload}
                            className="btn-primary flex items-center justify-center"
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
                  <div className="grid grid-cols-3 gap-2">
                    {capturedImages.map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`Captured for measurement ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                  <div className="absolute top-4 right-4 flex space-x-2">
                    <button
                      onClick={resetCapture}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors shadow-lg"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="absolute bottom-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center">
                    <CheckCircle className="mr-1" size={16} />
                    {capturedImages.length} / 3 Photos Ready
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
              multiple
            />

            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
          )}
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

          {/* Sizing preferences */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card"
          >
            <h2 className="text-xl font-semibold mb-4">Sizing Preferences</h2>
            <label htmlFor="pref-gender" className="block text-sm font-medium text-gray-700 mb-1">Size chart</label>
            <select
              id="pref-gender"
              value={preferences.gender}
              onChange={(e) => setPreferences({ ...preferences, gender: e.target.value as Gender })}
              className="input-field mb-3"
            >
              <option value="female">Women's</option>
              <option value="male">Men's</option>
            </select>
            <label htmlFor="pref-fit" className="block text-sm font-medium text-gray-700 mb-1">Preferred fit</label>
            <select
              id="pref-fit"
              value={preferences.fit}
              onChange={(e) => setPreferences({ ...preferences, fit: e.target.value as Fit })}
              className="input-field"
            >
              <option value="slim">Slim / fitted</option>
              <option value="regular">Regular</option>
              <option value="relaxed">Relaxed / loose</option>
            </select>
          </motion.div>

          {/* Enhanced Photo Guidelines */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center text-blue-900">
              <Info className="mr-2" size={20} />
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
          {capturedImages.length > 0 && (
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
              <p>• <strong>Estimates only:</strong> photo results can be a few cm off; use Manual entry for best accuracy</p>
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
