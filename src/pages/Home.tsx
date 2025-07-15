import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Ruler, BarChart3, Shield, Zap, Users } from 'lucide-react';

const Home: React.FC = () => {
  const features = [
    {
      icon: Camera,
      title: 'AI-Powered Measurement',
      description: 'Advanced computer vision technology analyzes your photo to extract precise body measurements.',
      color: 'text-blue-600'
    },
    {
      icon: Ruler,
      title: 'Accurate Results',
      description: 'Get measurements for chest, waist, hips, shoulders, arms, and inseam with high precision.',
      color: 'text-green-600'
    },
    {
      icon: BarChart3,
      title: 'Size Recommendations',
      description: 'Receive personalized clothing size recommendations based on your measurements.',
      color: 'text-purple-600'
    },
    {
      icon: Shield,
      title: 'Privacy First',
      description: 'Your photos are processed securely and never stored on our servers.',
      color: 'text-red-600'
    },
    {
      icon: Zap,
      title: 'Instant Processing',
      description: 'Get your measurements in seconds with our optimized AI algorithms.',
      color: 'text-yellow-600'
    },
    {
      icon: Users,
      title: 'Track Progress',
      description: 'Monitor your body measurements over time and track your fitness journey.',
      color: 'text-indigo-600'
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center py-20 px-4"
      >
        <div className="max-w-4xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-5xl md:text-6xl font-bold text-gray-900 mb-6"
          >
            Smart Body
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-600">
              {' '}Measurement
            </span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-xl md:text-2xl text-gray-600 mb-8 leading-relaxed"
          >
            Get accurate body measurements instantly using AI-powered computer vision.
            Perfect for online shopping, fitness tracking, and custom tailoring.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link
              to="/measurement"
              className="btn-primary text-lg px-8 py-4 flex items-center"
            >
              <Camera className="mr-2" size={24} />
              Start Measuring
            </Link>
            <Link
              to="/profile"
              className="btn-secondary text-lg px-8 py-4 flex items-center"
            >
              <Users className="mr-2" size={24} />
              View Profile
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Choose SmartMeasure?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our advanced AI technology makes body measurement simple, accurate, and accessible to everyone.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                className="card hover:scale-105 transition-transform duration-300"
              >
                <div className={`${feature.color} mb-4`}>
                  <feature.icon size={48} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">
              Get your measurements in three simple steps
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Capture Photo',
                description: 'Take a photo or upload an existing one. Stand straight with arms slightly away from your body.',
                icon: Camera
              },
              {
                step: '02',
                title: 'AI Processing',
                description: 'Our AI analyzes your photo using advanced pose detection to identify key body landmarks.',
                icon: Zap
              },
              {
                step: '03',
                title: 'Get Results',
                description: 'Receive accurate measurements and personalized size recommendations instantly.',
                icon: BarChart3
              }
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2, duration: 0.6 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="relative mb-6">
                  <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <item.icon className="text-primary-600" size={32} />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {item.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-secondary-600">
        <div className="max-w-4xl mx-auto text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-white/90 mb-8">
              Join thousands of users who trust SmartMeasure for accurate body measurements.
            </p>
            <Link
              to="/measurement"
              className="inline-flex items-center bg-white text-primary-600 font-semibold px-8 py-4 rounded-lg hover:bg-gray-50 transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              <Camera className="mr-2" size={24} />
              Start Your First Measurement
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;