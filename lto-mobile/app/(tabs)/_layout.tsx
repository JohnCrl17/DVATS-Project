import React from 'react';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      // Dito nilalagay ang sceneContainerStyle para mawala ang asul na background
      sceneContainerStyle={{ backgroundColor: 'white' }}
      screenOptions={{
        headerShown: false,
        // Nakatago ang default tab bar para hindi sumilip sa Login/Dashboard
        tabBarStyle: { display: 'none' }, 
      }}>
      
      {/* Listahan ng lahat ng files sa loob ng (tabs) folder */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="register" options={{ href: null }} />
      <Tabs.Screen name="dashboard" options={{ href: null }} />
      <Tabs.Screen name="apprehension" options={{ href: null }} />
      <Tabs.Screen name="ticket" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="alerts" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}