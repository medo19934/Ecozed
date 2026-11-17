import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

export const BRAND_GRADIENT = ['#5b6db4', '#7b649b'] as const;

export function Screen({ children }: { children: ReactNode }) {
  return <View className="flex-1 bg-surface">{children}</View>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View className={`rounded-3xl border border-line bg-white p-5 shadow-sm ${className}`}>
      {children}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      className="overflow-hidden rounded-2xl active:opacity-90"
    >
      <LinearGradient
        colors={BRAND_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          minHeight: 56,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-12 items-center justify-center rounded-2xl px-4 active:bg-line"
    >
      <Text className="text-base font-medium text-brand">{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View className="gap-2">
      <Text className="text-start text-sm font-medium text-ink">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#9a9ab0"
        className={`min-h-14 rounded-2xl border bg-white px-4 text-base text-ink ${error ? 'border-danger' : 'border-line'}`}
        {...props}
      />
      {error ? (
        <Text accessibilityRole="alert" className="text-start text-xs text-danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" className="flex-row rounded-2xl bg-line/60 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            className={`min-h-12 flex-1 items-center justify-center rounded-xl ${active ? 'bg-white shadow-sm' : ''}`}
          >
            <Text className={`text-sm font-semibold ${active ? 'text-brand' : 'text-ink-muted'}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
