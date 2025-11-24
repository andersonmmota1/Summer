import React from 'react';

const Estoque: React.FC = () => {
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Gestão de Estoque
      </h2>
      <p className="text-gray-700 dark:text-gray-300">
        Aqui você poderá visualizar e gerenciar todos os itens do seu estoque.
      </p>
    </div>
  );
};

export default Estoque;