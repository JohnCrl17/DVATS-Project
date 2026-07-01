import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: (value?: string) => void;
};

type AlertConfig = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: 'prompt' | 'alert';
  secureTextEntry?: boolean;
  placeholder?: string;
};

let _showAlert: (config: AlertConfig) => void = () => {};

export const CustomAlertProvider = () => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [inputValue, setInputValue] = useState('');
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    _showAlert = (cfg: AlertConfig) => {
      setConfig(cfg);
      setInputValue('');
      setVisible(true);
    };
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 18,
          stiffness: 260,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleButton = (btn: AlertButton) => {
    setVisible(false);
    setTimeout(() => {
      if (config?.type === 'prompt') {
        btn.onPress?.(inputValue);
      } else {
        btn.onPress?.();
      }
    }, 200);
  };

  if (!config) return null;

  const buttons = config.buttons || [{ text: 'OK', style: 'default' as const }];
  const isHorizontal = buttons.length === 2;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill}>
        <View style={styles.backdrop}>
          <Animated.View
            style={[
              styles.alertBox,
              { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
            ]}
          >
            {/* Title */}
            <Text style={styles.title}>{config.title}</Text>

            {/* Message */}
            {config.message ? (
              <Text style={styles.message}>{config.message}</Text>
            ) : null}

            {/* Prompt Input */}
            {config.type === 'prompt' && (
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <TextInput
                  style={styles.promptInput}
                  value={inputValue}
                  onChangeText={setInputValue}
                  placeholder={config.placeholder || ''}
                  placeholderTextColor="#aeaeb2"
                  secureTextEntry={config.secureTextEntry}
                  autoFocus
                />
              </KeyboardAvoidingView>
            )}

            {/* Divider */}
            <View style={styles.dividerH} />

            {/* Buttons */}
            <View style={[styles.buttonRow, !isHorizontal && { flexDirection: 'column' }]}>
              {buttons.map((btn, index) => {
                const isCancel = btn.style === 'cancel';
                const isDestructive = btn.style === 'destructive';
                const isLast = index === buttons.length - 1;

                return (
                  <React.Fragment key={index}>
                    {isHorizontal && index > 0 && <View style={styles.dividerV} />}
                    {!isHorizontal && index > 0 && <View style={styles.dividerH} />}
                    <TouchableOpacity
                      style={[
                        styles.button,
                        isHorizontal && { flex: 1 },
                        !isHorizontal && { width: '100%' },
                      ]}
                      onPress={() => handleButton(btn)}
                      activeOpacity={0.5}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          isCancel && styles.buttonTextCancel,
                          isDestructive && styles.buttonTextDestructive,
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </BlurView>
    </Modal>
  );
};

// ✅ Drop-in replacement for Alert.alert and Alert.prompt
export const IosAlert = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[]
  ) => {
    _showAlert({ title, message, buttons, type: 'alert' });
  },

  prompt: (
    title: string,
    message?: string,
    callback?: (value: string) => void,
    type?: 'default' | 'secure-text' | 'plain-text',
    defaultValue?: string
  ) => {
    _showAlert({
      title,
      message,
      type: 'prompt',
      secureTextEntry: type === 'secure-text',
      placeholder: defaultValue || '',
      buttons: [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {},
        },
        {
          text: 'OK',
          style: 'default',
          onPress: (val?: string) => callback?.(val || ''),
        },
      ],
    });
  },
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  alertBox: {
    width: width * 0.72,
    backgroundColor: 'rgba(242,242,247,0.97)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 4,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 13,
    color: '#3c3c43',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    lineHeight: 18,
  },
  promptInput: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.15)',
  },
  dividerH: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60,60,67,0.25)',
  },
  dividerV: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60,60,67,0.25)',
  },
  buttonRow: {
    flexDirection: 'row',
    minHeight: 44,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  buttonTextCancel: {
    fontWeight: '600',
    color: '#007AFF',
  },
  buttonTextDestructive: {
    color: '#FF3B30',
    fontWeight: '400',
  },
});