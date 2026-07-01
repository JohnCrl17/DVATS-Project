import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator 
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { IosAlert } from './CustomAlert'; // i-adjust path

interface TicketParams {
  ticket_no?: string;
  created_at?: string;
  enforcer_name?: string;
  badge_number?: string;
  driver_name?: string;
  violation_name?: string;
  fine_amount?: string;
  ticket_id?: string;
  id?: string;
  status?: string;
}

export default function TicketScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() as unknown as TicketParams; 
  
  // 1. Gagamit tayo ng 'currentStatus' para hindi mag-conflict sa variable name
  const [currentStatus, setCurrentStatus] = useState<string>("PENDING"); 
  const [loadingStatus, setLoadingStatus] = useState(true);

  // 2. I-map natin ang data mula sa params (Sinunod ang database names mo)
  const ticketData = {
    no: params.ticket_no || "N/A",
    driver: params.driver_name || "Unknown Driver",
    violation: params.violation_name || "No Violation Listed",
    amount: params.fine_amount || "0",
    date: params.created_at || "N/A",
    enforcer: params.enforcer_name || "N/A",
    badge: params.badge_number || "N/A",
    db_id: params.ticket_id || params.id || "" 
  };

  const API_BASE_URL = "https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api";

  useEffect(() => {
    const fetchStatus = async () => {
      if (!ticketData.db_id) {
        setCurrentStatus(String(params.status || "PENDING").toUpperCase());
        setLoadingStatus(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/get_ticket_status.php?id=${ticketData.db_id}`,
          { 
            headers: { 
              "ngrok-skip-browser-warning": "true",
              "Accept": "application/json"
            } 
          }
        );
        const result = await response.json();
        if (result.status === "success" && result.data?.status) {
          setCurrentStatus(result.data.status.toUpperCase());
        } else {
          setCurrentStatus(String(params.status || "PENDING").toUpperCase());
        }
      } catch (e) {
        console.log("Status fetch error:", e);
        setCurrentStatus(String(params.status || "PENDING").toUpperCase());
      } finally {
        setLoadingStatus(false);
      }
    };

    fetchStatus();
  }, [ticketData.db_id]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.receiptCard}>
          <Text style={styles.ltoHeader}>LTO DASMARIÑAS</Text>
          <Text style={styles.subHeader}>ELECTRONIC TRAFFIC CITATION RECEIPT</Text>

          <View style={styles.ticketBadge}>
            <Text style={styles.ticketNo}>TICKET #{ticketData.no}</Text>
          </View>

          {!loadingStatus && (
            <View style={[
              styles.statusBadge,
              { backgroundColor: currentStatus === "PAID" ? "#16a34a" : "#f59e0b" }
            ]}>
              <Text style={styles.statusText}>{currentStatus}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>DATE/TIME:</Text>
            <Text style={styles.value}>{ticketData.date}</Text>
          </View>

          <View style={styles.infoRow}>
             <Text style={styles.label}>ENFORCER:</Text>
            <Text style={[styles.value, { color: '#2563eb' }]}>
              {ticketData.enforcer.toUpperCase()} ({ticketData.badge})
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>DRIVER:</Text>
            <Text style={styles.value}>{ticketData.driver.toUpperCase()}</Text>
          </View>

          <View style={styles.offenseBox}>
            <Text style={styles.offenseLabel}>OFFENSE CITED</Text>
            <Text style={styles.offenseName}>{ticketData.violation}</Text>
            <Text style={styles.amount}>
              ₱{Number(ticketData.amount).toLocaleString()}
            </Text>
          </View>

          <View style={styles.qrSection}>
            <QRCode
              value={`TICKET:${ticketData.no}|DRIVER:${ticketData.driver}`}
              size={120}
            />
            <Text style={styles.qrText}>SCAN TO VERIFY RECORD</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/(tabs)/history')}
        >
          <Text style={styles.homeBtnText}>GO BACK</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    scrollContent: { padding: 25, alignItems: 'center' },
    receiptCard: { backgroundColor: 'white', width: '100%', padding: 20, borderRadius: 15, elevation: 4 },
    ltoHeader: { textAlign: 'center', fontSize: 18, fontWeight: '900', color: '#1e293b' },
    subHeader: { textAlign: 'center', fontSize: 10, color: '#64748b', fontWeight: '700', marginBottom: 10 },
    ticketBadge: { backgroundColor: '#f8fafc', alignSelf: 'center', padding: 8, borderRadius: 5, marginTop: 5 },
    ticketNo: { fontSize: 12, fontWeight: '800', color: '#1e293b' },
    statusBadge: { alignSelf: 'center', paddingVertical: 5, paddingHorizontal: 15, borderRadius: 10, marginTop: 10 },
    statusText: { color: 'white', fontSize: 12, fontWeight: '900' },
    divider: { height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: '#e2e8f0', marginVertical: 20, borderRadius: 1 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    label: { fontSize: 11, fontWeight: '800', color: '#94a3b8' },
    value: { fontSize: 11, fontWeight: '900', color: '#1e293b' },
    offenseBox: { backgroundColor: '#f8fafc', padding: 20, borderRadius: 15, alignItems: 'center', marginVertical: 10 },
    offenseLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8' },
    offenseName: { fontSize: 18, fontWeight: '900', color: '#ef4444', marginTop: 5, textAlign: 'center' },
    amount: { fontSize: 26, fontWeight: '900', marginTop: 5, color: '#1e293b' },
    qrSection: { alignItems: 'center', marginTop: 20 },
    qrText: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginTop: 10 },
    homeBtn: { marginTop: 20, marginBottom: 40 },
    homeBtnText: { color: '#64748b', fontWeight: '800', fontSize: 14 }
});