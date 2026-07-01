import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';

interface Officer {
  name: string;
  badge_number: string;
  unit: string;
  profile_pic?: string;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [officer, setOfficer] = useState<Officer | null>(null);
  const [stats, setStats] = useState({ captured: 0, fines: 0 });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [shiftStart] = useState(new Date()); // nag-start nung nag-load ang dashboard
  const [shiftDuration, setShiftDuration] = useState('00:00:00');
  const [todayTickets, setTodayTickets] = useState(0);

  const player = useAudioPlayer(require('../assets/notif_sound.mp3'));

  // Update time every second
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const timer = setInterval(() => {
        setCurrentTime(new Date());

        // Shift duration
        const diff = Math.floor((new Date().getTime() - shiftStart.getTime()) / 1000);
        const hrs  = String(Math.floor(diff / 3600)).padStart(2, '0');
        const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
        const secs = String(diff % 60).padStart(2, '0');
        setShiftDuration(`${hrs}:${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(timer);
}, [shiftStart]);

  const playNotificationSound = () => {
    try {
      if (player) player.play();
    } catch (error) {
      console.log('Sound Error:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      const sessionData = await AsyncStorage.getItem('userSession');
      if (sessionData) {
        const user = JSON.parse(sessionData);
        const badge = user.badge_number;

        setOfficer({
          name: user.full_name || user.name || 'OFFICER',
          badge_number: badge || 'N/A',
          unit: user.unit || 'N/A',
          profile_pic: user.profile_pic,
        });

        const [statsRes, activityRes, alertsRes] = await Promise.all([
          fetch(`https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api/get_stats.php?badge_number=${badge}`, {
            headers: { 'ngrok-skip-browser-warning': 'true', Accept: 'application/json' },
          }),
          fetch(`https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api/get_apprehensions.php?badge_number=${badge}`, {
            headers: { 'ngrok-skip-browser-warning': 'true', Accept: 'application/json' },
          }),
          fetch(`https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api/get_alerts.php?badge_number=${badge}`, {
            headers: { 'ngrok-skip-browser-warning': 'true', Accept: 'application/json' },
          }),
        ]);

        const statsData = await statsRes.json();
        const activityData = await activityRes.json();
        const alertsData = await alertsRes.json();

        if (statsData.status === 'success' && statsData.data) {
          setStats({
            captured: Number(statsData.data.captured) || 0,
            fines: Number(statsData.data.fines) || 0,
          });
          setTodayTickets(Number(statsData.data.today_tickets) || 0);
        }

        if (activityData.status === 'success') {
          setRecentActivity(activityData.data ? activityData.data.slice(0, 4) : []);
        }

        if (alertsData.status === 'success') {
          const fetchedAlerts = alertsData.data || [];
          const newUnreadCount = fetchedAlerts.filter(
            (n: any) => n.is_read == 0 || n.is_read == '0'
          ).length;
          if (newUnreadCount > unreadCount) playNotificationSound();
          setUnreadCount(newUnreadCount);
        }
      }
    } catch (error) {
      console.error('Dashboard Sync Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
      const interval = setInterval(loadDashboardData, 10000);
      return () => clearInterval(interval);
    }, [unreadCount])
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('en-PH', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = () => {
    return currentTime.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F2F2F7" />

      {/* ── Fixed Top Section (does not scroll) ── */}
      <View style={styles.fixedTop}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.officerNameHeader}>
              {officer?.name?.split(' ')[0] || 'Officer'}
            </Text>
            <View style={styles.dateTimeRow}>
              <Text style={styles.dateText}>{formatDate()}</Text>
              <Text style={styles.timeSeparator}> · </Text>
              <Text style={styles.timeText}>{formatTime()}</Text>
            </View>
          </View>
        </View>

        {/* ── Badge Chip ── */}
        <View style={styles.badgeChip}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeChipText}>
            LTO Dasmariñas · Badge {officer?.badge_number || '—'}
          </Text>
        </View>

        {/* ── Stats Cards ── */}
        <View style={styles.statsRow}>
          {/* Captured / Logs */}
          <TouchableOpacity
            style={[styles.statCard, styles.statCardDark]}
            onPress={() => router.push('/history')}
            activeOpacity={0.85}
          >
            <View style={styles.statCardHeader}>
              <View style={[styles.statIconWrap, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                <Ionicons name="document-text-outline" size={16} color="#fff" />
              </View>
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.4)" />
            </View>
            <Text style={styles.statNumberDark}>{stats.captured}</Text>
            <Text style={styles.statLabelDark}>History Logs</Text>
          </TouchableOpacity>

          {/* Fines */}
          {/* Shift Status Card */}
          <View style={[styles.statCard, styles.statCardLight]}>
              <View style={styles.statCardHeader}>
                  <View style={[styles.statIconWrap, { backgroundColor: '#E8F5E9' }]}>
                      <Ionicons name="time-outline" size={16} color="#1E8E3E" />
                  </View>
                  <View style={styles.onlineDot} />
              </View>

              <Text style={styles.statNumberLight}>{shiftDuration}</Text>
              <Text style={styles.statLabelLight}>Shift Duration</Text>

              {/* Today's tickets */}
              <View style={styles.shiftSubRow}>
                  <Ionicons name="receipt-outline" size={11} color="#8E8E93" />
                  <Text style={styles.shiftSubText}>{todayTickets} ticket{todayTickets !== 1 ? 's' : ''} today</Text>
              </View>
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <TouchableOpacity
          style={styles.newTicketButton}
          onPress={() => router.push('/apprehension')}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={['#1A73E8', '#0D5BD1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.newTicketGradient}
          >
            <View style={styles.newTicketLeft}>
              <View style={styles.newTicketIconWrap}>
                <Ionicons name="add" size={20} color="#1A73E8" />
              </View>
              <View>
                <Text style={styles.newTicketTitle}>New Apprehension</Text>
                <Text style={styles.newTicketSub}>Issue a violation ticket</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.6)" />
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Section Header (fixed, outside scroll) ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => router.push('/history')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Scrollable Activity List only ── */}
      <View style={styles.activityContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.activityScrollContent}
        >
          <View style={styles.activityList}>
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color="#1A73E8" />
              </View>
            ) : recentActivity.length > 0 ? (
              recentActivity.map((item: any, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.activityRow,
                    index < recentActivity.length - 1 && styles.activityRowBorder,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/ticket',
                      params: {
                        ticket_no: item.ticket_no,
                        ticket_id: item.id,
                        driver_name: item.driver_name,
                        violation_name: item.violation_name,
                        fine_amount: String(item.fine_amount),
                        status: item.status,
                        created_at: item.created_at,
                        enforcer_name: officer?.name,
                        badge_number: officer?.badge_number,
                      },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.activityDotWrap,
                      {
                        backgroundColor:
                          item.status?.toLowerCase() === 'paid' ? '#E6F4EA' : '#FEE8E8',
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        item.status?.toLowerCase() === 'paid'
                          ? 'checkmark'
                          : 'alert'
                      }
                      size={15}
                      color={
                        item.status?.toLowerCase() === 'paid' ? '#1E8E3E' : '#D93025'
                      }
                    />
                  </View>

                  <View style={styles.activityContent}>
                    <Text style={styles.activityName} numberOfLines={1}>
                      {item.driver_name || 'Unknown Driver'}
                    </Text>
                    <Text style={styles.activityMeta} numberOfLines={1}>
                      {item.ticket_no} · {item.violation_name || 'Violation'}
                    </Text>
                  </View>

                  <View style={styles.activityRight}>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor:
                            item.status?.toLowerCase() === 'paid' ? '#E6F4EA' : '#FEE8E8',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          {
                            color:
                              item.status?.toLowerCase() === 'paid'
                                ? '#1E8E3E'
                                : '#D93025',
                          },
                        ]}
                      >
                        {item.status?.toUpperCase() || 'PENDING'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={13} color="#C7C7CC" style={{ marginTop: 4 }} />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyWrap}>
                <Ionicons name="document-text-outline" size={36} color="#C7C7CC" />
                <Text style={styles.emptyTitle}>No activity yet</Text>
                <Text style={styles.emptySubtitle}>Issued tickets will appear here</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* ── Tab Bar ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/dashboard')}>
          <Ionicons name="home" size={22} color="#1A73E8" />
          <Text style={[styles.tabLabel, { color: '#1A73E8' }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/history')}>
          <Ionicons name="time" size={22} color="#8E8E93" />
          <Text style={styles.tabLabel}>History</Text>
        </TouchableOpacity>

        {/* Centre FAB */}
        <TouchableOpacity
          style={styles.fabWrap}
          onPress={() => router.push('/apprehension')}
          activeOpacity={0.9}
        >
          <LinearGradient colors={['#1A73E8', '#0D5BD1']} style={styles.fab}>
            <Ionicons name="add" size={26} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/alerts')}>
          <View>
            <Ionicons name="notifications" size={22} color="#8E8E93" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.tabLabel}>Alerts</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/profile')}>
          <Ionicons name="person" size={22} color="#8E8E93" />
          <Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },

  // ── Fixed Top ────────────────────────────────────
  fixedTop: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },

  // ── Scrollable Activity Container ───────────────
  activityContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 83 : 65,
  },
  activityScrollContent: {
    paddingBottom: 12,
  },

  // ── Header ──────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerLeft: { flex: 1 },
  greeting: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  officerNameHeader: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
  },
  dateText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '400',
  },
  timeSeparator: {
    fontSize: 13,
    color: '#C7C7CC',
  },
  timeText: {
    fontSize: 13,
    color: '#1A73E8',
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // ── Badge Chip ───────────────────────────────────
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#1A73E8',
    marginRight: 7,
  },
  badgeChipText: {
    fontSize: 12,
    color: '#3C3C43',
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // ── Stats ────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  statCardDark: {
    backgroundColor: '#1C1C1E',
  },
  statCardLight: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statNumberDark: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  statNumberLight: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  statLabelDark: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  statLabelLight: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // ── New Ticket Button ────────────────────────────
  newTicketButton: {
    borderRadius: 18,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  newTicketGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  newTicketLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  newTicketIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newTicketTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  newTicketSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginTop: 1,
    fontWeight: '400',
  },

  // ── Section Header ───────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.3,
  },
  seeAllText: {
    fontSize: 14,
    color: '#1A73E8',
    fontWeight: '500',
  },

  // ── Activity List ────────────────────────────────
  activityList: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  activityRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  activityDotWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: { flex: 1 },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.1,
  },
  activityMeta: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
    fontWeight: '400',
  },
  activityRight: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loadingWrap: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyWrap: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3C3C43',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 4,
  },

  // ── Tab Bar ──────────────────────────────────────
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 83 : 65,
    backgroundColor: 'rgba(249,249,251,0.92)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#8E8E93',
    letterSpacing: 0.1,
  },
  fabWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 10 : 0,
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(249,249,251,0.92)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },

  onlineDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: '#1E8E3E',
},
shiftSubRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            4,
    marginTop:      4,
},
shiftSubText: {
    fontSize:   11,
    color:      '#8E8E93',
    fontWeight: '500',
},
});