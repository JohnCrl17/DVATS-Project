import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CustomAlertProvider } from './(tabs)/CustomAlert';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* Nilagyan ng white background para sa buong project */}
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0f172a' }}>
  <Stack 
    screenOptions={{ 
      headerShown: false,
      contentStyle: { backgroundColor: '#0f172a' },
      animation: 'none',
    }}
  >
          {/* Ang (tabs) folder ang main entry point */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          
          {/* I-declare dito ang iba pang screens na wala sa loob ng tabs kung meron man */}
          {/* Halimbawa: <Stack.Screen name="FaceLoginScreen" options={{ presentation: 'modal' }} /> */}
        </Stack>
        <CustomAlertProvider />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}