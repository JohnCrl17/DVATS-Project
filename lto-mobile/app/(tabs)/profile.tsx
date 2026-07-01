import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Platform,
  Animated,
} from 'react-native';

import { SafeAreaView }             from 'react-native-safe-area-context';
import { Ionicons }                 from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage                 from '@react-native-async-storage/async-storage';
import { IosAlert }                 from './CustomAlert';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface Officer {
  name:              string;
  badge_number:      string;
  unit:              string;
  profile_pic?:      string;
  email?:            string;
  has_fingerprint?:  boolean | number;
  has_facial?:       boolean | number;
}

// ─────────────────────────────────────────────────────────────
// SMALL REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconBox}>
        <Ionicons name={icon as any} size={16} color="#64748b" />
      </View>
      <View style={styles.infoTexts}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function SettingRow({
  icon,
  iconBg,
  iconColor,
  label,
  labelColor,
  onPress,
  showChevron = true,
}: {
  icon:          string;
  iconBg:        string;
  iconColor:     string;
  label:         string;
  labelColor?:   string;
  onPress:       () => void;
  showChevron?:  boolean;
}) {
  return (
    <TouchableOpacity style={styles.settingRow} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={icon as any} size={18} color={iconColor} />
        </View>
        <Text style={[styles.settingLabel, labelColor ? { color: labelColor } : {}]}>{label}</Text>
      </View>
      {showChevron && <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
// SHEET MODAL  (slides up like native iOS sheet)
// ─────────────────────────────────────────────────────────────
function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible:  boolean;
  onClose:  () => void;
  title:    string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={sheetStyles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={sheetStyles.sheet}>
          {/* Drag handle */}
          <View style={sheetStyles.handle} />
          <View style={sheetStyles.sheetHeader}>
            <Text style={sheetStyles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={sheetStyles.closeBtn}>
              <Ionicons name="close" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor:      'white',
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    24,
    paddingBottom:        40,
    shadowColor:          '#000',
    shadowOffset:         { width: 0, height: -4 },
    shadowOpacity:        0.08,
    shadowRadius:         16,
    elevation:            20,
  },
  handle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: '#e2e8f0',
    alignSelf:       'center',
    marginTop:       12,
    marginBottom:    16,
  },
  sheetHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   24,
  },
  sheetTitle:  { fontSize: 16, fontWeight: '600', color: '#0f172a', letterSpacing: -0.3 },
  closeBtn: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: '#f1f5f9',
    alignItems:      'center',
    justifyContent:  'center',
  },
});

// ─────────────────────────────────────────────────────────────
// PROFILE SCREEN
// ─────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();

  const [officer,           setOfficer]           = useState<Officer | null>(null);
  const [infoVisible,       setInfoVisible]       = useState(false);
  const [securityVisible,   setSecurityVisible]   = useState(false);
  const [qrVisible,         setQrVisible]         = useState(false);
  const [biometricVisible,  setBiometricVisible]  = useState(false);  // ← ADDED
  const [newPassword,       setNewPassword]       = useState('');
  const [updating,          setUpdating]          = useState(false);
  // Dagdag sa states mo sa taas
const [oldPassword, setOldPassword] = useState('');
const [showOld, setShowOld] = useState(false);
const [showNew, setShowNew] = useState(false);

  // ── Biometric status derived from officer data
  const hasFingerprint = !!(officer?.has_fingerprint);
  const hasFacial      = !!(officer?.has_facial);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const sessionData = await AsyncStorage.getItem('userSession');
          if (sessionData) {
            const user = JSON.parse(sessionData);
            setOfficer({
              name:             user.full_name        || 'OFFICER',
              badge_number:     user.badge_number     || 'N/A',
              unit:             user.unit             || 'N/A',
              profile_pic:      user.profile_pic,
              email:            user.email            || 'officer@dasma.gov.ph',
              has_fingerprint:  user.has_fingerprint,   // ← ADDED
              has_facial:       user.has_facial,         // ← ADDED
            });
          }
        } catch (e) {
          console.error('Failed to load profile', e);
        }
      };
      load();
    }, [])
  );

  const handleChangePassword = async () => {
    if (!officer?.badge_number) { IosAlert.alert('Error', 'Officer ID not found.'); return; }
    if (!oldPassword) { IosAlert.alert('Invalid', 'Please enter your current PIN.'); return; }
    if (newPassword.length < 6) { IosAlert.alert('Invalid', 'New PIN must be at least 6 digits.'); return; }

    setUpdating(true);
    try {
        const response = await fetch(
            'https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api/update_password.php',
            {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Accept': 'application/json', 
                    'ngrok-skip-browser-warning': 'true' 
                },
                body: JSON.stringify({ 
                    badge_number: officer.badge_number, 
                    old_password: oldPassword,  // ← DAGDAG
                    new_password: newPassword 
                }),
            }
        );
        const result = await response.json();
        if (result.status === 'success') {
            IosAlert.alert('Success', 'Security PIN updated!');
            setOldPassword('');
            setNewPassword('');
            setSecurityVisible(false);
        } else {
            IosAlert.alert('Error', result.message || 'Update failed.');
        }
    } catch {
        IosAlert.alert('System Error', 'Connection failed.');
    } finally {
        setUpdating(false);
    }
};

  const handleChangePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      IosAlert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const manipResult = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 400, height: 400 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!manipResult.base64) {
      IosAlert.alert('Error', 'Failed to process image.');
      return;
    }

    setUpdating(true);
    try {
      const controller = new AbortController();              // ✅ dineclare na
      const timeoutId  = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(
        'https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api/update_profile_pic.php',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({
            badge_number: officer?.badge_number,
            profile_pic:  manipResult.base64,
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      const text = await response.text();
      console.log('Raw response:', text);

      const result2 = JSON.parse(text);                     // ✅ parse once lang

      if (result2.status === 'success') {
        setOfficer(prev => prev ? { ...prev, profile_pic: manipResult.base64! } : prev);

        const session = await AsyncStorage.getItem('userSession');
        if (session) {
          const user = JSON.parse(session);
          user.profile_pic = manipResult.base64;
          await AsyncStorage.setItem('userSession', JSON.stringify(user));
        }

        IosAlert.alert('Success', 'Profile photo updated!');
      } else {
        IosAlert.alert('Error', result2.message || 'Upload failed.');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        IosAlert.alert('Timeout', 'Upload took too long. Please try again.');
      } else {
        IosAlert.alert('Error', 'Connection failed. Please try again.');
      }
      console.error('Upload error:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => {
    IosAlert.alert(
      'Sign Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text:    'Sign Out',
          style:   'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('userSession');
              setTimeout(() => {
                router.replace({ pathname: '/' });
              }, 250); // ← hintayin muna mag-close ang alert modal
            } catch (e) {
              console.log('Logout Error:', e);
            }
          },
        },
      ]
    );
  };

  const initials = officer?.name
    ? officer.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '—';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f2f2f7" />

      {/* ── HEADER ── */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/dashboard')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── AVATAR CARD ── */}
        <View style={styles.avatarCard}>
          <TouchableOpacity style={styles.avatarWrap} onPress={handleChangePhoto} activeOpacity={0.8}>
            {officer?.profile_pic ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${officer.profile_pic}` }}
                style={styles.avatarImg}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            {/* ✅ Camera icon overlay */}
            <View style={styles.cameraBtn}>
              {updating ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="camera" size={13} color="white" />
              )}
            </View>
          </TouchableOpacity>

          <Text style={styles.officerName}>{officer?.name?.toUpperCase() || 'LOADING...'}</Text>

          <View style={styles.pillRow}>
            <View style={styles.infoPill}>
              <Ionicons name="id-card-outline" size={11} color="#007aff" />
              <Text style={styles.infoPillText}>{officer?.badge_number || '—'}</Text>
            </View>
            <View style={styles.infoPillDot} />
            <View style={styles.infoPill}>
              <Ionicons name="business-outline" size={11} color="#007aff" />
              <Text style={styles.infoPillText}>Unit {officer?.unit || '—'}</Text>
            </View>
          </View>

          {/* Quick actions */}
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickBtn} onPress={() => setQrVisible(true)}>
              <Ionicons name="qr-code-outline" size={18} color="#007aff" />
              <Text style={styles.quickLabel}>Digital Badge</Text>
            </TouchableOpacity>
            <View style={styles.quickDivider} />
            <TouchableOpacity style={styles.quickBtn} onPress={() => setInfoVisible(true)}>
              <Ionicons name="person-outline" size={18} color="#007aff" />
              <Text style={styles.quickLabel}>Details</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── SETTINGS ── */}
        <SectionHeader label="Security" />
        <View style={styles.settingsCard}>
          <SettingRow
            icon="lock-closed-outline"
            iconBg="#fff7ed"
            iconColor="#ea580c"
            label="Change Security PIN"
            onPress={() => setSecurityVisible(true)}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="finger-print-outline"
            iconBg="#f0fdf4"
            iconColor="#22c55e"
            label="Biometric Auth"
            onPress={() => setBiometricVisible(true)}   // ← FIXED: hindi na blangko
          />
        </View>

        <SectionHeader label="Account" />
        <View style={styles.settingsCard}>
          <SettingRow
            icon="power-outline"
            iconBg="#fef2f2"
            iconColor="#ef4444"
            label="Sign Out"
            labelColor="#ef4444"
            onPress={handleLogout}
            showChevron={false}
          />
        </View>

        <Text style={styles.version}>DVATS Enforcer Terminal v1.0 · 2026</Text>
      </ScrollView>

      {/* ── INFO SHEET ── */}
      <Sheet visible={infoVisible} onClose={() => setInfoVisible(false)} title="Officer Information">
        <InfoRow icon="person-outline"   label="Full Name" value={officer?.name        || '—'} />
        <InfoRow icon="id-card-outline"  label="Badge No." value={officer?.badge_number || '—'} />
        <InfoRow icon="business-outline" label="District"  value={`Dasmariñas Unit · ${officer?.unit || '—'}`} />
        <InfoRow icon="mail-outline"     label="Email"     value={officer?.email        || '—'} />
      </Sheet>

      {/* ── SECURITY SHEET ── */}
      <Sheet visible={securityVisible} onClose={() => {
          setSecurityVisible(false);
          setOldPassword('');
          setNewPassword('');
      }} title="Change Security PIN">

          <Text style={styles.sheetHint}>Enter your current PIN then set a new one.</Text>

          {/* Current PIN */}
          <Text style={styles.inputLabel}>Current PIN</Text>
          <View style={styles.inputWrap}>
              <TextInput
                  style={styles.inputInner}
                  placeholder="Current PIN"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showOld}
                  keyboardType="numeric"
                  maxLength={8}
                  value={oldPassword}
                  onChangeText={setOldPassword}
              />
              <TouchableOpacity onPress={() => setShowOld(p => !p)} style={styles.eyeBtn}>
                  <Ionicons name={showOld ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94a3b8" />
              </TouchableOpacity>
          </View>

          {/* New PIN */}
          <Text style={[styles.inputLabel, { marginTop: 12 }]}>New PIN</Text>
          <View style={styles.inputWrap}>
              <TextInput
                  style={styles.inputInner}
                  placeholder="min. 6 digits PIN"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showNew}
                  keyboardType="numeric"
                  maxLength={8}
                  value={newPassword}
                  onChangeText={setNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNew(p => !p)} style={styles.eyeBtn}>
                  <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94a3b8" />
              </TouchableOpacity>
          </View>

          <TouchableOpacity
              style={[styles.confirmBtn, { marginTop: 20 }, updating && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={updating}
              activeOpacity={0.8}
          >
              {updating
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.confirmBtnText}>Update PIN</Text>
              }
          </TouchableOpacity>
      </Sheet>

      {/* ── QR SHEET ── */}
      <Sheet visible={qrVisible} onClose={() => setQrVisible(false)} title="Digital Badge">
        <View style={styles.qrWrap}>
          <View style={styles.qrBox}>
            <Ionicons name="qr-code" size={140} color="#0f172a" />
          </View>
          <Text style={styles.qrName}>{officer?.name?.toUpperCase()}</Text>
          <Text style={styles.qrSub}>Dasmariñas City Traffic Management</Text>
        </View>
      </Sheet>

      {/* ── BIOMETRIC SHEET ── */}
      <Sheet visible={biometricVisible} onClose={() => setBiometricVisible(false)} title="Biometric Auth">
        <Text style={styles.sheetHint}>
          Biometric methods registered for this enforcer account.
        </Text>

        {/* Fingerprint Row */}
        <View style={bioStyles.row}>
          <View style={[bioStyles.iconBox, { backgroundColor: hasFingerprint ? '#f0fdf4' : '#f8fafc' }]}>
            <Ionicons
              name="finger-print-outline"
              size={34}
              color={hasFingerprint ? '#22c55e' : '#cbd5e1'}
            />
          </View>
          <View style={bioStyles.textBox}>
            <Text style={bioStyles.label}>Fingerprint</Text>
            <View style={bioStyles.badgeRow}>
              <View style={[bioStyles.badge, { backgroundColor: hasFingerprint ? '#dcfce7' : '#fee2e2' }]}>
                <Ionicons
                  name={hasFingerprint ? 'checkmark-circle' : 'close-circle'}
                  size={12}
                  color={hasFingerprint ? '#16a34a' : '#dc2626'}
                />
                <Text style={[bioStyles.badgeText, { color: hasFingerprint ? '#16a34a' : '#dc2626' }]}>
                  {hasFingerprint ? 'Registered' : 'Not Registered'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Facial Recognition Row */}
        <View style={bioStyles.row}>
          <View style={[bioStyles.iconBox, { backgroundColor: hasFacial ? '#f0fdf4' : '#f8fafc' }]}>
            <Ionicons
              name="scan-outline"
              size={34}
              color={hasFacial ? '#22c55e' : '#cbd5e1'}
            />
          </View>
          <View style={bioStyles.textBox}>
            <Text style={bioStyles.label}>Facial Recognition</Text>
            <View style={bioStyles.badgeRow}>
              <View style={[bioStyles.badge, { backgroundColor: hasFacial ? '#dcfce7' : '#fee2e2' }]}>
                <Ionicons
                  name={hasFacial ? 'checkmark-circle' : 'close-circle'}
                  size={12}
                  color={hasFacial ? '#16a34a' : '#dc2626'}
                />
                <Text style={[bioStyles.badgeText, { color: hasFacial ? '#16a34a' : '#dc2626' }]}>
                  {hasFacial ? 'Registered' : 'Not Registered'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Note kung wala pang registered */}
        {(!hasFingerprint || !hasFacial) && (
          <View style={bioStyles.noteBox}>
            <Ionicons name="information-circle-outline" size={15} color="#64748b" />
            <Text style={bioStyles.noteText}>
              Contact your administrator to register missing biometric data.
            </Text>
          </View>
        )}
      </Sheet>

    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// BIOMETRIC STYLES
// ─────────────────────────────────────────────────────────────
const bioStyles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               16,
    paddingVertical:   18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.1)',
  },
  iconBox: {
    width:          64,
    height:         64,
    borderRadius:   18,
    alignItems:     'center',
    justifyContent: 'center',
  },
  textBox:   { flex: 1 },
  label:     { fontSize: 15, fontWeight: '600', color: '#1e293b', marginBottom: 6 },
  badgeRow:  { flexDirection: 'row' },
  badge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:    20,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  noteBox: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             8,
    marginTop:       20,
    backgroundColor: '#f8fafc',
    borderRadius:    10,
    padding:         12,
  },
  noteText: { flex: 1, fontSize: 12, color: '#64748b', lineHeight: 17 },
});

// ─────────────────────────────────────────────────────────────
// STYLES — modern minimalist, iOS system palette
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },

  // ── header
  headerSafe: { backgroundColor: '#f2f2f7' },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.18)',
  },
  backBtn: {
    width:           38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(60,60,67,0.08)',
    alignItems:      'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1e293b', letterSpacing: -0.3 },

  // ── scroll
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48 },

  // ── avatar card
  avatarCard: {
    backgroundColor: 'white',
    borderRadius:    20,
    paddingVertical: 28,
    alignItems:      'center',
    marginBottom:    28,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    6,
    elevation:        2,
  },
  avatarWrap:     { position: 'relative', marginBottom: 14 },
  avatarImg:      { width: 86, height: 86, borderRadius: 28 },
  avatarFallback: {
    width: 86, height: 86, borderRadius: 28,
    backgroundColor: '#007aff',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: 30, fontWeight: '700', color: 'white', letterSpacing: -0.5 },
  onlineDot: {
    position:        'absolute', bottom: 2, right: 2,
    width:           14, height: 14, borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth:     2.5, borderColor: 'white',
  },

  officerName: { fontSize: 18, fontWeight: '700', color: '#0f172a', letterSpacing: -0.3, marginBottom: 8 },

  pillRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22 },
  infoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  infoPillText:  { fontSize: 11, fontWeight: '600', color: '#007aff' },
  infoPillDot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1' },

  quickRow: {
    flexDirection:   'row',
    width:           '88%',
    borderTopWidth:  StyleSheet.hairlineWidth,
    borderTopColor:  'rgba(60,60,67,0.12)',
    paddingTop:      18,
  },
  quickBtn:     { flex: 1, alignItems: 'center', gap: 6 },
  quickLabel:   { fontSize: 12, fontWeight: '500', color: '#007aff' },
  quickDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(60,60,67,0.12)' },

  // ── section header
  sectionHeader: {
    fontSize:        12,
    fontWeight:      '600',
    color:           '#94a3b8',
    letterSpacing:   0.4,
    marginBottom:    8,
    paddingLeft:     4,
    textTransform:   'uppercase',
  },

  // ── settings card
  settingsCard: {
    backgroundColor: 'white',
    borderRadius:    16,
    marginBottom:    28,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.04,
    shadowRadius:    4,
    elevation:        2,
  },
  settingRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  settingLeft:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
  settingIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel:  { fontSize: 15, fontWeight: '500', color: '#1e293b' },
  rowDivider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60,60,67,0.1)',
    marginLeft:      66,
  },

  // Dagdag sa loob ng StyleSheet.create:
cameraBtn: {
  position:        'absolute',
  bottom:          0,
  right:           0,
  width:           28,
  height:          28,
  borderRadius:    14,
  backgroundColor: '#007aff',
  alignItems:      'center',
  justifyContent:  'center',
  borderWidth:     2.5,
  borderColor:     'white',
  elevation:       4,
},

  // ── version
  version: { textAlign: 'center', fontSize: 11, color: '#cbd5e1', marginTop: 8 },

  // ── sheet internals (info rows)
  infoRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               14,
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.1)',
  },
  infoIconBox: {
    width:           36, height: 36, borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems:      'center', justifyContent: 'center',
  },
  infoTexts:  {},
  infoLabel:  { fontSize: 11, color: '#94a3b8', fontWeight: '500', marginBottom: 2 },
  infoValue:  { fontSize: 14, fontWeight: '600', color: '#1e293b' },

  // ── security sheet
  sheetHint:  { fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 18 },
  input: {
    backgroundColor:   '#f8fafc',
    borderWidth:       1,
    borderColor:       '#e2e8f0',
    borderRadius:      12,
    paddingHorizontal: 16,
    paddingVertical:   14,
    fontSize:          16,
    fontWeight:        '600',
    color:             '#1e293b',
    marginBottom:      16,
    letterSpacing:     4,
  },
  confirmBtn: {
    backgroundColor: '#007aff',
    borderRadius:    12,
    paddingVertical:  15,
    alignItems:      'center',
  },
  confirmBtnText: { color: 'white', fontWeight: '600', fontSize: 15, letterSpacing: -0.2 },

  // ── QR sheet
  qrWrap:  { alignItems: 'center', paddingBottom: 8 },
  qrBox: {
    backgroundColor: '#f8fafc',
    padding:         20,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     '#e2e8f0',
    marginBottom:    16,
  },
  qrName:  { fontSize: 15, fontWeight: '700', color: '#0f172a', letterSpacing: -0.2, marginBottom: 4 },
  qrSub:   { fontSize: 12, color: '#94a3b8', fontWeight: '500' },

  inputLabel: { 
    fontSize: 11, fontWeight: '600', 
    color: '#94a3b8', marginBottom: 6, 
    letterSpacing: 0.3, textTransform: 'uppercase' 
},
inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 16,
},
inputInner: {
    flex: 1, paddingVertical: 14,
    fontSize: 16, fontWeight: '600',
    color: '#1e293b', letterSpacing: 4,
},
eyeBtn: { 
    padding: 4 
},
});