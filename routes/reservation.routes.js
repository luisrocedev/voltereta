const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { verifyToken } = require('../middlewares/auth');

// Obtener todas las reservas
router.get('/', verifyToken, (req, res) => {
  db.query('SELECT * FROM reservations', (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Error al obtener reservas' });
    res.json({ success: true, data: results });
  });
});

// Crear nueva reserva
router.post('/', verifyToken, (req, res) => {
  const { customerName, date, time, guests } = req.body;
  const sql = 'INSERT INTO reservations (customerName, date, time, guests) VALUES (?, ?, ?, ?)';
  db.query(sql, [customerName, date, time, guests], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Error al crear reserva' });
    res.json({ success: true, newId: result.insertId });
  });
});

// Actualizar reserva
router.put('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const { customerName, date, time, guests } = req.body;
  const sql = 'UPDATE reservations SET customerName = ?, date = ?, time = ?, guests = ? WHERE id = ?';
  db.query(sql, [customerName, date, time, guests, id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Error al actualizar reserva' });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    res.json({ success: true, message: 'Reserva actualizada' });
  });
});

// Eliminar reserva
router.delete('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM reservations WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Error al eliminar reserva' });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
    res.json({ success: true, message: 'Reserva eliminada' });
  });
});

module.exports = router;
