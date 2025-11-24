import React from 'react';

const FluxoDeCaixa: React.FC = () => {
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Fluxo de Caixa
      </h2>
      <p className="text-gray-700 dark:text-gray-300">
        Acompanhe as entradas e saídas financeiras do seu restaurante.
      </p>
    </div>
  );
};

export default FluxoDeCaixa;