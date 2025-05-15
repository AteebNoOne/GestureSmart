// ReportHistoryScreen.tsx
import { NavigationProp } from '@react-navigation/native';
import { format } from 'date-fns';
import React, { useState } from 'react';
import { SafeAreaView, View, TouchableOpacity, ScrollView ,StyleSheet,Text} from 'react-native';
import { spacing, typography } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from "../hooks/useTheme";

interface ReportHistoryScreenProps {
  navigation: NavigationProp<any>;
}

export const ReportHistoryScreen:React.FC<ReportHistoryScreenProps> = ({ navigation }) => {
  const { colors } = useTheme();
  const [reports] = useState([
    {
      id: '1',
      patientName: 'John Doe',
      date: new Date(2024, 1, 15),
      status: 'completed',
      pdfUrl: 'report1.pdf',
    },
    {
      id: '2',
      patientName: 'Jane Smith',
      date: new Date(2024, 1, 14),
      status: 'completed',
      pdfUrl: 'report2.pdf',
    },
    // Add more reports as needed
  ]);

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      padding: spacing.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    title: {
      fontSize: typography.fontSize.xl,
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
      marginLeft: spacing.md,
    },
    reportCard: {
      backgroundColor: colors.surface,
      borderRadius: spacing.md,
      padding: spacing.lg,
      marginBottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
    },
    reportInfo: {
      flex: 1,
    },
    patientName: {
      fontSize: typography.fontSize.md,
      fontFamily: typography.fontFamily.semibold,
      color: colors.text,
    },
    reportDate: {
      fontSize: typography.fontSize.sm,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    viewButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: spacing.sm,
    },
    viewButtonText: {
      color: '#FFFFFF',
      fontSize: typography.fontSize.sm,
      fontFamily: typography.fontFamily.medium,
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons 
              name="arrow-left" 
              size={24} 
              color={colors.text} 
            />
          </TouchableOpacity>
          <Text style={styles.title}>Report History</Text>
        </View>

        <ScrollView>
          {reports.map(report => (
            <View key={report.id} style={styles.reportCard}>
              <View style={styles.reportInfo}>
                <Text style={styles.patientName}>{report.patientName}</Text>
                <Text style={styles.reportDate}>
                  {format(report.date, 'MMM dd, yyyy HH:mm')}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.viewButton}
                onPress={() => {
                  // Handle PDF viewing
                  console.log(`View PDF: ${report.pdfUrl}`);
                }}
              >
                <Text style={styles.viewButtonText}>View PDF</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

