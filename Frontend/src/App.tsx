import { useState } from 'react';
import Sidebar from './components/Sidebar';
import TablaTurnos from './components/TablaTurnos';
import ListaEmpleados from './components/ListaEmpleados';
import ListaClientes from './components/ListaClientes';
import ProgramacionExternos from './components/ProgramacionExternos';
import DashboardCoberturaTurnos from './components/DashboardCoberturaTurnos'; // ✅ NUEVO

function App() {
  // ✅ ahora incluye dashboard
  const [vistaActual, setVistaActual] = useState<'turnos' | 'empleados' | 'clientes' | 'externos' | 'dashboard'>('turnos');

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar setVista={setVistaActual as (vista: string) => void} vistaActual={vistaActual} />

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
        {vistaActual === 'externos' && <ProgramacionExternos />}

        {/* ✅ Nueva Vista */}
        {vistaActual === 'dashboard' && <DashboardCoberturaTurnos />}
      </main>
    </div>
  );
}

export default App;