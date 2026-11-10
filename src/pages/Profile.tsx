import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  Ruler, 
  Calendar, 
  Edit3, 
  Save, 
  X,
  TrendingUp,
  History
} from 'lucide-react';

interface UserProfile {
  id?: number;
  name: string;
  email: string;
  height: number;
  created_at?: string;
}

interface MeasurementHistory {
  id: number;
  chest: number;
  waist: number;
  hips: number;
  shoulder_width: number;
  arm_length: number;
  inseam: number;
  recommended_size: string;
  created_at: string;
}

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    height: 170
  });
  const [isEditing, setIsEditing] = useState(false);
  const [measurements, setMeasurements] = useState<MeasurementHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    // Load profile from localStorage or create new one
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      try {
        const parsedProfile = JSON.parse(savedProfile);
        setProfile(parsedProfile);
        setHasProfile(true);
        loadMeasurements(parsedProfile.id);
      } catch {
        localStorage.removeItem('userProfile');
      }
    }
  }, []);

  const loadMeasurements = async (userId: number) => {
    try {
      const response = await fetch(`/api/measurements/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setMeasurements(data);
      }
    } catch (error) {
      console.error('Error loading measurements:', error);
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      if (hasProfile && profile.id) {
        // Update existing profile (in a real app, you'd have an update endpoint)
        localStorage.setItem('userProfile', JSON.stringify(profile));
      } else {
        // Create new profile
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(profile)
        });

        if (response.ok) {
          const data = await response.json();
          const updatedProfile = { ...profile, id: data.id };
          setProfile(updatedProfile);
          localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
          setHasProfile(true);
        } else {
          throw new Error('Failed to create profile');
        }
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof UserProfile, value: string | number) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getLatestMeasurement = () => {
    return measurements.length > 0 ? measurements[0] : null;
  };

  const getMeasurementTrend = (field: keyof MeasurementHistory) => {
    if (measurements.length < 2) return null;
    const latest = measurements[0][field] as number;
    const previous = measurements[1][field] as number;
    return latest - previous;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Your Profile
        </h1>
        <p className="text-xl text-gray-600">
          Manage your information and track your measurement history
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Profile Information */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold flex items-center">
                <User className="mr-3 text-primary-600" />
                Profile Info
              </h2>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-primary-600 hover:text-primary-700 p-2 rounded-lg hover:bg-primary-50 transition-colors"
                >
                  <Edit3 size={20} />
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={saveProfile}
                    disabled={loading}
                    className="text-green-600 hover:text-green-700 p-2 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    <Save size={20} />
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="inline mr-2" size={16} />
                  Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="input-field"
                    placeholder="Enter your name"
                  />
                ) : (
                  <p className="text-gray-900 font-medium">
                    {profile.name || 'Not set'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="inline mr-2" size={16} />
                  Email
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="input-field"
                    placeholder="Enter your email"
                  />
                ) : (
                  <p className="text-gray-900 font-medium">
                    {profile.email || 'Not set'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Ruler className="inline mr-2" size={16} />
                  Height (cm)
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    value={profile.height}
                    onChange={(e) => handleInputChange('height', Number(e.target.value))}
                    className="input-field"
                    min="100"
                    max="250"
                    placeholder="Enter your height"
                  />
                ) : (
                  <p className="text-gray-900 font-medium">
                    {profile.height} cm
                  </p>
                )}
              </div>

              {profile.created_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="inline mr-2" size={16} />
                    Member Since
                  </label>
                  <p className="text-gray-900 font-medium">
                    {formatDate(profile.created_at)}
                  </p>
                </div>
              )}
            </div>

            {!hasProfile && !isEditing && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-800 text-sm mb-3">
                  Create your profile to save and track your measurements over time.
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn-primary w-full"
                >
                  Create Profile
                </button>
              </div>
            )}
          </motion.div>
        </div>

        {/* Measurement History */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card mb-6"
          >
            <h2 className="text-2xl font-semibold mb-6 flex items-center">
              <TrendingUp className="mr-3 text-primary-600" />
              Latest Measurements
            </h2>

            {getLatestMeasurement() ? (
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { label: 'Chest', field: 'chest' as keyof MeasurementHistory, icon: '👕' },
                  { label: 'Waist', field: 'waist' as keyof MeasurementHistory, icon: '📏' },
                  { label: 'Hips', field: 'hips' as keyof MeasurementHistory, icon: '📐' },
                  { label: 'Shoulders', field: 'shoulder_width' as keyof MeasurementHistory, icon: '🤝' },
                  { label: 'Arms', field: 'arm_length' as keyof MeasurementHistory, icon: '💪' },
                  { label: 'Inseam', field: 'inseam' as keyof MeasurementHistory, icon: '👖' },
                ].map((item) => {
                  const latest = getLatestMeasurement();
                  const trend = getMeasurementTrend(item.field);
                  return (
                    <div key={item.label} className="measurement-item">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{item.icon}</span>
                        <div>
                          <p className="font-medium text-gray-900">{item.label}</p>
                          {trend !== null && (
                            <p className={`text-xs ${trend > 0 ? 'text-red-500' : trend < 0 ? 'text-green-500' : 'text-gray-500'}`}>
                              {trend > 0 ? '+' : ''}{trend.toFixed(1)}cm from last
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-primary-600">
                          {(latest![item.field] as number).toFixed(1)}
                        </p>
                        <p className="text-sm text-gray-500">cm</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Ruler className="mx-auto mb-4 text-gray-400" size={48} />
                <p className="text-gray-500 mb-4">No measurements yet</p>
                <p className="text-sm text-gray-400">
                  Take your first measurement to see your progress here
                </p>
              </div>
            )}
          </motion.div>

          {/* Measurement History */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <h2 className="text-2xl font-semibold mb-6 flex items-center">
              <History className="mr-3 text-primary-600" />
              Measurement History
            </h2>

            {measurements.length > 0 ? (
              <div className="space-y-4">
                {measurements.map((measurement, index) => (
                  <motion.div
                    key={measurement.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          Measurement #{measurements.length - index}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(measurement.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm font-medium">
                          Size {measurement.recommended_size}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Chest</p>
                        <p className="font-medium">{measurement.chest.toFixed(1)} cm</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Waist</p>
                        <p className="font-medium">{measurement.waist.toFixed(1)} cm</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Hips</p>
                        <p className="font-medium">{measurement.hips.toFixed(1)} cm</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <History className="mx-auto mb-4 text-gray-400" size={48} />
                <p className="text-gray-500 mb-4">No measurement history</p>
                <p className="text-sm text-gray-400">
                  Your measurement history will appear here after you take measurements
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Profile;