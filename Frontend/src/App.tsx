import { useState } from 'react';
import Sidebar from './components/Sidebar';
import TablaTurnos from './components/TablaTurnos';
import ListaEmpleados from './components/ListaEmpleados';
import ListaClientes from './components/ListaClientes';
import ProgramacionExternos from './components/ProgramacionExternos'; // <--- Importación Nueva

function App() {
  // Ahora el estado acepta 'externos'
  const [vistaActual, setVistaActual] = useState('turnos');

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar setVista={setVistaActual} vistaActual={vistaActual} />

      <main className="ml-64 flex-1 p-8 overflow-auto">
        {vistaActual === 'turnos' && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Gestión de Turnos</h1>
              <p className="text-gray-500">Programación semanal de empleados y apoyos.</p>
            </div>
            <TablaTurnos />
          </>
        )}

        {vistaActual === 'empleados' && <ListaEmpleados />}
        {vistaActual === 'clientes' && <ListaClientes />}
        
        {/* Nueva Vista */}
        {vistaActual === 'externos' && <ProgramacionExternos />} 
      </main>
    </div>
  );
}

export default App;