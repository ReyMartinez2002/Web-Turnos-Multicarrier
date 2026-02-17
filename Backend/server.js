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
// AUTO-MARCAR PPY (cuando se crea turno externo)
// =========================
function getFechaInicioSemanaSabado(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00');
  const day = d.getDay(); // 0 dom ... 6 sab
  const offset = day === 6 ? 0 : day + 1; // sab=0, dom=1, lun=2...
  const inicio = new Date(d);
  inicio.setDate(d.getDate() - offset);
  return inicio.toISOString().split('T')[0];
}

function getColDiaDesdeFecha(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00');
  const day = d.getDay();
  const map = {
    6: 'sabado',
    0: 'domingo',
    1: 'lunes',
    2: 'martes',
    3: 'miercoles',
    4: 'jueves',
    5: 'viernes',
  };
  return map[day];
}

function autoMarcarPPYPorExterno({ empleadoId, fechaISO, textoPPY = '5PM' }, cb) {
  if (!empleadoId || !fechaISO) return cb?.(null);

  const fechaSemana = getFechaInicioSemanaSabado(fechaISO);
  const colDia = getColDiaDesdeFecha(fechaISO);
  if (!colDia) return cb?.(null);

  const findSql = `
    SELECT id, ${colDia} as valorActual
    FROM programacion_semanal
    WHERE empleado_id = ? AND fecha_inicio_semana = ?
    LIMIT 1
  `;

  db.query(findSql, [empleadoId, fechaSemana], (err, rows) => {
    if (err) return cb?.(err);
    if (!rows || rows.length === 0) return cb?.(null);

    const fila = rows[0];
    const actual = (fila.valorActual || '').toString().trim().toUpperCase();

    // Solo pisa si está vacío o "PM"
    const sePuedePisar = actual === '' || actual === 'PM';
    if (!sePuedePisar) return cb?.(null);

    const updateSql = `UPDATE programacion_semanal SET ${colDia} = ? WHERE id = ?`;
    db.query(updateSql, [textoPPY, fila.id], (err2) => cb?.(err2 || null));
  });
}

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

// INSERT (con auto-marca PPY)
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

    if (data.empleadoId) {
      return autoMarcarPPYPorExterno({ empleadoId: data.empleadoId, fechaISO: data.fecha, textoPPY: '5PM' }, (errAuto) => {
        if (errAuto) console.error('Auto-marca PPY falló:', errAuto);
        return res.json({ message: 'Turno creado', id: result.insertId });
      });
    }

    return res.json({ message: 'Turno creado', id: result.insertId });
  });
};

// POST (con cruces)
app.post('/turnos-externos', (req, res) => {
  const data = req.body;

  if (!data.empleadoId) return insertarTurnoExterno(req, res);

  const inicioNuevo = horaADecimal(data.horaIni);
  const finNuevo = horaADecimal(data.horaFin);

  // Cruce con EXTERNOS
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
        return res.status(409).json({ message: `¡Cruce! Ya tiene turno en ${t.empresa} (${t.hora_inicio} - ${t.hora_fin})` });
      }
    }

    // Cruce con PPY
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
            message: '¡Cruce! Tiene turno en PPY.',
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

// ============================================
// IMPORTACIÓN MASIVA TURNOS EXTERNOS
// POST /turnos-externos/importar
// body: { turnos: [{ documento|cc|empleadoId, sucursalId, fecha, horaIni, horaFin }] }
// ============================================
app.post('/turnos-externos/importar', (req, res) => {
  const { turnos } = req.body;

  if (!Array.isArray(turnos) || turnos.length === 0) {
    return res.status(400).json({ message: 'No se recibieron turnos para importar.' });
  }

  const normalizados = turnos
    .map((t) => {
      const documento = String(t.documento ?? t.cc ?? '').trim();
      const empleadoId = t.empleadoId ? Number(t.empleadoId) : null;
      const sucursalId = Number(t.sucursalId);
      const fecha = String(t.fecha ?? '').split('T')[0];
      const horaIni = String(t.horaIni ?? '');
      const horaFin = String(t.horaFin ?? '');

      if (!sucursalId || !fecha || !horaIni || !horaFin) return null;
      if (!empleadoId && !documento) return null;

      return { documento, empleadoId, sucursalId, fecha, horaIni, horaFin };
    })
    .filter(Boolean);

  if (normalizados.length === 0) {
    return res.status(400).json({
      message: 'No hay filas válidas. Requiere sucursalId, fecha, horaIni, horaFin y (empleadoId o documento/cc).',
    });
  }

  const docs = [...new Set(normalizados.filter((x) => !x.empleadoId && x.documento).map((x) => x.documento))];
  const empleadosPorDoc = new Map();

  const resolverEmpleados = (cb) => {
    if (docs.length === 0) return cb(null);
    const sql = `SELECT id, documento FROM empleados WHERE documento IN (?)`;
    db.query(sql, [docs], (err, rows) => {
      if (err) return cb(err);
      rows.forEach((r) => empleadosPorDoc.set(String(r.documento), r.id));
      cb(null);
    });
  };

  resolverEmpleados((err0) => {
    if (err0) return res.status(500).json(err0);

    const filas = normalizados.map((t) => {
      const empleadoFinal = t.empleadoId || empleadosPorDoc.get(t.documento) || null;

      const extras = calcularExtrasFecha(t.fecha);
      const horasTotales = calcularHorasTotales(t.horaIni, t.horaFin);

      return [
        empleadoFinal,
        t.sucursalId,
        t.fecha,
        extras?.semana || null,
        extras?.dia_semana || null,
        extras?.mes || null,
        extras?.anio || null,
        t.horaIni,
        t.horaFin,
        horasTotales,
        'No Cargar',
        null,
        null,
        null,
        'OK',
        'Pendiente',
      ];
    });

    const sqlInsert = `
      INSERT INTO turnos_externos
        (empleado_id, sucursal_id, fecha, semana, dia_semana, mes, anio,
         hora_inicio, hora_fin, horas_totales,
         id_turno, asignacion, tipo_turno, franja_horaria, estado_turno, estado_ejecucion)
      VALUES ?
    `;

    db.query(sqlInsert, [filas], (err1, result) => {
      if (err1) return res.status(500).json(err1);

      const listaMarcar = filas.map((f) => ({ empleadoId: f[0], fecha: f[2] })).filter((x) => x.empleadoId);

      let idx = 0;
      let ppyMarcados = 0;

      const marcar = () => {
        if (idx >= listaMarcar.length) {
          return res.json({
            message: 'Importación completa',
            resumen: {
              recibidos: turnos.length,
              validos: normalizados.length,
              insertados: result.affectedRows || 0,
              ppyMarcados,
            },
          });
        }

        const it = listaMarcar[idx++];
        autoMarcarPPYPorExterno({ empleadoId: it.empleadoId, fechaISO: it.fecha, textoPPY: '5PM' }, (e) => {
          if (!e) ppyMarcados++;
          marcar();
        });
      };

      marcar();
    });
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
// IMPORTACIÓN MASIVA DE EMPLEADOS (JSON)
// =========================
app.post('/empleados/importar', (req, res) => {
  const { empleados } = req.body;

  if (!Array.isArray(empleados) || empleados.length === 0) {
    return res.status(400).json({ message: 'No se recibieron empleados para importar.' });
  }

  const filas = empleados
    .map((e) => {
      const nombre = (e.nombre || '').toString().trim().toUpperCase();
      const documento = (e.documento || '').toString().trim();
      const celular = (e.celular || '').toString().trim();
      const cargo = (e.cargo || '').toString().trim().toUpperCase();
      const idInterwap = (e.idInterwap || '').toString().trim();
      const estado = (e.estado || 'Activo').toString().trim();
      const sedeFijaId = e.sedeFijaId && e.sedeFijaId !== '0' && e.sedeFijaId !== 0 ? e.sedeFijaId : null;

      if (!nombre || !documento || !cargo) return null;

      return [nombre, documento, celular, cargo, idInterwap, estado, sedeFijaId];
    })
    .filter(Boolean);

  if (filas.length === 0) {
    return res
      .status(400)
      .json({ message: 'Todos los registros venían vacíos o inválidos (requiere nombre, documento, cargo).' });
  }

  const sql = `
    INSERT IGNORE INTO empleados
      (nombre_completo, documento, celular, cargo, id_interwap, estado, sede_fija_id)
    VALUES ?
  `;

  db.query(sql, [filas], (err, result) => {
    if (err) return res.status(500).json(err);

    const insertados = result.affectedRows || 0;
    const recibidosValidos = filas.length;
    const duplicados = Math.max(recibidosValidos - insertados, 0);

    return res.json({
      message: 'Importación finalizada',
      resumen: {
        recibidos: empleados.length,
        validos: recibidosValidos,
        insertados,
        duplicados,
      },
    });
  });
});

// =========================
// IMPORTACIÓN MASIVA DE CLIENTES / SUCURSALES (JSON)
// =========================
app.post('/clientes/importar', (req, res) => {
  const { clientes } = req.body;

  if (!Array.isArray(clientes) || clientes.length === 0) {
    return res.status(400).json({ message: 'No se recibieron clientes para importar.' });
  }

  const filas = clientes
    .map((c) => {
      const empresa = (c.empresa || '').toString().trim().toUpperCase();
      const sucursal = (c.sucursal || '').toString().trim().toUpperCase();
      const idCliente = (c.idCliente || '').toString().trim() || null;
      const idInterwap = (c.idInterwap || '').toString().trim() || null;
      const direccion = (c.direccion || '').toString().trim() || null;

      if (!empresa || !sucursal) return null;

      return [empresa, sucursal, idCliente, idInterwap, direccion];
    })
    .filter(Boolean);

  if (filas.length === 0) {
    return res.status(400).json({ message: 'Todos los registros venían vacíos o inválidos (requiere empresa y sucursal).' });
  }

  const sql = `
    INSERT IGNORE INTO clientes_sucursales
      (empresa, sucursal, id_cliente_interno, id_interwap, direccion)
    VALUES ?
  `;

  db.query(sql, [filas], (err, result) => {
    if (err) return res.status(500).json(err);

    const insertados = result.affectedRows || 0;
    const validos = filas.length;
    const duplicados = Math.max(validos - insertados, 0);

    return res.json({
      message: 'Importación de sedes finalizada',
      resumen: {
        recibidos: clientes.length,
        validos,
        insertados,
        duplicados,
      },
    });
  });
});

// ============================================
// PROGRAMACIÓN SEMANAL + OVERLAY DE EXTERNOS
// ============================================
app.get('/programacion-semanal-con-externos', (req, res) => {
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: 'Se requiere ?fecha=YYYY-MM-DD' });

  const sqlPPY = `
    SELECT p.*,
           e.nombre_completo as nombre_empleado,
           c.sucursal as nombre_sucursal,
           c.empresa as nombre_empresa
    FROM programacion_semanal p
    JOIN empleados e ON p.empleado_id = e.id
    JOIN clientes_sucursales c ON p.sucursal_id = c.id
    WHERE p.fecha_inicio_semana = ?
  `;

  const sqlExt = `
    SELECT t.id,
           t.empleado_id,
           t.fecha,
           t.hora_inicio,
           t.hora_fin,
           c.empresa,
           c.sucursal
    FROM turnos_externos t
    JOIN clientes_sucursales c ON t.sucursal_id = c.id
    WHERE t.fecha BETWEEN ? AND DATE_ADD(?, INTERVAL 6 DAY)
      AND t.empleado_id IS NOT NULL
    ORDER BY t.fecha ASC, t.hora_inicio ASC
  `;

  db.query(sqlPPY, [fecha], (err1, programacion) => {
    if (err1) return res.status(500).json(err1);

    db.query(sqlExt, [fecha, fecha], (err2, externos) => {
      if (err2) return res.status(500).json(err2);

      return res.json({
        fecha_inicio_semana: fecha,
        programacion,
        externos,
      });
    });
  });
});
// CREAR TURNOS EXTERNOS MASIVO (sin Excel)
// POST /turnos-externos/masivo
// body: { sucursalId, fechaInicio, fechaFin, dias: ['sabado'..], horaIni, horaFin, empleadoId? }
// ============================================
app.post('/turnos-externos/masivo', (req, res) => {
  const { sucursalId, fechaInicio, fechaFin, dias, horaIni, horaFin, empleadoId } = req.body;

  if (!sucursalId || !fechaInicio || !fechaFin || !Array.isArray(dias) || dias.length === 0 || !horaIni || !horaFin) {
    return res.status(400).json({ message: 'Faltan datos: sucursalId, fechaInicio, fechaFin, dias[], horaIni, horaFin son obligatorios.' });
  }

  // Mapa día (JS) -> columna/clave tuya
  const mapDia = {
    sabado: 6,
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
  };

  const diasSet = new Set(dias.map((d) => String(d).toLowerCase().trim()));
  const ini = new Date(fechaInicio + 'T00:00:00');
  const fin = new Date(fechaFin + 'T00:00:00');

  if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime()) || ini > fin) {
    return res.status(400).json({ message: 'Rango de fechas inválido.' });
  }

  const fechasSeleccionadas = [];
  for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
    const jsDay = d.getDay(); // 0..6
    const diaKey = Object.keys(mapDia).find((k) => mapDia[k] === jsDay);
    if (diaKey && diasSet.has(diaKey)) {
      fechasSeleccionadas.push(new Date(d));
    }
  }

  if (fechasSeleccionadas.length === 0) {
    return res.status(400).json({ message: 'No hay fechas que coincidan con los días seleccionados.' });
  }

  const empleadoFinal = empleadoId ? Number(empleadoId) : null;

  // Armamos filas para INSERT en lote
  const filas = fechasSeleccionadas.map((fechaObj) => {
    const fechaISO = fechaObj.toISOString().split('T')[0];
    const extras = calcularExtrasFecha(fechaISO);
    const horasTotales = calcularHorasTotales(horaIni, horaFin);

    return [
      empleadoFinal,
      Number(sucursalId),
      fechaISO,
      extras?.semana || null,
      extras?.dia_semana || null,
      extras?.mes || null,
      extras?.anio || null,
      horaIni,
      horaFin,
      horasTotales,
      'No Cargar',
      null,
      null,
      null,
      'OK',
      'Pendiente',
    ];
  });

  const sqlInsert = `
    INSERT INTO turnos_externos
      (empleado_id, sucursal_id, fecha, semana, dia_semana, mes, anio,
       hora_inicio, hora_fin, horas_totales,
       id_turno, asignacion, tipo_turno, franja_horaria, estado_turno, estado_ejecucion)
    VALUES ?
  `;

  db.query(sqlInsert, [filas], (err, result) => {
    if (err) return res.status(500).json(err);

    // Auto-marca PPY si hay empleado
    if (!empleadoFinal) {
      return res.json({
        message: 'Turnos masivos creados',
        resumen: { insertados: result.affectedRows || 0, ppyMarcados: 0 },
      });
    }

    let idx = 0;
    let ppyMarcados = 0;

    const marcar = () => {
      if (idx >= filas.length) {
        return res.json({
          message: 'Turnos masivos creados',
          resumen: { insertados: result.affectedRows || 0, ppyMarcados },
        });
      }

      const fechaISO = filas[idx][2];
      idx++;

      autoMarcarPPYPorExterno({ empleadoId: empleadoFinal, fechaISO, textoPPY: '5PM' }, (e) => {
        if (!e) ppyMarcados++;
        marcar();
      });
    };

    marcar();
  });
});

// ============================================
// Regla anti-duplicado (en destino):
// existe si coincide: sucursal_id + fecha + hora_inicio + hora_fin + (empleado_id o NULL)
// ============================================
app.post('/turnos-externos/clonar', (req, res) => {
  const {
    sucursalId,
    fechaOrigenInicio,
    fechaOrigenFin,
    fechaDestinoInicio,
    incluirVacantes = true,
    incluirAsignados = true,
  } = req.body;

  if (!fechaOrigenInicio || !fechaOrigenFin || !fechaDestinoInicio) {
    return res.status(400).json({
      message: 'Faltan datos: fechaOrigenInicio, fechaOrigenFin, fechaDestinoInicio.',
    });
  }

  const oIni = new Date(fechaOrigenInicio + 'T00:00:00');
  const oFin = new Date(fechaOrigenFin + 'T00:00:00');
  const dIni = new Date(fechaDestinoInicio + 'T00:00:00');

  if ([oIni, oFin, dIni].some((d) => Number.isNaN(d.getTime())) || oIni > oFin) {
    return res.status(400).json({ message: 'Fechas inválidas.' });
  }

  const shiftDays = Math.round((dIni.getTime() - oIni.getTime()) / 86400000);

  // -------------------------
  // 1) Traer turnos ORIGEN
  // -------------------------
  const where = [];
  const params = [];

  where.push('fecha BETWEEN ? AND ?');
  params.push(fechaOrigenInicio, fechaOrigenFin);

  if (sucursalId) {
    where.push('sucursal_id = ?');
    params.push(Number(sucursalId));
  }

  if (!incluirVacantes) where.push('empleado_id IS NOT NULL');
  if (!incluirAsignados) where.push('empleado_id IS NULL');

  const sqlSelOrigen = `
    SELECT id, empleado_id, sucursal_id, fecha, hora_inicio, hora_fin
    FROM turnos_externos
    WHERE ${where.join(' AND ')}
    ORDER BY fecha ASC, hora_inicio ASC, id ASC
  `;

  db.query(sqlSelOrigen, params, (err, origen) => {
    if (err) return res.status(500).json(err);
    if (!origen || origen.length === 0) {
      return res.status(400).json({ message: 'No hay turnos en el rango origen para clonar.' });
    }

    // -------------------------
    // 2) Construir CANDIDATOS destino
    // -------------------------
    const candidatos = origen.map((t) => {
      const fechaOrig = String(t.fecha).split('T')[0];
      const f = new Date(fechaOrig + 'T00:00:00');
      f.setDate(f.getDate() + shiftDays);
      const fechaNueva = f.toISOString().split('T')[0];

      return {
        empleado_id: t.empleado_id || null,
        sucursal_id: t.sucursal_id,
        fecha: fechaNueva,
        hora_inicio: t.hora_inicio,
        hora_fin: t.hora_fin,
      };
    });

    // Rango destino para consultar existentes
    const destinoMin = candidatos.reduce((min, c) => (c.fecha < min ? c.fecha : min), candidatos[0].fecha);
    const destinoMax = candidatos.reduce((max, c) => (c.fecha > max ? c.fecha : max), candidatos[0].fecha);

    const sucursalesDestino = [...new Set(candidatos.map((c) => c.sucursal_id))];

    // -------------------------
    // 3) Consultar EXISTENTES destino (para no duplicar)
    // -------------------------
    const sqlSelDestino = `
      SELECT empleado_id, sucursal_id, fecha, hora_inicio, hora_fin
      FROM turnos_externos
      WHERE fecha BETWEEN ? AND ?
        AND sucursal_id IN (?)
    `;

    db.query(sqlSelDestino, [destinoMin, destinoMax, sucursalesDestino], (err2, existentes) => {
      if (err2) return res.status(500).json(err2);

      const key = (x) =>
        `${x.sucursal_id}|${String(x.fecha).split('T')[0]}|${x.hora_inicio}|${x.hora_fin}|${x.empleado_id ?? 'NULL'}`;

      const setExistentes = new Set((existentes || []).map(key));

      const aInsertar = candidatos.filter((c) => !setExistentes.has(key(c)));
      const omitidos = candidatos.length - aInsertar.length;

      if (aInsertar.length === 0) {
        return res.json({
          message: 'No se clonó nada porque ya existía todo en el rango destino.',
          resumen: {
            origen: origen.length,
            candidatos: candidatos.length,
            omitidosPorDuplicado: omitidos,
            insertados: 0,
            shiftDays,
          },
        });
      }

      // -------------------------
      // 4) Insertar SOLO los nuevos
      // -------------------------
      const filas = aInsertar.map((c) => {
        const extras = calcularExtrasFecha(c.fecha);
        const horasTotales = calcularHorasTotales(c.hora_inicio, c.hora_fin);

        return [
          c.empleado_id,
          c.sucursal_id,
          c.fecha,
          extras?.semana || null,
          extras?.dia_semana || null,
          extras?.mes || null,
          extras?.anio || null,
          c.hora_inicio,
          c.hora_fin,
          horasTotales,
          'No Cargar',
          null,
          null,
          null,
          'OK',
          'Pendiente',
        ];
      });

      const sqlIns = `
        INSERT INTO turnos_externos
          (empleado_id, sucursal_id, fecha, semana, dia_semana, mes, anio,
           hora_inicio, hora_fin, horas_totales,
           id_turno, asignacion, tipo_turno, franja_horaria, estado_turno, estado_ejecucion)
        VALUES ?
      `;

      db.query(sqlIns, [filas], (err3, result) => {
        if (err3) return res.status(500).json(err3);

        // Auto-marca PPY (solo filas con empleado)
        const conEmpleado = filas.filter((f) => f[0]);
        let idx = 0;
        let ppyMarcados = 0;

        const marcar = () => {
          if (idx >= conEmpleado.length) {
            return res.json({
              message: 'Clonación completada',
              resumen: {
                origen: origen.length,
                candidatos: candidatos.length,
                omitidosPorDuplicado: omitidos,
                insertados: result.affectedRows || 0,
                shiftDays,
                ppyMarcados,
              },
            });
          }

          const f = conEmpleado[idx++];
          const empleadoId = f[0];
          const fechaISO = f[2];

          autoMarcarPPYPorExterno({ empleadoId, fechaISO, textoPPY: '5PM' }, (e) => {
            if (!e) ppyMarcados++;
            marcar();
          });
        };

        marcar();
      });
    });
  });
});

// =========================
// SERVER
// =========================
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});