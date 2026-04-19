import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FilterState } from '../components/shared/FilterModal';

const EMPTY_FILTERS: FilterState = {
  venueTypes: [], regions: [], countries: [], genres: [], disciplines: [], months: [],
};

type DiscoverStore = {
  filters: FilterState;
  search: string;
  setFilters: (f: FilterState) => void;
  setSearch: (s: string) => void;
  resetFilters: () => void;
};

export const useDiscoverStore = create<DiscoverStore>()(
  persist(
    (set) => ({
      filters: EMPTY_FILTERS,
      search: '',
      setFilters: (filters) => set({ filters }),
      setSearch: (search) => set({ search }),
      resetFilters: () => set({ filters: EMPTY_FILTERS, search: '' }),
    }),
    {
      name: 'artnet-discover-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Solo persistir filtros, no la búsqueda de texto
      partialize: (state) => ({ filters: state.filters }),
    }
  )
);
