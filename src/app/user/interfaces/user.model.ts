export interface Users {
  users: User[];
}

export interface User {
  idUser?: string;
  role?: string;
  name?: string;
  email?: string;
  password: string;
}

export interface UserAdmin {
  uuid?: string;
  role: string; // Puedes agregar más roles si los tienes
  name: string;
  mail: string;
  password: string; // encriptada
  status: string; // según tus estados posibles
}

export interface UserAdminGet {
  uuid: string;
  role: string; // ADMIN | COLABORADOR
  name: string;
  mail: string;
  password: null; // el backend ya no expone el hash
  status: string; // ACTIVO | INACTIVO
  createdBy: string;
  createdDate: string; // o Date si lo vas a convertir
  lastModifiedBy: string;
  lastModifiedDate: string; // o Date si lo vas a convertir
}

/** Body de PUT /users/modify (UserDTO del backend) */
export interface UserModify {
  idUser: string;
  role: string;
  name: string;
  mail: string;
  password?: string | null;
  status: string;
}

export interface ClienteDTO {
  idClient?: string;
  name: string;
  username?: string;
  mail?: string;
  dni?: string;
}
