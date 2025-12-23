# 🎨 Myhrvoldgruppen UI Design Guide

> Inspirert av moderne dashboard-design (Patient Portal, EXLM Dashboard style)
> For Claude Code: Følg disse retningslinjene for all UI-utvikling

---

## 🎯 Design-prinsipper

### 1. Clean & Minimal
- Mye whitespace
- Færre elementer per side
- Fokus på innhold, ikke dekorasjon
- Ingen unødvendig visuell støy

### 2. Card-Based Layout
- Alt innhold i avrundede kort
- Subtile skygger for dybde
- Konsistent spacing mellom kort
- Hover-effekter som gir feedback

### 3. Smooth Interactions
- Alle overganger animert (200-300ms)
- Subtile hover states
- Loading skeletons istedenfor spinners
- Micro-interactions på knapper

### 4. Professional Yet Friendly
- Ikke for "corporate", ikke for "playful"
- Balansert bruk av farger
- Profesjonelle ikoner (Lucide)
- Vennlig, men effektiv

---

## 🎨 Fargepalett (Oppdatert)

### Primærfarger
```css
/* Hovedfarge - Mørk blå */
--primary-900: #001a33;    /* Darkest */
--primary-800: #002244;    /* Header bg */
--primary-700: #003366;    /* Brand primary */
--primary-600: #004488;    /* Hover states */
--primary-500: #0055aa;    /* Links */

/* Aksentfarge - Teal (moderne touch) */
--accent-600: #0d9488;     /* Primary accent */
--accent-500: #14b8a6;     /* Hover */
--accent-400: #2dd4bf;     /* Light accent */
--accent-100: #ccfbf1;     /* Background tint */
```

### Nøytrale farger
```css
/* Grays - Varmere tone */
--gray-900: #111827;       /* Text primary */
--gray-700: #374151;       /* Text secondary */
--gray-500: #6b7280;       /* Text muted */
--gray-300: #d1d5db;       /* Borders */
--gray-200: #e5e7eb;       /* Dividers */
--gray-100: #f3f4f6;       /* Background alt */
--gray-50: #f9fafb;        /* Background main */
--white: #ffffff;          /* Cards */
```

### Semantiske farger
```css
/* Status */
--success-500: #22c55e;    /* Godkjent */
--success-100: #dcfce7;    /* Success bg */

--warning-500: #f59e0b;    /* Venter */
--warning-100: #fef3c7;    /* Warning bg */

--error-500: #ef4444;      /* Feil/Avvist */
--error-100: #fee2e2;      /* Error bg */

--info-500: #3b82f6;       /* Info */
--info-100: #dbeafe;       /* Info bg */
```

---

## 📐 Spacing System

```css
/* Base unit: 4px */
--space-1: 4px;    /* 0.25rem */
--space-2: 8px;    /* 0.5rem */
--space-3: 12px;   /* 0.75rem */
--space-4: 16px;   /* 1rem - Standard gap */
--space-5: 20px;   /* 1.25rem */
--space-6: 24px;   /* 1.5rem - Card padding */
--space-8: 32px;   /* 2rem - Section gap */
--space-10: 40px;  /* 2.5rem */
--space-12: 48px;  /* 3rem - Large gap */
--space-16: 64px;  /* 4rem */
```

### Anvendelse
```
Card padding: 24px (space-6)
Card gap: 16px (space-4)
Section margin: 32px (space-8)
Input padding: 12px 16px
Button padding: 12px 24px
```

---

## 🔲 Border Radius

```css
--radius-sm: 6px;      /* Små elementer, badges */
--radius-md: 8px;      /* Inputs, small cards */
--radius-lg: 12px;     /* Standard kort */
--radius-xl: 16px;     /* Store kort, modals */
--radius-2xl: 20px;    /* Hero sections */
--radius-full: 9999px; /* Piller, avatarer */
```

---

## 🌑 Shadows (Subtile)

```css
/* Elevation system */
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.03);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.05), 0 4px 6px rgba(0, 0, 0, 0.03);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.05), 0 10px 10px rgba(0, 0, 0, 0.02);

/* Card shadows */
--shadow-card: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-card-hover: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
```

---

## 📝 Typography

### Font Stack
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Sizes & Weights
```css
/* Headings */
--text-4xl: 36px;  /* Hero, page titles */
--text-3xl: 30px;  /* Section titles */
--text-2xl: 24px;  /* Card titles */
--text-xl: 20px;   /* Subheadings */
--text-lg: 18px;   /* Large body */

/* Body */
--text-base: 16px; /* Default body */
--text-sm: 14px;   /* Secondary text */
--text-xs: 12px;   /* Captions, badges */

/* Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Line Heights
```css
--leading-tight: 1.25;   /* Headings */
--leading-snug: 1.375;   /* Subheadings */
--leading-normal: 1.5;   /* Body text */
--leading-relaxed: 1.625; /* Long text */
```

---

## 🧩 Komponent-mønstre

### 1. Page Header
```tsx
<View className="bg-white border-b border-gray-200">
  <View className="px-6 py-5">
    <Text className="text-2xl font-semibold text-gray-900">
      Reklamasjoner
    </Text>
    <Text className="text-sm text-gray-500 mt-1">
      Administrer kunde- og leverandørsaker effektivt
    </Text>
  </View>
</View>
```

### 2. Stats Card (Grid)
```tsx
<View className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6">
  <View className="bg-white rounded-xl p-5 shadow-card">
    <View className="flex-row items-center gap-3">
      <View className="w-10 h-10 rounded-lg bg-accent-100 items-center justify-center">
        <FileText size={20} color="#0d9488" />
      </View>
      <View>
        <Text className="text-2xl font-bold text-gray-900">24</Text>
        <Text className="text-sm text-gray-500">Totalt</Text>
      </View>
    </View>
  </View>
</View>
```

### 3. List Card (Clickable)
```tsx
<Pressable 
  className="bg-white rounded-xl p-4 shadow-card active:shadow-sm transition-shadow"
  style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
>
  <View className="flex-row items-center gap-4">
    {/* Avatar/Icon */}
    <View className="w-12 h-12 rounded-full bg-primary-100 items-center justify-center">
      <Text className="text-primary-700 font-semibold">UB</Text>
    </View>
    
    {/* Content */}
    <View className="flex-1">
      <Text className="text-base font-medium text-gray-900">UBE-2412-0001</Text>
      <Text className="text-sm text-gray-500">UBERT Varmeskap DCUC31</Text>
    </View>
    
    {/* Badge + Arrow */}
    <View className="items-end gap-2">
      <View className="px-2.5 py-1 rounded-full bg-warning-100">
        <Text className="text-xs font-medium text-warning-700">Venter</Text>
      </View>
      <ChevronRight size={20} color="#9ca3af" />
    </View>
  </View>
</Pressable>
```

### 4. Form Input
```tsx
<View className="gap-1.5">
  <Text className="text-sm font-medium text-gray-700">E-post</Text>
  <TextInput
    className="h-11 px-4 bg-white border border-gray-300 rounded-lg text-base text-gray-900 focus:border-accent-500 focus:ring-2 focus:ring-accent-100"
    placeholder="navn@eksempel.no"
    placeholderTextColor="#9ca3af"
  />
  <Text className="text-xs text-gray-500">Vi sender bekreftelse hit</Text>
</View>
```

### 5. Primary Button
```tsx
<Pressable 
  className="h-11 px-6 bg-accent-600 rounded-lg items-center justify-center active:bg-accent-700 transition-colors"
  style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
>
  <Text className="text-base font-semibold text-white">Opprett sak</Text>
</Pressable>
```

### 6. Secondary Button
```tsx
<Pressable className="h-11 px-6 bg-white border border-gray-300 rounded-lg items-center justify-center active:bg-gray-50">
  <Text className="text-base font-medium text-gray-700">Avbryt</Text>
</Pressable>
```

### 7. Status Badge
```tsx
// Definerte varianter
const badgeVariants = {
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700', 
  error: 'bg-error-100 text-error-700',
  info: 'bg-info-100 text-info-700',
  neutral: 'bg-gray-100 text-gray-700',
};

<View className={`px-2.5 py-1 rounded-full ${badgeVariants.success}`}>
  <Text className="text-xs font-medium">Godkjent</Text>
</View>
```

### 8. Empty State
```tsx
<View className="flex-1 items-center justify-center py-16">
  <View className="w-16 h-16 rounded-2xl bg-gray-100 items-center justify-center mb-4">
    <Inbox size={32} color="#9ca3af" />
  </View>
  <Text className="text-lg font-semibold text-gray-900 mb-1">
    Ingen reklamasjoner
  </Text>
  <Text className="text-sm text-gray-500 text-center max-w-xs mb-6">
    Du har ingen aktive reklamasjoner. Opprett en ny for å komme i gang.
  </Text>
  <Pressable className="h-11 px-6 bg-accent-600 rounded-lg">
    <Text className="text-base font-semibold text-white">Opprett sak</Text>
  </Pressable>
</View>
```

### 9. Modal / Bottom Sheet
```tsx
<View className="flex-1 bg-black/40">
  <View className="flex-1" /> {/* Backdrop */}
  <View className="bg-white rounded-t-2xl max-h-[90%]">
    {/* Handle */}
    <View className="items-center py-3">
      <View className="w-10 h-1 rounded-full bg-gray-300" />
    </View>
    
    {/* Header */}
    <View className="px-6 pb-4 border-b border-gray-100">
      <Text className="text-xl font-semibold text-gray-900">Velg leverandør</Text>
    </View>
    
    {/* Content */}
    <ScrollView className="px-6 py-4">
      {/* ... */}
    </ScrollView>
  </View>
</View>
```

### 10. Wizard Step Indicator
```tsx
<View className="flex-row items-center px-6 py-4 bg-white border-b border-gray-100">
  {steps.map((step, index) => (
    <React.Fragment key={step.id}>
      {/* Step circle */}
      <View className={`w-8 h-8 rounded-full items-center justify-center ${
        index < currentStep 
          ? 'bg-accent-600' 
          : index === currentStep 
            ? 'bg-accent-600' 
            : 'bg-gray-200'
      }`}>
        {index < currentStep ? (
          <Check size={16} color="white" />
        ) : (
          <Text className={`text-sm font-semibold ${
            index === currentStep ? 'text-white' : 'text-gray-500'
          }`}>
            {index + 1}
          </Text>
        )}
      </View>
      
      {/* Connector line */}
      {index < steps.length - 1 && (
        <View className={`flex-1 h-0.5 mx-2 ${
          index < currentStep ? 'bg-accent-600' : 'bg-gray-200'
        }`} />
      )}
    </React.Fragment>
  ))}
</View>
```

---

## 🔄 Animasjoner (React Native Reanimated)

### Standard Timing
```ts
const timing = {
  fast: 150,
  normal: 200,
  slow: 300,
  spring: { damping: 15, stiffness: 150 },
};
```

### Fade In
```ts
const fadeIn = useAnimatedStyle(() => ({
  opacity: withTiming(1, { duration: 200 }),
}));
```

### Slide Up (for modals)
```ts
const slideUp = useAnimatedStyle(() => ({
  transform: [
    { translateY: withSpring(0, { damping: 20, stiffness: 200 }) }
  ],
}));
```

### Scale on Press
```ts
const scaleOnPress = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(pressed ? 0.97 : 1) }],
}));
```

---

## 📱 Responsive Breakpoints

```css
/* Mobile first */
sm: 640px   /* Large phones */
md: 768px   /* Tablets */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

### Grid Layouts
```tsx
// Stats cards
<View className="grid grid-cols-2 md:grid-cols-4 gap-4">

// List with sidebar (desktop)
<View className="flex-col lg:flex-row">
  <View className="lg:w-80 border-r" /> {/* Sidebar */}
  <View className="flex-1" /> {/* Content */}
</View>
```

---

## ✅ Do's and Don'ts

### ✅ Do
- Bruk konsistent spacing (4px grid)
- Gi kortene subtile skygger
- Animer alle overganger
- Bruk ikoner med text labels
- Hold fargebruken enkel
- Test på både lys og mørk bakgrunn

### ❌ Don't
- Ikke bruk for mange farger samtidig
- Unngå harde skygger
- Ikke bland avrundingsstiler
- Ikke bruk for liten tekst (<12px)
- Unngå kompliserte gradienter
- Ikke overanimer - hold det subtilt

---

## 🎨 Tailwind Config (NativeWind)

```js
// tailwind.config.js
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './features/**/*.{ts,tsx}', './shared/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f0ff',
          100: '#cce0ff',
          200: '#99c2ff',
          300: '#66a3ff',
          400: '#3385ff',
          500: '#0055aa',
          600: '#004488',
          700: '#003366',
          800: '#002244',
          900: '#001a33',
        },
        accent: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
};
```

---

## 📚 Eksempel: Komplett Side

```tsx
// features/claims/screens/ClaimsListScreen.tsx
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Plus, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react-native';

export function ClaimsListScreen() {
  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white border-b border-gray-200">
        <View className="px-6 py-5 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-semibold text-gray-900">
              Reklamasjoner
            </Text>
            <Text className="text-sm text-gray-500 mt-1">
              24 aktive saker
            </Text>
          </View>
          <Pressable className="h-10 px-4 bg-accent-600 rounded-lg flex-row items-center gap-2">
            <Plus size={18} color="white" />
            <Text className="text-sm font-semibold text-white">Ny sak</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1">
        {/* Stats */}
        <View className="p-6">
          <View className="flex-row gap-4">
            <StatsCard icon={FileText} label="Totalt" value={24} color="primary" />
            <StatsCard icon={Clock} label="Venter" value={7} color="warning" />
            <StatsCard icon={CheckCircle} label="Løst" value={15} color="success" />
            <StatsCard icon={AlertCircle} label="Avvist" value={2} color="error" />
          </View>
        </View>

        {/* Filter chips */}
        <View className="px-6 pb-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              <FilterChip label="Alle" active />
              <FilterChip label="Nye" count={5} />
              <FilterChip label="Under behandling" count={7} />
              <FilterChip label="Venter leverandør" count={3} />
            </View>
          </ScrollView>
        </View>

        {/* List */}
        <View className="px-6 gap-3 pb-6">
          <ClaimCard 
            number="UBE-2412-0001"
            product="UBERT Varmeskap DCUC31"
            supplier="UBERT"
            status="pending"
          />
          <ClaimCard 
            number="ELE-2412-0003"
            product="Electrolux Oppvaskmaskin"
            supplier="Electrolux"
            status="approved"
          />
          {/* ... */}
        </View>
      </ScrollView>
    </View>
  );
}
```

---

## 🔗 Ressurser

- **Ikoner**: [Lucide Icons](https://lucide.dev) - Konsistent, pen stil
- **Font**: [Inter](https://rsms.me/inter/) - Moderne, lesbar
- **Inspirasjon**: Dribbble dashboards, Linear, Notion
- **Animasjoner**: React Native Reanimated 3

---

> **Husk**: Design handler om å løse problemer for brukeren. 
> Hold det enkelt, konsistent, og fokusert på oppgaven.
