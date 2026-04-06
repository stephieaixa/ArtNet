import { create } from 'zustand';
import type { User, ArtistProfile, VenueProfile } from '../types';

interface AuthState {
  user: User | null;
  artistProfile: ArtistProfile | null;
  venueProfile: VenueProfile | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setArtistProfile: (profile: ArtistProfile | null) => void;
  setVenueProfile: (profile: VenueProfile | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  artistProfile: null,
  venueProfile: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setArtistProfile: (artistProfile) => set({ artistProfile }),
  setVenueProfile: (venueProfile) => set({ venueProfile }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, artistProfile: null, venueProfile: null, isLoading: false }),
}));
