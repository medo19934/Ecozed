import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

WebBrowser.maybeCompleteAuthSession();

const ids = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
};
export const googleConfigured = Boolean(ids.webClientId || ids.iosClientId || ids.androidClientId);

function GoogleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48" accessibilityElementsHidden>
      <Path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <Path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </Svg>
  );
}

function ConfiguredGoogleButton({
  onIdToken,
  busy,
}: {
  onIdToken: (token: string) => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(ids);

  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.params.id_token ?? response.authentication?.idToken;
      if (token) onIdToken(token);
    }
  }, [response, onIdToken]);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!request || busy}
      onPress={() => promptAsync()}
      className="min-h-14 flex-row items-center justify-center gap-3 rounded-full border border-line bg-white px-5 active:bg-surface"
    >
      {busy ? <ActivityIndicator color="#5b6db4" /> : <GoogleLogo />}
      <Text className="text-base font-semibold text-ink">{t('auth.google')}</Text>
    </Pressable>
  );
}

/** Google sign-in (sign up or log in). Needs EXPO_PUBLIC_GOOGLE_*_CLIENT_ID. */
export function GoogleButton(props: { onIdToken: (token: string) => void; busy?: boolean }) {
  const { t } = useTranslation();
  if (!googleConfigured) {
    return (
      <View className="rounded-2xl border border-dashed border-warning bg-warning/10 p-4">
        <Text className="text-start text-sm text-ink">{t('auth.notConfigured')}</Text>
      </View>
    );
  }
  return <ConfiguredGoogleButton {...props} />;
}
