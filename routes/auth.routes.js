// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, param, validationResult } = require('express-validator');
const { db, JWT_SECRET } = require('../db');
const { verifyToken, checkRole } = require('../middlewares/auth');
const upload = require('../middlewares/upload'); // Middleware de subida de imagen

const validateFields = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ====================== Registro (solo admin) ======================
router.post(
  '/register',
  verifyToken,
  checkRole('admin'),
  [
    body('username')
      .notEmpty().withMessage('El usuario es obligatorio')
      .trim()
      .escape(),
    body('password')
      .notEmpty().withMessage('La contraseña es obligatoria')
      .trim(), // Evitamos escapar la contraseña para no alterar caracteres
    body('role')
      .notEmpty().withMessage('El rol es obligatorio')
      .trim()
      .escape(),
    body('email')
      .optional()
      .isEmail().withMessage('El email debe ser válido')
      .normalizeEmail(),
    body('fullname')
      .optional()
      .trim()
      .escape(),
    body('profile_pic')
      .optional()
      .isURL().withMessage('La URL de la foto debe ser válida')
      .trim()
  ],
  validateFields,
  async (req, res) => {
    const { username, password, role, fullname, email, profile_pic } = req.body;
    try {
      const hashed = await bcrypt.hash(password, 10);
      const sql = `INSERT INTO users (username, password, role, fullname, email, profile_pic) VALUES (?, ?, ?, ?, ?, ?)`;
      db.query(sql, [username, hashed, role, fullname || null, email || null, profile_pic || null], (err, result) => {
        if (err)
          return res.status(500).json({
            success: false,
            message: 'Error en la base de datos',
            error: err.sqlMessage
          });
        res.json({ success: true, userId: result.insertId });
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error interno', error });
    }
  }
);


// ====================== Login ======================
router.post(
  '/login',
  [
    body('username')
      .notEmpty().withMessage('El usuario es obligatorio')
      .trim()
      .escape(),
    body('password')
      .notEmpty().withMessage('La contraseña es obligatoria')
      .trim()
  ],
  validateFields,
  (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM users WHERE username = ?';
    db.query(sql, [username], async (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Error en DB' });
      if (!results.length) return res.status(401).json({ success: false, message: 'Usuario no existe' });
      const user = results[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
      
      // Payload para el token
      const payload = {
        id: user.id,
        username: user.username,
        role: user.role,
        fullname: user.fullname,
        email: user.email,
        photo: user.profile_pic
      };

      // Generar access token (ejemplo: 8 horas de expiración)
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
      // Generar refresh token (ejemplo: 7 días de expiración)
      const refreshToken = jwt.sign(
        payload,
        process.env.REFRESH_TOKEN_SECRET || JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        message: 'Login exitoso',
        token,
        refreshToken,
        user: payload
      });
    });
  }
);



// ====================== Cambiar contraseña ======================
router.put(
  '/update-password',
  verifyToken,
  [
    body('oldPassword')
      .notEmpty().withMessage('La contraseña antigua es obligatoria')
      .trim(),
    body('newPassword')
      .notEmpty().withMessage('La nueva contraseña es obligatoria')
      .trim()
  ],
  validateFields,
  async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    try {
      const userId = req.user.id;
      db.query('SELECT * FROM users WHERE id = ?', [userId], async (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error en DB' });
        if (!results.length) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        const match = await bcrypt.compare(oldPassword, results[0].password);
        if (!match) return res.status(401).json({ success: false, message: 'Contraseña anterior incorrecta' });

        const hashed = await bcrypt.hash(newPassword, 10);
        db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId], (err2) => {
          if (err2) return res.status(500).json({ success: false, message: 'Error al actualizar pass' });
          res.json({ success: true, message: 'Contraseña actualizada' });
        });
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  }
);


// ====================== Subida de foto de perfil (archivo local) ======================
router.post('/upload-photo', verifyToken, (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'La imagen es demasiado grande. Máximo 2MB'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Error al subir archivo: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se subió ninguna imagen' 
      });
    }

    const photoUrl = `/uploads/profile_pics/${req.file.filename}`;
    
    // Primero verificamos si hay una foto anterior para borrarla
    db.query('SELECT profile_pic FROM users WHERE id = ?', [req.user.id], (err, results) => {
      if (err) {
        console.error('Error al obtener foto anterior:', err);
      } else if (results.length > 0 && results[0].profile_pic) {
        const oldPhoto = results[0].profile_pic;
        // No borramos la foto default
        if (oldPhoto !== '/profile_pics/default.png') {
          const oldPhotoPath = path.join(__dirname, '../public', oldPhoto);
          try {
            fs.unlinkSync(oldPhotoPath);
          } catch (e) {
            console.error('Error al borrar foto anterior:', e);
          }
        }
      }

      // Actualizamos la base de datos con la nueva foto
      db.query('UPDATE users SET profile_pic = ? WHERE id = ?', [photoUrl, req.user.id], (updateErr) => {
        if (updateErr) {
          console.error('Error al actualizar foto en DB:', updateErr);
          return res.status(500).json({ 
            success: false, 
            message: 'Error al guardar la foto en la base de datos' 
          });
        }

        res.json({ 
          success: true, 
          message: 'Foto actualizada correctamente',
          photoUrl: photoUrl
        });
      });
    });
  });
});

router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Se requiere el refresh token' });
  }

  // Verificar el refresh token usando REFRESH_TOKEN_SECRET
  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ success: false, message: 'Refresh token inválido' });
    }
    // Preparar el payload para el nuevo access token
    const payload = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      fullname: decoded.fullname,
      email: decoded.email,
      photo: decoded.photo
    };
    // Generar un nuevo access token
    const newToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
    res.json({ success: true, token: newToken });
  });
});


module.exports = router;
