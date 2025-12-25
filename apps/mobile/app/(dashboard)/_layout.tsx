import { Tabs } from 'expo-router';
import { Home, FileText, User, Calendar, ClipboardList } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function DashboardLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#003366',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingTop: 6,
          paddingBottom: 6,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hjem',
          tabBarIcon: ({ color, size }) => <Home size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="claims"
        options={{
          title: 'Reklamasjon',
          tabBarIcon: ({ color, size }) => <FileText size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="agreements"
        options={{
          title: 'Avtaler',
          tabBarIcon: ({ color, size }) => <ClipboardList size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="visits"
        options={{
          title: 'Besøk',
          tabBarIcon: ({ color, size }) => <Calendar size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <User size={size - 2} color={color} />,
        }}
      />
    </Tabs>
  );
}
