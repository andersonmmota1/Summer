"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface FilterState {
  selectedSupplier: string | null;
  // Adicione outros filtros globais aqui conforme necessário
}

interface FilterContextType {
  filters: FilterState;
  setFilter: (newFilters: Partial<FilterState>) => void;
  clearFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState<FilterState>({
    selectedSupplier: null,
  });

  const setFilter = (newFilters: Partial<FilterState>) => {
    setFilters(prevFilters => ({ ...prevFilters, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({
      selectedSupplier: null,
    });
  };

  return (
    <FilterContext.Provider value={{ filters, setFilter, clearFilters }}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilter = () => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
};