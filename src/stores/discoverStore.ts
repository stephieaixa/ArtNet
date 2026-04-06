import { create } from 'zustand';
import type { FilterState } from '../components/shared/FilterModal';

const EMPTY_FILTERS: FilterState = {
  venueTypes: [], regions: [], countries: [], genres: [], disciplines: [],
};

type DiscoverStore = {
  filters: FilterState;
  search: string;
  setFilters: (f: FilterState) => void;
  setSearch: (s: string) => void;
  resetFilters: () => void;
};

export const useDiscoverStore = create<DiscoverStore>((set) => ({
  filters: EMPTY_FILTERS,
  search: '',
  setFilters: (filters) => set({ filters }),
  setSearch: (search) => set({ search }),
  resetFilters: () => set({ filters: EMPTY_FILTERS, search: '' }),
}));
