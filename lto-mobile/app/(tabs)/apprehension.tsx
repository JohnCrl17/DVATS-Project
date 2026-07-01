import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView,
  ActivityIndicator, Animated, Dimensions, TextInput
} from 'react-native';
import { SafeAreaView }          from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter }             from 'expo-router';
import { useFocusEffect }        from '@react-navigation/native';
import { useIsFocused }          from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage              from '@react-native-async-storage/async-storage';
import * as LocalAuthentication  from 'expo-local-authentication';
import * as ImageManipulator     from 'expo-image-manipulator';
import * as ImagePicker          from 'expo-image-picker';
import { Image }                 from 'react-native';
import { IosAlert }              from './CustomAlert';

const API_BASE_URL = 'https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api';

interface MasterViolation {
  id: string;
  ordinance_no: string;
  violation_name: string;
  first_offense: string;
  second_offense: string;
  third_offense: string;
}

const STEP_LABELS    = ['License', 'QR Verify', 'Evidence', 'ID Proof', 'Auth', 'Ticket'];
const STEP_TITLES    = ['', 'License OCR Scan', 'QR Code Verification', 'Violation Evidence', 'Enforcer Identity Proof', 'Officer Authorization', 'Issue Ticket'];
const STEP_SUBTITLES = ['', 'Point camera at driver\'s license', 'Scan driver\'s DVATS QR code', 'Take photo of violator and vehicle', 'Verify your identity as the arresting officer', 'Biometric sign-off required', 'Review and confirm violations'];

function StepIndicator({ current }: { current: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={si.wrap}>
      {[1, 2, 3, 4, 5, 6].map((s, i) => (
        <React.Fragment key={s}>
          <View style={si.item}>
            <View style={[si.circle, current > s && si.done, current === s && si.active]}>
              {current > s
                ? <Ionicons name="checkmark" size={10} color="white" />
                : <Text style={[si.num, current === s && { color: 'white' }]}>{s}</Text>
              }
            </View>
            <Text style={[si.label, current === s && si.labelActive]}>{STEP_LABELS[i]}</Text>
          </View>
          {i < 5 && <View style={[si.line, current > s && si.lineDone]} />}
        </React.Fragment>
      ))}
    </ScrollView>
  );
}

const si = StyleSheet.create({
  wrap:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 28 },
  item:        { alignItems: 'center', gap: 4 },
  circle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  active:      { backgroundColor: '#007aff', borderColor: '#007aff' },
  done:        { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  num:         { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  label:       { fontSize: 9,  fontWeight: '500', color: '#94a3b8', letterSpacing: 0.2 },
  labelActive: { color: '#007aff', fontWeight: '700' },
  line:        { flex: 1, height: 1.5, backgroundColor: '#e2e8f0', marginBottom: 14, marginHorizontal: 4 },
  lineDone:    { backgroundColor: '#22c55e' },
});

function SectionLabel({ text }: { text: string }) {
  return <Text style={sl.text}>{text}</Text>;
}
const sl = StyleSheet.create({
  text: { fontSize: 11, fontWeight: '600', color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
});

export default function ApprehensionScreen() {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef  = useRef<any>(null);
  const router     = useRouter();

  const [isCameraActive,    setIsCameraActive]    = useState(true);
  const [currentStep,       setCurrentStep]       = useState(1);
  const [enforcerBadge,     setEnforcerBadge]     = useState('');
  const [enforcerName,      setEnforcerName]      = useState('');
  const [loading,           setLoading]           = useState(false);
  const [scanning,          setScanning]          = useState(false);
  const [supervisorPin,     setSupervisorPin]     = useState('');
  const [driverName,        setDriverName]        = useState('');
  const [licenseNo,         setLicenseNo]         = useState('NOT DETECTED');
  const [clientId,          setClientId]          = useState<string | null>(null);
  const [capturedLicenseUri,setCapturedLicenseUri]= useState<string | null>(null);
  const [capturedUri,       setCapturedUri]       = useState<string | null>(null);
  const [qrScanned,         setQrScanned]         = useState(false);
  const [qrResult,          setQrResult]          = useState<'matched' | 'failed' | null>(null);
  const [isDriverRegistered,setIsDriverRegistered]= useState(false);
  const [driverEmail,       setDriverEmail]       = useState('');
  const [driverPhone,       setDriverPhone]       = useState('');
  const [searchQuery,       setSearchQuery]       = useState('');
  const [selectedViolations,setSelectedViolations]= useState<MasterViolation[]>([]);
  const [offenseLevel,      setOffenseLevel]      = useState<'first'|'second'|'third'>('first');
  const [cameraKey,         setCameraKey]         = useState(0);

  // Step 3
  const [violationPhotoUri, setViolationPhotoUri] = useState<string | null>(null);
  const [violationPhotoUrl, setViolationPhotoUrl] = useState<string | null>(null);
  const violationCameraRef = useRef<any>(null);

  // Step 4
  const [enforcerProofUri,  setEnforcerProofUri]  = useState<string | null>(null);
  const [enforcerProofUrl,  setEnforcerProofUrl]  = useState<string | null>(null);
  const [proofType,         setProofType]         = useState<'face_verified' | 'manual_photo' | null>(null);
  const [faceVerified,      setFaceVerified]      = useState(false);
  const [faceAttempts,      setFaceAttempts]      = useState(0);
  const [faceVerifying,     setFaceVerifying]     = useState(false);
  const [showManualFallback,setShowManualFallback]= useState(false);
  const enforcerCameraRef  = useRef<any>(null);

  // Master violations from database
  const [masterViolations, setMasterViolations] = useState<MasterViolation[]>([]);
  const [violationsLoaded, setViolationsLoaded] = useState(false);

  const scanAnim  = useRef(new Animated.Value(0)).current;
  const scanAnim2 = useRef(new Animated.Value(0)).current;

  // ─── FETCH VIOLATIONS FROM DATABASE ───
  useEffect(() => {
    const fetchViolations = async () => {
      try {
        const url = `${API_BASE_URL}/master_violations_api.php?action=read`;
        console.log('Fetching violations from:', url);
        
        const response = await fetch(url, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'Accept': 'application/json'
          }
        });
        
        const textResponse = await response.text();
        console.log('Raw response (first 200 chars):', textResponse.substring(0, 200));
        
        const result = JSON.parse(textResponse);
        
        if (result.status === 'success' && result.data) {
          setMasterViolations(result.data);
          setViolationsLoaded(true);
        } else {
          console.log('API error:', result.message || 'Unknown');
          setMasterViolations([]);
          setViolationsLoaded(true);
        }
      } catch (error) {
        console.error('Fetch violations error:', error);
        setMasterViolations([]);
        setViolationsLoaded(true);
      }
    };

    fetchViolations();
  }, []);

  useEffect(() => {
    if (currentStep === 2 && !qrScanned) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim2, { toValue: 180, duration: 1500, useNativeDriver: true }),
          Animated.timing(scanAnim2, { toValue: 0,   duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scanAnim2.setValue(0);
    }
  }, [currentStep, qrScanned]);

  const resetAllStates = () => {
    setCurrentStep(1); setDriverName(''); setLicenseNo('NOT DETECTED');
    setClientId(null); setQrScanned(false); setQrResult(null);
    setSelectedViolations([]); setDriverEmail(''); setDriverPhone('');
    setSearchQuery(''); setOffenseLevel('first');
    setCapturedUri(null); setCapturedLicenseUri(null);
    setScanning(false); setLoading(false); setIsCameraActive(true);
    setViolationPhotoUri(null); setViolationPhotoUrl(null);
    setEnforcerProofUri(null);  setEnforcerProofUrl(null);
    setProofType(null); setFaceVerified(false);
    setFaceAttempts(0); setFaceVerifying(false);
    setShowManualFallback(false);
    setTimeout(() => setCameraKey(prev => prev + 1), 300);
  };

  const uploadPhoto = async (base64: string, type: 'violation' | 'proof'): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}/upload_photo.php`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body:    JSON.stringify({ image: base64, type }),
      });
      const result = await res.json();
      if (result.status === 'success') return result.url;
      return null;
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  const verifyFace = async (photoUri: string) => {
    setFaceVerifying(true);
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        photoUri, [{ resize: { width: 400 } }],
        { base64: true, compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );
      const res = await fetch(`${API_BASE_URL}/face_login.php`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body:    JSON.stringify({ badge_number: enforcerBadge, selfie: manipResult.base64 }),
      });
      const result = await res.json();
      if (result.status === 'success') {
        const url = await uploadPhoto(manipResult.base64!, 'proof');
        setEnforcerProofUri(photoUri);
        setEnforcerProofUrl(url);
        setProofType('face_verified');
        setFaceVerified(true);
        IosAlert.alert('Identity Verified', 'Face recognized successfully.', [{
          text: 'Continue',
          onPress: () => setCurrentStep(5)
        }]);
      } else {
        const newAttempts = faceAttempts + 1;
        setFaceAttempts(newAttempts);
        if (newAttempts >= 3) {
          setShowManualFallback(true);
          IosAlert.alert(
            'Face Verification Failed',
            'Unable to verify your face after 3 attempts. Please upload a photo as manual proof.',
            [{ text: 'OK' }]
          );
        } else {
          IosAlert.alert('Not Recognized', `Face not recognized. Attempt ${newAttempts} of 3.`, [{ text: 'Try Again' }]);
        }
      }
    } catch (err) {
      console.error('Face verify error:', err);
      IosAlert.alert('Error', 'Face verification failed. Please try again.');
    } finally {
      setFaceVerifying(false);
    }
  };

  const captureViolationPhoto = async () => {
    if (!violationCameraRef.current) {
      IosAlert.alert('Camera Error', 'Camera is not ready. Please wait a moment and try again.');
      return;
    }
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const photo = await violationCameraRef.current.takePictureAsync({ quality: 0.5 });
      const manipResult = await ImageManipulator.manipulateAsync(
        photo.uri, [{ resize: { width: 800 } }],
        { base64: true, compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );
      setViolationPhotoUri(photo.uri);
      setLoading(true);
      const url = await uploadPhoto(manipResult.base64!, 'violation');
      setViolationPhotoUrl(url);
      setLoading(false);
    } catch (err) {
      console.error('Violation photo error:', err);
      IosAlert.alert('Error', 'Failed to capture photo. Please try again.');
      setLoading(false);
    }
  };

  const captureEnforcerSelfie = async () => {
    if (!enforcerCameraRef.current) return;
    try {
      const photo = await enforcerCameraRef.current.takePictureAsync({ quality: 0.5 });
      await verifyFace(photo.uri);
    } catch (err) {
      console.error('Enforcer selfie error:', err);
      IosAlert.alert('Error', 'Failed to capture selfie. Please try again.');
    }
  };

  const pickManualProof = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const manipResult = await ImageManipulator.manipulateAsync(
        uri, [{ resize: { width: 600 } }],
        { base64: true, compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );
      setLoading(true);
      const url = await uploadPhoto(manipResult.base64!, 'proof');
      setEnforcerProofUri(uri);
      setEnforcerProofUrl(url);
      setProofType('manual_photo');
      setLoading(false);
    }
  };

  const takeManualProofPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const manipResult = await ImageManipulator.manipulateAsync(
        uri, [{ resize: { width: 600 } }],
        { base64: true, compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );
      setLoading(true);
      const url = await uploadPhoto(manipResult.base64!, 'proof');
      setEnforcerProofUri(uri);
      setEnforcerProofUrl(url);
      setProofType('manual_photo');
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      resetAllStates();
      return () => { setIsCameraActive(true); };
    }, [])
  );

  useEffect(() => {
    if (!permission?.granted) requestPermission();
    const getEnforcer = async () => {
      const session = await AsyncStorage.getItem('userSession');
      if (session) {
        const user = JSON.parse(session);
        setEnforcerBadge(user.badge_number || '');
        setEnforcerName(user.full_name || 'Officer');
      }
    };
    getEnforcer();
  }, [permission]);

  useEffect(() => {
    const getSupervisorPin = async () => {
      try {
        const res  = await fetch(`${API_BASE_URL}/get_supervisor_pin.php`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
        const data = await res.json();
        if (data.status === 'success') setSupervisorPin(data.pin);
      } catch (err) { console.error('PIN fetch error:', err); }
    };
    getSupervisorPin();
  }, []);

  const performOCR = async (photoUri: string) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        photoUri, [{ resize: { width: 1200 } }],
        { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
      );
      const base64WithPrefix = `data:image/jpeg;base64,${manipResult.base64}`;
      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `apikey=K82464329788957&base64Image=${encodeURIComponent(base64WithPrefix)}&language=eng&OCREngine=2`
      });
      const ocrResult = await response.json();
      const rawText = ocrResult.ParsedResults?.[0]?.ParsedText || '';
      const licenseMatch = rawText.match(/([A-Z0-9]{2,3}[-\s]?[0-9]{2}[-\s]?[A-Z0-9]{5,7})/);
      let license = licenseMatch ? licenseMatch[1].toUpperCase().replace(/\s/g, '-') : null;
      const invalidKeywords = ['last name','first name','middle name','republic','department','license','address','expiration','nationality','driver\'s license','signature','agency code'];
      const lines = rawText.split('\n');
      let name = null;
      for (let line of lines) {
        const clean = line.trim(), lower = clean.toLowerCase();
        const isInvalid = invalidKeywords.some(k => lower.includes(k));
        if (!isInvalid && clean.includes(',') && clean.split(',').length === 2 && clean.length >= 8 && clean.length <= 40) { name = clean; break; }
      }
      return { license: license || null, name: name || null };
    } catch (err) { console.error('OCR ERROR:', err); return { license: null, name: null }; }
  };

  const searchDatabase = async (licenseToSearch: string, ocrName: string | null = null): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/search_driver.php?license_no=${encodeURIComponent(licenseToSearch)}`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      const text = await response.text();
      if (!text.trim().startsWith('{')) throw new Error('Invalid JSON: ' + text);
      const result = JSON.parse(text);
      if (result.status === 'success') {
        const nameFromDb = result.data.full_name?.trim() || result.data.fullname?.trim() || 'UNKNOWN DRIVER';
        setDriverName(nameFromDb);
        setLicenseNo(result.data.verified_license || licenseToSearch);
        setClientId(result.data.client_id);
        setIsDriverRegistered(true);
        setIsCameraActive(false);
        setTimeout(() => {
          setCurrentStep(2);
          setCameraKey(prev => prev + 1);
          setTimeout(() => setIsCameraActive(true), 800);
        }, 100);
      } else {
          const cleanOcrName = ocrName && ocrName.trim().length > 3 ? ocrName.trim() : null;
          setDriverName(cleanOcrName || licenseToSearch);
          setLicenseNo(licenseToSearch);
          setIsDriverRegistered(false);
          // Force camera remount
          setIsCameraActive(false);
          setCameraKey(prev => prev + 1);
          setCurrentStep(3);
          setTimeout(() => setIsCameraActive(true), 600);
      }
    } catch (error) {
      console.log('SEARCH ERROR:', error);
      Alert.alert('Error', 'Database response invalid. Check logs.');
    } finally { setLoading(false); }
  };

  const onQRScanned = ({ data }: { data: string }) => {
    if (qrScanned) return;
    setQrScanned(true);
    const scannedLicense = data.trim().toUpperCase();
    const currentLicense = licenseNo.trim().toUpperCase();
    if (scannedLicense === currentLicense) {
      setQrResult('matched');
      IosAlert.alert('Identity Verified', 'QR Code matched with license number.', [{ 
        text: 'Proceed', 
        onPress: () => {
          setCurrentStep(3);
          setCameraKey(prev => prev + 1);
        }
      }]);
    } else {
      setQrResult('failed');
      IosAlert.alert(
        'QR Mismatch',
        `QR Code does not match.\n\nExpected: ${currentLicense}\nScanned: ${scannedLicense}`,
        [
          { text: 'Try Again', onPress: () => { setQrScanned(false); setQrResult(null); } },
          {
            text: 'Supervisor Override', style: 'destructive',
            onPress: () => {
              IosAlert.prompt('Supervisor Override', 'Enter supervisor PIN to proceed:', (pin) => {
                if (pin === supervisorPin) {
                  setQrResult('matched');
                  setCurrentStep(3);
                  setCameraKey(prev => prev + 1);
                } else {
                  IosAlert.alert('Wrong PIN', 'Cannot proceed without proper verification.');
                  setQrScanned(false); setQrResult(null);
                }
              }, 'secure-text');
            }
          }
        ]
      );
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5 });
    if (!result.canceled) {
      setScanning(true);
      const uri = result.assets[0].uri;
      setCapturedLicenseUri(uri);
      const ocrData = await performOCR(uri);
      setScanning(false);
      if (ocrData.license) searchDatabase(ocrData.license);
      else IosAlert.alert('Error', 'Could not detect license in image.');
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!cameraRef.current) return;
      setScanning(true);
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 200, duration: 1500, useNativeDriver: true }),
          Animated.timing(scanAnim, { toValue: 0,   duration: 1500, useNativeDriver: true }),
        ])
      ).start();
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
        setCapturedUri(photo.uri);
        const result = await performOCR(photo.uri);
        setScanning(false); setCapturedUri(null);
        scanAnim.stopAnimation(); scanAnim.setValue(0);
        if (result.license) {
          setCapturedLicenseUri(photo.uri);
          const safeName = result.name && result.name.trim().length > 3 ? result.name.trim() : null;
          searchDatabase(result.license, safeName);
        } else {
          setCapturedLicenseUri(null);
          IosAlert.alert('License Not Found', 'Could not detect license number. Make sure the card is clear and well-lit.', [{ text: 'Try Again' }]);
        }
      } catch (err) {
        console.error('Step 1 error:', err);
        setScanning(false); setCapturedUri(null);
        scanAnim.stopAnimation(); scanAnim.setValue(0);
        IosAlert.alert('Error', 'Camera capture failed. Please try again.');
      }
    } else if (currentStep === 2) {
      IosAlert.alert('Scan QR Code', 'Please ask the driver to show their DVATS portal QR code, then point the camera at it.');
    } else if (currentStep === 3) {
      if (!violationPhotoUri) {
        IosAlert.alert('Photo Required', 'Please take a photo of the violator and vehicle before proceeding.');
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 4) {
      if (!enforcerProofUri) {
        IosAlert.alert('Proof Required', 'Please verify your identity before proceeding.');
        return;
      }
      setCurrentStep(5);
    } else if (currentStep === 5) {
      const biometricAuth = await LocalAuthentication.authenticateAsync({
        promptMessage: `Authenticate Officer ${enforcerName}`,
        disableDeviceFallback: false
      });
      if (biometricAuth.success) setCurrentStep(6);
      else IosAlert.alert('Auth Failed', 'Biometric authentication required to proceed.');
    } else if (currentStep === 6) {
      if (selectedViolations.length === 0) {
        IosAlert.alert('Warning', 'Please select at least one violation.');
        return;
      }
      IosAlert.alert('Confirm Ticket', `Issue violation ticket to ${driverName}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => submitApprehension() }
      ]);
    }
  };

  const submitApprehension = async () => {
    if (!isDriverRegistered) {
      if (!driverEmail || !driverPhone) { IosAlert.alert('Missing Information', 'Please provide both Email and Phone Number for unregistered drivers.'); return; }
      if (driverPhone.length < 11) { IosAlert.alert('Invalid Phone', 'Please enter a valid 11-digit phone number.'); return; }
    }
    setLoading(true);
    const totalFine = selectedViolations.reduce((sum, v) => {
      if (offenseLevel === 'first') return sum + Number(v.first_offense || 0);
      if (offenseLevel === 'second') return sum + Number(v.second_offense || 0);
      if (offenseLevel === 'third') return sum + Number(v.third_offense || 0);
      return sum;
    }, 0);
    const violationNames = selectedViolations.map(v => v.violation_name).join(', ');
    
    const payload = {
      driver_name:      isDriverRegistered ? driverName : licenseNo,
      license_no:       licenseNo || 'NOT DETECTED',
      violation_types:  violationNames,
      penalty_amount:   totalFine,
      offense_level:    offenseLevel,
      badge_number:     enforcerBadge,
      driver_email:     !isDriverRegistered ? driverEmail : '',
      driver_phone:     !isDriverRegistered ? driverPhone : '',
      is_registered:    isDriverRegistered ? 1 : 0,
      client_id:        clientId,
      violation_photo:  violationPhotoUrl  || '',
      enforcer_proof:   enforcerProofUrl   || '',
      proof_type:       proofType          || '',
    };
    try {
      const response   = await fetch(`${API_BASE_URL}/add_violation.php`, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }, body: JSON.stringify(payload) });
      const jsonResult = await response.json();
      if (jsonResult.status === 'success') {
        if (!isDriverRegistered && driverEmail) {
          try {
            await fetch(`${API_BASE_URL}/send_registration.php`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email:          driverEmail,
                license_no:     licenseNo,
                ticket_no:      jsonResult.ticket_no,
                violation_name: violationNames,
                fine_amount:    totalFine
              })
            });
          } catch {}
        }
        if (!isDriverRegistered && driverPhone) {
          const formattedPhone = driverPhone.startsWith('0') ? '+63' + driverPhone.slice(1) : driverPhone;
          try {
            const smsMessage = `OFFICIAL NOTICE: LTO Dasmariñas. Ticket No: ${jsonResult.ticket_no}. License: ${licenseNo}. Total Fine: ₱${totalFine}. Settle at https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api/driver-portal/index.html - DVATS`;
            await fetch(`${API_BASE_URL}/send_sms.php`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }, body: JSON.stringify({ number: formattedPhone, message: smsMessage }) });
          } catch (smsErr) { console.error('SMS Error:', smsErr); }
        }
        IosAlert.alert('Ticket Issued', 'Ticket and notifications sent successfully.', [{
          text: 'OK',
          onPress: () => {
            resetAllStates();
            router.push({ pathname: '/ticket', params: { ticket_no: jsonResult.ticket_no, driver_name: isDriverRegistered ? driverName : `LICENSE NO: ${licenseNo}`, license_no: licenseNo, violation_name: violationNames, fine_amount: totalFine.toString(), created_at: new Date().toISOString(), enforcer_name: enforcerName, badge_number: enforcerBadge, is_registered: isDriverRegistered ? 1 : 0 } });
          }
        }]);
      } else { IosAlert.alert('Failed', jsonResult.message || 'Unknown error.'); }
    } catch (err) { console.error('SUBMIT ERROR:', err); IosAlert.alert('Error', 'Check terminal for details.'); }
    finally { setLoading(false); }
  };

  const totalPenalty = selectedViolations.reduce((sum, v) => {
    // Gamitin yung penalty based sa offense level
    if (offenseLevel === 'first') return sum + Number(v.first_offense || 0);
    if (offenseLevel === 'second') return sum + Number(v.second_offense || 0);
    if (offenseLevel === 'third') return sum + Number(v.third_offense || 0);
    return sum;
  }, 0);

  return (
    <View style={styles.root}>

      {/* ── HEADER ── */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => { resetAllStates(); router.replace('/dashboard'); }}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={20} color="#1e293b" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerStep}>Step {currentStep} of 6</Text>
            <Text style={styles.headerTitle}>{STEP_TITLES[currentStep]}</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      {/* ── CONTENT ── */}
      <View style={styles.body}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <StepIndicator current={currentStep} />
          <Text style={styles.stepSub}>{STEP_SUBTITLES[currentStep]}</Text>

          {/* ─── STEP 1: OCR ─── */}
          {currentStep === 1 && isFocused && isCameraActive && (
            <View style={styles.stepWrap}>
              <View style={styles.cameraFrame}>
                {capturedUri
                  ? <Image source={{ uri: capturedUri }} style={styles.camera} />
                  : <CameraView key="back-camera-ocr" ref={cameraRef} style={styles.camera} facing="back" />
                }
                {scanning && (
                  <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanAnim }] }]} />
                )}
                <View style={styles.cameraOverlay}>
                  <View style={[styles.guideBox, scanning && { borderColor: '#007aff' }]} />
                </View>
                {scanning && (
                  <View style={styles.scanningBadge}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.scanningText}>Scanning…</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.galleryBtn, scanning && { opacity: 0.4 }]}
                onPress={pickImage}
                disabled={scanning}
              >
                <View style={styles.galleryIconBox}>
                  <Ionicons name="image-outline" size={18} color="#007aff" />
                </View>
                <Text style={styles.galleryText}>Upload from Gallery</Text>
                <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
              </TouchableOpacity>
            </View>
          )}

          {/* ─── STEP 2: QR ─── */}
          {currentStep === 2 && isFocused && isCameraActive && (
            <View style={styles.stepWrap}>
              <View style={styles.driverChip}>
                <View style={styles.driverChipIcon}>
                  <Ionicons name="person-outline" size={14} color="#007aff" />
                </View>
                <View style={styles.driverChipTextWrap}>
                  <Text style={styles.driverChipName} numberOfLines={1}>{driverName}</Text>
                  <Text style={styles.driverChipLicense} numberOfLines={1}>{licenseNo}</Text>
                </View>
                <View style={styles.driverChipBadge}>
                  <Text style={styles.driverChipBadgeText}>Registered</Text>
                </View>
              </View>
              <View style={styles.qrFrame}>
                {!qrScanned ? (
                  <>
                    <CameraView
                      key="back-camera-qr"
                      style={styles.camera}
                      facing="back"
                      onBarcodeScanned={onQRScanned}
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    />
                    <Animated.View style={[styles.qrScanLine, { transform: [{ translateY: scanAnim2 }] }]} />
                    <View style={styles.cameraOverlay}>
                      <View style={styles.qrGuideBox} />
                    </View>
                  </>
                ) : (
                  <View style={styles.qrResultScreen}>
                    <Ionicons
                      name={qrResult === 'matched' ? 'checkmark-circle' : 'close-circle'}
                      size={80}
                      color={qrResult === 'matched' ? '#22c55e' : '#ef4444'}
                    />
                    <Text style={[styles.qrResultText, { color: qrResult === 'matched' ? '#22c55e' : '#ef4444' }]}>
                      {qrResult === 'matched' ? 'QR Verified' : 'QR Mismatch'}
                    </Text>
                  </View>
                )}
              </View>
              {!qrScanned && (
                <View style={styles.qrHint}>
                  <Ionicons name="phone-portrait-outline" size={14} color="#64748b" />
                  <Text style={styles.qrHintText}>Ask the driver to show their DVATS portal QR code</Text>
                </View>
              )}
            </View>
          )}

          {/* ─── STEP 3: VIOLATION EVIDENCE PHOTO ─── */}
          {currentStep === 3 && isFocused && isCameraActive && (
            <View style={styles.stepWrap}>

              {/* Driver info chip */}
              <View style={styles.driverChip}>
                <View style={styles.driverChipIcon}>
                  <Ionicons name="person-outline" size={14} color="#007aff" />
                </View>
                <View style={styles.driverChipTextWrap}>
                  <Text style={styles.driverChipName} numberOfLines={1}>{driverName}</Text>
                  <Text style={styles.driverChipLicense} numberOfLines={1}>{licenseNo}</Text>
                </View>
                <View style={[styles.driverChipBadge, { backgroundColor: isDriverRegistered ? '#f0fdf4' : '#fff7ed' }]}>
                  <Text style={[styles.driverChipBadgeText, { color: isDriverRegistered ? '#22c55e' : '#ea580c' }]}>
                    {isDriverRegistered ? 'Registered' : 'Unregistered'}
                  </Text>
                </View>
              </View>

              {/* Camera or Preview */}
              <View style={styles.cameraFrame}>
                {violationPhotoUri ? (
                  <>
                    <Image source={{ uri: violationPhotoUri }} style={styles.camera} resizeMode="cover" />
                    <View style={styles.photoCapturedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="white" />
                      <Text style={styles.photoCapturedText}>Photo Captured</Text>
                    </View>
                  </>
                ) : (
                  <CameraView
                    key={`violation-camera-${cameraKey}`}
                    ref={violationCameraRef}
                    style={styles.camera}
                    facing="back"
                  />
                )}
                <View style={styles.cameraOverlay}>
                  {!violationPhotoUri && (
                    <View style={styles.guideBox} />
                  )}
                </View>
              </View>

              {/* Buttons */}
              {!violationPhotoUri ? (
                <TouchableOpacity
                  style={styles.captureBtn}
                  onPress={captureViolationPhoto}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons name="camera" size={18} color="white" />
                      <Text style={styles.captureBtnText}>Capture Evidence Photo</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.captureBtn, { backgroundColor: '#64748b' }]}
                  onPress={() => { setViolationPhotoUri(null); setViolationPhotoUrl(null); }}
                >
                  <Ionicons name="refresh" size={18} color="white" />
                  <Text style={styles.captureBtnText}>Retake Photo</Text>
                </TouchableOpacity>
              )}

              {/* Upload status */}
              {violationPhotoUri && (
                <View style={styles.uploadStatus}>
                  <Ionicons
                    name={violationPhotoUrl ? 'cloud-done-outline' : 'cloud-upload-outline'}
                    size={14}
                    color={violationPhotoUrl ? '#22c55e' : '#94a3b8'}
                  />
                  <Text style={[styles.uploadStatusText, violationPhotoUrl && { color: '#22c55e' }]}>
                    {violationPhotoUrl ? 'Uploaded successfully' : 'Uploading...'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ─── STEP 4: ENFORCER IDENTITY PROOF ─── */}
          {currentStep === 4 && isFocused && (
            <View style={styles.stepWrap}>

              {/* Enforcer info */}
              <View style={[styles.driverChip, { marginBottom: 16 }]}>
                <View style={[styles.driverChipIcon, { backgroundColor: '#fff7ed' }]}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="#ea580c" />
                </View>
                <View style={styles.driverChipTextWrap}>
                  <Text style={styles.driverChipName}>{enforcerName}</Text>
                  <Text style={styles.driverChipLicense}>Badge {enforcerBadge}</Text>
                </View>
                {proofType && (
                  <View style={[styles.driverChipBadge, { backgroundColor: proofType === 'face_verified' ? '#f0fdf4' : '#eff6ff' }]}>
                    <Text style={[styles.driverChipBadgeText, { color: proofType === 'face_verified' ? '#22c55e' : '#3b82f6' }]}>
                      {proofType === 'face_verified' ? '✓ Face ID' : '📷 Manual'}
                    </Text>
                  </View>
                )}
              </View>

              {/* If already captured — show preview */}
              {enforcerProofUri ? (
                <View>
                  <View style={styles.cameraFrame}>
                    <Image source={{ uri: enforcerProofUri }} style={styles.camera} resizeMode="cover" />
                    <View style={[styles.photoCapturedBadge, { backgroundColor: proofType === 'face_verified' ? 'rgba(34,197,94,0.85)' : 'rgba(59,130,246,0.85)' }]}>
                      <Ionicons name={proofType === 'face_verified' ? 'checkmark-circle' : 'image'} size={14} color="white" />
                      <Text style={styles.photoCapturedText}>
                        {proofType === 'face_verified' ? 'Face Verified' : 'Manual Photo'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.captureBtn, { backgroundColor: '#64748b', marginTop: 12 }]}
                    onPress={() => { setEnforcerProofUri(null); setEnforcerProofUrl(null); setProofType(null); setFaceVerified(false); setFaceAttempts(0); setShowManualFallback(false); }}
                  >
                    <Ionicons name="refresh" size={18} color="white" />
                    <Text style={styles.captureBtnText}>Redo Verification</Text>
                  </TouchableOpacity>
                </View>

              ) : !showManualFallback ? (
                // Face++ Primary
                <View>
                  <View style={styles.cameraFrame}>
                    {faceVerifying ? (
                      <View style={[styles.camera, { backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }]}>
                        <ActivityIndicator size="large" color="white" />
                        <Text style={{ color: 'white', marginTop: 12, fontWeight: '600' }}>Verifying face...</Text>
                      </View>
                    ) : (
                      <CameraView
                        key={`enforcer-camera-${cameraKey}`}
                        ref={enforcerCameraRef}
                        style={styles.camera}
                        facing="front"
                      />
                    )}
                    <View style={styles.cameraOverlay}>
                      <View style={[styles.guideBox, { borderRadius: 100, width: '55%', height: '75%' }]} />
                    </View>
                    {faceAttempts > 0 && (
                      <View style={[styles.scanningBadge, { backgroundColor: 'rgba(239,68,68,0.7)' }]}>
                        <Text style={styles.scanningText}>Attempt {faceAttempts} of 3</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.captureBtn, faceVerifying && { opacity: 0.5 }]}
                    onPress={captureEnforcerSelfie}
                    disabled={faceVerifying}
                  >
                    <Ionicons name="scan" size={18} color="white" />
                    <Text style={styles.captureBtnText}>
                      {faceAttempts === 0 ? 'Verify Face' : `Retry Face (${faceAttempts}/3)`}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.fallbackBtn}
                    onPress={() => setShowManualFallback(true)}
                  >
                    <Text style={styles.fallbackBtnText}>Having trouble? Use manual photo instead</Text>
                  </TouchableOpacity>
                </View>

              ) : (
                // Manual Fallback
                <View>
                  <View style={styles.manualFallbackCard}>
                    <Ionicons name="information-circle-outline" size={20} color="#3b82f6" />
                    <Text style={styles.manualFallbackText}>
                      Face verification unavailable. Please take a selfie or upload a photo as proof that you are the arresting officer.
                    </Text>
                  </View>

                  <View style={styles.manualBtnRow}>
                    <TouchableOpacity
                      style={[styles.manualBtn, { flex: 1 }]}
                      onPress={takeManualProofPhoto}
                      disabled={loading}
                    >
                      {loading ? <ActivityIndicator color="white" size="small" /> : (
                        <>
                          <Ionicons name="camera" size={18} color="white" />
                          <Text style={styles.captureBtnText}>Take Selfie</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.manualBtn, { flex: 1, backgroundColor: '#64748b' }]}
                      onPress={pickManualProof}
                      disabled={loading}
                    >
                      {loading ? <ActivityIndicator color="white" size="small" /> : (
                        <>
                          <Ionicons name="image-outline" size={18} color="white" />
                          <Text style={styles.captureBtnText}>Upload Photo</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.fallbackBtn}
                    onPress={() => { setShowManualFallback(false); setFaceAttempts(0); }}
                  >
                    <Text style={styles.fallbackBtnText}>Try Face Verification Again</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Upload status */}
              {enforcerProofUri && (
                <View style={[styles.uploadStatus, { marginTop: 8 }]}>
                  <Ionicons
                    name={enforcerProofUrl ? 'cloud-done-outline' : 'cloud-upload-outline'}
                    size={14}
                    color={enforcerProofUrl ? '#22c55e' : '#94a3b8'}
                  />
                  <Text style={[styles.uploadStatusText, enforcerProofUrl && { color: '#22c55e' }]}>
                    {enforcerProofUrl ? 'Uploaded successfully' : 'Uploading...'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ─── STEP 5: BIOMETRIC AUTH ─── */}
          {currentStep === 5 && (
            <View style={[styles.stepWrap, { alignItems: 'center', paddingTop: 20 }]}>
              <View style={styles.biometricRing}>
                <View style={styles.biometricInner}>
                  <MaterialCommunityIcons name="fingerprint" size={72} color="#007aff" />
                </View>
              </View>
              <Text style={styles.officerName}>{enforcerName}</Text>
              <View style={styles.badgePill}>
                <Ionicons name="id-card-outline" size={11} color="#007aff" />
                <Text style={styles.badgePillText}>Badge {enforcerBadge}</Text>
              </View>
              <Text style={styles.authNote}>
                Tap authenticate below to verify your identity and sign this ticket.
              </Text>
              <View style={styles.biometricInfoCard}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#22c55e" />
                <Text style={styles.biometricInfoText}>
                  Your biometric data never leaves this device.
                </Text>
              </View>

              {/* Evidence thumbnails */}
              <View style={styles.evidenceRow}>
                {violationPhotoUri && (
                  <View style={styles.evidenceThumb}>
                    <Image source={{ uri: violationPhotoUri }} style={styles.evidenceImg} />
                    <Text style={styles.evidenceLabel}>Evidence</Text>
                  </View>
                )}
                {enforcerProofUri && (
                  <View style={styles.evidenceThumb}>
                    <Image source={{ uri: enforcerProofUri }} style={styles.evidenceImg} />
                    <Text style={styles.evidenceLabel}>
                      {proofType === 'face_verified' ? 'Face ID' : 'Manual'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ─── STEP 6: ISSUE TICKET ─── */}
          {currentStep === 6 && (
            <View style={styles.stepWrap}>

              {/* Offender summary */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryIconBox}>
                    <Ionicons name="person-outline" size={14} color="#64748b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryLabel}>Offender</Text>
                    <Text style={styles.summaryValue}>{driverName?.trim().length > 0 ? driverName : licenseNo}</Text>
                  </View>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <View style={styles.summaryIconBox}>
                    <Ionicons name="card-outline" size={14} color="#64748b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryLabel}>License No.</Text>
                    <Text style={styles.summaryValue}>{licenseNo}</Text>
                  </View>
                </View>
                <View style={styles.summaryDivider} />

                {/* Photo thumbnails */}
                <View style={styles.summaryRow}>
                  <View style={styles.summaryIconBox}>
                    <Ionicons name="images-outline" size={14} color="#64748b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryLabel}>Evidence Photos</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      {violationPhotoUri && (
                        <View style={styles.ticketThumbWrap}>
                          <Image source={{ uri: violationPhotoUri }} style={styles.ticketThumb} />
                          <Text style={styles.ticketThumbLabel}>Violation</Text>
                        </View>
                      )}
                      {enforcerProofUri && (
                        <View style={styles.ticketThumbWrap}>
                          <Image source={{ uri: enforcerProofUri }} style={styles.ticketThumb} />
                          <Text style={styles.ticketThumbLabel}>
                            {proofType === 'face_verified' ? '✓ Face ID' : '📷 Manual'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              {/* Unregistered driver fields */}
              {!isDriverRegistered && (
                <View style={styles.section}>
                  <SectionLabel text="Contact Details" />
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="juan@email.com"
                      placeholderTextColor="#94a3b8"
                      value={driverEmail}
                      onChangeText={setDriverEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="09XXXXXXXXX"
                      placeholderTextColor="#94a3b8"
                      value={driverPhone}
                      onChangeText={setDriverPhone}
                      keyboardType="phone-pad"
                      maxLength={11}
                    />
                  </View>
                </View>
              )}

              {/* Offense level */}
              <View style={styles.section}>
                <SectionLabel text="Offense Level" />
                <View style={styles.offenseRow}>
                  {(['first', 'second', 'third'] as const).map(level => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.offenseBtn, offenseLevel === level && styles.offenseBtnActive]}
                      onPress={() => setOffenseLevel(level)}
                    >
                      <Text style={[styles.offenseBtnText, offenseLevel === level && styles.offenseBtnTextActive]}>
                        {level.charAt(0).toUpperCase() + level.slice(1)} Offense
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Violation picker */}
              <View style={styles.section}>
                <SectionLabel text="Select Violations" />
                <View style={styles.searchBox}>
                  <Ionicons name="search-outline" size={15} color="#94a3b8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search violation…"
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
                <View style={styles.violationList}>
                  {masterViolations.length === 0 && violationsLoaded && (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Ionicons name="alert-circle-outline" size={24} color="#94a3b8" />
                      <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, textAlign: 'center' }}>
                        No violations loaded.{'\n'}Check your connection or add ordinances in the admin panel.
                      </Text>
                    </View>
                  )}
                  {masterViolations
                    .filter(v => v.violation_name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(v => {
                      const selected = !!selectedViolations.find(i => i.id === v.id);
                      return (
                        <TouchableOpacity
                          key={v.id}
                          style={[styles.vCard, selected && styles.vCardSelected]}
                          onPress={() => {
                            setSelectedViolations(selected
                              ? selectedViolations.filter(i => i.id !== v.id)
                              : [...selectedViolations, v]
                            );
                          }}
                        >
                          <View style={[styles.vCheck, selected && styles.vCheckActive]}>
                            {selected && <Ionicons name="checkmark" size={10} color="white" />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.vName, selected && styles.vNameSelected]} numberOfLines={2}>
                              {v.violation_name}
                            </Text>
                            <Text style={{ fontSize: 9, color: selected ? '#94a3b8' : '#64748b', marginTop: 2 }}>
                              {v.ordinance_no}
                            </Text>
                          </View>
                          <Text style={[styles.vFine, selected && styles.vFineSelected]}>
                            ₱{(offenseLevel === 'first' 
                              ? Number(v.first_offense || 0) 
                              : offenseLevel === 'second' 
                                ? Number(v.second_offense || 0) 
                                : Number(v.third_offense || 0)
                            ).toLocaleString()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              </View>

              {/* Total */}
              {selectedViolations.length > 0 && (
                <View style={styles.totalCard}>
                  <View>
                    <Text style={styles.totalLabel}>Total Penalty</Text>
                    <Text style={styles.totalCount}>{selectedViolations.length} violation{selectedViolations.length > 1 ? 's' : ''}</Text>
                  </View>
                  <Text style={styles.totalAmount}>₱{totalPenalty.toLocaleString()}</Text>
                </View>
              )}
            </View>
          )}

        </ScrollView>

        {/* ── ACTION BUTTON ── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.actionBtn, (loading || scanning || faceVerifying) && styles.actionBtnDisabled]}
            onPress={handleNext}
            disabled={loading || scanning || faceVerifying}
            activeOpacity={0.85}
          >
            {loading || scanning || faceVerifying
              ? <ActivityIndicator color="white" />
              : (
                <View style={styles.actionBtnInner}>
                  <Text style={styles.actionBtnText}>
                    {currentStep === 1 && 'Scan License'}
                    {currentStep === 2 && 'Scan QR Code'}
                    {currentStep === 3 && 'Capture Evidence Photo'}
                    {currentStep === 4 && 'Verify Identity'}
                    {currentStep === 5 && 'Authenticate'}
                    {currentStep === 6 && 'Confirm & Issue Ticket'}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="white" />
                </View>
              )
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#f2f2f7' },
  headerSafe:  { backgroundColor: '#f2f2f7' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.18)',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(60,60,67,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerStep:   { fontSize: 11, fontWeight: '600', color: '#94a3b8', letterSpacing: 0.3, textTransform: 'uppercase' },
  headerTitle:  { fontSize: 17, fontWeight: '600', color: '#1e293b', letterSpacing: -0.3, marginTop: 1 },
  body:         { flex: 1 },
  scroll:       { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },
  stepSub:      { fontSize: 13, color: '#64748b', marginTop: -16, marginBottom: 24, paddingLeft: 2 },
  stepWrap:     { width: '100%' },

  cameraFrame: {
    width: '100%', height: 260, borderRadius: 20,
    overflow: 'hidden', backgroundColor: '#0f172a', marginBottom: 14,
  },
  camera:        { width: '100%', height: '100%' },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  guideBox: {
    width: '80%', height: '55%',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 12,
  },
  scanLine: {
    position: 'absolute', width: '100%', height: 2.5,
    backgroundColor: '#007aff', opacity: 0.85, top: 0,
  },
  scanningBadge: {
    position: 'absolute', bottom: 14, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
  },
  scanningText: { color: 'white', fontSize: 12, fontWeight: '600' },

  galleryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'white', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  galleryIconBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
  },
  galleryText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#1e293b' },

  driverChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'white', borderRadius: 14, padding: 12, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  driverChipIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  driverChipName:    { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  driverChipLicense: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  driverChipTextWrap: { flex: 1 },
  driverChipBadge: {
    flexShrink: 0, backgroundColor: '#f0fdf4',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  driverChipBadgeText: { fontSize: 10, fontWeight: '700', color: '#22c55e' },

  qrFrame: {
    width: '100%', height: 280, borderRadius: 20,
    overflow: 'hidden', backgroundColor: '#0f172a', marginBottom: 12,
  },
  qrGuideBox: {
    width: 200, height: 200,
    borderWidth: 2.5, borderColor: '#007aff',
    borderRadius: 16, backgroundColor: 'transparent',
  },
  qrScanLine: {
    position: 'absolute', width: '100%', height: 2.5,
    backgroundColor: '#007aff', opacity: 0.85, top: 50,
  },
  qrResultScreen: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a',
  },
  qrResultText: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  qrHint: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 12,
  },
  qrHintText: { fontSize: 12, color: '#64748b', flex: 1, lineHeight: 17 },

  captureBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#007aff', borderRadius: 14, height: 52, marginBottom: 10,
  },
  captureBtnText: { color: 'white', fontSize: 14, fontWeight: '600' },

  photoCapturedBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(34,197,94,0.85)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  photoCapturedText: { color: 'white', fontSize: 11, fontWeight: '700' },

  uploadStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    justifyContent: 'center', marginTop: 4,
  },
  uploadStatusText: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },

  fallbackBtn:     { alignItems: 'center', paddingVertical: 12 },
  fallbackBtnText: { fontSize: 12, color: '#94a3b8', fontWeight: '500', textDecorationLine: 'underline' },

  manualFallbackCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#eff6ff', borderRadius: 12, padding: 14, marginBottom: 16,
  },
  manualFallbackText: { flex: 1, fontSize: 12, color: '#1d4ed8', lineHeight: 17, fontWeight: '500' },

  manualBtnRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  manualBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#007aff', borderRadius: 14, height: 52,
  },

  biometricRing: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  biometricInner: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'white', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#007aff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
  },
  officerName:  { fontSize: 20, fontWeight: '700', color: '#0f172a', letterSpacing: -0.3, marginBottom: 8 },
  badgePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginBottom: 14,
  },
  badgePillText:  { fontSize: 12, fontWeight: '600', color: '#007aff' },
  authNote:       { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 19, marginBottom: 20, paddingHorizontal: 20 },
  biometricInfoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, width: '100%', marginBottom: 20,
  },
  biometricInfoText: { fontSize: 12, color: '#16a34a', fontWeight: '500', flex: 1 },

  evidenceRow:  { flexDirection: 'row', gap: 12, marginTop: 8 },
  evidenceThumb: { alignItems: 'center', gap: 4 },
  evidenceImg:  { width: 70, height: 70, borderRadius: 12, backgroundColor: '#f1f5f9' },
  evidenceLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },

  section:      { marginBottom: 24 },
  summaryCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 4, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  summaryRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(60,60,67,0.1)', marginHorizontal: 12 },
  summaryIconBox: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },
  summaryLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '500', marginBottom: 2 },
  summaryValue: { fontSize: 15, fontWeight: '600', color: '#0f172a' },

  ticketThumbWrap: { alignItems: 'center', gap: 3 },
  ticketThumb:     { width: 56, height: 56, borderRadius: 10, backgroundColor: '#f1f5f9' },
  ticketThumbLabel:{ fontSize: 9, color: '#94a3b8', fontWeight: '600' },

  inputGroup:  { marginBottom: 12 },
  inputLabel:  { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 6, letterSpacing: 0.2 },
  input: {
    backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, fontWeight: '500', color: '#1e293b',
  },

  searchBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0',
      borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b', fontWeight: '500' },
  offenseRow:          { flexDirection: 'row', gap: 8 },
  offenseBtn: {
      flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center',
      backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0',
  },
  offenseBtnActive:    { backgroundColor: '#007aff', borderColor: '#007aff' },
  offenseBtnText:      { fontSize: 13, fontWeight: '600', color: '#64748b' },
  offenseBtnTextActive:{ color: 'white' },


  violationList: { gap: 6 },
  vCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'white', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  vCardSelected:     { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  vCheck: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  vCheckActive:      { backgroundColor: '#007aff', borderColor: '#007aff' },
  vName:             { flex: 1, fontSize: 12, fontWeight: '600', color: '#475569' },
  vNameSelected:     { color: 'white' },
  vFine:             { fontSize: 13, fontWeight: '700', color: '#1e293b', minWidth: 64, textAlign: 'right' },
  vFineSelected:     { color: '#60a5fa' },

  totalCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0f172a', borderRadius: 16, padding: 18, marginTop: 6,
  },
  totalLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginBottom: 2 },
  totalCount:  { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  totalAmount: { fontSize: 28, fontWeight: '700', color: 'white', letterSpacing: -0.5 },

  bottomBar: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.12)',
    backgroundColor: '#f2f2f7',
  },
  actionBtn: {
    backgroundColor: '#007aff', borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnDisabled: { backgroundColor: '#c7d7f0' },
  actionBtnInner:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtnText:     { color: 'white', fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
});