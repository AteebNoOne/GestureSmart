# Contributing to GestureSmart 🤝

Thank you for your interest in contributing to GestureSmart! We welcome contributions from developers, accessibility advocates, and anyone passionate about creating inclusive technology.

## 📋 Table of Contents
- [Current Platform Support](#current-platform-support)
- [Priority Contributions Needed](#priority-contributions-needed)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Submission Process](#submission-process)
- [Community Guidelines](#community-guidelines)

## 📱 Current Platform Support

### **Android Support Status**
- ✅ **Android 13 (API 33)**: Fully supported and tested
- ⚠️ **Android 12 and below**: Limited compatibility
- ❌ **iOS**: Not currently supported

### **Known Limitations**
- Custom Java native modules are optimized for Android 13
- MediaPipe integration may have compatibility issues on older Android versions
- Camera and microphone permissions handling varies across Android versions
- Performance optimization is currently Android 13-specific

## 🎯 Priority Contributions Needed

We're actively seeking contributors to help with these critical areas:

### **🔥 HIGH PRIORITY**

#### 1. **Android Version Compatibility** 
- **Goal**: Support Android 8.0 (API 26) and above
- **Areas needed**:
  - Native module compatibility testing
  - Camera API version handling
  - Permission system adaptations
  - MediaPipe model optimization for older devices
  - Performance tuning for lower-end hardware

#### 2. **iOS Platform Support**
- Port custom Java modules to Swift/Objective-C
- Implement iOS-specific camera and microphone handling
- Adapt gesture recognition for iOS ARKit integration
- Test accessibility features with iOS VoiceOver

#### 3. **Cross-Platform Testing**
- Device compatibility testing across different manufacturers
- Screen size and resolution adaptations
- Hardware-specific optimizations
- Battery usage optimization

### **🔧 MEDIUM PRIORITY**

#### 4. **Accessibility Enhancements**
- Improve WCAG 2.1 compliance
- Add more voice command variations
- Enhance haptic feedback for gesture recognition
- Better support for screen readers

#### 5. **Performance Optimization**
- Reduce app startup time
- Optimize ML model loading
- Improve gesture recognition accuracy
- Memory usage optimization

#### 6. **UI/UX Improvements**
- More intuitive gesture training interface
- Better visual feedback for gesture recognition
- Enhanced settings and customization options
- Dark mode and theme support

### **💡 NICE TO HAVE**

#### 7. **New Features**
- Custom gesture creation
- Multi-language support
- Cloud sync for user preferences
- Analytics and usage tracking (privacy-focused)

## 🛠️ Development Setup

### Prerequisites
```bash
# Required tools
Node.js >= 18.0.0
Java Development Kit (JDK) 11 or higher
Android Studio with SDK 33
Expo CLI (latest)
EAS CLI (for builds)
Git
```

### Environment Setup
```bash
# Clone the repository
git clone https://github.com/ateebnoone/gesturesmart.git
cd gesturesmart

# Install dependencies
npm install
# or
yarn install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Device Testing Setup
```bash
# Enable developer options on your Android device
# Enable USB debugging
# Connect device and verify
adb devices

# For testing on different Android versions
# We recommend testing on:
# - Android 13 (current supported)
# - Android 11, 12 (medium priority)
# - Android 8, 9, 10 (high priority compatibility)
```

## 📋 Contributing Guidelines

### **Before You Start**
1. Check existing issues and pull requests
2. Join our community discussion (create an issue for major features)
3. Fork the repository
4. Create a feature branch from `main`

### **Branch Naming Convention**
```bash
# Feature branches
feature/android-compatibility-api-28
feature/ios-support-initial
feature/gesture-custom-learning

# Bug fixes
bugfix/camera-permission-android-11
bugfix/mediapipe-crash-older-devices

# Documentation
docs/contributing-guidelines
docs/api-documentation
```

### **Commit Message Format**
```bash
# Format: type(scope): description
feat(android): add support for Android 11 camera API
fix(gesture): resolve MediaPipe crash on older devices
docs(readme): update installation instructions
test(android): add compatibility tests for API 28-33
```

## 🔧 Code Standards

### **TypeScript/JavaScript**
```typescript
// Use TypeScript for all new code
// Follow existing code style and patterns
// Use meaningful variable and function names
// Add proper type definitions

// Example:
interface GestureRecognitionResult {
  gesture: string;
  confidence: number;
  timestamp: number;
  deviceInfo: AndroidDeviceInfo;
}
```

### **Java Native Modules**
```java
// Follow Android development best practices
// Use proper error handling
// Add compatibility checks for different API levels
// Document native module interfaces

// Example:
@ReactMethod
public void initializeGestureRecognition(ReadableMap options, Promise promise) {
    try {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.reject("UNSUPPORTED_VERSION", "Requires Android 8.0+");
            return;
        }
        // Implementation
    } catch (Exception e) {
        promise.reject("INITIALIZATION_ERROR", e.getMessage());
    }
}
```

### **React Native Components**
```typescript
// Use functional components with hooks
// Implement proper accessibility props
// Follow React Native best practices
// Add proper error boundaries

// Example:
const GestureDetection: React.FC<GestureDetectionProps> = ({ onGesture }) => {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  
  useEffect(() => {
    checkDeviceCompatibility();
  }, []);
  
  return (
    <View accessible={true} accessibilityLabel="Gesture detection area">
      {/* Component implementation */}
    </View>
  );
};
```

## 🧪 Testing Requirements

### **Required Testing**
1. **Device Compatibility Testing**
   ```bash
   # Test on minimum supported devices
   # Android 8.0+ (when compatibility is added)
   # Various screen sizes and resolutions
   # Different manufacturers (Samsung, Google, OnePlus, etc.)
   ```

2. **Accessibility Testing**
   ```bash
   # TalkBack (Android screen reader)
   # High contrast mode
   # Large text settings
   # Voice commands in noisy environments
   ```

3. **Performance Testing**
   ```bash
   # Memory usage monitoring
   # Battery consumption testing
   # CPU usage during ML operations
   # Network usage optimization
   ```

4. **Edge Case Testing**
   ```bash
   # Low light conditions
   # Multiple hands in frame
   # Rapid gesture sequences
   # Device rotation scenarios
   ```

### **Testing Commands**
```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Test on device
npx expo start --android

# Build and test
yarn build:android
```

## 📝 Submission Process

### **Pull Request Checklist**
- [ ] Code follows project style guidelines
- [ ] Tests pass on target Android versions
- [ ] Accessibility features tested
- [ ] Documentation updated
- [ ] No breaking changes (or properly documented)
- [ ] Performance impact assessed
- [ ] Screenshots/videos for UI changes

### **Pull Request Template**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change
- [ ] Documentation update
- [ ] Android compatibility improvement
- [ ] iOS support addition

## Android Compatibility
- [ ] Tested on Android 13
- [ ] Tested on Android 11-12
- [ ] Tested on Android 8-10
- [ ] Added compatibility checks

## Testing
- [ ] Unit tests added/updated
- [ ] Device testing completed
- [ ] Accessibility testing done
- [ ] Performance testing completed

## Screenshots/Videos
Add visual proof of changes

## Additional Notes
Any additional context or considerations
```

## 🤝 Community Guidelines

### **Communication**
- Be respectful and inclusive
- Focus on constructive feedback
- Help newcomers get started
- Share knowledge about accessibility

### **Issue Reporting**
```markdown
## Bug Report Template
**Device Information:**
- Device: [e.g., Samsung Galaxy S21]
- Android Version: [e.g., Android 13]
- App Version: [e.g., 1.2.0]

**Expected Behavior:**
Description of expected functionality

**Actual Behavior:**
What actually happened

**Steps to Reproduce:**
1. Step one
2. Step two
3. Step three

**Screenshots/Logs:**
Include relevant visual or log information
```

### **Feature Requests**
```markdown
## Feature Request Template
**Problem Statement:**
What accessibility challenge does this address?

**Proposed Solution:**
Detailed description of proposed feature

**Target Users:**
Who would benefit from this feature?

**Alternative Solutions:**
Other approaches considered

**Additional Context:**
Any additional information or mockups
```

## 🎯 Getting Started Checklist

For new contributors, here's how to get started:

### **First Time Contributors**
1. [ ] Read this contributing guide completely
2. [ ] Set up development environment
3. [ ] Look for issues labeled `good-first-issue` or `help-wanted`
4. [ ] Join project discussions
5. [ ] Start with documentation or small bug fixes

### **Android Compatibility Contributors**
1. [ ] Set up testing environment with multiple Android versions
2. [ ] Review current compatibility issues
3. [ ] Focus on MediaPipe integration challenges
4. [ ] Test camera and microphone permissions
5. [ ] Document findings and create compatibility matrix

### **iOS Support Contributors**
1. [ ] Set up iOS development environment
2. [ ] Review existing Android native modules
3. [ ] Plan iOS equivalent implementations
4. [ ] Start with basic app structure
5. [ ] Implement camera and gesture recognition

## 📞 Contact & Support

### **Getting Help**
- **GitHub Issues**: Technical questions and bug reports
- **Email**: [ateebnoone@gmail.com](mailto:ateebnoone@gmail.com) - Direct contact with maintainer
- **WhatsApp**: [+923182553930](https://wa.me/+923182553930) - Quick questions

### **Response Times**
- Issues and PRs: Within 2-3 business days
- Security issues: Within 24 hours
- General questions: Within 1 week

## 🔐 Security

If you discover a security vulnerability, please send an email to [ateebnoone@gmail.com](mailto:ateebnoone@gmail.com) instead of creating a public issue. We take security seriously and will respond promptly.

## 📄 License

By contributing to GestureSmart, you agree that your contributions will be licensed under the same MIT License that covers the project.

---

**Thank you for contributing to GestureSmart! Together, we can make mobile technology accessible to everyone.** 🌟
