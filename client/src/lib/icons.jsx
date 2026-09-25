import {
  Utensils, ShoppingCart, Car, House, Zap, ShoppingBag, HeartPulse, Clapperboard, GraduationCap, Receipt, Sparkles, Gift,
  Circle, Briefcase, Laptop, Store, TrendingUp, TrendingDown, CirclePlus, Shield, Plane, PiggyBank, Landmark, Smartphone,
  CreditCard, Wallet, AlarmClock, CalendarClock, CalendarDays, Shapes, Coffee, Bus, Fuel, Pill, Shirt, Tv, Wifi, Dumbbell,
  Baby, Dog, Music, Book, Gamepad2, Wrench, Building2, Heart, Star, Gem, Bike, Train, Stethoscope, Palette, Camera, Globe,
  Sprout, Target, Coins, HandCoins, Banknote,
} from 'lucide-react';

// Icon names are stored in the DB as kebab-case strings.
export const ICONS = {
  utensils: Utensils, 'shopping-cart': ShoppingCart, car: Car, home: House, zap: Zap, 'shopping-bag': ShoppingBag,
  'heart-pulse': HeartPulse, clapperboard: Clapperboard, 'graduation-cap': GraduationCap, receipt: Receipt,
  sparkles: Sparkles, gift: Gift, circle: Circle, briefcase: Briefcase, laptop: Laptop, store: Store,
  'trending-up': TrendingUp, 'trending-down': TrendingDown, 'plus-circle': CirclePlus, shield: Shield, plane: Plane,
  'piggy-bank': PiggyBank, landmark: Landmark, smartphone: Smartphone, 'credit-card': CreditCard, wallet: Wallet,
  'alarm-clock': AlarmClock, 'calendar-clock': CalendarClock, 'calendar-days': CalendarDays, shapes: Shapes,
  coffee: Coffee, bus: Bus, fuel: Fuel, pill: Pill, shirt: Shirt, tv: Tv, wifi: Wifi, dumbbell: Dumbbell, baby: Baby,
  dog: Dog, music: Music, book: Book, gamepad: Gamepad2, wrench: Wrench, building: Building2, heart: Heart, star: Star,
  gem: Gem, bike: Bike, train: Train, stethoscope: Stethoscope, palette: Palette, camera: Camera, globe: Globe,
  sprout: Sprout, target: Target, coins: Coins, 'hand-coins': HandCoins, banknote: Banknote,
};

export const ICON_CHOICES = Object.keys(ICONS).filter((k) => !['trending-down', 'alarm-clock', 'calendar-clock', 'calendar-days', 'shapes'].includes(k));

export function Icon({ name, ...props }) {
  const C = ICONS[name] || Circle;
  return <C {...props} />;
}

export const ACCOUNT_ICONS = { cash: 'banknote', bank: 'landmark', mobile: 'smartphone', card: 'credit-card', other: 'wallet' };

export const COLORS = ['#0f766e', '#10b981', '#84cc16', '#eab308', '#f97316', '#ef4444', '#f43f5e', '#ec4899', '#a855f7', '#8b5cf6', '#6366f1', '#0ea5e9', '#06b6d4', '#14b8a6', '#64748b', '#94a3b8'];
