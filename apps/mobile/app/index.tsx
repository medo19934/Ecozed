import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { homeRouteFor } from '@/lib/roles';

export default function Index() {
  const { status, user } = useAuth();
  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#6366f1" />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/(auth)/login" />;
  return <Redirect href={homeRouteFor(user?.role)} />;
}
