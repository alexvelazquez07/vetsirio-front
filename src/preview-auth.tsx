export function useAuth() {
  return {
    usuario: null,
    veterinaria: null,
    estadoSuscripcion: null,
    cargando: false,
    autenticado: true,
    login: async () => {},
    logout: async () => {},
    limpiarSesion: () => {},
    refrescarPerfil: async () => {},
    puede: () => true,
    puedeAlguno: () => true,
  };
}
