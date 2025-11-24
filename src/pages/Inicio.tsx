import React from 'react';

const Inicio: React.FC = () => {
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Bem-vindo ao Dashboard de Gestão do Restaurante!
      </h2>
      <p className="text-gray-700 dark:text-gray-300">
        Use a navegação acima para explorar as diferentes seções da gestão do seu restaurante.
      </p>
    </div>
  );
};

export default Inicio;