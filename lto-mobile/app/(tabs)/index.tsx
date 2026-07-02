import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  StatusBar, KeyboardAvoidingView, Platform, Image,
  ActivityIndicator, Keyboard, TouchableWithoutFeedback,
  Dimensions, Animated, Modal,
} from 'react-native';

import { useRouter }             from 'expo-router';
import AsyncStorage              from '@react-native-async-storage/async-storage';
import { Ionicons }              from '@expo/vector-icons';
import { useFocusEffect }        from '@react-navigation/native';

const { height, width } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// iOS-STYLE CUSTOM ALERT HOOK
// ─────────────────────────────────────────────────────────────
interface AlertButton {
  text:     string;
  onPress?: () => void;
  style?:   'default' | 'cancel' | 'destructive';
}
interface AlertConfig {
  title:    string;
  message?: string;
  buttons?: AlertButton[];
}

function useAlert() {
  const [config,  setConfig]  = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const showAlert = React.useCallback((
    title: string, message?: string, buttons?: AlertButton[]
  ) => {
    setConfig({ title, message, buttons: buttons || [{ text: 'OK', style: 'default' }] });
    setVisible(true);
    scaleAnim.setValue(0.85);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const hideAlert = React.useCallback((onPress?: () => void) => {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 0.85, useNativeDriver: true, speed: 25, bounciness: 0 }),
      Animated.timing(opacityAnim, { toValue: 0,    duration: 150,         useNativeDriver: true }),
    ]).start(() => { setVisible(false); setConfig(null); onPress?.(); });
  }, []);

  const AlertModal = React.useCallback(() => {
    if (!config) return null;
    const buttons = config.buttons || [{ text: 'OK' }];
    return (
      <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={() => hideAlert()}>
        <TouchableOpacity style={aStyles.backdrop} activeOpacity={1}
          onPress={() => { const c = buttons.find(b => b.style === 'cancel'); if (c) hideAlert(c.onPress); }}
        >
          <TouchableOpacity activeOpacity={1}>
            <Animated.View style={[aStyles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
              <View style={aStyles.textSection}>
                <Text style={aStyles.title}>{config.title}</Text>
                {config.message ? <Text style={aStyles.message}>{config.message}</Text> : null}
              </View>
              <View style={aStyles.divider} />
              <View style={[aStyles.buttonRow, buttons.length > 2 && aStyles.buttonColumn]}>
                {buttons.map((btn, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      aStyles.button,
                      buttons.length === 1 && aStyles.buttonFull,
                      buttons.length > 2  && aStyles.buttonFullColumn,
                      i < buttons.length - 1 && buttons.length === 2 && aStyles.buttonWithRightBorder,
                    ]}
                    onPress={() => hideAlert(btn.onPress)}
                    activeOpacity={0.75}
                  >
                    <Text style={[
                      aStyles.buttonText,
                      btn.style === 'cancel'      && aStyles.buttonTextCancel,
                      btn.style === 'destructive' && aStyles.buttonTextDestructive,
                      (!btn.style || btn.style === 'default') && aStyles.buttonTextDefault,
                    ]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }, [config, visible]);

  return { showAlert, AlertModal };
}

const aStyles = StyleSheet.create({
  backdrop:              { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 40 },
  card:                  { width: width - 80, maxWidth: 270, backgroundColor: 'rgba(242,242,247,0.97)', borderRadius: 14, overflow: 'hidden', elevation: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 16 },
  textSection:           { paddingTop: 20, paddingBottom: 16, paddingHorizontal: 16, alignItems: 'center', gap: 4 },
  title:                 { fontSize: 17, fontWeight: '600', color: '#000', textAlign: 'center', letterSpacing: -0.4, lineHeight: 22 },
  message:               { fontSize: 13, fontWeight: '400', color: '#000', textAlign: 'center', lineHeight: 18, opacity: 0.85 },
  divider:               { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(60,60,67,0.29)' },
  buttonRow:             { flexDirection: 'row' },
  buttonColumn:          { flexDirection: 'column' },
  button:                { flex: 1, paddingVertical: 11, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  buttonFull:            { flex: 1 },
  buttonFullColumn:      { flex: 0, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.29)' },
  buttonWithRightBorder: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(60,60,67,0.29)' },
  buttonText:            { fontSize: 17, letterSpacing: -0.4 },
  buttonTextCancel:      { fontWeight: '400', color: '#007AFF' },
  buttonTextDestructive: { fontWeight: '400', color: '#FF3B30' },
  buttonTextDefault:     { fontWeight: '600', color: '#007AFF' },
});

// ─────────────────────────────────────────────────────────────
// LOGIN SCREEN
// ─────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router = useRouter();
  const { showAlert, AlertModal } = useAlert();

  const [badgeNumber,  setBadgeNumber]  = useState('');
  const [securityPin,  setSecurityPin]  = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showPin,      setShowPin]      = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const badgeInputRef = useRef<TextInput>(null);
  const pinInputRef   = useRef<TextInput>(null);

  const logoScale   = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const fadeIn      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    const onShow = Keyboard.addListener('keyboardDidShow', () => {
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 0.7, useNativeDriver: true, speed: 14, bounciness: 0 }),
        Animated.timing(logoOpacity, { toValue: 0,   duration: 150, useNativeDriver: true }),
      ]).start();
    });
    const onHide = Keyboard.addListener('keyboardDidHide', () => {
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 5 }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    });
    return () => { onShow.remove(); onHide.remove(); };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setBadgeNumber('');
      setSecurityPin('');
      // ✅ Clear any leftover pending session on focus
      AsyncStorage.removeItem('pendingSession');
    }, [])
  );

  // ✅ UPDATED: Badge + Password → Face Verification (required)
  const handleLogin = async () => {
    if (!badgeNumber || !securityPin) {
      showAlert('Authentication Required', 'Please enter your Badge Number and Security PIN.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        'https://dvats-api-php.onrender.com/login.php',
        {
          method:  'POST',
          headers: {
            'Content-Type':               'application/json',
            'Accept':                     'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({ badge_number: badgeNumber, password: securityPin }),
        }
      );
      const result = await response.json();

      if (result.status === 'success') {
        // ✅ Save as pendingSession — hindi pa fully logged in
        // Face verification pa ang susunod na step
        await AsyncStorage.setItem('pendingSession',    JSON.stringify(result.user));
        await AsyncStorage.setItem('biometricUserData', JSON.stringify(result.user));

        // ✅ Redirect to Face Verification — REQUIRED step
        router.replace('/FaceLoginScreen');

      } else {
        showAlert('Access Denied', result.message || 'Invalid credentials.');
      }
    } catch {
      showAlert('Connection Lost', 'Cannot reach the server. Ensure Ngrok is online.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0f4ff" translucent={false} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <Animated.View style={[{ flex: 1 }, { opacity: fadeIn }]}>

            {/* ── TOP: Light section with logo ── */}
            <View style={s.top}>
              <Animated.View style={[s.logoWrap, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}>
                <View style={s.decCircle1} />
                <View style={s.decCircle2} />

                <View style={s.logoRing}>
                  <View style={s.logoCircle}>
                    <Image
                      source={require('../assets/images/logo.png')}
                      style={s.logoImage}
                      resizeMode="contain"
                    />
                  </View>
                </View>

                <Text style={s.brandName}>DVATS</Text>

                <View style={s.badgePill}>
                  <View style={s.badgeDot} />
                  <Text style={s.badgeText}>ENFORCER TERMINAL</Text>
                </View>
              </Animated.View>
            </View>

            {/* ── BOTTOM: Dark blue form card ── */}
            <View style={s.card}>
              <View style={s.handle} />

              <Text style={s.cardTitle}>Secure Access</Text>
              <Text style={s.cardSub}>Sign in to your enforcer account</Text>

              {/* Badge field */}
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>BADGE ID</Text>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => badgeInputRef.current?.focus()}
                  style={[s.field, focusedField === 'badge' && s.fieldFocused]}
                >
                  <View style={[s.fieldIconBox, focusedField === 'badge' && s.fieldIconBoxFocused]}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={15}
                      color={focusedField === 'badge' ? '#60a5fa' : '#64748b'}
                    />
                  </View>
                  <TextInput
                    ref={badgeInputRef}
                    style={s.fieldInput}
                    placeholder="Enter your Badge"
                    placeholderTextColor="#4a5568"
                    value={badgeNumber}
                    onChangeText={setBadgeNumber}
                    autoCapitalize="characters"
                    onFocus={() => setFocusedField('badge')}
                    onBlur={() => setFocusedField(null)}
                    returnKeyType="next"
                    onSubmitEditing={() => pinInputRef.current?.focus()}
                  />
                </TouchableOpacity>
              </View>

              {/* PIN field */}
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>SECURITY PIN</Text>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => pinInputRef.current?.focus()}
                  style={[s.field, focusedField === 'pin' && s.fieldFocused]}
                >
                  <View style={[s.fieldIconBox, focusedField === 'pin' && s.fieldIconBoxFocused]}>
                    <Ionicons
                      name="key-outline"
                      size={15}
                      color={focusedField === 'pin' ? '#60a5fa' : '#64748b'}
                    />
                  </View>
                  <TextInput
                    ref={pinInputRef}
                    style={s.fieldInput}
                    placeholder="Enter your PIN"
                    placeholderTextColor="#4a5568"
                    secureTextEntry={!showPin}
                    value={securityPin}
                    onChangeText={setSecurityPin}
                    onFocus={() => setFocusedField('pin')}
                    onBlur={() => setFocusedField(null)}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity onPress={() => setShowPin(!showPin)} style={s.eyeBtn}>
                    <Ionicons
                      name={showPin ? 'eye-off-outline' : 'eye-outline'}
                      size={16}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>

              {/* ✅ Face Verification notice */}
              <View style={s.faceNotice}>
                <Ionicons name="scan-outline" size={14} color="#60a5fa" />
                <Text style={s.faceNoticeText}>
                  Face verification required after login
                </Text>
              </View>

              {/* Authenticate button */}
              <TouchableOpacity
                style={[s.authBtn, loading && s.authBtnLoading]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <View style={s.authBtnInner}>
                    <Text style={s.authBtnText}>Authenticate</Text>
                    <Ionicons name="arrow-forward" size={16} color="white" />
                  </View>
                )}
              </TouchableOpacity>

              <Text style={s.footer}>Dasmariñas Violations Alert And Tracking · 2026</Text>
            </View>

          </Animated.View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <AlertModal />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: '#f0f4ff',
  },

  top: {
    flex:            1,
    backgroundColor: '#f0f4ff',
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },

  logoWrap: {
    alignItems:     'center',
    justifyContent: 'center',
    gap:            10,
  },

  decCircle1: {
    position:        'absolute',
    width:           220,
    height:          220,
    borderRadius:    110,
    backgroundColor: 'rgba(59,130,246,0.06)',
    top:             -30,
  },
  decCircle2: {
    position:        'absolute',
    width:           160,
    height:          160,
    borderRadius:    80,
    backgroundColor: 'rgba(99,102,241,0.05)',
    top:             -10,
  },

  logoRing: {
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: 'rgba(59,130,246,0.08)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
    borderColor:     'rgba(59,130,246,0.15)',
  },

  logoCircle: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: 'white',
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
    elevation:       8,
    shadowColor:     '#3b82f6',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.15,
    shadowRadius:    12,
  },

  logoImage: { width: '120%', height: '120%' },

  brandName: {
    fontSize:      26,
    fontWeight:    '800',
    color:         '#0f172a',
    letterSpacing: 8,
  },

  badgePill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   'rgba(59,130,246,0.08)',
    borderWidth:       1,
    borderColor:       'rgba(59,130,246,0.15)',
    paddingHorizontal: 12,
    paddingVertical:   5,
    borderRadius:      20,
  },

  badgeDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: '#22c55e',
  },

  badgeText: {
    fontSize:      9,
    fontWeight:    '700',
    color:         '#3b82f6',
    letterSpacing: 1.5,
  },

  card: {
    backgroundColor:      '#0f172a',
    borderTopLeftRadius:  32,
    borderTopRightRadius: 32,
    paddingHorizontal:    24,
    paddingTop:           10,
    paddingBottom:        80,
    marginBottom:         -60,
  },

  handle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf:       'center',
    marginBottom:    22,
  },

  cardTitle: {
    fontSize:      22,
    fontWeight:    '700',
    color:         'white',
    letterSpacing: -0.5,
    marginBottom:  4,
  },

  cardSub: {
    fontSize:     13,
    color:        'rgba(255,255,255,0.4)',
    fontWeight:   '400',
    marginBottom: 24,
  },

  fieldWrap:  { marginBottom: 14 },

  fieldLabel: {
    fontSize:      10,
    fontWeight:    '700',
    color:         'rgba(255,255,255,0.35)',
    letterSpacing: 0.8,
    marginBottom:  7,
    paddingLeft:   2,
  },

  field: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    backgroundColor:   'rgba(255,255,255,0.06)',
    borderRadius:      14,
    paddingHorizontal: 14,
    height:            52,
    borderWidth:       1.5,
    borderColor:       'rgba(255,255,255,0.08)',
  },

  fieldFocused: {
    borderColor:     '#3b82f6',
    backgroundColor: 'rgba(59,130,246,0.08)',
  },

  fieldIconBox: {
    width:           32,
    height:          32,
    borderRadius:    9,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },

  fieldIconBoxFocused: { backgroundColor: 'rgba(59,130,246,0.15)' },

  fieldInput: {
    flex:       1,
    fontSize:   14,
    fontWeight: '500',
    color:      'white',
  },

  eyeBtn: { padding: 4 },

  // ✅ Face verification notice
  faceNotice: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   'rgba(59,130,246,0.08)',
    borderWidth:       1,
    borderColor:       'rgba(59,130,246,0.15)',
    borderRadius:      10,
    paddingHorizontal: 12,
    paddingVertical:   8,
    marginBottom:      6,
  },

  faceNoticeText: {
    fontSize:   12,
    color:      '#60a5fa',
    fontWeight: '600',
  },

  authBtn: {
    backgroundColor: '#3b82f6',
    height:          54,
    borderRadius:    14,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       6,
    marginBottom:    12,
    shadowColor:     '#3b82f6',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.4,
    shadowRadius:    12,
    elevation:       6,
  },

  authBtnLoading: { backgroundColor: '#1e3a5f', shadowOpacity: 0, elevation: 0 },

  authBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  authBtnText: {
    color:         'white',
    fontSize:      15,
    fontWeight:    '600',
    letterSpacing: -0.2,
  },

  footer: {
    textAlign:  'center',
    fontSize:   10,
    color:      'rgba(255,255,255,0.2)',
    fontWeight: '500',
  },
});