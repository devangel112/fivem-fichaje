import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id: string;
  role?: "EMPLEADO" | "ENCARGADO" | "DUENO" | "VISITANTE";
    };
  }

  interface User {
    id: string;
  role: "EMPLEADO" | "ENCARGADO" | "DUENO" | "VISITANTE";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  role?: "EMPLEADO" | "ENCARGADO" | "DUENO" | "VISITANTE";
  }
}
