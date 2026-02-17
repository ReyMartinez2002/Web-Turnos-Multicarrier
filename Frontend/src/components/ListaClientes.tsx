import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit, Trash2, X, Check, Building, MapPin } from 'lucide-react';

interface Cliente {
  id: number;
  empresa: string;
  sucursal: string;
  idCliente: string;
  idInterwap: string;
  direccion: string;
}

const ListaClientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);

  const clienteVacio: Cliente = {
    id: 0, empresa: '', sucursal: '', idCliente: '', idInterwap: '', direccion: ''
  };

  const [formulario, setFormulario] = useState<Cliente>(clienteVacio);

  // --- 1. CARGAR DESDE BD ---
  const cargarClientes = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/clientes');
      const data = await res.json();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientesFormateados = data.map((c: any) => ({
        id: c.id,
        empresa: c.empresa,
        sucursal: c.sucursal,
        idCliente: c.id_cliente_interno,
        idInterwap: c.id_interwap,
        direccion: c.direccion
      }));
      setClientes(clientesFormateados);
    } catch (error) {
      console.error("Error cargando clientes:", error);
    }
  }, []);

  useEffect(() => {
    cargarClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 2. GUARDAR EN BD ---
  const guardarCliente = async () => {
    if (!formulario.empresa || !formulario.sucursal) return alert("Empresa y Sucursal son obligatorios");

    try {
      const response = await fetch('http://localhost:3001/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulario)
      });

      if (response.ok) {
        alert("Cliente/Sucursal guardada exitosamente");
        setModalAbierto(false);
        cargarClientes();
      } else {
        alert("Error al guardar");
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión");
    }
  };

  const clientesFiltrados = clientes.filter(c => 
    c.empresa.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.sucursal.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-6 p-1">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Clientes Externos (BD)</h2>
          <p className="text-sm text-gray-500">Gestión de sucursales y códigos Interwap</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button 
            onClick={() => { setFormulario(clienteVacio); setModalAbierto(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium whitespace-nowrap"
          >
            <Plus size={18} /> Nuevo Registro
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto bg-white rounded-xl shadow border border-gray-200">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-xs">
            <tr>
              <th className="p-3 border-b">Empresa</th>
              <th className="p-3 border-b">Sucursal</th>
              <th className="p-3 border-b">ID Cliente</th>
              <th className="p-3 border-b">ID Interwap</th>
              <th className="p-3 border-b">Dirección</th>
              <th className="p-3 border-b text-center w-24">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clientesFiltrados.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">No hay registros en BD.</td></tr>
            )}
            {clientesFiltrados.map((cliente) => (
              <tr key={cliente.id} className="hover:bg-indigo-50/50 transition-colors">
                <td className="p-3 align-middle">
                  <div className="font-bold text-gray-800 flex items-center gap-2">
                    <Building size={14} className="text-gray-400"/>
                    {cliente.empresa}
                  </div>
                </td>
                <td className="p-3 align-middle text-gray-700 font-medium">{cliente.sucursal}</td>
                <td className="p-3 align-middle text-gray-500 font-mono text-xs">{cliente.idCliente || '-'}</td>
                <td className="p-3 align-middle">
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded text-xs">{cliente.idInterwap}</span>
                </td>
                <td className="p-3 align-middle text-gray-500 text-xs flex items-center gap-1">
                   <MapPin size={12}/> {cliente.direccion}
                </td>
                <td className="p-3 align-middle text-center">
                  <div className="flex justify-center gap-2">
                    <button className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-md"><Edit size={16} /></button>
                    <button className="p-1.5 text-red-500 hover:bg-red-100 rounded-md"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-indigo-900 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Building size={20}/> Nuevo Registro
              </h3>
              <button onClick={() => setModalAbierto(false)} className="hover:text-gray-300"><X size={24} /></button>
            </div>

            <div className="p-6 grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empresa</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-bold"
                  value={formulario.empresa}
                  onChange={(e) => setFormulario({...formulario, empresa: e.target.value.toUpperCase()})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sucursal</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                  value={formulario.sucursal}
                  onChange={(e) => setFormulario({...formulario, sucursal: e.target.value.toUpperCase()})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID Cliente (Opcional)</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formulario.idCliente}
                    onChange={(e) => setFormulario({...formulario, idCliente: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID INTERWAP</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700"
                    value={formulario.idInterwap}
                    onChange={(e) => setFormulario({...formulario, idInterwap: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dirección</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formulario.direccion}
                  onChange={(e) => setFormulario({...formulario, direccion: e.target.value})}
                />
              </div>
            </div>

            <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t">
              <button onClick={() => setModalAbierto(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded">Cancelar</button>
              <button onClick={guardarCliente} className="px-6 py-2 bg-indigo-600 text-white rounded font-medium flex items-center gap-2 hover:bg-indigo-700">
                <Check size={18} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListaClientes;