import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';

import { SafeAreaView }              from 'react-native-safe-area-context';
import { Ionicons }                  from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage                  from '@react-native-async-storage/async-storage';
import { IosAlert }                  from './CustomAlert';

import Swipeable             from 'react-native-gesture-handler/Swipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface NotificationType {
  id:           number | string;
  badge_number: string;
  type:         string;
  title:        string;
  description:  string;
  is_read:      number | string;
  created_at:   string;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const isUnread = (n: NotificationType) =>
  parseInt(n.is_read?.toString() || '0') === 0;

// Map notification type → icon
function alertIcon(type: string, unread: boolean): { name: any; color: string; bg: string } {
  const map: Record<string, { name: any; color: string; bg: string }> = {
    warning:  { name: 'warning-outline',          color: '#f59e0b', bg: '#fffbeb' },
    info:     { name: 'information-circle-outline', color: '#007aff', bg: '#eff6ff' },
    success:  { name: 'checkmark-circle-outline',  color: '#22c55e', bg: '#f0fdf4' },
    error:    { name: 'close-circle-outline',       color: '#ef4444', bg: '#fef2f2' },
  };
  const fallback = unread
    ? { name: 'mail-unread-outline', color: '#007aff', bg: '#eff6ff' }
    : { name: 'mail-open-outline',   color: '#94a3b8', bg: '#f1f5f9' };

  return map[type?.toLowerCase()] ?? fallback;
}

// ─────────────────────────────────────────────────────────────
// ALERTS SCREEN
// ─────────────────────────────────────────────────────────────
export default function AlertsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);

  // ── FETCH
  const fetchAlerts = useCallback(async () => {
    try {
      const sessionData = await AsyncStorage.getItem('userSession');
      if (!sessionData) return;

      const user = JSON.parse(sessionData);
      const url  = `https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api/get_alerts.php?badge_number=${user.badge_number}`;

      const response = await fetch(url, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      const result = await response.json();
      if (result.status === 'success') setNotifications(result.data || []);
    } catch (e) {
      console.log('Fetch alerts error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAlerts(); }, [fetchAlerts]));

  // ── ACTIONS
  const markAsRead = async (id: string | number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    try {
      await fetch(
        `https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api/mark_read.php?id=${id}`,
        { headers: { 'ngrok-skip-browser-warning': 'true' } }
      );
    } catch (e) { console.log('Mark read error:', e); }
  };

  const markAllAsRead = async () => {
    try {
      const sessionData = await AsyncStorage.getItem('userSession');
      if (!sessionData) return;
      const user = JSON.parse(sessionData);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      await fetch(
        `https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api/mark_all_read.php?badge_number=${user.badge_number}`,
        { headers: { 'ngrok-skip-browser-warning': 'true' } }
      );
    } catch (e) { console.log('Mark all read error:', e); }
  };

  const deleteNotification = (id: any) => {
    IosAlert.alert(
      'Delete Alert',
      'Remove this notification permanently?',
      [
        { text: 'Cancel',  style: 'cancel' },
        {
          text:    'Delete',
          style:   'destructive',
          onPress: async () => {
            setNotifications(prev => prev.filter(n => n.id !== id));
            try {
              await fetch(
                `https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api/delete_notification.php?id=${id}`,
                { headers: { 'ngrok-skip-browser-warning': 'true' } }
              );
            } catch (e) { console.log('Delete error:', e); }
          },
        },
      ]
    );
  };

  // ── SWIPE ACTION
  const renderRightActions = (id: any) => (
    <TouchableOpacity style={styles.swipeDelete} onPress={() => deleteNotification(id)}>
      <Ionicons name="trash-outline" size={20} color="white" />
      <Text style={styles.swipeDeleteText}>Delete</Text>
    </TouchableOpacity>
  );

  const newCount = notifications.filter(isUnread).length;

  // ── LOADING STATE
  if (loading && !refreshing) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#007aff" />
        <Text style={styles.loaderText}>Loading alerts…</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>

        {/* ── HEADER ── */}
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.replace('/dashboard')} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={20} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Alerts</Text>
            <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          </View>

          {/* Unread count pill */}
          {newCount > 0 && (
            <View style={styles.countPillWrap}>
              <View style={styles.countPill}>
                <View style={styles.countDot} />
                <Text style={styles.countText}>
                  {newCount} unread notification{newCount > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}
        </SafeAreaView>

        {/* ── LIST ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchAlerts(); }}
              tintColor="#007aff"
            />
          }
        >
          {notifications.length === 0 ? (
            // ── EMPTY STATE
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="notifications-off-outline" size={36} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptySub}>We'll notify you when something comes up.</Text>
            </View>
          ) : (
            notifications.map((item, index) => {
              const unread = isUnread(item);
              const icon   = alertIcon(item.type, unread);

              return (
                <Swipeable
                  key={item.id}
                  renderRightActions={() => renderRightActions(item.id)}
                  friction={2}
                  rightThreshold={40}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => markAsRead(item.id)}
                    style={[styles.card, unread && styles.cardUnread]}
                  >
                    {/* Unread indicator bar */}
                    {unread && <View style={styles.unreadBar} />}

                    {/* Icon */}
                    <View style={[styles.iconBox, { backgroundColor: icon.bg }]}>
                      <Ionicons name={icon.name} size={20} color={icon.color} />
                    </View>

                    {/* Content */}
                    <View style={styles.cardContent}>
                      <View style={styles.titleRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                        {unread && (
                          <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>NEW</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                      <View style={styles.timeRow}>
                        <Ionicons name="time-outline" size={10} color="#cbd5e1" />
                        <Text style={styles.timeText}>{item.created_at}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              );
            })
          )}
        </ScrollView>

      </View>
    </GestureHandlerRootView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f2f2f7' },

  // ── loader
  loaderWrap:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f2f2f7' },
  loaderText:  { marginTop: 10, fontSize: 13, color: '#94a3b8', fontWeight: '500' },

  // ── header
  headerSafe:  { backgroundColor: '#f2f2f7' },
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
  headerTitle:  { fontSize: 17, fontWeight: '600', color: '#1e293b', letterSpacing: -0.3 },
  markAllBtn:   { paddingHorizontal: 4, paddingVertical: 6 },
  markAllText:  { fontSize: 13, fontWeight: '500', color: '#007aff' },

  // ── unread count pill
  countPillWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  countPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    alignSelf:         'flex-start',
    backgroundColor:   '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      20,
  },
  countDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#007aff' },
  countText: { fontSize: 12, fontWeight: '600', color: '#007aff' },

  // ── scroll
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48 },

  // ── card
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    backgroundColor: 'white',
    borderRadius:    16,
    padding:         14,
    marginBottom:    10,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.04,
    shadowRadius:    4,
    elevation:       2,
  },
  cardUnread: {
    backgroundColor: '#fafcff',
  },
  unreadBar: {
    position:        'absolute',
    left:            0, top: 0, bottom: 0,
    width:           3,
    backgroundColor: '#007aff',
    borderTopLeftRadius:    16,
    borderBottomLeftRadius: 16,
  },
  iconBox: {
    width:          44, height: 44,
    borderRadius:   14,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  cardContent: { flex: 1 },
  titleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   4,
  },
  cardTitle:    { fontSize: 14, fontWeight: '600', color: '#0f172a', flex: 1, marginRight: 8 },
  newBadge: {
    backgroundColor:   '#007aff',
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      6,
  },
  newBadgeText: { fontSize: 9, fontWeight: '700', color: 'white', letterSpacing: 0.3 },
  cardDesc:     { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 8 },
  timeRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText:     { fontSize: 10, color: '#94a3b8', fontWeight: '500' },

  // ── swipe delete
  swipeDelete: {
    backgroundColor:  '#ef4444',
    justifyContent:   'center',
    alignItems:       'center',
    width:            72,
    borderRadius:     16,
    marginLeft:       8,
    marginBottom:     10,
  },
  swipeDeleteText: { color: 'white', fontSize: 11, fontWeight: '600', marginTop: 4 },

  // ── empty
  emptyWrap: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyIconBox: {
    width:           72, height: 72, borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems:      'center', justifyContent: 'center',
    marginBottom:    16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1e293b', marginBottom: 6 },
  emptySub:   { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 19 },
});