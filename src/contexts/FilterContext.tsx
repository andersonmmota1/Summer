"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface FilterState {
  selectedSupplier: string | null;
  selectedProduct: string | null; // Novo filtro para o nome do produto interno
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
    selectedProduct: null, // Inicializa como nulo
  });

  const setFilter = (newFilters: Partial<FilterState>) => {
    setFilters(prevFilters => ({ ...prevFilters, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({
      selectedSupplier: null,
      selectedProduct: null, // Limpa também o filtro de produto
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