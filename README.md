# GestureSmart 🤲👁️🗣️

An AI-powered mobile accessibility system designed for users with motor and visual impairments, enabling touch-free interaction through gesture recognition, voice commands, and eye-tracking.

## 📱 Overview

GestureSmart bridges the accessibility gap in mobile interfaces by offering an inclusive and adaptive system that enables users to control mobile devices through gestures, voice, or eye movements. This combination of AI technologies ensures usability across diverse environments and offers users the freedom to choose their preferred interaction mode.

## ✨ Key Features

### 🎯 Multi-Modal Control
- **Gesture Control**: Hand-based navigation using MediaPipe/TensorFlow Lite
- **Voice Commands**: Real-time speech input via Google Speech-to-Text API
- **Eye Tracking**: OpenCV-based gaze and blink detection for UI control
- **Seamless Mode Switching**: Intelligent fallback mechanisms between input modes

### 🔒 Privacy-Focused Design
- No personal data collection - only anonymized device tokens and session logs
- On-device processing for core gesture features
- Encrypted communication using HTTPS
- WCAG 2.1 compliant accessibility standards

### 📱 Offline Capabilities
- Core gesture features work offline using on-device TensorFlow Lite models
- Ideal for rural or low-connectivity areas
- Ensures privacy and usability without internet dependency

### 🎨 Accessibility-First UI
- Designed following WCAG 2.1 principles for inclusive design
- Voice alerts and audio cues for visual feedback
- Minimal visual clutter to support users with cognitive or visual impairments

## 🏗️ Technology Stack

### Frontend
- **React Native** - Cross-platform mobile development
- **TensorFlow Lite** - On-device machine learning
- **MediaPipe** - Real-time gesture recognition
- **OpenCV** - Computer vision and eye tracking

### Backend
- **Node.js** - Server-side runtime
- **MongoDB Atlas** - Cloud database for session data
- **Express.js** - Web application framework

### AI/ML Services
- **Google Speech API** - Speech-to-text conversion
- **MediaPipe Framework** - Hand landmark detection
- **OpenCV** - Image processing and facial landmark detection

## 📊 Performance Metrics

The system demonstrates high reliability across key performance indicators:

- **Precision**: High accuracy in controlled environments
- **Accuracy**: Consistent performance across different input modes
- **Recall**: Effective detection of user intents
- **TNR (True Negative Rate)**: Robust false positive filtering
- **Fallback Reliability**: Seamless mode switching preserves usability

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- React Native CLI
- Android Studio / Xcode
- MongoDB Atlas account
- Google Cloud Platform account (for Speech API)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/gesturesmart.git
   cd gesturesmart
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd ios && pod install # For iOS only
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   GOOGLE_SPEECH_API_KEY=your_google_speech_api_key
   MONGODB_URI=your_mongodb_atlas_connection_string
   NODE_ENV=development
   ```

4. **Start the Metro bundler**
   ```bash
   npx react-native start
   ```

5. **Run the application**
   ```bash
   # For Android
   npx react-native run-android
   
   # For iOS
   npx react-native run-ios
   ```

## 🧠 AI Model Training

### Datasets Used
- **Gesture Recognition**: Annotated video frames of hand movements for swipes, taps, and zoom actions
- **Voice Commands**: Pre-recorded datasets with varying accents and environmental conditions
- **Eye Tracking**: Facial landmark datasets for gaze direction and blinking pattern detection

### Model Architecture
- **Preprocessing**: Data normalization and augmentation
- **Framework**: MediaPipe and OpenCV with deep learning integration
- **Training Metrics**: Accuracy, Precision, Recall, and F1-Score optimization

## 🔧 System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Native  │    │     Node.js     │    │  MongoDB Atlas  │
│   Mobile App    │◄──►│     Backend     │◄──►│    Database     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   AI Services   │    │  Cloud Services │
│ • MediaPipe     │    │ • Google Speech │
│ • OpenCV        │    │ • HTTPS Encrypt │
│ • TensorFlow    │    │                 │
└─────────────────┘    └─────────────────┘
```

## 🎯 Use Cases

### Primary Users
- Individuals with motor impairments
- Visually impaired users
- Users with speech difficulties
- Elderly users seeking simplified interfaces

### Environments
- **Noisy Environments**: Voice recognition with noise filtering
- **Low-Light Conditions**: Gesture and eye-tracking alternatives
- **Dynamic Settings**: Adaptive mode switching based on context
- **Offline Scenarios**: Core functionality without internet dependency

## 🔮 Future Enhancements

### 🎨 Custom Gesture Learning
- Enable users to create personalized hand gestures
- On-device ML training for privacy and adaptability
- Tailored gestures based on individual mobility needs

### 📱 Braille via Haptic Feedback
- Vibration-based tactile cues to simulate Braille
- Navigate interface without visual or audio support
- Enhanced accessibility for blind users

### ⚡ On-Device ML Optimization
- Lightweight, personalized models
- Improved accuracy and responsiveness
- Reduced cloud dependency for better privacy

### 🌍 Multilingual & NLP Support
- Regional language support (Urdu, Hindi, Pashto, etc.)
- Right-to-left (RTL) text support
- Localized content for global accessibility

## 🧪 Testing & Validation

The system underwent extensive testing across:
- **Controlled Environments**: Laboratory conditions with optimal lighting and minimal noise
- **Real-World Scenarios**: Varied lighting, background noise, and user movement
- **Accessibility Compliance**: WCAG 2.1 guidelines adherence
- **Cross-Platform Compatibility**: iOS and Android device testing

## 🤝 Contributing

We welcome contributions to make GestureSmart more accessible and inclusive! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

### Development Guidelines
1. Follow React Native and Node.js best practices
2. Ensure accessibility compliance in all features
3. Test across multiple devices and environments
4. Document new features and API changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact & Support

**Developer**: Atib Ur Rehman

- 📧 **Email**: [ateebnoone@gmail.com](mailto:ateebnoone@gmail.com)
- 💬 **WhatsApp**: [+923182553930](https://wa.me/+923182553930)

## 🙏 Acknowledgments

Special thanks to all the testers and accessibility advocates who provided valuable feedback during development and testing phases. Your insights were crucial in making GestureSmart truly inclusive.

## 📈 Project Status

GestureSmart is actively maintained and continuously improved. The system has demonstrated technical and commercial viability as a scalable accessibility solution through extensive real-world testing.

---

*Building technology that empowers everyone to interact with the digital world, regardless of their physical abilities.*
