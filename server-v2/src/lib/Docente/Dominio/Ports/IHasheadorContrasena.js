class IHasheadorContrasena {
  async hashear(contrasena) {}
  async verificar(contrasena, hash) {}
}

module.exports = IHasheadorContrasena;
