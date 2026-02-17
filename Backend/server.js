const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// CONFIGURACIÓN DE CONEXIÓN A MYSQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root", // Tu usuario
  password: "", // Tu contraseña
  database: "turnos_multicarrier_db",
});

db.connect((err) => {
  if (err) console.log("Error conectando a MySQL:", err);
  else console.log("¡Conectado a MySQL exitosamente!");
});

// --- UTILIDAD: MAPA DE HORARIOS ---
const obtenerRangoHorario = (textoTurno) => {
  if (!textoTurno) return null;
  const turno = textoTurno.toUpperCase().trim();

  if (turno === "AM") return { inicio: 6, fin: 15 };
  if (turno === "PM") return { inicio: 13, fin: 21 };
  if (turno === "AM Y PM") return { inicio: 6, fin: 21 };
  if (turno === "DESC" || turno === "DESCANSO") return null;

  try {
    const numeros = turno
      .replace(/[^0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .map((n) => parseInt(n));
    if (numeros.length === 2) {
      let [inicio, fin] = numeros;
      if (inicio < 6) inicio += 12;
      if (fin < 6) fin += 12;
      return { inicio, fin };
    }
  } catch (e) {
    console.log("Error parseando turno:", turno);
  }
  return null;
};

const hayCruce = (rango1, rango2) => {
  if (!rango1 || !rango2) return false;
  return rango1.inicio < rango2.fin && rango1.fin > rango2.inicio;
};

// --- RUTAS DE LA API (ENDPOINTS) ---

// 1. Obtener todos los empleados
app.get("/empleados", (req, res) => {
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

// 2. Crear un empleado
app.post("/empleados", (req, res) => {
  const { nombre, documento, celular, cargo, idInterwap, estado, sedeFijaId } =
    req.body;
  const sede = sedeFijaId && sedeFijaId !== "0" ? sedeFijaId : null;

  const sql =
    "INSERT INTO empleados (nombre_completo, documento, celular, cargo, id_interwap, estado, sede_fija_id) VALUES (?, ?, ?, ?, ?, ?, ?)";

  db.query(
    sql,
    [nombre, documento, celular, cargo, idInterwap, estado || "Activo", sede],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY")
          return res.status(400).json({ message: "La cédula ya existe" });
        return res.status(500).json(err);
      }
      return res.json({ message: "Empleado creado", id: result.insertId });
    },
  );
});

// 3. Obtener clientes/sucursales
app.get("/clientes", (req, res) => {
  const sql = "SELECT * FROM clientes_sucursales ORDER BY empresa, sucursal";
  db.query(sql, (err, result) => {
    if (err) return res.json(err);
    return res.json(result);
  });
});

// 4. Crear cliente/sucursal
app.post("/clientes", (req, res) => {
  const { empresa, sucursal, idCliente, idInterwap, direccion } = req.body;
  const sql =
    "INSERT INTO clientes_sucursales (empresa, sucursal, id_cliente_interno, id_interwap, direccion) VALUES (?, ?, ?, ?, ?)";
  db.query(
    sql,
    [empresa, sucursal, idCliente, idInterwap, direccion],
    (err, result) => {
      if (err) return res.json(err);
      return res.json({ message: "Cliente creado", id: result.insertId });
    },
  );
});

// --- AQUÍ ESTÁN LAS RUTAS CLAVE PARA EXTERNOS QUE FALTABAN ---

// 5. Obtener turnos externos (CORREGIDO PARA TRAER NOMBRES)
app.get("/turnos-externos", (req, res) => {
  const sql = `
        SELECT t.*, 
               e.nombre_completo, 
               e.documento, 
               e.id_interwap as emp_id_interwap, 
               e.cargo,
               c.empresa, 
               c.sucursal, 
               c.id_interwap as suc_id_interwap
        FROM turnos_externos t
        LEFT JOIN empleados e ON t.empleado_id = e.id
        LEFT JOIN clientes_sucursales c ON t.sucursal_id = c.id
        ORDER BY t.fecha DESC
    `;
  db.query(sql, (err, result) => {
    if (err) return res.json(err);
    return res.json(result);
  });
});

// 6. Crear turno externo
app.post("/turnos-externos", (req, res) => {
  const data = req.body;
  const sql = `
        INSERT INTO turnos_externos (
            empleado_id, sucursal_id, fecha, semana, dia_semana, mes, anio, 
            hora_inicio, hora_fin, horas_totales, id_turno, asignacion, tipo_turno, 
            franja_horaria, estado_turno, estado_ejecucion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
  // Aseguramos valores por defecto para evitar errores NULL
  const values = [
    data.empleadoId,
    data.sucursalId,
    data.fecha,
    data.semana,
    data.dia,
    data.mes,
    data.anio,
    data.horaIni,
    data.horaFin,
    data.horasTotales,
    data.idTurno || "MANUAL",
    data.asignacion || "GENERICO",
    data.tipoTurno || "EXTRA",
    data.franjaHoraria || "",
    data.estadoTurno || "OK",
    data.estadoEjecucion || "Pendiente",
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json(err);
    }
    return res.json({ message: "Turno creado", id: result.insertId });
  });
});

// 26. Obtener Clientes según TIPO (PPY o EXTERNOS)
app.get("/clientes-filtro", (req, res) => {
  const { tipo } = req.query;
  let sql = "SELECT * FROM clientes_sucursales";

  if (tipo === "PPY") {
    sql += " WHERE empresa = 'PAN PA YA'";
  } else if (tipo === "EXTERNOS") {
    sql += " WHERE empresa != 'PAN PA YA'";
  }
  sql += " ORDER BY empresa, sucursal";

  db.query(sql, (err, result) => {
    if (err) return res.json(err);
    return res.json(result);
  });
});

// 27. Editar turno externo (PARA EL BOTÓN EDITAR)
app.put("/turnos-externos/:id", (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const sql = `
        UPDATE turnos_externos 
        SET empleado_id=?, sucursal_id=?, fecha=?, semana=?, dia_semana=?, mes=?, anio=?,
            hora_inicio=?, hora_fin=?, horas_totales=?
        WHERE id=?
    `;

  const values = [
    data.empleadoId,
    data.sucursalId,
    data.fecha,
    data.semana,
    data.dia,
    data.mes,
    data.anio,
    data.horaIni,
    data.horaFin,
    data.horasTotales,
    id,
  ];

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json(err);
    return res.json({ message: "Turno actualizado" });
  });
});

// 28. Eliminar turno externo (PARA EL BOTÓN ELIMINAR)
app.delete("/turnos-externos/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM turnos_externos WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json(err);
    return res.json({ message: "Turno eliminado" });
  });
});

// --- FIN RUTAS EXTERNOS ---

// 7. Asignar empleado como FIJO
app.post("/asignar-fijo", (req, res) => {
  const { empleadoId, sucursalId } = req.body;
  const sql =
    "INSERT INTO empleados_fijos (empleado_id, sucursal_id) VALUES (?, ?)";
  db.query(sql, [empleadoId, sucursalId], (err, result) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY")
        return res.status(400).json({ message: "Ya es fijo aquí" });
      return res.status(500).json(err);
    }
    return res.json({ message: "Asignado como Fijo", id: result.insertId });
  });
});

// 8. Obtener empleados FIJOS de una sucursal
app.get("/fijos/:sucursalId", (req, res) => {
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

// 9. Obtener Programación Semanal (POR FECHA Y TIPO)
app.get("/programacion-semanal", (req, res) => {
  const { fecha, tipo } = req.query;

  if (!fecha) {
    return res
      .status(400)
      .json({ error: "Se requiere la fecha de inicio de semana" });
  }

  let filtroEmpresa = "";
  if (tipo === "PPY") filtroEmpresa = "AND c.empresa = 'PAN PA YA'";
  else if (tipo === "EXTERNOS") filtroEmpresa = "AND c.empresa != 'PAN PA YA'";

  const sql = `
        SELECT p.*, 
               e.nombre_completo as nombre_empleado,
               c.sucursal as nombre_sucursal,
               c.empresa as nombre_empresa
        FROM programacion_semanal p
        JOIN empleados e ON p.empleado_id = e.id
        JOIN clientes_sucursales c ON p.sucursal_id = c.id
        WHERE p.fecha_inicio_semana = ? ${filtroEmpresa}
    `;
  db.query(sql, [fecha], (err, result) => {
    if (err) return res.json(err);
    return res.json(result);
  });
});

// 10. Guardar o Actualizar un Turno (CON VALIDACIÓN DE CRUCES)
app.post("/programacion-semanal/actualizar", (req, res) => {
  const { sucursalId, empleadoId, tipo, dia, valor, fechaSemana } = req.body;

  if (!fechaSemana)
    return res.status(400).json({ error: "Falta fecha semana" });

  const rangoNuevo = obtenerRangoHorario(valor);
  if (!rangoNuevo) {
    ejecutarUpdate();
    return;
  }

  const sqlCheck = `
        SELECT sucursal_id, ${dia} as turno_existente 
        FROM programacion_semanal 
        WHERE empleado_id = ? AND fecha_inicio_semana = ? AND sucursal_id != ?
    `;

  db.query(
    sqlCheck,
    [empleadoId, fechaSemana, sucursalId],
    (err, resultados) => {
      if (err) return res.status(500).json(err);
      for (const fila of resultados) {
        const rangoExistente = obtenerRangoHorario(fila.turno_existente);
        if (hayCruce(rangoNuevo, rangoExistente)) {
          return res
            .status(409)
            .json({
              error: "CRUCE DE TURNOS",
              mensaje: `El empleado ya tiene turno (${fila.turno_existente}) en otra sede ese día.`,
            });
        }
      }
      ejecutarUpdate();
    },
  );

  function ejecutarUpdate() {
    const sql = `
            INSERT INTO programacion_semanal (sucursal_id, empleado_id, tipo_empleado, fecha_inicio_semana, ${dia}) 
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE ${dia} = ?
        `;
    db.query(
      sql,
      [sucursalId, empleadoId, tipo, fechaSemana, valor, valor],
      (err, result) => {
        if (err) return res.status(500).json(err);
        return res.json({ message: "Turno actualizado" });
      },
    );
  }
});

// 11. Agregar Empleado a la Programación
app.post("/programacion-semanal/agregar", (req, res) => {
  const { sucursalId, empleadoId, tipo, fechaSemana } = req.body;
  const sql =
    "INSERT INTO programacion_semanal (sucursal_id, empleado_id, tipo_empleado, fecha_inicio_semana) VALUES (?, ?, ?, ?)";
  db.query(sql, [sucursalId, empleadoId, tipo, fechaSemana], (err, result) => {
    if (err) return res.json(err);
    return res.json({ message: "Empleado agregado", id: result.insertId });
  });
});

// 12. Eliminar fila de programación
app.delete("/programacion-semanal/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM programacion_semanal WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) return res.json(err);
    return res.json({ message: "Eliminado" });
  });
});

// 13. ROTAR TURNOS
app.post("/rotar-turnos", (req, res) => {
  const { fechaSemana } = req.body;
  if (!fechaSemana)
    return res.status(400).json({ error: "Falta fecha semana" });

  const sqlGet = `SELECT * FROM programacion_semanal WHERE tipo_empleado = 'Fijo' AND fecha_inicio_semana = ? ORDER BY sucursal_id, id ASC`;

  db.query(sqlGet, [fechaSemana], async (err, resultados) => {
    if (err) return res.status(500).json({ error: "Error al leer turnos" });

    const porSucursal = {};
    resultados.forEach((fila) => {
      if (!porSucursal[fila.sucursal_id]) porSucursal[fila.sucursal_id] = [];
      porSucursal[fila.sucursal_id].push(fila);
    });

    const actualizaciones = [];
    Object.keys(porSucursal).forEach((sucursalId) => {
      const filas = porSucursal[sucursalId];
      if (filas.length > 1) {
        const ultimo = filas[filas.length - 1];
        const turnosDelUltimo = {
          s: ultimo.sabado,
          d: ultimo.domingo,
          l: ultimo.lunes,
          m: ultimo.martes,
          mi: ultimo.miercoles,
          j: ultimo.jueves,
          v: ultimo.viernes,
        };

        for (let i = filas.length - 1; i > 0; i--) {
          const ant = filas[i - 1];
          actualizaciones.push({
            id: filas[i].id,
            s: ant.sabado,
            d: ant.domingo,
            l: ant.lunes,
            m: ant.martes,
            mi: ant.miercoles,
            j: ant.jueves,
            v: ant.viernes,
          });
        }
        actualizaciones.push({ id: filas[0].id, ...turnosDelUltimo });
      }
    });

    if (actualizaciones.length === 0)
      return res.json({ message: "No hubo cambios" });

    const promesas = actualizaciones.map((act) => {
      return new Promise((resolve, reject) => {
        const sqlUp = `UPDATE programacion_semanal SET sabado=?, domingo=?, lunes=?, martes=?, miercoles=?, jueves=?, viernes=? WHERE id=?`;
        db.query(
          sqlUp,
          [act.s, act.d, act.l, act.m, act.mi, act.j, act.v, act.id],
          (e, r) => (e ? reject(e) : resolve(r)),
        );
      });
    });

    await Promise.all(promesas);
    res.json({ message: "Rotación completada" });
  });
});

// 14. EDITAR SOLO EL EMPLEADO DE UNA FILA
app.put("/programacion-semanal/editar-empleado", (req, res) => {
  const { idProgramacion, nuevoEmpleadoId } = req.body;
  const sql = "UPDATE programacion_semanal SET empleado_id = ? WHERE id = ?";
  db.query(sql, [nuevoEmpleadoId, idProgramacion], (err, result) => {
    if (err) return res.status(500).json(err);
    return res.json({ message: "Empleado actualizado" });
  });
});

// 15. REPLICAR PROGRAMACIÓN
app.post("/replicar-programacion", (req, res) => {
  const { fechaAnterior, fechaNueva } = req.body;
  const sqlCheck =
    "SELECT COUNT(*) as total FROM programacion_semanal WHERE fecha_inicio_semana = ?";

  db.query(sqlCheck, [fechaNueva], (err, result) => {
    if (result[0].total > 0)
      return res.json({ message: "La semana ya tiene datos." });

    const sqlCopy = `
            INSERT INTO programacion_semanal 
            (sucursal_id, empleado_id, tipo_empleado, fecha_inicio_semana, sabado, domingo, lunes, martes, miercoles, jueves, viernes)
            SELECT sucursal_id, empleado_id, 'Fijo', ?, sabado, domingo, lunes, martes, miercoles, jueves, viernes
            FROM programacion_semanal WHERE fecha_inicio_semana = ? AND tipo_empleado = 'Fijo'
        `;

    db.query(sqlCopy, [fechaNueva, fechaAnterior], (errCopy, resultCopy) => {
      if (errCopy) return res.status(500).json(errCopy);
      return res.json({ message: "Replicado exitosamente" });
    });
  });
});

// 16, 17, 18. GESTIÓN LISTA EMPRESAS
app.get("/empresas-lista", (req, res) => {
  db.query("SELECT * FROM empresas_lista ORDER BY nombre ASC", (e, r) =>
    e ? res.json(e) : res.json(r),
  );
});
app.post("/empresas-lista", (req, res) => {
  db.query(
    "INSERT INTO empresas_lista (nombre) VALUES (?)",
    [req.body.nombre.toUpperCase()],
    (e, r) => (e ? res.status(500).json(e) : res.json({ message: "Agregado" })),
  );
});
app.delete("/empresas-lista/:id", (req, res) => {
  db.query(
    "DELETE FROM empresas_lista WHERE id = ?",
    [req.params.id],
    (e, r) => (e ? res.json(e) : res.json({ message: "Borrado" })),
  );
});

// 19, 20. GESTIÓN CLIENTES
app.put("/clientes/:id", (req, res) => {
  const { empresa, sucursal, idCliente, idInterwap, direccion } = req.body;
  const sql =
    "UPDATE clientes_sucursales SET empresa=?, sucursal=?, id_cliente_interno=?, id_interwap=?, direccion=? WHERE id=?";
  db.query(
    sql,
    [empresa, sucursal, idCliente, idInterwap, direccion, req.params.id],
    (e, r) =>
      e ? res.status(500).json(e) : res.json({ message: "Actualizado" }),
  );
});
app.delete("/clientes/:id", (req, res) => {
  db.query(
    "DELETE FROM clientes_sucursales WHERE id = ?",
    [req.params.id],
    (e, r) =>
      e ? res.status(500).json(e) : res.json({ message: "Eliminado" }),
  );
});

// 21, 22. GESTIÓN EMPLEADOS
app.put("/empleados/:id", (req, res) => {
  const { nombre, documento, celular, cargo, idInterwap, estado, sedeFijaId } =
    req.body;
  const sede = sedeFijaId && sedeFijaId !== "0" ? sedeFijaId : null;
  const sql =
    "UPDATE empleados SET nombre_completo=?, documento=?, celular=?, cargo=?, id_interwap=?, estado=?, sede_fija_id=? WHERE id=?";
  db.query(
    sql,
    [
      nombre,
      documento,
      celular,
      cargo,
      idInterwap,
      estado,
      sede,
      req.params.id,
    ],
    (e, r) =>
      e ? res.status(500).json(e) : res.json({ message: "Actualizado" }),
  );
});
app.delete("/empleados/:id", (req, res) => {
  db.query(
    "SELECT COUNT(*) as total FROM programacion_semanal WHERE empleado_id = ?",
    [req.params.id],
    (e, r) => {
      if (r[0].total > 0)
        return res
          .status(400)
          .json({ error: "Tiene turnos asociados, inactivar en su lugar." });
      db.query(
        "DELETE FROM empleados WHERE id = ?",
        [req.params.id],
        (ed, rd) =>
          ed ? res.status(500).json(ed) : res.json({ message: "Borrado" }),
      );
    },
  );
});

// 23, 24, 25. GESTIÓN CARGOS
app.get("/cargos-lista", (req, res) =>
  db.query("SELECT * FROM cargos_lista ORDER BY nombre ASC", (e, r) =>
    res.json(r),
  ),
);
app.post("/cargos-lista", (req, res) =>
  db.query(
    "INSERT INTO cargos_lista (nombre) VALUES (?)",
    [req.body.nombre.toUpperCase()],
    (e, r) => res.json({ message: "Ok" }),
  ),
);
app.delete("/cargos-lista/:id", (req, res) =>
  db.query("DELETE FROM cargos_lista WHERE id = ?", [req.params.id], (e, r) =>
    res.json({ message: "Ok" }),
  ),
);

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
