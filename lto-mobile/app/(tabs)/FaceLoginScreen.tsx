import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, StatusBar, Dimensions, Image,
  Keyboard, TouchableWithoutFeedback, Animated, Platform
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import { IosAlert } from './CustomAlert';

// ─── CONFIG ────────────────────────────────────────────────────────────────
const API_BASE_URL     = "https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api";
const MAX_RETRIES      = 3;
const FETCH_TIMEOUT_MS = 60000;
// ───────────────────────────────────────────────────────────────────────────

const { width }  = Dimensions.get('window');
const FRAME_SIZE = width * 0.65;

type VerifyStatus = 'idle' | 'verifying' | 'success' | 'failed' | 'network_error';

export default function FaceLoginScreen() {
  const router    = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // ✅ Badge loaded from pendingSession — no manual input
  const [badgeNumber,  setBadgeNumber]  = useState('');
  const [enforcerName, setEnforcerName] = useState('');

  const [scanning,     setScanning]     = useState(false);
  const [countdown,    setCountdown]    = useState<number | null>(null);
  const [frozenPhoto,  setFrozenPhoto]  = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle');
  const [retryCount,   setRetryCount]   = useState(0);

  const slideAnim = useRef(new Animated.Value(0)).current;

  // ─── Keyboard listeners ───────────────────────────────────────────────────
  useEffect(() => {
    const showListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.spring(slideAnim, {
          toValue:         -(e.endCoordinates.height * 0.4),
          useNativeDriver: true,
          speed:           15,
          bounciness:      0,
        }).start();
      }
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.spring(slideAnim, {
          toValue:         0,
          useNativeDriver: true,
          speed:           15,
          bounciness:      0,
        }).start();
      }
    );
    return () => { showListener.remove(); hideListener.remove(); };
  }, [slideAnim]);

  // ─── Interval cleanup ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ─── Load pendingSession on focus ─────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      Keyboard.dismiss();
      slideAnim.setValue(0);
      setScanning(false);
      setCountdown(null);
      setFrozenPhoto(null);
      setVerifyStatus('idle');
      setRetryCount(0);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // ✅ Load badge from pendingSession set by login.tsx
      AsyncStorage.getItem('pendingSession').then(data => {
        if (data) {
          const user = JSON.parse(data);
          setBadgeNumber(user.badge_number || '');
          setEnforcerName(user.fullname || user.name || '');
        } else {
          // Walang pending session — ibig sabihin hindi dumaan sa login
          IosAlert.alert(
            'Session Expired',
            'Please login with your Badge and PIN first.',
            [{ text: 'OK', onPress: () => router.replace('/') }]
          );
        }
      });

      return () => {
        Keyboard.dismiss();
        slideAnim.setValue(0);
        Animated.spring(slideAnim, {
          toValue:         0,
          useNativeDriver: true,
          speed:           25,
          bounciness:      0,
        }).start();

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [])
  );

  // ─── Navigate back to login cleanly ───────────────────────────────────────
  const navigateBackToLogin = () => {
    // ✅ Clear pending session — user cancelled face verif
    AsyncStorage.removeItem('pendingSession');
    setTimeout(() => {
      slideAnim.setValue(0);
      router.replace('/');
    }, 150);
  };

  const handleReset = () => {
    setFrozenPhoto(null);
    setVerifyStatus('idle');
    setScanning(false);
    setCountdown(null);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startCountdown = () => {
    if (scanning || !badgeNumber.trim()) return;
    Keyboard.dismiss();
    setCountdown(3);
    let count = 3;
    intervalRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count === 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setCountdown(null);
        handleCapture();
      }
    }, 1000);
  };

  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    // ✅ Badge comes from pendingSession — no user input needed
    const currentBadge = badgeNumber.trim().toUpperCase();
    if (!currentBadge) {
      IosAlert.alert("Session Error", "Badge number not found. Please login again.");
      navigateBackToLogin();
      return;
    }

    setScanning(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64:         false,
        quality:        0.5,
        skipProcessing: true,
      });

      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 400 } }],
        { base64: true, compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      if (!resized.base64) {
        IosAlert.alert("Error", "Failed to process photo. Please try again.");
        handleReset();
        return;
      }

      setFrozenPhoto(resized.uri);
      setVerifyStatus('verifying');
      await sendToBackend(resized.base64, currentBadge);

    } catch (err) {
      console.error("Capture error:", err);
      IosAlert.alert("Error", "Failed to capture. Please try again.");
      handleReset();
    }
  };

  const sendToBackend = async (base64: string, badge: string) => {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/face_login.php`,
        {
          method:  "POST",
          headers: {
            "Content-Type":               "application/json",
            "Accept":                     "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ badge_number: badge, selfie: base64 }),
        },
        FETCH_TIMEOUT_MS
      );

      const rawText = await response.text();
      console.log("Face API raw response:", rawText);

      let result;
      try {
        result = JSON.parse(rawText);
      } catch (parseErr) {
        console.error("JSON parse failed. Raw:", rawText);
        setVerifyStatus('network_error');
        return;
      }

      if (result.status === "success") {
        setVerifyStatus('success');

        // ✅ Promote pendingSession → actual userSession
        const pending = await AsyncStorage.getItem('pendingSession');
        if (pending) {
          await AsyncStorage.setItem('userSession',      pending);
          await AsyncStorage.setItem('biometricEnabled', 'true');
        }
        await AsyncStorage.removeItem('pendingSession');

        setTimeout(() => router.replace("/dashboard"), 1500);

      } else {
        console.log("Face login failed:", result.message);
        setVerifyStatus('failed');
      }

    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.error("Request timed out");
      } else {
        console.error("Network/fetch error:", error);
      }
      setVerifyStatus('network_error');
    }
  };

  const handleRetry = () => {
    if (retryCount >= MAX_RETRIES - 1) {
      IosAlert.alert(
        "Too Many Attempts",
        "Face recognition failed 3 times. Please login again with your Badge & Password.",
        [{
          text:    "OK",
          onPress: () => navigateBackToLogin(),
        }]
      );
      return;
    }
    setRetryCount(prev => prev + 1);
    handleReset();
  };

  // ─── Permission screens ───────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <LinearGradient colors={['#0f172a', '#1e3a8a']} style={styles.centered}>
        <Ionicons name="camera-outline" size={60} color="white" />
        <Text style={styles.permText}>Camera permission is required</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  // ─── Main UI ──────────────────────────────────────────────────────────────
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {/* CAMERA */}
        {!frozenPhoto && (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
        )}

        {/* FROZEN PHOTO */}
        {frozenPhoto && (
          <Image source={{ uri: frozenPhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}

        {/* OVERLAY */}
        <View style={styles.overlay}>

          {/* TOP NAV */}
          <SafeAreaView>
            <View style={styles.topNav}>
              <TouchableOpacity style={styles.backBtn} onPress={navigateBackToLogin}>
                <Ionicons name="chevron-back" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.topTitle}>FACE VERIFICATION</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* ✅ Step indicator */}
            <View style={styles.stepIndicator}>
              <View style={styles.stepDone}>
                <Ionicons name="checkmark" size={12} color="white" />
              </View>
              <View style={styles.stepLine} />
              <View style={styles.stepActive}>
                <Text style={styles.stepActiveText}>2</Text>
              </View>
              <View style={[styles.stepLine, { opacity: 0.3 }]} />
              <View style={styles.stepPending}>
                <Ionicons name="grid-outline" size={12} color="rgba(255,255,255,0.4)" />
              </View>
            </View>

            {/* ✅ Enforcer info — shows who is logging in */}
            {badgeNumber !== '' && (
              <View style={styles.enforcerBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#22c55e" />
                <Text style={styles.enforcerBadgeText}>
                  {enforcerName ? `${enforcerName}  ·  ` : ''}{badgeNumber}
                </Text>
              </View>
            )}
          </SafeAreaView>

          {/* ANIMATED CONTENT */}
          <Animated.View
            style={[styles.animatedContent, { transform: [{ translateY: slideAnim }] }]}
          >
            {/* FACE FRAME */}
            <View style={styles.faceFrameWrapper}>
              <View style={[
                styles.faceFrame,
                verifyStatus === 'success' && styles.faceFrameSuccess,
                (verifyStatus === 'failed' || verifyStatus === 'network_error') && styles.faceFrameFailed,
              ]}>
                {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map((pos) => (
                  <View key={pos} style={[
                    styles.corner, styles[pos],
                    verifyStatus === 'success' && styles.cornerSuccess,
                    (verifyStatus === 'failed' || verifyStatus === 'network_error') && styles.cornerFailed,
                  ]} />
                ))}

                {countdown !== null && (
                  <View style={styles.countdownWrapper}>
                    <Text style={styles.countdownText}>{countdown}</Text>
                  </View>
                )}

                {verifyStatus === 'verifying' && (
                  <View style={styles.statusOverlay}>
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={styles.statusText}>Verifying face...</Text>
                  </View>
                )}

                {verifyStatus === 'success' && (
                  <View style={styles.statusOverlay}>
                    <Ionicons name="checkmark-circle" size={60} color="#22c55e" />
                    <Text style={[styles.statusText, { color: '#22c55e' }]}>Face Recognized!</Text>
                    <Text style={[styles.statusSubText, { color: '#86efac' }]}>Redirecting to dashboard...</Text>
                  </View>
                )}

                {verifyStatus === 'failed' && (
                  <View style={styles.statusOverlay}>
                    <Ionicons name="close-circle" size={60} color="#ef4444" />
                    <Text style={[styles.statusText, { color: '#ef4444' }]}>Not Recognized</Text>
                    <Text style={[styles.statusSubText, { color: '#fca5a5' }]}>
                      Attempt {retryCount + 1} of {MAX_RETRIES}
                    </Text>
                  </View>
                )}

                {verifyStatus === 'network_error' && (
                  <View style={styles.statusOverlay}>
                    <Ionicons name="cloud-offline-outline" size={60} color="#fbbf24" />
                    <Text style={[styles.statusText, { color: '#fbbf24' }]}>Connection Error</Text>
                    <Text style={[styles.statusSubText, { color: '#fde68a' }]}>
                      Check your internet connection
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* BOTTOM SECTION */}
            <View style={styles.bottomSection}>

              {verifyStatus === 'idle' && (
                <Text style={styles.instructionText}>
                  Position your face inside the frame, then tap SCAN FACE
                </Text>
              )}
              {verifyStatus === 'verifying' && (
                <Text style={styles.instructionText}>Please wait while we verify your face...</Text>
              )}
              {verifyStatus === 'failed' && (
                <Text style={[styles.instructionText, { color: '#fca5a5' }]}>
                  Face not recognized. Please try again.
                </Text>
              )}
              {verifyStatus === 'network_error' && (
                <Text style={[styles.instructionText, { color: '#fde68a' }]}>
                  Could not connect to server. Check your connection.
                </Text>
              )}

              {verifyStatus === 'idle' && (
                <TouchableOpacity
                  style={[styles.scanBtn, (!badgeNumber.trim() || scanning) && styles.scanBtnDisabled]}
                  onPress={startCountdown}
                  disabled={!badgeNumber.trim() || scanning}
                >
                  {countdown !== null ? (
                    <Text style={styles.scanBtnText}>Capturing in {countdown}...</Text>
                  ) : (
                    <>
                      <Ionicons name="scan" size={22} color="white" />
                      <Text style={styles.scanBtnText}>SCAN FACE</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {(verifyStatus === 'failed' || verifyStatus === 'network_error') && (
                <TouchableOpacity
                  style={[styles.retryBtn, retryCount >= MAX_RETRIES - 1 && styles.retryBtnDisabled]}
                  onPress={handleRetry}
                >
                  <Ionicons name="refresh" size={20} color="white" />
                  <Text style={styles.scanBtnText}>
                    {retryCount >= MAX_RETRIES - 1 ? 'MAX RETRIES REACHED' : 'TRY AGAIN'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* ✅ Cancel goes back to login — clears pending session */}
              <TouchableOpacity style={styles.cancelBtn} onPress={navigateBackToLogin}>
                <Text style={styles.cancelBtnText}>← Back to Login</Text>
              </TouchableOpacity>

            </View>
          </Animated.View>

        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  permText:  { color: 'white', fontSize: 16, fontWeight: '700', textAlign: 'center', paddingHorizontal: 30 },
  permBtn:   { backgroundColor: '#1e40af', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 15 },
  permBtnText: { color: 'white', fontWeight: '900', fontSize: 14 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent:  'space-between',
  },

  topNav: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingTop:        10,
    paddingBottom:     10,
  },
  backBtn: {
    padding:         10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius:    12,
  },
  topTitle: { color: 'white', fontSize: 15, fontWeight: '900', letterSpacing: 1 },

  // ✅ Step indicator
  stepIndicator: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    paddingBottom:  10,
  },
  stepDone: {
    width:           24, height: 24, borderRadius: 12,
    backgroundColor: '#22c55e',
    alignItems:      'center', justifyContent: 'center',
  },
  stepLine: {
    width:           30, height: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius:    1,
  },
  stepActive: {
    width:           24, height: 24, borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems:      'center', justifyContent: 'center',
  },
  stepActiveText: { color: 'white', fontSize: 12, fontWeight: '900' },
  stepPending: {
    width:           24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems:      'center', justifyContent: 'center',
  },

  // ✅ Enforcer badge display
  enforcerBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               6,
    backgroundColor:   'rgba(34,197,94,0.1)',
    borderWidth:       1,
    borderColor:       'rgba(34,197,94,0.3)',
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:   6,
    alignSelf:         'center',
    marginBottom:      6,
  },
  enforcerBadgeText: {
    color:      '#22c55e',
    fontSize:   12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  animatedContent: {
    flex:           1,
    justifyContent: 'space-between',
  },

  faceFrameWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  faceFrame: {
    width:          FRAME_SIZE,
    height:         FRAME_SIZE * 1.2,
    borderRadius:   FRAME_SIZE * 0.5,
    justifyContent: 'center',
    alignItems:     'center',
    position:       'relative',
  },
  faceFrameSuccess: { backgroundColor: 'rgba(34,197,94,0.1)' },
  faceFrameFailed:  { backgroundColor: 'rgba(239,68,68,0.1)' },

  corner: {
    position:    'absolute',
    width:       30,
    height:      30,
    borderColor: 'white',
    borderWidth: 3,
  },
  cornerSuccess: { borderColor: '#22c55e' },
  cornerFailed:  { borderColor: '#ef4444' },
  topLeft:     { top: 0,    left: 0,  borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 10 },
  topRight:    { top: 0,    right: 0, borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 10 },
  bottomLeft:  { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0,    borderBottomLeftRadius: 10 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0,    borderBottomRightRadius: 10 },

  countdownWrapper: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  countdownText: { color: 'white', fontSize: 40, fontWeight: '900' },

  statusOverlay: {
    justifyContent:  'center',
    alignItems:      'center',
    gap:             10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius:    FRAME_SIZE * 0.5,
    padding:         20,
  },
  statusText:    { color: 'white', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  statusSubText: { color: 'white', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  bottomSection: {
    paddingHorizontal: 30,
    paddingBottom:     50,
    paddingTop:        10,
    alignItems:        'center',
    gap:               15,
    width:             '100%',
  },

  instructionText: {
    color:      'rgba(255,255,255,0.7)',
    fontSize:   13,
    fontWeight: '600',
    textAlign:  'center',
  },

  scanBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
    backgroundColor: '#1e40af',
    width:           '100%',
    height:          60,
    borderRadius:    20,
    elevation:       8,
  },
  scanBtnDisabled: { backgroundColor: '#475569' },
  scanBtnText:     { color: 'white', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  retryBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
    backgroundColor: '#dc2626',
    width:           '100%',
    height:          60,
    borderRadius:    20,
    elevation:       8,
  },
  retryBtnDisabled: { backgroundColor: '#7f1d1d' },

  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: {
    color:              'rgba(255,255,255,0.5)',
    fontSize:           13,
    fontWeight:         '600',
    textDecorationLine: 'underline',
  },
});