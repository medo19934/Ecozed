import { Baby } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { API_URL } from '@/lib/api';
import { tokenStore } from '@/lib/token-store';

/** Authenticated photo (private API file) with a gendered placeholder. */
export function ChildPhoto({
  path,
  gender,
  size = 52,
}: {
  path: string | null;
  gender: 'MALE' | 'FEMALE';
  size?: number;
}) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (path) void tokenStore.get().then((t) => setToken(t?.accessToken ?? null));
  }, [path]);
  const bg = gender === 'FEMALE' ? '#f6e8f1' : '#e9ecf6';
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }}
      className="items-center justify-center overflow-hidden"
    >
      {path && token ? (
        <Image
          source={{ uri: `${API_URL}${path}`, headers: { Authorization: `Bearer ${token}` } }}
          style={{ width: size, height: size }}
        />
      ) : (
        <Baby color={gender === 'FEMALE' ? '#7b649b' : '#5b6db4'} size={size / 2} />
      )}
    </View>
  );
}

export function ChildRow({
  photoPath,
  gender,
  name,
  lines,
  badge,
  onPress,
}: {
  badge?: ReactNode;
  /** Opens the child profile when given. */
  onPress?: () => void;
  photoPath: string | null;
  gender: 'MALE' | 'FEMALE';
  name: string;
  lines: (string | null | undefined)[];
}) {
  const Box = onPress ? Pressable : View;
  return (
    <Box
      {...(onPress ? { onPress, accessibilityRole: 'button' as const } : {})}
      className="flex-row items-center gap-4 rounded-3xl border border-line bg-white p-4"
    >
      <ChildPhoto path={photoPath} gender={gender} />
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-start text-base font-semibold text-ink">{name}</Text>
          {badge}
        </View>
        {lines.filter(Boolean).map((l, i) => (
          <Text key={i} className="text-start text-sm text-ink-muted">
            {l}
          </Text>
        ))}
      </View>
    </Box>
  );
}
