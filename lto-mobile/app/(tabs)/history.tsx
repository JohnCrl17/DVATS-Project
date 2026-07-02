import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Animated,
  Platform,
} from 'react-native';

import { SafeAreaView }             from 'react-native-safe-area-context';
import { Ionicons }                 from '@expo/vector-icons';
import { LinearGradient }           from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage                 from '@react-native-async-storage/async-storage';

// ✅ FIXED: Use Render URL instead of Ngrok
const API_BASE = 'https://dvats-api-php.onrender.com';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface Apprehension {
  id:             string;
  ticket_no:      string;
  driver_name:    string;
  violation_name: string;
  fine_amount:    string;
  status:         string;
  created_at:     string;
}

type AlertButton = {
  text:     string;
  style?:   'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type AlertConfig = {
  title:    string;
  message?: string;
  buttons?: AlertButton[];
};

// ─────────────────────────────────────────────────────────────
// iOS ALERT COMPONENT  (unchanged — your original)
// ─────────────────────────────────────────────────────────────
function IOSAlert({ visible, config, onClose }: {
  visible:  boolean;
  config:   AlertConfig | null;
  onClose:  () => void;
}) {
  const scaleAnim   = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 200 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim,   { toValue: 0.8, duration: 150, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0,   duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!config) return null;

  const buttons  = config.buttons?.length ? config.buttons : [{ text: 'OK', style: 'default' as const }];
  const isColumn = buttons.length > 2;

  const handlePress = (btn: AlertButton) => {
    onClose();
    if (btn.onPress) setTimeout(btn.onPress, 200);
  };

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[iosStyles.backdrop, { opacity: opacityAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} />
      </Animated.View>
      <View style={iosStyles.centeredView}>
        <Animated.View style={[
          iosStyles.alertBox,
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim }
        ]}>
          <Text style={iosStyles.alertTitle}>{config.title}</Text>
          {config.message ? <Text style={iosStyles.alertMessage}>{config.message}</Text> : null}
          <View style={iosStyles.dividerH} />
          <View style={[iosStyles.buttonRow, isColumn && { flexDirection: 'column' }]}>
            {buttons.map((btn, idx) => {
              const isLast        = idx === buttons.length - 1;
              const isDestructive = btn.style === 'destructive';
              const isCancel      = btn.style === 'cancel';
              return (
                <React.Fragment key={idx}>
                  <TouchableOpacity
                    style={[iosStyles.alertBtn, isColumn && { width: '100%' }]}
                    activeOpacity={0.6}
                    onPress={() => handlePress(btn)}
                  >
                    <Text style={[
                      iosStyles.alertBtnText,
                      isDestructive && { color: '#ef4444' },
                      isCancel      && { color: '#64748b' },
                      !isDestructive && !isCancel && { color: '#007aff', fontWeight: '600' },
                    ]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                  {!isLast && (
                    <View style={isColumn ? iosStyles.dividerH : iosStyles.dividerV} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const iosStyles = StyleSheet.create({
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  alertBox: {
    width:           '100%',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(242,242,247,0.98)' : 'white',
    borderRadius:    14,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 10 },
    shadowOpacity:   0.25,
    shadowRadius:    20,
    elevation:       20,
  },
  alertTitle:   { textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#000', paddingTop: 20, paddingHorizontal: 16, paddingBottom: 4, letterSpacing: -0.2 },
  alertMessage: { textAlign: 'center', fontSize: 13, color: '#3c3c43', paddingHorizontal: 16, paddingBottom: 20, lineHeight: 18 },
  dividerH:     { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(60,60,67,0.29)' },
  dividerV:     { width: StyleSheet.hairlineWidth,  backgroundColor: 'rgba(60,60,67,0.29)' },
  buttonRow:    { flexDirection: 'row' },
  alertBtn:     { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  alertBtnText: { fontSize: 17, color: '#007aff' },
});

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────
function useIOSAlert() {
  const [visible, setVisible] = useState(false);
  const [config,  setConfig]  = useState<AlertConfig | null>(null);

  const showAlert = (cfg: AlertConfig) => { setConfig(cfg); setVisible(true); };
  const hideAlert = () => setVisible(false);

  const AlertComponent = <IOSAlert visible={visible} config={config} onClose={hideAlert} />;

  return { showAlert, AlertComponent };
}

// ─────────────────────────────────────────────────────────────
// STAT PILL
// ─────────────────────────────────────────────────────────────
function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statPillVal}>{value}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// TICKET CARD
// ─────────────────────────────────────────────────────────────
function TicketCard({
  item,
  onPress,
}: {
  item:     Apprehension;
  onPress:  () => void;
}) {
  const isPaid = item.status?.toLowerCase() === 'paid';

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={onPress}
    >
      {/* Left accent bar */}
      <View style={[styles.cardAccent, { backgroundColor: isPaid ? '#34d399' : '#f87171' }]} />

      <View style={styles.cardInner}>
        {/* Top row */}
        <View style={styles.cardTop}>
          <Text style={styles.cardTicketNo}>#{item.ticket_no || item.id}</Text>
          <View style={[styles.statusPill, { backgroundColor: isPaid ? '#d1fae5' : '#fee2e2' }]}>
            <View style={[styles.statusDot, { backgroundColor: isPaid ? '#10b981' : '#ef4444' }]} />
            <Text style={[styles.statusLabel, { color: isPaid ? '#065f46' : '#991b1b' }]}>
              {item.status?.toUpperCase() || 'PENDING'}
            </Text>
          </View>
        </View>

        {/* Driver name */}
        <Text style={styles.cardDriver}>{item.driver_name?.toUpperCase() || 'N/A'}</Text>

        {/* Violation */}
        <Text style={styles.cardViolation} numberOfLines={1}>{item.violation_name}</Text>

        {/* Bottom row */}
        <View style={styles.cardBottom}>
          <View style={styles.cardDateRow}>
            <Ionicons name="time-outline" size={11} color="#94a3b8" />
            <Text style={styles.cardDate}>
              {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
            </Text>
          </View>

          <View style={styles.cardAmountRow}>
            <Text style={styles.cardAmount}>₱{Number(item.fine_amount).toLocaleString()}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
// HISTORY SCREEN
// ─────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const router = useRouter();
  const { showAlert, AlertComponent } = useIOSAlert();

  const [historyData, setHistoryData] = useState<Apprehension[]>([]);
  const [officer,     setOfficer]     = useState({ name: 'Loading...', unit: '...', badge_number: '' });
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const loadHistory = async () => {
    try {
      const sessionData = await AsyncStorage.getItem('userSession');
      if (sessionData) {
        const user = JSON.parse(sessionData);
        setOfficer({
          name:         user.full_name    || user.name || 'Officer',
          unit:         user.unit         || 'N/A',
          badge_number: user.badge_number || '',
        });

        // ✅ FIXED: Using API_BASE instead of Ngrok URL
        const response = await fetch(
          `${API_BASE}/get_history.php?badge_number=${user.badge_number}`,
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        const result = await response.json();
        console.log('HISTORY DATA CHECK:', result);

        if (result.status === 'success') setHistoryData(result.data || []);
        else setHistoryData([]);
      }
    } catch (error) {
      console.error('History Fetch Error:', error);
      setHistoryData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadHistory(); }, []));

  const paidCount    = historyData.filter(i => i.status?.toLowerCase() === 'paid').length;
  const pendingCount = historyData.length - paidCount;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {AlertComponent}

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/dashboard')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#1e293b" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>History</Text>
          <Text style={styles.headerSub}>Ofc. {officer.name} · Unit {officer.unit}</Text>
        </View>

        {/* Spacer to balance back button */}
        <View style={{ width: 38 }} />
      </View>

      {/* ── STAT PILLS ── */}
      <View style={styles.statsRow}>
        <StatPill label="Total"   value={historyData.length} />
        <View style={styles.statDivider} />
        <StatPill label="Paid"    value={paidCount} />
        <View style={styles.statDivider} />
        <StatPill label="Pending" value={pendingCount} />
      </View>

      {/* ── LIST ── */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadHistory(); }}
            tintColor="#94a3b8"
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color="#94a3b8" style={{ marginTop: 60 }} />
        ) : historyData.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={28} color="#cbd5e1" />
            </View>
            <Text style={styles.emptyTitle}>No Records Yet</Text>
            <Text style={styles.emptySub}>Issued tickets will appear here.</Text>
          </View>
        ) : (
          historyData.map((item) => (
            <TicketCard
              key={item.id}
              item={item}
              onPress={() =>
                router.push({
                  pathname: '/ticket',
                  params: {
                    ticket_id:      item.id,
                    id:             item.id,
                    ticket_no:      item.ticket_no,
                    driver_name:    item.driver_name,
                    violation_name: item.violation_name,
                    fine_amount:    String(item.fine_amount),
                    status:         item.status,
                    created_at:     item.created_at,
                    enforcer_name:  officer.name,
                    badge_number:   officer.badge_number,
                  },
                })
              }
            />
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES  — modern minimalist, matches iOS alert palette
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── layout
  container:   { flex: 1, backgroundColor: '#f2f2f7' },

  // ── header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    backgroundColor:   'rgba(242,242,247,0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.18)',
  },
  backBtn: {
    width:           38,
    height:          38,
    borderRadius:    12,
    backgroundColor: 'rgba(60,60,67,0.08)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerCenter:  { alignItems: 'center' },
  headerTitle: {
    fontSize:    17,
    fontWeight:  '600',
    color:       '#1e293b',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize:  12,
    color:     '#94a3b8',
    marginTop:  2,
    fontWeight: '500',
  },

  // ── stat pills
  statsRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    marginHorizontal:  20,
    marginTop:         16,
    marginBottom:       4,
    backgroundColor:   'white',
    borderRadius:      14,
    paddingVertical:   14,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.04,
    shadowRadius:       4,
    elevation:          2,
  },
  statPill:      { flex: 1, alignItems: 'center' },
  statPillVal: {
    fontSize:    22,
    fontWeight:  '700',
    color:       '#0f172a',
    letterSpacing: -0.5,
  },
  statPillLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  statDivider:   { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: 'rgba(60,60,67,0.18)' },

  // ── list
  listContent: { paddingHorizontal: 16, paddingTop: 16 },

  // ── card
  card: {
    flexDirection:  'row',
    backgroundColor: 'white',
    borderRadius:   16,
    marginBottom:   12,
    overflow:       'hidden',
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 1 },
    shadowOpacity:  0.05,
    shadowRadius:    6,
    elevation:       2,
  },
  cardAccent: { width: 4 },
  cardInner:  { flex: 1, padding: 14 },

  cardTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:    8,
  },
  cardTicketNo: { fontSize: 11, fontWeight: '600', color: '#94a3b8', letterSpacing: 0.3 },

  statusPill: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:   20,
    gap:             4,
  },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  cardDriver: {
    fontSize:    15,
    fontWeight:  '700',
    color:       '#0f172a',
    letterSpacing: -0.2,
    marginBottom:  2,
  },
  cardViolation: {
    fontSize:   12,
    color:      '#007aff',
    fontWeight: '500',
    marginBottom: 12,
  },

  cardBottom: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  cardDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardDate:    { fontSize: 10, color: '#94a3b8' },

  cardAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardAmount: {
    fontSize:    15,
    fontWeight:  '700',
    color:       '#0f172a',
    letterSpacing: -0.3,
  },

  // ── empty state
  emptyState: { alignItems: 'center', marginTop: 72 },
  emptyIcon: {
    width:           64,
    height:          64,
    borderRadius:    20,
    backgroundColor: 'rgba(60,60,67,0.06)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#334155', marginBottom: 4 },
  emptySub:   { fontSize: 13, color: '#94a3b8' },
});