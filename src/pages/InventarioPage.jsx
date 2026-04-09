export default function InventarioPage() {
  return (
    <div style={{ padding: "20px" }}>
      <h1>📦 Orbisys - Inventário</h1>
      <p>Sistema online funcionando</p>

      <div
        style={{
          border: "1px solid #ccc",
          padding: "20px",
          borderRadius: "8px",
          marginTop: "20px",
        }}
      >
        <h3>Resumo</h3>
        <p>Itens cadastrados: 0</p>
        <p>Último inventário: hoje</p>
      </div>
    </div>
  );
}
