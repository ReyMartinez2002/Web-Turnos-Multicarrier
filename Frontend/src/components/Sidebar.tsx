import React from 'react';
import { Users, Calendar, Settings, LogOut, Briefcase } from 'lucide-react';

// 1. ESTA PARTE ES LA CLAVE PARA ARREGLAR EL ERROR EN APP.TSX
interface SidebarProps {
  setVista: (vista: string) => void;
  vistaActual: string;
}

interface SidebarItemProps {
  icon: React.ReactNode;
  text: string;
  active?: boolean;
  onClick?: () => void;
}

// 2. Aquí aplicamos la interface al componente
const Sidebar: React.FC<SidebarProps> = ({ setVista, vistaActual }) => {
  return (
    <aside className="h-screen w-64 bg-white border-r border-gray-200 flex flex-col fixed left-0 top-0 z-30">
      <div className="p-6 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">M</div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">Multicarrier</h1>
          <p className="text-[10px] text-gray-500 font-medium">SISTEMA DE GESTIÓN</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 mt-2">
        <SidebarItem 
          icon={<Calendar size={20} />} 
          text="Programación Turnos" 
          active={vistaActual === 'turnos'} 
          onClick={() => setVista('turnos')}
        />
        
        <SidebarItem 
          icon={<Users size={20} />} 
          text="Base de Personal" 
          active={vistaActual === 'empleados'} 
          onClick={() => setVista('empleados')}
        />

        <SidebarItem 
          icon={<Briefcase size={20} />} 
          text="Clientes Externos" 
          active={vistaActual === 'clientes'} 
          onClick={() => setVista('clientes')}
        />

        <div className="pt-4 mt-4 border-t border-gray-100">
           <SidebarItem icon={<Settings size={20} />} text="Configuración" />
        </div>
      </nav>

      <div className="p-4 border-t border-gray-100">
        <button className="flex items-center gap-3 w-full p-3 text-red-500 hover:bg-red-50 rounded-lg transition-all text-sm font-medium">
          <LogOut size={18} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
};

// Componente para los botones individuales
const SidebarItem: React.FC<SidebarItemProps> = ({ icon, text, active = false, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 group ${
      active 
        ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' 
        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
    }`}>
    <span className={`${active ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
      {icon}
    </span>
    <span className="font-medium text-sm">{text}</span>
  </div>
);

export default Sidebar;