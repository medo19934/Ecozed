import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { areaForRole, homeRouteFor } from '@/lib/roles';

export default function AuthLayout() {
  const { status, user } = useAuth();
  if (status === 'signedIn' && areaForRole(user?.role))
    return <Redirect href={homeRouteFor(user?.role)} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
