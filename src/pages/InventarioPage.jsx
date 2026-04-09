mport { useAuth } from "../hooks/useAuth";

export default function InventarioPage() {
  const user = useAuth();

  return (
    <div>
      <h2>Inventário</h2>
      {user ? <p>Usuário logado: {user.email}</p> : <p>Faça login</p>}
    </div>
  );
}
