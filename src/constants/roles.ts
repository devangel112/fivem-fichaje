export type Role = "EMPLEADO" | "ENCARGADO" | "DUENO" | "VISITANTE";

export const roleLabels: Record<Role, string> = {
  EMPLEADO: "Empleado",
  ENCARGADO: "Encargado",
  DUENO: "Dueño",
  VISITANTE: "Visitante",
};
