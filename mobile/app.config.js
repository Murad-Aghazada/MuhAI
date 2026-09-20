// Expo configuration. JS rather than app.json so the API URL can be read from
// the environment at bundle time.
export default {
  expo: {
    name: 'Muhai',
    slug: 'muhai',
    scheme: 'muhai',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#f7f7f3',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.muhai.app',
      infoPlist: {
        NSCameraUsageDescription:
          'Fatura fotoğrafı çekip otomatik olarak okumak için kameraya erişim gerekir.',
        NSPhotoLibraryUsageDescription:
          'Galerinizdeki fatura fotoğraflarını okumak için erişim gerekir.',
      },
    },
    android: {
      package: 'com.muhai.app',
      adaptiveIcon: {
        backgroundColor: '#f7f7f3',
        foregroundImage: './assets/android-icon-foreground.png',
      },
      permissions: ['CAMERA'],
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        'expo-camera',
        {
          cameraPermission:
            'Fatura fotoğrafı çekip otomatik olarak okumak için kameraya erişim gerekir.',
        },
      ],
    ],
    experiments: { typedRoutes: false },
  },
}
