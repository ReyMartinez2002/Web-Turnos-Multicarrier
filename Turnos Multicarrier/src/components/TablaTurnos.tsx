import React from 'react';

const TablaTurnos = () => {
  // Estos datos simulan lo que vendrá de tu base de datos después
  const diasSemana = [
    { fecha: '14 Feb', dia: 'Sábado' },
    { fecha: '15 Feb', dia: 'Domingo' },
    { fecha: '16 Feb', dia: 'Lunes' },
    { fecha: '17 Feb', dia: 'Martes' },
    { fecha: '18 Feb', dia: 'Miércoles' },
    { fecha: '19 Feb', dia: 'Jueves' },
    { fecha: '20 Feb', dia: 'Viernes' },
  ];

  const sucursales = [
    {
      nombre: 'SALITRE',
      empleados: [
        { nombre: 'HERNANDEZ GONZALO', turnos: ['AM', 'AM', 'AM', 'DESCANSO', 'AM Y PM', '11 A 3PM', 'AM'] },
        { nombre: 'CESPEDES BONILLA', turnos: ['PM', 'PM', 'PM', 'AM Y PM', '11 A 3PM', 'DESCANSO', 'PM'] },
      ]
    },
    {
      nombre: 'SARMIENTO',
      empleados: [
        { nombre: 'BAQUERO ROJAS', turnos: ['AM', 'AM', 'AM', 'AM', 'AM Y PM', 'DESCANSO', 'AM'] },
      ]
    }
  ];

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-gray-800 text-white">
          <tr>
            <th className="p-3 border border-gray-600 min-w-[150px]">SUCURSAL / EMPLEADO</th>
            {diasSemana.map((dia, index) => (
              <th key={index} className="p-3 border border-gray-600 text-center min-w-[100px]">
                <div className="text-xs opacity-75 uppercase">{dia.dia}</div>
                <div className="font-bold">{dia.fecha}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sucursales.map((sucursal, sIndex) => (
            <React.Fragment key={sIndex}>
              {/* Encabezado de la Sucursal (Fila Amarilla/Gris) */}
              <tr className="bg-gray-100 font-bold text-gray-700">
                <td className="p-2 border border-gray-200 bg-yellow-100" colSpan={8}>
                  {sucursal.nombre}
                </td>
              </tr>
              
              {/* Filas de Empleados */}
              {sucursal.empleados.map((empleado, eIndex) => (
                <tr key={eIndex} className="hover:bg-blue-50 transition-colors">
                  <td className="p-3 border border-gray-200 font-medium text-gray-900 truncate">
                    {empleado.nombre}
                  </td>
                  {empleado.turnos.map((turno, tIndex) => (
                    <td key={tIndex} className="p-0 border border-gray-200 h-16 relative group">
                      {/* Aquí está la "celda" editable */}
                      <input 
                        type="text" 
                        defaultValue={turno}
                        className={`w-full h-full text-center focus:outline-none focus:bg-blue-100 p-1 text-xs font-semibold
                          ${turno === 'DESCANSO' ? 'text-red-500 bg-red-50' : 
                            turno === 'AM' ? 'text-blue-600' : 
                            turno === 'PM' ? 'text-purple-600' : 'text-gray-700'}
                        `}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TablaTurnos;