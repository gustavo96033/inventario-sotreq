import { useAuth } from "../hooks/useAuth";

export default function InventarioPage() {
  const user = useAuth();

  return (
    <div>
      <h2>Inventário</h2>
      <p>{user ? user.email : "Faça login"}</p>
    </div>
  );
}
