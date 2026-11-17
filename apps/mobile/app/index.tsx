import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { homeRouteFor } from '@/lib/roles';

export default function Index() {
  const { status, user } = useAuth();
  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#5b6db4" />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/(auth)/login" />;
  if (user?.mustChangePassword) return <Redirect href="/password?forced=1" />;
  return <Redirect href={homeRouteFor(user?.role)} />;
}
