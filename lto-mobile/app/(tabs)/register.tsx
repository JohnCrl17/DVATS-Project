import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Image,
  ActivityIndicator, Dimensions, StatusBar, Modal, Animated,
} from 'react-native';

import { SafeAreaView }          from 'react-native-safe-area-context';
import { useRouter }             from 'expo-router';
import { Ionicons }              from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// iOS-STYLE ALERT (same as your existing version)
// ─────────────────────────────────────────────────────────────
type AlertButton = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void; };
type AlertConfig = { title: string; message?: string; buttons?: AlertButton[]; };
type IOSAlertProps = { visible: boolean; config: AlertConfig | null; onClose: () => void; };

function IOSAlert({ visible, config, onClose }: IOSAlertProps) {
  const scaleAnim   = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1,   useNativeDriver: true, damping: 14, stiffness: 200 }),
        Animated.timing(opacityAnim, { toValue: 1,   duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim,   { toValue: 0.8, duration: 150, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0,   duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!config) return null;
  const buttons = config.buttons?.length ? config.buttons : [{ text: 'OK', style: 'default' as const }];

  const handlePress = (btn: AlertButton) => { onClose(); if (btn.onPress) setTimeout(btn.onPress, 200); };

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[aS.backdrop, { opacity: opacityAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} />
      </Animated.View>
      <View style={aS.centeredView}>
        <Animated.View style={[aS.alertBox, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <Text style={aS.alertTitle}>{config.title}</Text>
          {config.message ? <Text style={aS.alertMessage}>{config.message}</Text> : null}
          <View style={aS.dividerH} />
          <View style={[aS.buttonRow, buttons.length > 2 && { flexDirection: 'column' }]}>
            {buttons.map((btn, idx) => {
              const isLast   = idx === buttons.length - 1;
              const isColumn = buttons.length > 2;
              return (
                <React.Fragment key={idx}>
                  <TouchableOpacity
                    style={[aS.alertBtn, isColumn && { width: '100%' }]}
                    activeOpacity={0.6}
                    onPress={() => handlePress(btn)}
                  >
                    <Text style={[
                      aS.alertBtnText,
                      btn.style === 'destructive' && { color: '#ef4444' },
                      btn.style === 'cancel'      && { color: '#64748b' },
                      (!btn.style || btn.style === 'default') && { color: '#007aff', fontWeight: '600' },
                    ]}>{btn.text}</Text>
                  </TouchableOpacity>
                  {!isLast && <View style={isColumn ? aS.dividerH : aS.dividerV} />}
                </React.Fragment>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const aS = StyleSheet.create({
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  alertBox:     { width: '100%', backgroundColor: Platform.OS === 'ios' ? 'rgba(242,242,247,0.98)' : 'white', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 20 },
  alertTitle:   { textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#000', paddingTop: 20, paddingHorizontal: 16, paddingBottom: 4, letterSpacing: -0.2 },
  alertMessage: { textAlign: 'center', fontSize: 13, color: '#3c3c43', paddingHorizontal: 16, paddingBottom: 20, lineHeight: 18 },
  dividerH:     { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(60,60,67,0.29)' },
  dividerV:     { width: StyleSheet.hairlineWidth,  backgroundColor: 'rgba(60,60,67,0.29)' },
  buttonRow:    { flexDirection: 'row' },
  alertBtn:     { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  alertBtnText: { fontSize: 17, color: '#007aff' },
});

function useIOSAlert() {
  const [visible, setVisible] = useState(false);
  const [config,  setConfig]  = useState<AlertConfig | null>(null);
  const showAlert = (cfg: AlertConfig) => { setConfig(cfg); setVisible(true); };
  const hideAlert = () => setVisible(false);
  const AlertComponent = <IOSAlert visible={visible} config={config} onClose={hideAlert} />;
  return { showAlert, AlertComponent };
}

// ─────────────────────────────────────────────────────────────
// REGISTER SCREEN
// ─────────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [showCamera,    setShowCamera]    = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [base64Image,   setBase64Image]   = useState<string>('');
  const [loading,       setLoading]       = useState(false);
  const [showPassword,  setShowPassword]  = useState(false);
  const [focusedField,  setFocusedField]  = useState<string | null>(null);

  const { showAlert, AlertComponent } = useIOSAlert();

  const [formData, setFormData] = useState({
    name: '', badgeNo: '', unit: '', password: '', email: '', district_office: '',
  });

  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission]);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const data = await cameraRef.current.takePictureAsync({ quality: 0.3, base64: true });
        if (data) { setCapturedImage(data.uri); setBase64Image(data.base64 ?? ''); }
        setShowCamera(false);
      } catch {
        showAlert({ title: 'Camera Error', message: 'Failed to take picture. Please try again.', buttons: [{ text: 'OK' }] });
      }
    }
  };

  const handleRegister = async () => {
    if (!formData.name || !formData.badgeNo || !formData.unit || !formData.password || !base64Image || !formData.email || !formData.district_office) {
      showAlert({ title: 'Required Fields', message: 'Please complete all fields and capture your face photo.', buttons: [{ text: 'OK' }] });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api/register.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.name, badgeNo: formData.badgeNo, unit: formData.unit,
          password: formData.password, profilePic: base64Image,
          email: formData.email, district_office: formData.district_office,
        }),
      });
      const result = await response.json();
      if (result.status === 'success') {
        showAlert({ title: 'Account Secured', message: 'Registration complete. You can now login.', buttons: [{ text: 'Proceed to Login', style: 'default', onPress: () => router.replace('/') }] });
      } else {
        showAlert({ title: 'Registration Failed', message: result.message || 'Something went wrong.', buttons: [{ text: 'OK' }] });
      }
    } catch {
      showAlert({ title: 'Network Error', message: 'Cannot connect to server. Please check your connection.', buttons: [{ text: 'OK' }] });
    } finally {
      setLoading(false);
    }
  };

  if (!permission) return <View style={s.root} />;

  // ── CAMERA VIEW ─────────────────────────────────────────
  if (showCamera && permission.granted) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" translucent={false} />
        <CameraView style={{ flex: 1 }} facing="front" ref={cameraRef}>
          <View style={s.camOverlay}>
            {/* Oval face guide */}
            <View style={s.faceGuideOuter}>
              <View style={s.faceGuideInner} />
            </View>
            <Text style={s.camHint}>ALIGN YOUR FACE WITHIN THE FRAME</Text>
            <View style={s.camControls}>
              <TouchableOpacity onPress={() => setShowCamera(false)} style={s.camCancelBtn}>
                <Ionicons name="close" size={22} color="white" />
              </TouchableOpacity>
              <TouchableOpacity onPress={takePicture} style={s.camCaptureBtn}>
                <View style={s.camCaptureInner} />
              </TouchableOpacity>
              <View style={{ width: 52 }} />
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  // ── MAIN REGISTER FORM ──────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0f4ff" translucent={false} />
      {AlertComponent}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* ── LIGHT TOP HEADER ── */}
        <Animated.View style={[s.topHeader, { opacity: fadeIn }]}>
          <TouchableOpacity onPress={() => router.replace('/')} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color="#0f172a" />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>REGISTRATION</Text>
            <Text style={s.headerSub}>ENFORCER CREDENTIAL SYSTEM</Text>
          </View>
          <View style={{ width: 40 }} />
        </Animated.View>

        {/* ── DARK CARD (scrollable) ── */}
        <ScrollView
          style={s.darkCard}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Handle */}
          <View style={s.handle} />

          {/* ── SECTION 1: Face ── */}
          <View style={s.sectionRow}>
            <View style={s.sectionDot} />
            <Text style={s.sectionLabel}>FACE RECOGNITION DATA</Text>
          </View>

          <TouchableOpacity style={s.faceCard} onPress={() => setShowCamera(true)} activeOpacity={0.85}>
            <View style={[s.faceCircle, capturedImage && s.faceCircleCaptured]}>
              {capturedImage ? (
                <Image source={{ uri: capturedImage }} style={s.faceImage} />
              ) : (
                <Ionicons name="person-outline" size={36} color="rgba(255,255,255,0.3)" />
              )}
            </View>
            <View style={s.faceCameraBtn}>
              <Ionicons name="camera" size={14} color="white" />
            </View>
            <Text style={s.faceStatus}>
              {capturedImage ? '✓  PHOTO CAPTURED' : 'TAP TO SCAN FACE'}
            </Text>
          </TouchableOpacity>

          {/* ── SECTION 2: Account Details ── */}
          <View style={[s.sectionRow, { marginTop: 28 }]}>
            <View style={s.sectionDot} />
            <Text style={s.sectionLabel}>ACCOUNT DETAILS</Text>
          </View>

          {/* Fields */}
          {[
            { key: 'name',            label: 'FULL NAME',        placeholder: 'Lastname, Firstname M.I.',  caps: 'characters' as const, keyboard: 'default'        as const },
            { key: 'email',           label: 'EMAIL ADDRESS',    placeholder: 'enforcer@lto.gov.ph',       caps: 'none'       as const, keyboard: 'email-address'  as const },
            { key: 'district_office', label: 'DISTRICT OFFICE',  placeholder: 'LTO Dasmariñas District',   caps: 'words'      as const, keyboard: 'default'        as const },
            { key: 'badgeNo',         label: 'BADGE NUMBER',     placeholder: 'DASMA-000-2026',            caps: 'characters' as const, keyboard: 'default'        as const },
            { key: 'unit',            label: 'ASSIGNED UNIT',    placeholder: 'E.g. Unit 1',               caps: 'characters' as const, keyboard: 'default'        as const },
          ].map((field) => (
            <View key={field.key} style={s.fieldWrap}>
              <Text style={s.fieldLabel}>{field.label}</Text>
              <View style={[s.field, focusedField === field.key && s.fieldFocused]}>
                <TextInput
                  style={s.fieldInput}
                  placeholder={field.placeholder}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  autoCapitalize={field.caps}
                  keyboardType={field.keyboard}
                  returnKeyType="next"
                  onFocus={() => setFocusedField(field.key)}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={(val) => setFormData({ ...formData, [field.key]: val })}
                />
              </View>
            </View>
          ))}

          {/* Password */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>SECURITY PASSWORD</Text>
            <View style={[s.field, focusedField === 'password' && s.fieldFocused]}>
              <TextInput
                style={[s.fieldInput, { flex: 1 }]}
                placeholder="Minimum 6 characters"
                placeholderTextColor="rgba(255,255,255,0.2)"
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                onChangeText={(val) => setFormData({ ...formData, password: val })}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Register button */}
          <TouchableOpacity
            style={[s.registerBtn, loading && s.registerBtnLoading]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <View style={s.registerBtnInner}>
                <Ionicons name="shield-checkmark-outline" size={18} color="white" />
                <Text style={s.registerBtnText}>Register Enforcer</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelRow} onPress={() => router.replace('/')}>
            <Text style={s.cancelText}>Cancel Registration</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({

  root: { flex: 1, backgroundColor: '#f0f4ff' },

  // ── TOP HEADER: light ──────────────────────────────────
  topHeader: {
    backgroundColor:  '#f0f4ff',
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     20,
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
  },

  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    12,
    backgroundColor: 'rgba(15,23,42,0.06)',
    alignItems:      'center',
    justifyContent:  'center',
  },

  headerCenter: { alignItems: 'center' },

  headerTitle: {
    fontSize:      15,
    fontWeight:    '800',
    color:         '#0f172a',
    letterSpacing: 3,
    marginTop: 12,
  },

  headerSub: {
    fontSize:      9,
    fontWeight:    '600',
    color:         '#94a3b8',
    letterSpacing: 1.5,
    marginTop:     2,
  },

  // ── DARK CARD ─────────────────────────────────────────
  darkCard: {
    flex:                 1,
    backgroundColor:      '#0f172a',
    borderTopLeftRadius:  32,
    borderTopRightRadius: 32,
  },

  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom:     60,
  },

  handle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf:       'center',
    marginTop:       10,
    marginBottom:    28,
  },

  // ── SECTION HEADER ────────────────────────────────────
  sectionRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginBottom:  16,
  },

  sectionDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: '#3b82f6',
  },

  sectionLabel: {
    fontSize:      10,
    fontWeight:    '700',
    color:         '#3b82f6',
    letterSpacing: 1.5,
  },

  // ── FACE CAPTURE ──────────────────────────────────────
  faceCard: {
    backgroundColor:   'rgba(255,255,255,0.04)',
    borderRadius:      20,
    borderWidth:       1.5,
    borderColor:       'rgba(255,255,255,0.08)',
    alignItems:        'center',
    paddingVertical:   28,
    gap:               12,
  },

  faceCircle: {
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth:     2,
    borderColor:     'rgba(255,255,255,0.12)',
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },

  faceCircleCaptured: {
    borderColor: '#22c55e',
    borderWidth: 2.5,
  },

  faceImage: { width: '100%', height: '100%' },

  faceCameraBtn: {
    position:        'absolute',
    bottom:          55,
    right:           width / 2 - 66,
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: '#3b82f6',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     '#0f172a',
  },

  faceStatus: {
    fontSize:      10,
    fontWeight:    '700',
    color:         'rgba(255,255,255,0.4)',
    letterSpacing: 1,
    marginTop:     4,
  },

  // ── FIELDS ────────────────────────────────────────────
  fieldWrap:  { marginBottom: 14 },

  fieldLabel: {
    fontSize:      10,
    fontWeight:    '700',
    color:         'rgba(255,255,255,0.3)',
    letterSpacing: 0.8,
    marginBottom:  7,
    paddingLeft:   2,
  },

  field: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   'rgba(255,255,255,0.05)',
    borderRadius:      14,
    paddingHorizontal: 16,
    height:            52,
    borderWidth:       1.5,
    borderColor:       'rgba(255,255,255,0.07)',
  },

  fieldFocused: {
    borderColor:     '#3b82f6',
    backgroundColor: 'rgba(59,130,246,0.08)',
  },

  fieldInput: {
    flex:       1,
    fontSize:   14,
    fontWeight: '500',
    color:      'white',
  },

  eyeBtn: { padding: 4 },

  // ── REGISTER BUTTON ───────────────────────────────────
  registerBtn: {
    backgroundColor: '#3b82f6',
    height:          54,
    borderRadius:    14,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       28,
    marginBottom:    12,
    shadowColor:     '#3b82f6',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.4,
    shadowRadius:    12,
    elevation:       6,
  },

  registerBtnLoading: { backgroundColor: '#1e3a5f', shadowOpacity: 0, elevation: 0 },

  registerBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  registerBtnText: {
    color:         'white',
    fontSize:      15,
    fontWeight:    '600',
    letterSpacing: -0.2,
  },

  cancelRow: { alignItems: 'center', paddingVertical: 8 },

  cancelText: {
    fontSize:   13,
    fontWeight: '500',
    color:      'rgba(255,255,255,0.25)',
  },

  // ── CAMERA ────────────────────────────────────────────
  camOverlay: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  faceGuideOuter: {
    width:        240,
    height:       300,
    borderRadius: 120,
    borderWidth:  2,
    borderColor:  'rgba(59,130,246,0.5)',
    alignItems:   'center',
    justifyContent: 'center',
  },

  faceGuideInner: {
    width:        220,
    height:       280,
    borderRadius: 110,
    borderWidth:  1.5,
    borderColor:  '#3b82f6',
    borderStyle:  'dashed',
  },

  camHint: {
    marginTop:     24,
    fontSize:      10,
    fontWeight:    '700',
    color:         'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
  },

  camControls: {
    position:       'absolute',
    bottom:         50,
    flexDirection:  'row',
    width:          '100%',
    justifyContent: 'space-around',
    alignItems:     'center',
  },

  camCancelBtn: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.2)',
  },

  camCaptureBtn: {
    width:           76,
    height:          76,
    borderRadius:    38,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth:     3,
    borderColor:     'white',
    alignItems:      'center',
    justifyContent:  'center',
  },

  camCaptureInner: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: 'white',
  },
});