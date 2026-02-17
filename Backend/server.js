const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =========================
// DB: CONEXIÓN MYSQL
// =========================
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'turnos_multicarrier_db',
});

db.connect((err) => {
  if (err) console.log('Error conectando a MySQL:', err);
  else console.log('¡Conectado a MySQL exitosamente!');
});

// =========================
// UTILIDADES: HORARIOS / CRUCES
// =========================
const obtenerRangoHorario = (textoTurno) => {
  if (!textoTurno) return null;
  const turno = textoTurno.toUpperCase().trim();

  if (turno === 'AM') return { inicio: 6, fin: 15 };
  if (turno === 'PM') return { inicio: 13, fin: 21 };
  if (turno === 'AM Y PM') return { inicio: 6, fin: 21 };
  if (turno === 'DESC' || turno === 'DESCANSO') return null;

  try {
    const numeros = turno
      .replace(/[^0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .map((n) => parseInt(n, 10));

    if (numeros.length === 2) {
      let [inicio, fin] = numeros;

      if (inicio < 6) inicio += 12;
      if (fin < 6) fin += 12;

      return { inicio, fin };
    }
  } catch (e) {
    console.log('No se pudo parsear turno manual:', turno);
  }

  return null;
};

const hayCruce = (rango1, rango2) => {
  if (!rango1 || !rango2) return false;
  return rango1.inicio < rango2.fin && rango1.fin > rango2.inicio;
};

const horaADecimal = (hhmm) => {
  if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return null;
  const [hh, mm] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh + mm / 60;
};

const verificarCruce = (ini1, fin1, ini2, fin2) => {
  if ([ini1, fin1, ini2, fin2].some((v) => v === null || v === undefined)) return false;
  return ini1 < fin2 && fin1 > ini2;
};

const calcularExtrasFecha = (fechaStr) => {
  if (!fechaStr) return null;
  const date = new Date(fechaStr + 'T00:00:00');
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  const oneJan = new Date(date.getFullYear(), 0, 1);
  const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / 86400000);
  const semana = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);

  return {
    dia_semana: dias[date.getDay()],
    mes: meses[date.getMonth()],
    anio: date.getFullYear(),
    semana,
  };
};

const calcularHorasTotales = (horaIni, horaFin) => {
  const ini = horaADecimal(horaIni);
  const fin = horaADecimal(horaFin);
  if (ini == null || fin == null) return 0;
  let total = fin - ini;
  if (total < 0) total += 24;
  return Math.round(total * 10) / 10;
};

// =========================
// RUTAS: EMPLEADOS
// =========================
app.get('/empleados', (req, res) => {
  const sql = `
    SELECT e.*,
           c.sucursal as nombre_sede_fija,
           c.empresa as nombre_empresa_fija
    FROM empleados e
    LEFT JOIN clientes_sucursales c ON e.sede_fija_id = c.id
    ORDER BY e.nombre_completo ASC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.json(err);
    return res.json(result);
  });
});

app.post('/empleados', (req, res) => {
  const { nombre, documento, celular, cargo, idInterwap, estado, sedeFijaId } = req.body;

  const sede = sedeFijaId && sedeFijaId !== '0' ? sedeFijaId : null;

  const sql = `
    INSERT INTO empleados
      (nombre_completo, documento, celular, cargo, id_interwap, estado, sede_fija_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [nombre, documento, celular, cargo, idInterwap, estado || 'Activo', sede], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'La cédula ya existe' });
      return res.status(500).json(err);
    }
    return res.json({ message: 'Empleado creado', id: result.insertId });
  });
});

app.put('/empleados/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, documento, celular, cargo, idInterwap, estado, sedeFijaId } = req.body;

  const sede = sedeFijaId && sedeFijaId !== '0' ? sedeFijaId : null;

  const sql = `
    UPDATE empleados
    SET nombre_completo = ?,
        documento = ?,
        celular = ?,
        cargo = ?,
        id_interwap = ?,
        estado = ?,
        sede_fija_id = ?
    WHERE id = ?
  `;

  db.query(sql, [nombre, documento, celular, cargo, idInterwap, estado, sede, id], (err) => {
    if (err) return res.status(500).json(err);
    return res.json({ message: 'Empleado actualizado' });
  });
});

app.put('/empleados/:id/basico', (req, res) => {
  const { id } = req.params;
  const { nombre, documento, celular, cargo, idInterwap, estado } = req.body;

  const sql = `
    UPDATE empleados
    SET nombre_completo = ?,
        documento = ?,
        celular = ?,
        cargo = ?,
        id_interwap = ?,
        estado = ?
    WHERE id = ?
  `;

  db.query(sql, [nombre, documento, celular, cargo, idInterwap, estado, id], (err) => {
    if (err) return res.status(500).json(err);
    return res.json({ message: 'Empleado actualizado (básico)' });
  });
});

app.delete('/empleados/:id', (req, res) => {
  const { id } = req.params;

  const sqlCheck = 'SELECT COUNT(*) as total FROM programacion_semanal WHERE empleado_id = ?';
  db.query(sqlCheck, [id], (err, result) => {
    if (err) return res.status(500).json(err);

    if (result[0].total > 0) {
      return res.status(400).json({
        error: "No se puede eliminar: Tiene turnos asociados. Mejor cámbialo a estado 'Inactivo'.",
      });
    }

    db.query('DELETE FROM empleados WHERE id = ?', [id], (errDel) => {
      if (errDel) return res.status(500).json(errDel);
      return res.json({ message: 'Empleado eliminado definitivamente' });
    });
  });
});

// =========================
// RUTAS: CLIENTES / SUCURSALES
// =========================
app.get('/clientes', (req, res) => {
  db.query('SELECT * FROM clientes_sucursales', (err, result) => {
    if (err) return res.json(err);
    return res.json(result);
  });
});

app.get('/clientes-filtro', (req, res) => {
  const { tipo } = req.query;

  const sqlConTipo = `
    SELECT *
    FROM clientes_sucursales
    WHERE (? IS NULL OR tipo = ?)
    ORDER BY empresa, sucursal
  `;

  const sqlSinTipo = `
    SELECT *
    FROM clientes_sucursales
    ORDER BY empresa, sucursal
  `;

  db.query(sqlConTipo, [tipo || null, tipo || null], (err, result) => {
    if (!err) return res.json(result);

    if (err.code === 'ER_BAD_FIELD_ERROR') {
      return db.query(sqlSinTipo, (err2, result2) => {
        if (err2) return res.status(500).json(err2);
        return res.json(result2);
      });
    }

    return res.status(500).json(err);
  });
});

app.post('/clientes', (req, res) => {
  const { empresa, sucursal, idCliente, idInterwap, direccion } = req.body;
  const sql = `
    INSERT INTO clientes_sucursales
      (empresa, sucursal, id_cliente_interno, id_interwap, direccion)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(sql, [empresa, sucursal, idCliente, idInterwap, direccion], (err, result) => {
    if (err) return res.json(err);
    return res.json({ message: 'Cliente creado', id: result.insertId });
  });
});

app.put('/clientes/:id', (req, res) => {
  const { id } = req.params;
  const { empresa, sucursal, idCliente, idInterwap, direccion } = req.body;

  const sql = `
    UPDATE clientes_sucursales
    SET empresa = ?,
        sucursal = ?,
        id_cliente_interno = ?,
        id_interwap = ?,
        direccion = ?
    WHERE id = ?
  `;

  db.query(sql, [empresa, sucursal, idCliente, idInterwap, direccion, id], (err) => {
    if (err) return res.status(500).json(err);
    return res.json({ message: 'Cliente actualizado correctamente' });
  });
});

app.delete('/clientes/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM clientes_sucursales WHERE id = ?', [id], (err) => {
    if (err) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res
          .status(400)
          .json({ error: 'No se puede borrar: Esta sede tiene turnos o empleados asignados.' });
      }
      return res.status(500).json(err);
    }
    return res.json({ message: 'Cliente eliminado' });
  });
});

// =========================
// RUTAS: TURNOS EXTERNOS
// =========================
app.get('/turnos-externos', (req, res) => {
  const sql = `
    SELECT t.*,
           e.nombre_completo, e.nombre_completo as nombre_empleado,
           e.documento, e.id_interwap as emp_id_interwap, e.cargo,
           c.empresa, c.sucursal, c.id_interwap as suc_id_interwap
    FROM turnos_externos t
    LEFT JOIN empleados e ON t.empleado_id = e.id
    LEFT JOIN clientes_sucursales c ON t.sucursal_id = c.id
    ORDER BY t.fecha DESC, t.id DESC
  `;
  db.query(sql, (err, result) => (err ? res.status(500).json(err) : res.json(result)));
});

const insertarTurnoExterno = (req, res) => {
  const data = req.body;

  const extras = calcularExtrasFecha(data.fecha);
  const horasTotales = calcularHorasTotales(data.horaIni, data.horaFin);

  const sql = `
    INSERT INTO turnos_externos
      (empleado_id, sucursal_id, fecha, semana, dia_semana, mes, anio,
       hora_inicio, hora_fin, horas_totales,
       id_turno, asignacion, tipo_turno, franja_horaria, estado_turno, estado_ejecucion)
    VALUES (?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?, ?)
  `;

  const valores = [
    data.empleadoId || null,
    data.sucursalId,
    data.fecha,
    extras?.semana || data.semana || null,
    extras?.dia_semana || data.dia || null,
    extras?.mes || data.mes || null,
    extras?.anio || data.anio || null,
    data.horaIni || null,
    data.horaFin || null,
    data.horasTotales || horasTotales,
    data.idTurno || 'No Cargar',
    data.asignacion || data.cargo || null,
    data.tipoTurno || null,
    data.franjaHoraria || null,
    data.estadoTurno || 'OK',
    data.estadoEjecucion || 'Pendiente',
  ];

  db.query(sql, valores, (err, result) => {
    if (err) return res.status(500).json(err);
    return res.json({ message: 'Turno creado', id: result.insertId });
  });
};

app.post('/turnos-externos', (req, res) => {
  const data = req.body;

  if (!data.empleadoId) return insertarTurnoExterno(req, res);

  const inicioNuevo = horaADecimal(data.horaIni);
  const finNuevo = horaADecimal(data.horaFin);

  const sqlExt = `
    SELECT t.*, c.empresa
    FROM turnos_externos t
    JOIN clientes_sucursales c ON t.sucursal_id = c.id
    WHERE t.empleado_id = ? AND t.fecha = ?
  `;

  db.query(sqlExt, [data.empleadoId, data.fecha], (err, turnosExistentes) => {
    if (err) return res.status(500).json(err);

    for (const t of turnosExistentes) {
      if (verificarCruce(inicioNuevo, finNuevo, horaADecimal(t.hora_inicio), horaADecimal(t.hora_fin))) {
        return res
          .status(409)
          .json({ message: `¡Cruce! Ya tiene turno en ${t.empresa} (${t.hora_inicio} - ${t.hora_fin})` });
      }
    }

    const diasCols = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const fechaObj = new Date(data.fecha + 'T00:00:00');
    const nombreDia = diasCols[fechaObj.getDay()];

    const sqlPPY = `
      SELECT p.*, c.sucursal
      FROM programacion_semanal p
      JOIN clientes_sucursales c ON p.sucursal_id = c.id
      WHERE p.empleado_id = ?
        AND ? BETWEEN p.fecha_inicio_semana AND DATE_ADD(p.fecha_inicio_semana, INTERVAL 6 DAY)
    `;

    db.query(sqlPPY, [data.empleadoId, data.fecha], (err2, turnosPPY) => {
      if (err2) return res.status(500).json(err2);

      for (const p of turnosPPY) {
  const rangoPPY = obtenerRangoHorario(p[nombreDia]);
  if (rangoPPY && verificarCruce(inicioNuevo, finNuevo, rangoPPY.inicio, rangoPPY.fin)) {
    return res.status(409).json({
      code: 'CRUCE_PPY',
      message: `¡Cruce! Tiene turno en PPY.`,
      detalle: {
        sucursal: p.sucursal,
        dia: nombreDia,
        turnoTexto: p[nombreDia],
        rango: `${rangoPPY.inicio}:00 - ${rangoPPY.fin}:00`,
        nuevoTurno: `${data.horaIni} - ${data.horaFin}`,
        fecha: data.fecha,
      },
    });
  }
}

      return insertarTurnoExterno(req, res);
    });
  });
});

app.put('/turnos-externos/:id', (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const extras = calcularExtrasFecha(data.fecha);
  const horasTotales = calcularHorasTotales(data.horaIni, data.horaFin);

  const sql = `
    UPDATE turnos_externos
    SET empleado_id = ?,
        sucursal_id = ?,
        fecha = ?,
        semana = ?,
        dia_semana = ?,
        mes = ?,
        anio = ?,
        hora_inicio = ?,
        hora_fin = ?,
        horas_totales = ?,
        id_turno = ?,
        asignacion = ?,
        tipo_turno = ?,
        franja_horaria = ?,
        estado_turno = ?,
        estado_ejecucion = ?
    WHERE id = ?
  `;

  const valores = [
    data.empleadoId || null,
    data.sucursalId,
    data.fecha,
    extras?.semana || data.semana || null,
    extras?.dia_semana || data.dia || null,
    extras?.mes || data.mes || null,
    extras?.anio || data.anio || null,
    data.horaIni || null,
    data.horaFin || null,
    data.horasTotales || horasTotales,
    data.idTurno || 'No Cargar',
    data.asignacion || data.cargo || null,
    data.tipoTurno || null,
    data.franjaHoraria || null,
    data.estadoTurno || 'OK',
    data.estadoEjecucion || 'Pendiente',
    id,
  ];

  db.query(sql, valores, (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'No existe el turno' });
    return res.json({ message: 'Turno actualizado' });
  });
});

app.delete('/turnos-externos/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM turnos_externos WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'No existe el turno' });
    return res.json({ message: 'Turno eliminado' });
  });
});

app.patch('/turnos-externos/:id/liberar', (req, res) => {
  const { id } = req.params;

  const sql = `
    UPDATE turnos_externos
    SET empleado_id = NULL
    WHERE id = ?
  `;

  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'No existe el turno' });
    return res.json({ message: 'Turno liberado (vacante)' });
  });
});

// =========================
// RUTAS: FIJOS
// =========================
app.post('/asignar-fijo', (req, res) => {
  const { empleadoId, sucursalId } = req.body;
  const sql = 'INSERT INTO empleados_fijos (empleado_id, sucursal_id) VALUES (?, ?)';
  db.query(sql, [empleadoId, sucursalId], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Ya es fijo aquí' });
      return res.status(500).json(err);
    }
    return res.json({ message: 'Asignado como Fijo', id: result.insertId });
  });
});

app.get('/fijos/:sucursalId', (req, res) => {
  const { sucursalId } = req.params;
  const sql = `
    SELECT e.*
    FROM empleados e
    JOIN empleados_fijos ef ON e.id = ef.empleado_id
    WHERE ef.sucursal_id = ?
  `;
  db.query(sql, [sucursalId], (err, result) => {
    if (err) return res.json(err);
    return res.json(result);
  });
});

// =========================
// RUTAS: PROGRAMACIÓN SEMANAL
// =========================
app.get('/programacion-semanal', (req, res) => {
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: 'Se requiere la fecha de inicio de semana' });

  const sql = `
    SELECT p.*,
           e.nombre_completo as nombre_empleado,
           c.sucursal as nombre_sucursal
    FROM programacion_semanal p
    JOIN empleados e ON p.empleado_id = e.id
    JOIN clientes_sucursales c ON p.sucursal_id = c.id
    WHERE p.fecha_inicio_semana = ?
  `;
  db.query(sql, [fecha], (err, result) => {
    if (err) return res.json(err);
    return res.json(result);
  });
});

app.post('/programacion-semanal/actualizar', (req, res) => {
  const { sucursalId, empleadoId, tipo, dia, valor, fechaSemana } = req.body;
  if (!fechaSemana) return res.status(400).json({ error: 'Falta fecha semana' });

  const rangoNuevo = obtenerRangoHorario(valor);
  if (!rangoNuevo) return ejecutarUpdate();

  const sqlCheck = `
    SELECT sucursal_id, ${dia} as turno_existente
    FROM programacion_semanal
    WHERE empleado_id = ?
      AND fecha_inicio_semana = ?
      AND sucursal_id != ?
  `;

  db.query(sqlCheck, [empleadoId, fechaSemana, sucursalId], (err, resultados) => {
    if (err) return res.status(500).json(err);

    for (const fila of resultados) {
      const rangoExistente = obtenerRangoHorario(fila.turno_existente);
      if (hayCruce(rangoNuevo, rangoExistente)) {
        return res.status(409).json({
          error: 'CRUCE DE TURNOS',
          mensaje: `El empleado ya tiene turno (${fila.turno_existente}) en otra sede ese día.`,
        });
      }
    }

    ejecutarUpdate();
  });

  function ejecutarUpdate() {
    const sql = `
      INSERT INTO programacion_semanal
        (sucursal_id, empleado_id, tipo_empleado, fecha_inicio_semana, ${dia})
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE ${dia} = ?
    `;

    db.query(sql, [sucursalId, empleadoId, tipo, fechaSemana, valor, valor], (err) => {
      if (err) return res.status(500).json(err);
      return res.json({ message: 'Turno actualizado' });
    });
  }
});

app.post('/programacion-semanal/agregar', (req, res) => {
  const { sucursalId, empleadoId, tipo, fechaSemana } = req.body;
  if (!fechaSemana) return res.status(400).json({ error: 'Falta fecha semana' });

  const sql = `
    INSERT INTO programacion_semanal
      (sucursal_id, empleado_id, tipo_empleado, fecha_inicio_semana)
    VALUES (?, ?, ?, ?)
  `;
  db.query(sql, [sucursalId, empleadoId, tipo, fechaSemana], (err, result) => {
    if (err) return res.json(err);
    return res.json({ message: 'Empleado agregado a la tabla', id: result.insertId });
  });
});

app.delete('/programacion-semanal/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM programacion_semanal WHERE id = ?', [id], (err) => {
    if (err) return res.json(err);
    return res.json({ message: 'Eliminado' });
  });
});

app.put('/programacion-semanal/editar-empleado', (req, res) => {
  const { idProgramacion, nuevoEmpleadoId } = req.body;

  db.query(
    'UPDATE programacion_semanal SET empleado_id = ? WHERE id = ?',
    [nuevoEmpleadoId, idProgramacion],
    (err) => {
      if (err) return res.status(500).json({ error: 'Error al actualizar empleado' });
      return res.json({ message: 'Empleado actualizado correctamente' });
    }
  );
});

app.post('/rotar-turnos', (req, res) => {
  const { fechaSemana } = req.body;
  if (!fechaSemana) return res.status(400).json({ error: 'Falta fecha semana para rotar' });

  const sqlGet = `
    SELECT *
    FROM programacion_semanal
    WHERE tipo_empleado = 'Fijo' AND fecha_inicio_semana = ?
    ORDER BY sucursal_id, id ASC
  `;

  db.query(sqlGet, [fechaSemana], async (err, resultados) => {
    if (err) return res.status(500).json({ error: 'Error al leer turnos' });

    const porSucursal = {};
    resultados.forEach((fila) => {
      if (!porSucursal[fila.sucursal_id]) porSucursal[fila.sucursal_id] = [];
      porSucursal[fila.sucursal_id].push(fila);
    });

    const actualizaciones = [];

    Object.keys(porSucursal).forEach((sucursalId) => {
      const filas = porSucursal[sucursalId];
      if (filas.length <= 1) return;

      const ultimoIndex = filas.length - 1;
      const turnosDelUltimo = {
        sabado: filas[ultimoIndex].sabado,
        domingo: filas[ultimoIndex].domingo,
        lunes: filas[ultimoIndex].lunes,
        martes: filas[ultimoIndex].martes,
        miercoles: filas[ultimoIndex].miercoles,
        jueves: filas[ultimoIndex].jueves,
        viernes: filas[ultimoIndex].viernes,
      };

      for (let i = ultimoIndex; i > 0; i--) {
        const filaActual = filas[i];
        const filaAnterior = filas[i - 1];

        actualizaciones.push({
          id: filaActual.id,
          sabado: filaAnterior.sabado,
          domingo: filaAnterior.domingo,
          lunes: filaAnterior.lunes,
          martes: filaAnterior.martes,
          miercoles: filaAnterior.miercoles,
          jueves: filaAnterior.jueves,
          viernes: filaAnterior.viernes,
        });
      }

      actualizaciones.push({ id: filas[0].id, ...turnosDelUltimo });
    });

    if (actualizaciones.length === 0) return res.json({ message: 'No hubo cambios (pocos fijos)' });

    try {
      await Promise.all(
        actualizaciones.map(
          (act) =>
            new Promise((resolve, reject) => {
              const sqlUpdate = `
                UPDATE programacion_semanal
                SET sabado=?, domingo=?, lunes=?, martes=?, miercoles=?, jueves=?, viernes=?
                WHERE id=?
              `;
              const valores = [
                act.sabado,
                act.domingo,
                act.lunes,
                act.martes,
                act.miercoles,
                act.jueves,
                act.viernes,
                act.id,
              ];

              db.query(sqlUpdate, valores, (err2, result2) => (err2 ? reject(err2) : resolve(result2)));
            })
        )
      );

      return res.json({ message: 'Rotación de turnos completada exitosamente' });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Error interno' });
    }
  });
});

app.post('/replicar-programacion', (req, res) => {
  const { fechaAnterior, fechaNueva } = req.body;
  if (!fechaAnterior || !fechaNueva) return res.status(400).json({ error: 'Faltan fechas' });

  const sqlCheck = 'SELECT COUNT(*) as total FROM programacion_semanal WHERE fecha_inicio_semana = ?';
  db.query(sqlCheck, [fechaNueva], (err, result) => {
    if (err) return res.status(500).json(err);

    if (result[0].total > 0) return res.json({ message: 'La semana ya tiene datos, no se replicó nada.' });

    const sqlCopy = `
      INSERT INTO programacion_semanal
        (sucursal_id, empleado_id, tipo_empleado, fecha_inicio_semana, sabado, domingo, lunes, martes, miercoles, jueves, viernes)
      SELECT sucursal_id, empleado_id, 'Fijo', ?, sabado, domingo, lunes, martes, miercoles, jueves, viernes
      FROM programacion_semanal
      WHERE fecha_inicio_semana = ? AND tipo_empleado = 'Fijo'
    `;

    db.query(sqlCopy, [fechaNueva, fechaAnterior], (errCopy, resultCopy) => {
      if (errCopy) return res.status(500).json(errCopy);
      return res.json({ message: 'Programación replicada exitosamente', filasCopiadas: resultCopy.affectedRows });
    });
  });
});

// =========================
// RUTAS: LISTAS MAESTRAS
// =========================
app.get('/empresas-lista', (req, res) => {
  db.query('SELECT * FROM empresas_lista ORDER BY nombre ASC', (err, result) => {
    if (err) return res.json(err);
    return res.json(result);
  });
});

app.post('/empresas-lista', (req, res) => {
  const { nombre } = req.body;
  db.query('INSERT INTO empresas_lista (nombre) VALUES (?)', [nombre.toUpperCase()], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'La empresa ya existe' });
      return res.status(500).json(err);
    }
    return res.json({ message: 'Empresa agregada', id: result.insertId });
  });
});

app.delete('/empresas-lista/:id', (req, res) => {
  db.query('DELETE FROM empresas_lista WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.json(err);
    return res.json({ message: 'Empresa eliminada' });
  });
});

app.get('/cargos-lista', (req, res) => {
  db.query('SELECT * FROM cargos_lista ORDER BY nombre ASC', (err, result) => {
    if (err) return res.json(err);
    return res.json(result);
  });
});

app.post('/cargos-lista', (req, res) => {
  const { nombre } = req.body;
  db.query('INSERT INTO cargos_lista (nombre) VALUES (?)', [nombre.toUpperCase()], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'El cargo ya existe' });
      return res.status(500).json(err);
    }
    return res.json({ message: 'Cargo agregado', id: result.insertId });
  });
});

app.delete('/cargos-lista/:id', (req, res) => {
  db.query('DELETE FROM cargos_lista WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.json(err);
    return res.json({ message: 'Cargo eliminado' });
  });
});

// =========================
// SERVER
// =========================
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});