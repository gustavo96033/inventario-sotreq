import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEYS = {
  auth: "orbisys_auth_v1",
};

const CAT_YELLOW = "#2F6FED";
const CAT_BLACK = "#0F172A";

const SUPABASE_URL = "https://bjegmeiknyrdvtknuehv.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZWdtZWlrbnlyZHZ0a251ZWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzkzMjAsImV4cCI6MjA5MTE1NTMyMH0.-394udQXiGWmlbUKniSwfun2Aa_uC-FHqMscMTMb5kA";

const supabase =
  typeof window !== "undefined" && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const CSV_HEADERS_EXAMPLE =
  "PN;DESCRIÇÃO;LOCALIZAÇÃO;FOTO;OBSERVAÇÃO;STATUS;QUANTIDADE";

const ACCESS_CONFIG = {
  inventario: [
    {
      matricula: "401711",
      senha: "Si91077463@",
      nome: "Gustavo",
    },
    {
      matricula: "401668",
      senha: "Ad@301769x",
      nome: "Alaysson",
    },
  ],
  materiais: [
    {
      matricula: "401711",
      senha: "Si91077463@",
      nome: "Gustavo",
    },
    {
      matricula: "401668",
      senha: "Ad@301769x",
      nome: "Alaysson",
    },
    {
      matricula: "401667",
      senha: "12345",
      nome: "Kaique",
    },
  ],
};

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Erro ao salvar no localStorage:", error);
  }
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeHeader(value) {
  return normalizeText(value);
}

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

function getMonthKey(value = new Date()) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey || "").split("-");
  if (!year || !month) return monthKey;
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    "pt-BR",
    {
      month: "long",
      year: "numeric",
    }
  );
}

function extractQuantityFromObservation(text) {
  const raw = String(text || "");
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function parseCsvLine(line) {
  const delimiter = line.includes(";") ? ";" : ",";
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCsvText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map((header) =>
    normalizeHeader(header)
  );

  const rows = lines.slice(1);

  return rows
    .map((line) => {
      const values = parseCsvLine(line);
      const row = {};

      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });

      const pn = String(row.pn || "").trim();
      const descricao = String(row.descricao || "").trim();
      const localizacao = String(row.localizacao || "").trim();
      const observacao = String(row.observacao || "").trim();
      const status = String(row.status || "IDENTIFICADO").trim();

      const quantidade =
        row.quantidade !== undefined && String(row.quantidade).trim() !== ""
          ? Number(row.quantidade || 0)
          : extractQuantityFromObservation(observacao);

      return {
        id: createId(),
        pn,
        descricao,
        localizacao,
        quantidade: Number.isFinite(quantidade) ? quantidade : 0,
        observacao,
        status,
        foto: "",
        atualizadoEm: new Date().toISOString(),
        criadoEm: new Date().toISOString(),
        historico: [],
      };
    })
    .filter((item) => item.pn && item.descricao);
}

function statusStyle(status) {
  const normalized = String(status || "").toUpperCase();

  if (normalized.includes("SEM LOCA")) {
    return { background: "#fee2e2", color: "#991b1b" };
  }

  if (normalized.includes("SEM FOTO")) {
    return { background: "#fef3c7", color: "#92400e" };
  }

  if (normalized.includes("IDENTIFICADO") || normalized.includes("COMPLETO")) {
    return { background: "#dcfce7", color: "#166534" };
  }

  return { background: "#e5e7eb", color: "#374151" };
}

function movementTypeStyle(type) {
  const normalized = String(type || "").toUpperCase();

  if (normalized === "ENTRADA") {
    return { background: "#dcfce7", color: "#166534" };
  }

  if (normalized === "SAÍDA" || normalized === "SAIDA") {
    return { background: "#fee2e2", color: "#991b1b" };
  }

  if (normalized === "CADASTRO" || normalized === "EDIÇÃO DE CADASTRO") {
    return { background: "#dbeafe", color: "#1d4ed8" };
  }

  if (normalized === "IMPORTAÇÃO CSV") {
    return { background: "#ede9fe", color: "#6d28d9" };
  }

  return { background: "#e5e7eb", color: "#374151" };
}

function baseButtonStyle(kind = "primary") {
  if (kind === "primary") {
    return {
      background: CAT_YELLOW,
      color: "white",
      border: `1px solid ${CAT_YELLOW}`,
    };
  }

  if (kind === "danger") {
    return {
      background: "#dc2626",
      color: "white",
      border: "1px solid #dc2626",
    };
  }

  if (kind === "success") {
    return {
      background: "#16a34a",
      color: "white",
      border: "1px solid #16a34a",
    };
  }

  return {
    background: "white",
    color: CAT_BLACK,
    border: "1px solid #d1d5db",
  };
}

function ActionButton({
  children,
  onClick,
  type = "button",
  kind = "primary",
  fullWidth = false,
  disabled = false,
}) {
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        ...baseButtonStyle(kind),
        width: fullWidth ? "100%" : "auto",
        borderRadius: 10,
        padding: "12px 16px",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Panel({ title, children, right }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 14,
        padding: 20,
        boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
        border: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        minHeight: 46,
        borderRadius: 10,
        border: "1px solid #d1d5db",
        padding: "12px 14px",
        fontSize: 16,
        outline: "none",
        ...props.style,
      }}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        borderRadius: 10,
        border: "1px solid #d1d5db",
        padding: "12px 14px",
        fontSize: 15,
        outline: "none",
        resize: "vertical",
        ...props.style,
      }}
    />
  );
}

function InventoryPhotoInput({ label, foto, onChange }) {
  const inputRef = useRef(null);

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>
        {label}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        style={{ display: "none" }}
      />

      <div
        style={{
          border: "1px dashed #9ca3af",
          borderRadius: 10,
          background: "#f9fafb",
          minHeight: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {foto ? (
          <img
            src={foto}
            alt="Peça"
            style={{ width: "100%", height: 220, objectFit: "cover" }}
          />
        ) : (
          <div style={{ textAlign: "center", color: "#6b7280", padding: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
            <div>Sem foto</div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ActionButton kind="primary" onClick={() => inputRef.current?.click()}>
          📷 Tirar / escolher foto
        </ActionButton>
        {foto ? (
          <ActionButton kind="secondary" onClick={() => onChange("")}>
            Remover foto
          </ActionButton>
        ) : null}
      </div>
    </div>
  );
}

function MaterialListItem({ item, onEdit, onDelete }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "72px 1fr auto",
        gap: 12,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
        alignItems: "center",
        background: "white",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 10,
          overflow: "hidden",
          background: "#EEF2F7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {item.foto ? (
          <img
            src={item.foto}
            alt={item.descricao}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ color: "#6b7280" }}>📦</span>
        )}
      </div>

      <div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <strong>{item.descricao}</strong>
          <span
            style={{
              ...statusStyle(item.status),
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {item.status}
          </span>
        </div>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          PN: {item.pn}
        </div>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>
          Localização: {item.localizacao || "Não informada"}
        </div>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>
          Quantidade: {item.quantidade ?? 0}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <ActionButton kind="secondary" onClick={() => onEdit(item)}>
          Editar
        </ActionButton>
        <ActionButton kind="danger" onClick={() => onDelete(item.pn)}>
          Excluir
        </ActionButton>
      </div>
    </div>
  );
}

function InventoryItemRow({ item, onChange, onRemove }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
        gap: 12,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 14,
        background: "#fff",
      }}
    >
      <div style={{ gridColumn: "span 3" }}>
        <Field label="PN">
          <TextInput
            value={item.pn}
            onChange={(e) => onChange({ ...item, pn: e.target.value })}
            placeholder="Digite o PN"
          />
        </Field>
      </div>

      <div style={{ gridColumn: "span 4" }}>
        <Field label="Descrição">
          <TextInput
            value={item.descricao}
            onChange={(e) => onChange({ ...item, descricao: e.target.value })}
            placeholder="Descrição"
          />
        </Field>
      </div>

      <div style={{ gridColumn: "span 2" }}>
        <Field label="Qtd. contada">
          <TextInput
            type="number"
            value={item.quantidadeContada}
            onChange={(e) =>
              onChange({ ...item, quantidadeContada: e.target.value })
            }
            placeholder="0"
          />
        </Field>
      </div>

      <div style={{ gridColumn: "span 2" }}>
        <Field label="Localização">
          <TextInput
            value={item.localizacao}
            onChange={(e) => onChange({ ...item, localizacao: e.target.value })}
            placeholder="01.02.03.04"
          />
        </Field>
      </div>

      <div style={{ gridColumn: "span 1", display: "flex", alignItems: "end" }}>
        <ActionButton kind="danger" fullWidth onClick={onRemove}>
          Excluir
        </ActionButton>
      </div>

      <div style={{ gridColumn: "span 8" }}>
        <Field label="Observação">
          <TextArea
            value={item.observacao}
            onChange={(e) => onChange({ ...item, observacao: e.target.value })}
            rows={2}
            placeholder="Observações da contagem"
          />
        </Field>
      </div>

      <div style={{ gridColumn: "span 4" }}>
        <InventoryPhotoInput
          label="Foto da peça na contagem"
          foto={item.foto || ""}
          onChange={(foto) => onChange({ ...item, foto })}
        />
      </div>
    </div>
  );
}

function LoginGate({
  title,
  subtitle,
  onLogin,
  loginForm,
  setLoginForm,
  errorMessage,
}) {
  return (
    <Panel title={title}>
      <div
        style={{
          maxWidth: 440,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 20,
            background: "#f8fafc",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 20 }}>{subtitle}</div>
          <div style={{ color: "#6b7280", marginTop: 6 }}>
            Informe sua matrícula e senha para continuar.
          </div>
        </div>

        <Field label="Matrícula">
          <TextInput
            value={loginForm.matricula}
            onChange={(e) =>
              setLoginForm((prev) => ({ ...prev, matricula: e.target.value }))
            }
            placeholder="Digite sua matrícula"
          />
        </Field>

        <Field label="Senha">
          <TextInput
            type="password"
            value={loginForm.senha}
            onChange={(e) =>
              setLoginForm((prev) => ({ ...prev, senha: e.target.value }))
            }
            placeholder="Digite sua senha"
          />
        </Field>

        {errorMessage ? (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              borderRadius: 10,
              padding: 12,
              fontWeight: 600,
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <ActionButton onClick={onLogin} fullWidth>
          Entrar
        </ActionButton>
      </div>
    </Panel>
  );
}

function StatCard({ title, value, subtitle, icon }) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #0F172A 0%, #1E293B 100%)",
        color: "white",
        borderRadius: 12,
        padding: 18,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
      }}
    >
      <div style={{ fontSize: 28 }}>{icon}</div>
      <div style={{ marginTop: 10, fontSize: 13, color: "#d1d5db", fontWeight: 700 }}>
        {title}
      </div>
      <div style={{ marginTop: 6, fontSize: 28, fontWeight: 900 }}>{value}</div>
      {subtitle ? (
        <div style={{ marginTop: 6, fontSize: 13, color: "#9ca3af" }}>{subtitle}</div>
      ) : null}
    </div>
  );
}

function QuickAction({ title, text, buttonText, onClick }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 14,
        padding: 20,
        border: "1px solid #e5e7eb",
        boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 8, color: "#6b7280", lineHeight: 1.5 }}>{text}</div>
      <div style={{ marginTop: 16 }}>
        <ActionButton onClick={onClick}>{buttonText}</ActionButton>
      </div>
    </div>
  );
}

function MiningHero({ materialsCount, inventoriesCount, movementsCount, monthLabel }) {
  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, #0F172A 0%, #1D4ED8 38%, #0F172A 100%)",
        borderRadius: 16,
        padding: 26,
        color: "white",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 16px 40px rgba(15,23,42,0.18)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: "rgba(47,111,237,0.20)",
          filter: "blur(10px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -50,
          left: -20,
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: "rgba(47,111,237,0.14)",
          filter: "blur(10px)",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: CAT_YELLOW,
            color: "white",
            borderRadius: 999,
            padding: "10px 14px",
            fontWeight: 900,
            fontSize: 13,
            letterSpacing: 0.3,
          }}
        >
          ORBISYS • OPERATION SUITE
        </div>

        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: 22,
            alignItems: "center",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.1 }}>
              Plataforma Corporativa de Materiais
            </h1>
            <div
              style={{
                marginTop: 12,
                color: "#d1d5db",
                fontSize: 16,
                maxWidth: 760,
                lineHeight: 1.6,
              }}
            >
              Gestão centralizada de cadastro, inventário, rastreabilidade por usuário
              e movimentações operacionais com histórico fotográfico e controle quantitativo.
            </div>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontWeight: 700,
                }}
              >
                📦 Materiais: {materialsCount}
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontWeight: 700,
                }}
              >
                📝 Inventários: {inventoriesCount}
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontWeight: 700,
                }}
              >
                🔁 Movimentações em {monthLabel}: {movementsCount}
              </div>
            </div>
          </div>

          <div
            style={{
              minHeight: 240,
              borderRadius: 14,
              background:
                "linear-gradient(180deg, rgba(47,111,237,0.18) 0%, rgba(255,255,255,0.02) 100%)",
              border: "1px solid rgba(255,255,255,0.10)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: 14, color: "#d1d5db", fontWeight: 800 }}>
              VISÃO RÁPIDA DO MÊS
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div style={{ color: "#9ca3af", fontSize: 12 }}>Foco atual</div>
                <div style={{ marginTop: 6, fontWeight: 800, fontSize: 18 }}>
                  Movimentações operacionais
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div style={{ color: "#9ca3af", fontSize: 12 }}>Controle</div>
                <div style={{ marginTop: 6, fontWeight: 800, fontSize: 18 }}>
                  Auditoria por usuário e evidência
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div style={{ color: "#9ca3af", fontSize: 12 }}>Sistema</div>
                <div style={{ marginTop: 6, fontWeight: 800, fontSize: 18 }}>
                  Governança de materiais
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function exportToCsv(filename, rows) {
  const csvContent = rows.map((row) => row.join(";")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildMaterialsWithHistory(materialRows, historyRows) {
  return materialRows.map((material) => ({
    id: material.id || createId(),
    pn: material.pn,
    descricao: material.descricao,
    localizacao: material.localizacao || "",
    quantidade: Number(material.quantidade || 0),
    observacao: material.observacao || "",
    status: material.status || "IDENTIFICADO",
    foto: material.foto || "",
    criadoEm: material.criado_em || new Date().toISOString(),
    atualizadoEm: material.atualizado_em || new Date().toISOString(),
    historico: historyRows
      .filter((hist) => hist.material_pn === material.pn)
      .map((hist) => ({
        id: hist.id || createId(),
        acao: hist.acao,
        usuarioNome: hist.usuario_nome || "-",
        usuarioMatricula: hist.usuario_matricula || "-",
        detalhe: hist.detalhe || "",
        observacao: hist.observacao || "",
        foto: hist.foto || "",
        data: hist.data || new Date().toISOString(),
      })),
  }));
}

export default function App() {
  const [materials, setMaterials] = useState([]);
  const [movements, setMovements] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [currentInventory, setCurrentInventory] = useState(null);
  const [authState, setAuthState] = useState(() =>
    readStorage(STORAGE_KEYS.auth, {
      inventario: null,
      materiais: null,
    })
  );

  const [isLoadingCloud, setIsLoadingCloud] = useState(true);
  const [cloudError, setCloudError] = useState("");
  const [activeTab, setActiveTab] = useState("inicio");
  const [search, setSearch] = useState("");
  const [selectedMaterialPn, setSelectedMaterialPn] = useState("");
  const [newInventoryName, setNewInventoryName] = useState("");
  const [editingPn, setEditingPn] = useState("");

  const [inventarioLoginForm, setInventarioLoginForm] = useState({
  email: "",
  senha: "",
});
const [materiaisLoginForm, setMateriaisLoginForm] = useState({
  email: "",
  senha: "",
});
const [inventarioLoginError, setInventarioLoginError] = useState("");
const [materiaisLoginError, setMateriaisLoginError] = useState("");
const [authLoading, setAuthLoading] = useState(false);
const [sessionUser, setSessionUser] = useState(null);
const [profile, setProfile] = useState(null);

  const [newMaterial, setNewMaterial] = useState({
    pn: "",
    descricao: "",
    localizacao: "",
    quantidade: "",
    observacao: "",
    status: "IDENTIFICADO",
    foto: "",
  });

  const [movementForm, setMovementForm] = useState({
    tipo: "SAÍDA",
    pn: "",
    quantidade: "",
    observacao: "",
    foto: "",
    data: new Date().toISOString().slice(0, 16),
  });

  const [movementMonthFilter, setMovementMonthFilter] = useState(getMonthKey());
  const csvInputRef = useRef(null);

  useEffect(() => writeStorage(STORAGE_KEYS.auth, authState), [authState]);

  async function loadCloudData() {
    if (!supabase) {
      setCloudError("Supabase não encontrado. Confira o script no index.html.");
      setIsLoadingCloud(false);
      return;
    }

    setIsLoadingCloud(true);
    setCloudError("");

    try {
      const [
        { data: materialRows, error: materialError },
        { data: historyRows, error: historyError },
        { data: movementRows, error: movementError },
        { data: inventoryRows, error: inventoryError },
        { data: inventoryItemRows, error: inventoryItemError },
      ] = await Promise.all([
        supabase.from("materials").select("*").order("descricao", { ascending: true }),
        supabase.from("material_history").select("*").order("data", { ascending: false }),
        supabase.from("movements").select("*").order("data", { ascending: false }),
        supabase.from("inventories").select("*").order("atualizado_em", { ascending: false }),
        supabase.from("inventory_items").select("*").order("descricao", { ascending: true }),
      ]);

      if (materialError) throw materialError;
      if (historyError) throw historyError;
      if (movementError) throw movementError;
      if (inventoryError) throw inventoryError;
      if (inventoryItemError) throw inventoryItemError;

      setMaterials(buildMaterialsWithHistory(materialRows || [], historyRows || []));
      setMovements(
        (movementRows || []).map((item) => ({
          id: item.id,
          tipo: item.tipo,
          pn: item.pn,
          descricao: item.descricao,
          quantidade: Number(item.quantidade || 0),
          quantidadeAntes: Number(item.quantidade_antes || 0),
          quantidadeDepois: Number(item.quantidade_depois || 0),
          observacao: item.observacao || "",
          foto: item.foto || "",
          data: item.data,
          usuarioNome: item.usuario_nome || "-",
          usuarioMatricula: item.usuario_matricula || "-",
        }))
      );
      setInventories(
        (inventoryRows || []).map((inv) => ({
          id: inv.id,
          nome: inv.nome,
          criadoPor: inv.criado_por || "-",
          criadoEm: inv.criado_em || new Date().toISOString(),
          atualizadoEm: inv.atualizado_em || new Date().toISOString(),
          itens: (inventoryItemRows || [])
            .filter((row) => row.inventory_id === inv.id)
            .map((row) => ({
              id: row.id,
              pn: row.pn || "",
              descricao: row.descricao || "",
              quantidadeContada: String(row.quantidade_contada ?? 0),
              localizacao: row.localizacao || "",
              observacao: row.observacao || "",
              foto: row.foto || "",
            })),
        }))
      );
    } catch (error) {
      console.error(error);
      setCloudError(error.message || "Erro ao carregar dados do Supabase.");
    } finally {
      setIsLoadingCloud(false);
    }
  }

  useEffect(() => {
    loadCloudData();
  }, []);

  const canAccessInventario = Boolean(authState.inventario);
  const canAccessMateriais = Boolean(authState.materiais);

  const selectedMaterial = useMemo(
    () => materials.find((item) => item.pn === selectedMaterialPn) || null,
    [materials, selectedMaterialPn]
  );

  const filteredMaterials = useMemo(() => {
    const normalizedSearch = normalizeText(search);
    if (!normalizedSearch) return materials;

    return materials.filter((item) => {
      const haystack = [
        item.pn,
        item.descricao,
        item.localizacao,
        item.observacao,
        item.status,
      ]
        .map(normalizeText)
        .join(" ");

      return haystack.includes(normalizedSearch);
    });
  }, [materials, search]);

  const matchedMovementMaterial = useMemo(
    () =>
      materials.find((item) => normalizeText(item.pn) === normalizeText(movementForm.pn)) ||
      null,
    [materials, movementForm.pn]
  );

  const movementMonths = useMemo(() => {
    const keys = Array.from(new Set(movements.map((item) => getMonthKey(item.data))));
    const current = getMonthKey();
    if (!keys.includes(current)) keys.unshift(current);
    return Array.from(new Set(keys)).sort((a, b) => (a < b ? 1 : -1));
  }, [movements]);

  const filteredMovements = useMemo(
    () => movements.filter((item) => getMonthKey(item.data) === movementMonthFilter),
    [movements, movementMonthFilter]
  );

  const currentMonthLabel = formatMonthLabel(movementMonthFilter);
  const currentMonthMovements = filteredMovements;
  const currentMonthEntries = filteredMovements
    .filter((item) => item.tipo === "ENTRADA")
    .reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
  const currentMonthOutputs = filteredMovements
    .filter((item) => item.tipo === "SAÍDA")
    .reduce((sum, item) => sum + Number(item.quantidade || 0), 0);

  function resetMaterialForm() {
    setEditingPn("");
    setNewMaterial({
      pn: "",
      descricao: "",
      localizacao: "",
      quantidade: "",
      observacao: "",
      status: "IDENTIFICADO",
      foto: "",
    });
  }

  async function saveMaterial() {
    if (!supabase) return;

    if (!newMaterial.pn.trim() || !newMaterial.descricao.trim()) {
      window.alert("Preencha pelo menos PN e descrição.");
      return;
    }

    const actor = authState.materiais || authState.inventario || { nome: "Sistema", matricula: "-" };
    const normalizedPn = newMaterial.pn.trim();
    const quantityValue = Number(newMaterial.quantidade || 0);

    const payload = {
      pn: normalizedPn,
      descricao: newMaterial.descricao.trim(),
      localizacao: newMaterial.localizacao.trim(),
      quantidade: Number.isFinite(quantityValue) ? quantityValue : 0,
      observacao: newMaterial.observacao.trim(),
      status: newMaterial.status,
      foto: newMaterial.foto || "",
      atualizado_em: new Date().toISOString(),
    };

    try {
      if (editingPn) {
        const { error } = await supabase.from("materials").update(payload).eq("pn", editingPn);
        if (error) throw error;

        const { error: historyError } = await supabase.from("material_history").insert({
          material_pn: normalizedPn,
          acao: "EDIÇÃO DE CADASTRO",
          usuario_nome: actor.nome,
          usuario_matricula: actor.matricula,
          detalhe: `Material ${normalizedPn} atualizado.`,
          observacao: newMaterial.observacao.trim(),
          foto: newMaterial.foto || "",
          data: new Date().toISOString(),
        });

        if (historyError) throw historyError;
      } else {
        const { error } = await supabase.from("materials").insert({
          ...payload,
          criado_em: new Date().toISOString(),
        });
        if (error) throw error;

        const { error: historyError } = await supabase.from("material_history").insert({
          material_pn: normalizedPn,
          acao: "CADASTRO",
          usuario_nome: actor.nome,
          usuario_matricula: actor.matricula,
          detalhe: `Material ${normalizedPn} cadastrado.`,
          observacao: newMaterial.observacao.trim(),
          foto: newMaterial.foto || "",
          data: new Date().toISOString(),
        });

        if (historyError) throw historyError;
      }

      resetMaterialForm();
      await loadCloudData();
    } catch (error) {
      console.error(error);
      window.alert(error.message || "Erro ao salvar material.");
    }
  }

  function handleEditMaterial(item) {
    setActiveTab("cadastro");
    setEditingPn(item.pn);
    setNewMaterial({
      pn: item.pn,
      descricao: item.descricao,
      localizacao: item.localizacao || "",
      quantidade: String(item.quantidade ?? 0),
      observacao: item.observacao || "",
      status: item.status || "IDENTIFICADO",
      foto: item.foto || "",
    });
  }

  async function deleteMaterial(pn) {
    if (!supabase) return;

    const confirmed = window.confirm(`Deseja excluir o material ${pn}?`);
    if (!confirmed) return;

    try {
      const { error: historyError } = await supabase
        .from("material_history")
        .delete()
        .eq("material_pn", pn);
      if (historyError) throw historyError;

      const { error } = await supabase.from("materials").delete().eq("pn", pn);
      if (error) throw error;

      if (selectedMaterialPn === pn) setSelectedMaterialPn("");
      if (editingPn === pn) resetMaterialForm();
      await loadCloudData();
    } catch (error) {
      console.error(error);
      window.alert(error.message || "Erro ao excluir material.");
    }
  }

  function handleInventarioLogin() {
    const found = ACCESS_CONFIG.inventario.find(
      (item) =>
        item.matricula === inventarioLoginForm.matricula &&
        item.senha === inventarioLoginForm.senha
    );

    if (!found) {
      setInventarioLoginError("Matrícula ou senha inválida.");
      return;
    }

    setInventarioLoginError("");
    setAuthState((prev) => ({ ...prev, inventario: found }));
    setInventarioLoginForm({ matricula: "", senha: "" });
  }

  function handleMateriaisLogin() {
    const found = ACCESS_CONFIG.materiais.find(
      (item) =>
        item.matricula === materiaisLoginForm.matricula &&
        item.senha === materiaisLoginForm.senha
    );

    if (!found) {
      setMateriaisLoginError("Matrícula ou senha inválida.");
      return;
    }

    setMateriaisLoginError("");
    setAuthState((prev) => ({ ...prev, materiais: found }));
    setMateriaisLoginForm({ matricula: "", senha: "" });
  }

  function logoutArea(area) {
    setAuthState((prev) => ({ ...prev, [area]: null }));
  }

  function startNewInventory() {
    const name = newInventoryName.trim();
    if (!name) {
      window.alert("Digite o nome do inventário.");
      return;
    }

    const inventory = {
      id: `temp-${createId()}`,
      nome: name,
      criadoPor: authState.inventario?.nome || "-",
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      itens: [],
    };

    setCurrentInventory(inventory);
    setNewInventoryName("");
  }

  function openInventory(inv) {
    setCurrentInventory(inv);
  }

  async function saveCurrentInventory(options = { silent: false }) {
    if (!supabase || !currentInventory) return null;

    try {
      const isNew = !currentInventory.id || String(currentInventory.id).startsWith("temp-");
      let inventoryId = currentInventory.id;

      if (isNew) {
        const { data, error } = await supabase
          .from("inventories")
          .insert({
            nome: currentInventory.nome,
            criado_por: currentInventory.criadoPor || authState.inventario?.nome || "-",
            criado_em: currentInventory.criadoEm || new Date().toISOString(),
            atualizado_em: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        inventoryId = data.id;
      } else {
        const { error } = await supabase
          .from("inventories")
          .update({
            nome: currentInventory.nome,
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", currentInventory.id);

        if (error) throw error;
      }

      const { error: deleteItemsError } = await supabase
        .from("inventory_items")
        .delete()
        .eq("inventory_id", inventoryId);
      if (deleteItemsError) throw deleteItemsError;

      const itemPayload = (currentInventory.itens || []).map((item) => ({
        inventory_id: inventoryId,
        pn: item.pn || "",
        descricao: item.descricao || "",
        quantidade_contada: Number(item.quantidadeContada || 0),
        localizacao: item.localizacao || "",
        observacao: item.observacao || "",
        foto: item.foto || "",
      }));

      if (itemPayload.length) {
        const { error: insertItemsError } = await supabase
          .from("inventory_items")
          .insert(itemPayload);
        if (insertItemsError) throw insertItemsError;
      }

      await loadCloudData();
      const savedInventory = inventories.find((inv) => inv.id === inventoryId) || null;
      if (savedInventory) setCurrentInventory(savedInventory);
      if (!options.silent) window.alert("Inventário salvo na nuvem com sucesso.");
      return inventoryId;
    } catch (error) {
      console.error(error);
      window.alert(error.message || "Erro ao salvar inventário na nuvem.");
      return null;
    }
  }

  async function finishCurrentInventory() {
    if (!currentInventory) return;
    const savedId = await saveCurrentInventory({ silent: true });
    if (savedId) {
      setCurrentInventory(null);
      window.alert("Inventário finalizado e salvo na nuvem.");
    }
  }

  function addManualItemToInventory() {
    if (!currentInventory) return;
    const newItem = {
      id: createId(),
      pn: "",
      descricao: "",
      quantidadeContada: "",
      localizacao: "",
      observacao: "",
      foto: "",
    };

    setCurrentInventory((prev) => ({
      ...prev,
      atualizadoEm: new Date().toISOString(),
      itens: [...(prev.itens || []), newItem],
    }));
  }

  function updateInventoryItem(itemId, nextItem) {
    setCurrentInventory((prev) => ({
      ...prev,
      atualizadoEm: new Date().toISOString(),
      itens: (prev.itens || []).map((item) => (item.id === itemId ? nextItem : item)),
    }));
  }

  function removeInventoryItem(itemId) {
    setCurrentInventory((prev) => ({
      ...prev,
      atualizadoEm: new Date().toISOString(),
      itens: (prev.itens || []).filter((item) => item.id !== itemId),
    }));
  }

  function addSearchedItemToInventory() {
    if (!currentInventory || !selectedMaterial) return;
    const newItem = {
      id: createId(),
      pn: selectedMaterial.pn,
      descricao: selectedMaterial.descricao,
      quantidadeContada: String(selectedMaterial.quantidade ?? 0),
      localizacao: selectedMaterial.localizacao || "",
      observacao: selectedMaterial.observacao || "",
      foto: selectedMaterial.foto || "",
    };

    setCurrentInventory((prev) => ({
      ...prev,
      atualizadoEm: new Date().toISOString(),
      itens: [...(prev.itens || []), newItem],
    }));
    window.alert("Item adicionado ao inventário atual.");
  }

  async function registerMovement() {
    if (!supabase) return;
    if (!matchedMovementMaterial) {
      window.alert("PN não encontrado na base de materiais.");
      return;
    }

    const quantity = Number(movementForm.quantidade || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      window.alert("Informe uma quantidade válida.");
      return;
    }

    const actor = authState.materiais || { nome: "Sistema", matricula: "-" };
    const beforeQty = Number(matchedMovementMaterial.quantidade || 0);
    const isEntry = movementForm.tipo === "ENTRADA";
    const afterQty = isEntry ? beforeQty + quantity : beforeQty - quantity;

    if (!isEntry && afterQty < 0) {
      window.alert("Quantidade insuficiente para saída.");
      return;
    }

    const movementDate = movementForm.data
      ? new Date(movementForm.data).toISOString()
      : new Date().toISOString();

    try {
      const { error: materialError } = await supabase
        .from("materials")
        .update({
          quantidade: afterQty,
          atualizado_em: new Date().toISOString(),
        })
        .eq("pn", matchedMovementMaterial.pn);
      if (materialError) throw materialError;

      const { error: movementError } = await supabase.from("movements").insert({
        tipo: movementForm.tipo,
        pn: matchedMovementMaterial.pn,
        descricao: matchedMovementMaterial.descricao,
        quantidade: quantity,
        quantidade_antes: beforeQty,
        quantidade_depois: afterQty,
        observacao: movementForm.observacao.trim(),
        foto: movementForm.foto || "",
        data: movementDate,
        usuario_nome: actor.nome,
        usuario_matricula: actor.matricula,
      });
      if (movementError) throw movementError;

      const { error: historyError } = await supabase.from("material_history").insert({
        material_pn: matchedMovementMaterial.pn,
        acao: movementForm.tipo,
        usuario_nome: actor.nome,
        usuario_matricula: actor.matricula,
        detalhe: `${movementForm.tipo} de ${quantity} unidade(s). Antes: ${beforeQty}. Depois: ${afterQty}.`,
        observacao: movementForm.observacao.trim(),
        foto: movementForm.foto || "",
        data: movementDate,
      });
      if (historyError) throw historyError;

      setMovementForm({
        tipo: "SAÍDA",
        pn: "",
        quantidade: "",
        observacao: "",
        foto: "",
        data: new Date().toISOString().slice(0, 16),
      });

      await loadCloudData();
    } catch (error) {
      console.error(error);
      window.alert(error.message || "Erro ao salvar movimentação.");
    }
  }

  async function importCsvFile(event) {
    if (!supabase) return;

    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const parsed = parseCsvText(String(reader.result || ""));
      if (!parsed.length) {
        window.alert("Nenhum item válido encontrado no CSV.");
        return;
      }

      const actor = authState.materiais || { nome: "Sistema", matricula: "-" };

      try {
        for (const material of parsed) {
          const { error } = await supabase.from("materials").upsert(
            {
              pn: material.pn,
              descricao: material.descricao,
              localizacao: material.localizacao || "",
              quantidade: Number(material.quantidade || 0),
              observacao: material.observacao || "",
              status: material.status || "IDENTIFICADO",
              foto: material.foto || "",
              atualizado_em: new Date().toISOString(),
            },
            { onConflict: "pn" }
          );
          if (error) throw error;

          const { error: historyError } = await supabase.from("material_history").insert({
            material_pn: material.pn,
            acao: "IMPORTAÇÃO CSV",
            usuario_nome: actor.nome,
            usuario_matricula: actor.matricula,
            detalhe: `Material ${material.pn} importado via CSV.`,
            observacao: material.observacao || "",
            foto: material.foto || "",
            data: new Date().toISOString(),
          });
          if (historyError) throw historyError;
        }

        if (csvInputRef.current) csvInputRef.current.value = "";
        await loadCloudData();
        window.alert(`${parsed.length} material(is) importado(s) com sucesso.`);
      } catch (error) {
        console.error(error);
        window.alert(error.message || "Erro ao importar CSV.");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function exportMaterialsCsv() {
    const rows = [
      ["PN", "DESCRIÇÃO", "LOCALIZAÇÃO", "OBSERVAÇÃO", "STATUS", "QUANTIDADE"],
      ...materials.map((item) => [
        item.pn,
        item.descricao,
        item.localizacao || "",
        item.observacao || "",
        item.status || "",
        item.quantidade ?? 0,
      ]),
    ];
    exportToCsv("orbisys_materiais.csv", rows);
  }

  function exportMovementsCsv() {
    const rows = [
      [
        "TIPO",
        "PN",
        "DESCRIÇÃO",
        "QUANTIDADE",
        "ANTES",
        "DEPOIS",
        "USUÁRIO",
        "MATRÍCULA",
        "DATA",
        "OBSERVAÇÃO",
      ],
      ...filteredMovements.map((item) => [
        item.tipo,
        item.pn,
        item.descricao,
        item.quantidade,
        item.quantidadeAntes,
        item.quantidadeDepois,
        item.usuarioNome,
        item.usuarioMatricula,
        item.data,
        item.observacao || "",
      ]),
    ];
    exportToCsv(`orbisys_movimentacoes_${movementMonthFilter}.csv`, rows);
  }

  useEffect(() => {
    if (!selectedMaterialPn && filteredMaterials.length) {
      setSelectedMaterialPn(filteredMaterials[0].pn);
    }
    if (selectedMaterialPn && !filteredMaterials.some((item) => item.pn === selectedMaterialPn)) {
      setSelectedMaterialPn(filteredMaterials[0]?.pn || "");
    }
  }, [filteredMaterials, selectedMaterialPn]);

  if (isLoadingCloud) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#E8EDF5",
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
            fontWeight: 700,
          }}
        >
          Carregando dados do Orbisys...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#E8EDF5",
        padding: 18,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "280px minmax(0, 1fr)",
          gap: 18,
          alignItems: "start",
        }}
      >
        <aside
          style={{
            background: "linear-gradient(180deg, #0F172A 0%, #111827 100%)",
            color: "white",
            borderRadius: 18,
            padding: 18,
            minHeight: "calc(100vh - 36px)",
            position: "sticky",
            top: 18,
            boxShadow: "0 18px 40px rgba(15,23,42,0.18)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingBottom: 16,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 48,
                  height: 48,
                  padding: "0 14px",
                  borderRadius: 12,
                  background: CAT_YELLOW,
                  color: "white",
                  fontWeight: 900,
                  letterSpacing: 0.6,
                }}
              >
                OX
              </div>
              <div style={{ marginTop: 12, fontSize: 24, fontWeight: 900 }}>
                ORBISYS
              </div>
              <div style={{ marginTop: 4, color: "#94A3B8", fontSize: 13 }}>
                Operations Suite
              </div>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "10px 12px",
                fontSize: 12,
                color: "#CBD5E1",
                textAlign: "right",
              }}
            >
              <div style={{ fontWeight: 800 }}>ERP</div>
              <div style={{ marginTop: 4 }}>v3.0</div>
            </div>
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 8 }}>
            {[
              ["inicio", "Painel executivo", "◻"],
              ["pesquisa", "Consulta mestre", "⌕"],
              ["inventario", "Inventário físico", "▣"],
              ["historico", "Auditoria", "≣"],
              ["cadastro", "Cadastro mestre", "▤"],
              ["movimentacao", "Movimentações", "↹"],
            ].map(([tab, label, icon]) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "34px 1fr",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    borderRadius: 14,
                    border: isActive
                      ? `1px solid ${CAT_YELLOW}`
                      : "1px solid rgba(255,255,255,0.06)",
                    background: isActive
                      ? "linear-gradient(180deg, rgba(47,111,237,0.28) 0%, rgba(47,111,237,0.14) 100%)"
                      : "rgba(255,255,255,0.03)",
                    color: "white",
                    padding: "13px 14px",
                    cursor: "pointer",
                    textAlign: "left",
                    fontWeight: isActive ? 800 : 700,
                    boxShadow: isActive ? "0 10px 24px rgba(47,111,237,0.18)" : "none",
                  }}
                >
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
                      color: isActive ? "#DBEAFE" : "#CBD5E1",
                      fontSize: 14,
                    }}
                  >
                    {icon}
                  </span>
                  <div>
                    <div style={{ fontSize: 14 }}>{label}</div>
                    <div style={{ fontSize: 11, color: isActive ? "#BFDBFE" : "#94A3B8", marginTop: 3 }}>
                      {tab === "inicio" && "Visão consolidada"}
                      {tab === "pesquisa" && "Consulta por PN e descrição"}
                      {tab === "inventario" && "Contagem e consolidação"}
                      {tab === "historico" && "Rastro operacional"}
                      {tab === "cadastro" && "Base de materiais"}
                      {tab === "movimentacao" && "Entrada e saída mensal"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 20,
              paddingTop: 18,
              borderTop: "1px solid rgba(255,255,255,0.08)",
              display: "grid",
              gap: 10,
            }}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 14,
                padding: 14,
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ color: "#94A3B8", fontSize: 11, letterSpacing: 0.4 }}>MATERIAIS</div>
              <div style={{ marginTop: 6, fontWeight: 900, fontSize: 24 }}>{materials.length}</div>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 14,
                padding: 14,
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ color: "#94A3B8", fontSize: 11, letterSpacing: 0.4 }}>MOV. DO MÊS</div>
              <div style={{ marginTop: 6, fontWeight: 900, fontSize: 24 }}>{currentMonthMovements.length}</div>
              <div style={{ marginTop: 4, color: "#CBD5E1", fontSize: 12 }}>{currentMonthLabel}</div>
            </div>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          {cloudError ? (
            <div
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                border: "1px solid #fecaca",
                borderRadius: 14,
                padding: 16,
                marginBottom: 16,
                fontWeight: 700,
              }}
            >
              {cloudError}
            </div>
          ) : null}

          <div
            style={{
              background: "white",
              borderRadius: 18,
              border: "1px solid #D8E0EA",
              boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
              padding: 18,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.3fr 0.7fr",
                gap: 18,
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
                  color: "white",
                  borderRadius: 18,
                  padding: 24,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: "rgba(47,111,237,0.18)",
                    color: "#BFDBFE",
                    fontWeight: 800,
                    fontSize: 12,
                    border: "1px solid rgba(191,219,254,0.12)",
                  }}
                >
                  OPERATIONS CONTROL PLATFORM
                </div>
                <h1 style={{ margin: "16px 0 8px 0", fontSize: 34, lineHeight: 1.05 }}>
                  Gestão operacional com rastreabilidade e controle mestre
                </h1>
                <div style={{ color: "#CBD5E1", lineHeight: 1.6, maxWidth: 820 }}>
                  Plataforma para cadastro mestre de materiais, consulta operacional, inventário físico, auditoria de alterações e movimentações mensais com identificação por usuário.
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
                  {[
                    `Base ativa: ${materials.length} materiais`,
                    `Inventários: ${inventories.length}`,
                    `Módulo atual: ${activeTab.toUpperCase()}`,
                  ].map((item) => (
                    <div
                      key={item}
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        padding: "10px 12px",
                        fontWeight: 700,
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {[
                  ["ENTRADAS", currentMonthEntries, currentMonthLabel],
                  ["SAÍDAS", currentMonthOutputs, currentMonthLabel],
                  ["AUDITORIA", movements.length, "Eventos totais"],
                ].map(([title, value, subtitle]) => (
                  <div
                    key={title}
                    style={{
                      borderRadius: 16,
                      border: "1px solid #D8E0EA",
                      background: "#F8FAFC",
                      padding: 16,
                    }}
                  >
                    <div style={{ color: "#64748B", fontSize: 12, fontWeight: 700 }}>{title}</div>
                    <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, color: "#0F172A" }}>{value}</div>
                    <div style={{ marginTop: 4, color: "#64748B", fontSize: 13 }}>{subtitle}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              {activeTab === "inicio" && (
                <div style={{ display: "grid", gap: 20 }}>
                  <MiningHero
                    materialsCount={materials.length}
                    inventoriesCount={inventories.length}
                    movementsCount={currentMonthMovements.length}
                    monthLabel={currentMonthLabel}
                  />

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                      gap: 18,
                    }}
                  >
                    <StatCard title="Materiais cadastrados" value={materials.length} subtitle="Base total cadastrada" icon="📦" />
                    <StatCard title="Inventários salvos" value={inventories.length} subtitle="Histórico de contagens" icon="📝" />
                    <StatCard title="Entradas no mês" value={currentMonthEntries} subtitle={currentMonthLabel} icon="⬇️" />
                    <StatCard title="Saídas no mês" value={currentMonthOutputs} subtitle={currentMonthLabel} icon="⬆️" />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 18,
                    }}
                  >
                    <QuickAction title="Pesquisar material" text="Encontre rápido por PN, descrição, localização ou observação." buttonText="Abrir pesquisa" onClick={() => setActiveTab("pesquisa")} />
                    <QuickAction title="Registrar entrada ou saída" text="Lance movimentações do mês com quantidade, foto, data e usuário responsável." buttonText="Abrir movimentação" onClick={() => setActiveTab("movimentacao")} />
                    <QuickAction title="Criar ou abrir inventário" text="Monte um novo inventário, continue um salvo ou adicione item pesquisado." buttonText="Abrir inventário" onClick={() => setActiveTab("inventario")} />
                  </div>

                  <Panel title={`Resumo de movimentações de ${currentMonthLabel}`}>
                    {currentMonthMovements.length ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {currentMonthMovements
                          .sort((a, b) => new Date(b.data) - new Date(a.data))
                          .slice(0, 6)
                          .map((item) => (
                            <div
                              key={item.id}
                              style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: 10,
                                padding: 14,
                                background: "white",
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 12,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 800 }}>{item.descricao}</div>
                                <div style={{ color: "#6b7280", marginTop: 4 }}>PN: {item.pn}</div>
                                <div style={{ color: "#6b7280", marginTop: 4 }}>Usuário: {item.usuarioNome} • {formatDateTime(item.data)}</div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ ...movementTypeStyle(item.tipo), padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{item.tipo}</span>
                                <div style={{ fontWeight: 900, fontSize: 20 }}>{item.quantidade}</div>
                              </div>
                            </div>
                          ))}
                        <div style={{ marginTop: 6 }}>
                          <ActionButton kind="secondary" onClick={() => setActiveTab("movimentacao")}>Ver todas as movimentações do mês</ActionButton>
                        </div>
                      </div>
                    ) : (
                      <div style={{ border: "1px dashed #cbd5e1", borderRadius: 12, padding: 28, textAlign: "center", color: "#64748b", background: "#f8fafc" }}>
                        Ainda não existem movimentações registradas neste mês.
                      </div>
                    )}
                  </Panel>
                </div>
              )}

              {activeTab === "pesquisa" && (
                <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 20 }}>
                  <Panel
                    title="Pesquisar materiais"
                    right={<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><ActionButton kind="secondary" onClick={exportMaterialsCsv}>Exportar CSV</ActionButton><ActionButton kind="secondary" onClick={loadCloudData}>Atualizar nuvem</ActionButton></div>}
                  >
                    <div style={{ display: "grid", gap: 14 }}>
                      <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquise por PN, descrição, localização..." />
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {filteredMaterials.map((item) => (
                          <button
                            key={item.pn}
                            onClick={() => setSelectedMaterialPn(item.pn)}
                            style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 12, alignItems: "center", borderRadius: 12, border: selectedMaterialPn === item.pn ? `2px solid ${CAT_YELLOW}` : "1px solid #e5e7eb", background: "white", padding: 12, cursor: "pointer", textAlign: "left" }}
                          >
                            <div style={{ borderRadius: 10, overflow: "hidden", background: "#EEF2F7", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {item.foto ? <img src={item.foto} alt={item.descricao} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#6b7280" }}>📦</span>}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{item.descricao}</div>
                              <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>PN: {item.pn}</div>
                              <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>Loc.: {item.localizacao || "-"}</div>
                            </div>
                          </button>
                        ))}
                        {!filteredMaterials.length && <div style={{ border: "1px dashed #cbd5e1", borderRadius: 12, padding: 30, textAlign: "center", color: "#64748b" }}>Nenhum material encontrado.</div>}
                      </div>
                    </div>
                  </Panel>

                  <Panel
                    title="Detalhes do material"
                    right={selectedMaterial ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><ActionButton kind="secondary" onClick={() => handleEditMaterial(selectedMaterial)}>Editar material</ActionButton>{canAccessInventario && currentInventory ? <ActionButton kind="success" onClick={addSearchedItemToInventory}>Adicionar ao inventário</ActionButton> : null}</div> : null}
                  >
                    {selectedMaterial ? (
                      <div style={{ display: "grid", gap: 14 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 18, alignItems: "start" }}>
                          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb", background: "#EEF2F7", minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {selectedMaterial.foto ? <img src={selectedMaterial.foto} alt={selectedMaterial.descricao} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#6b7280", fontSize: 48 }}>📦</span>}
                          </div>
                          <div style={{ display: "grid", gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 12, color: "#6b7280" }}>Descrição</div>
                              <div style={{ fontWeight: 800, fontSize: 24, marginTop: 4 }}>{selectedMaterial.descricao}</div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}><div style={{ fontSize: 12, color: "#6b7280" }}>PN</div><div style={{ fontWeight: 700, marginTop: 6 }}>{selectedMaterial.pn}</div></div>
                              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}><div style={{ fontSize: 12, color: "#6b7280" }}>Quantidade</div><div style={{ fontWeight: 700, marginTop: 6 }}>{selectedMaterial.quantidade ?? 0}</div></div>
                              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}><div style={{ fontSize: 12, color: "#6b7280" }}>Localização</div><div style={{ fontWeight: 700, marginTop: 6 }}>{selectedMaterial.localizacao || "-"}</div></div>
                              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}><div style={{ fontSize: 12, color: "#6b7280" }}>Status</div><div style={{ marginTop: 6 }}><span style={{ ...statusStyle(selectedMaterial.status), padding: "6px 10px", borderRadius: 999, fontWeight: 700, fontSize: 12 }}>{selectedMaterial.status}</span></div></div>
                            </div>
                            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}><div style={{ fontSize: 12, color: "#6b7280" }}>Observação</div><div style={{ marginTop: 6, fontWeight: 600 }}>{selectedMaterial.observacao || "Sem observações"}</div></div>
                          </div>
                        </div>

                        <Panel title="Histórico do material">
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {(selectedMaterial.historico || []).length ? (
                              [...selectedMaterial.historico]
                                .sort((a, b) => new Date(b.data) - new Date(a.data))
                                .map((item) => (
                                  <div key={item.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, background: "#fafafa" }}>
                                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                      <span style={{ ...movementTypeStyle(item.acao), padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{item.acao}</span>
                                      <div style={{ fontWeight: 700 }}>{item.usuarioNome}</div>
                                      <div style={{ color: "#6b7280" }}>Matrícula: {item.usuarioMatricula || "-"}</div>
                                    </div>
                                    <div style={{ marginTop: 8, color: "#6b7280" }}>{formatDateTime(item.data)}</div>
                                    <div style={{ marginTop: 8, fontWeight: 600 }}>{item.detalhe || "-"}</div>
                                    {item.observacao ? <div style={{ marginTop: 8, color: "#6b7280" }}>Obs.: {item.observacao}</div> : null}
                                    {item.foto ? <div style={{ marginTop: 12, borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb" }}><img src={item.foto} alt="Histórico" style={{ width: "100%", maxHeight: 220, objectFit: "cover" }} /></div> : null}
                                  </div>
                                ))
                            ) : (
                              <div style={{ border: "1px dashed #cbd5e1", borderRadius: 12, padding: 24, textAlign: "center", color: "#64748b" }}>Nenhum histórico ainda.</div>
                            )}
                          </div>
                        </Panel>
                      </div>
                    ) : (
                      <div style={{ border: "1px dashed #cbd5e1", borderRadius: 14, background: "#f8fafc", padding: 40, textAlign: "center", color: "#64748b" }}>Selecione um material na lista para ver os detalhes.</div>
                    )}
                  </Panel>
                </div>
              )}

              {activeTab === "inventario" && !canAccessInventario && <LoginGate title="Área de Inventário" subtitle="Acesso restrito" onLogin={handleInventarioLogin} loginForm={inventarioLoginForm} setLoginForm={setInventarioLoginForm} errorMessage={inventarioLoginError} />}

              {activeTab === "inventario" && canAccessInventario && (
                <Panel
                  title="Controle de inventário"
                  right={<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><div style={{ background: "#EEF2F7", borderRadius: 10, padding: "10px 14px", fontWeight: 700 }}>👤 {authState.inventario?.nome}</div><ActionButton kind="secondary" onClick={() => logoutArea("inventario")}>Sair</ActionButton></div>}
                >
                  {!currentInventory ? (
                    <div style={{ display: "grid", gap: 18 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
                        <TextInput value={newInventoryName} onChange={(e) => setNewInventoryName(e.target.value)} placeholder="Ex.: Inventário Abril 2026" style={{ minHeight: 52 }} />
                        <ActionButton onClick={startNewInventory}>Criar inventário</ActionButton>
                      </div>
                      <Panel title="Inventários salvos">
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {inventories.length ? inventories.map((inv) => (
                            <div key={inv.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                              <div>
                                <div style={{ fontWeight: 800 }}>{inv.nome}</div>
                                <div style={{ color: "#6b7280", marginTop: 4 }}>Criado por: {inv.criadoPor || "-"}</div>
                                <div style={{ color: "#6b7280", marginTop: 4 }}>Atualizado em: {formatDateTime(inv.atualizadoEm)}</div>
                                <div style={{ color: "#6b7280", marginTop: 4 }}>Itens: {(inv.itens || []).length}</div>
                              </div>
                              <ActionButton kind="secondary" onClick={() => openInventory(inv)}>Abrir inventário</ActionButton>
                            </div>
                          )) : <div style={{ border: "1px dashed #cbd5e1", borderRadius: 12, padding: 24, textAlign: "center", color: "#64748b" }}>Nenhum inventário salvo.</div>}
                        </div>
                      </Panel>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 18 }}>
                      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, background: "#f8fafc" }}>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>Inventário atual</div>
                        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{currentInventory.nome}</div>
                        <div style={{ color: "#6b7280", marginTop: 6 }}>Criado por {currentInventory.criadoPor} em {formatDateTime(currentInventory.criadoEm)}</div>
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <ActionButton onClick={addManualItemToInventory}>Adicionar item manual</ActionButton>
                        <ActionButton kind="secondary" onClick={saveCurrentInventory}>Salvar inventário</ActionButton>
                        <ActionButton kind="success" onClick={finishCurrentInventory}>Finalizar inventário</ActionButton>
                        <ActionButton kind="danger" onClick={() => { const confirmed = window.confirm("Deseja fechar o inventário atual sem apagar os dados salvos?"); if (!confirmed) return; setCurrentInventory(null); }}>Fechar inventário</ActionButton>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {(currentInventory.itens || []).length ? currentInventory.itens.map((item) => <InventoryItemRow key={item.id} item={item} onChange={(nextItem) => updateInventoryItem(item.id, nextItem)} onRemove={() => removeInventoryItem(item.id)} />) : <div style={{ border: "1px dashed #cbd5e1", borderRadius: 12, padding: 30, textAlign: "center", color: "#64748b" }}>Nenhum item no inventário atual.</div>}
                      </div>
                    </div>
                  )}
                </Panel>
              )}

              {activeTab === "historico" && (
                <Panel title="Histórico geral de movimentações e ações">
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {materials.some((item) => (item.historico || []).length > 0) ? (
                      materials.flatMap((material) => (material.historico || []).map((hist) => ({ ...hist, pn: material.pn, descricao: material.descricao }))).sort((a, b) => new Date(b.data) - new Date(a.data)).map((item) => (
                        <div key={item.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, background: "white" }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ ...movementTypeStyle(item.acao), padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{item.acao}</span>
                            <strong>{item.descricao}</strong>
                            <span style={{ color: "#6b7280" }}>PN: {item.pn}</span>
                          </div>
                          <div style={{ marginTop: 8, color: "#6b7280" }}>{formatDateTime(item.data)}</div>
                          <div style={{ marginTop: 8, fontWeight: 600 }}>Usuário: {item.usuarioNome} | Matrícula: {item.usuarioMatricula || "-"}</div>
                          <div style={{ marginTop: 8 }}>{item.detalhe || "-"}</div>
                          {item.observacao ? <div style={{ marginTop: 8, color: "#6b7280" }}>Obs.: {item.observacao}</div> : null}
                        </div>
                      ))
                    ) : <div style={{ border: "1px dashed #cbd5e1", borderRadius: 14, background: "#f8fafc", padding: 40, textAlign: "center", color: "#64748b" }}>Nenhum histórico registrado ainda.</div>}
                  </div>
                </Panel>
              )}

              {activeTab === "cadastro" && !canAccessMateriais && <LoginGate title="Cadastro de materiais" subtitle="Login da área de materiais" onLogin={handleMateriaisLogin} loginForm={materiaisLoginForm} setLoginForm={setMateriaisLoginForm} errorMessage={materiaisLoginError} />}

              {activeTab === "cadastro" && canAccessMateriais && (
                <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 20 }}>
                  <Panel
                    title={editingPn ? "Editar material" : "Cadastrar material"}
                    right={<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><div style={{ background: "#EEF2F7", borderRadius: 10, padding: "10px 14px", fontWeight: 700 }}>👤 {authState.materiais?.nome}</div><ActionButton kind="secondary" onClick={() => logoutArea("materiais")}>Sair</ActionButton></div>}
                  >
                    <div style={{ display: "grid", gap: 14 }}>
                      <div style={{ background: "#fff7cc", border: "1px solid #fde68a", borderRadius: 10, padding: 14 }}>
                        <div style={{ fontWeight: 800 }}>Modelo CSV para importar</div>
                        <div style={{ color: "#6b7280", marginTop: 6 }}>Cabeçalho esperado:</div>
                        <div style={{ marginTop: 8, fontFamily: "monospace", background: "white", borderRadius: 12, padding: 10, fontSize: 13 }}>{CSV_HEADERS_EXAMPLE}</div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}><input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={importCsvFile} /></div>
                      </div>
                      <Field label="PN"><TextInput value={newMaterial.pn} onChange={(e) => setNewMaterial((prev) => ({ ...prev, pn: e.target.value }))} placeholder="Digite o PN" /></Field>
                      <Field label="Descrição"><TextInput value={newMaterial.descricao} onChange={(e) => setNewMaterial((prev) => ({ ...prev, descricao: e.target.value }))} placeholder="Descrição do material" /></Field>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Localização"><TextInput value={newMaterial.localizacao} onChange={(e) => setNewMaterial((prev) => ({ ...prev, localizacao: e.target.value }))} placeholder="01.02.03.04" /></Field>
                        <Field label="Quantidade"><TextInput type="number" value={newMaterial.quantidade} onChange={(e) => setNewMaterial((prev) => ({ ...prev, quantidade: e.target.value }))} placeholder="0" /></Field>
                      </div>
                      <Field label="Status"><select value={newMaterial.status} onChange={(e) => setNewMaterial((prev) => ({ ...prev, status: e.target.value }))} style={{ width: "100%", minHeight: 46, borderRadius: 10, border: "1px solid #d1d5db", padding: "12px 14px", fontSize: 16, outline: "none", background: "white" }}><option value="IDENTIFICADO">IDENTIFICADO</option><option value="SEM FOTO">SEM FOTO</option><option value="SEM LOCALIZAÇÃO">SEM LOCALIZAÇÃO</option><option value="COMPLETO">COMPLETO</option></select></Field>
                      <Field label="Observação"><TextArea rows={3} value={newMaterial.observacao} onChange={(e) => setNewMaterial((prev) => ({ ...prev, observacao: e.target.value }))} placeholder="Observações" /></Field>
                      <InventoryPhotoInput label="Foto do material" foto={newMaterial.foto} onChange={(foto) => setNewMaterial((prev) => ({ ...prev, foto }))} />
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <ActionButton onClick={saveMaterial}>{editingPn ? "Atualizar material" : "Salvar material"}</ActionButton>
                        <ActionButton kind="secondary" onClick={resetMaterialForm}>Limpar</ActionButton>
                      </div>
                    </div>
                  </Panel>

                  <Panel title="Lista de materiais cadastrados">
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {materials.length ? materials.map((item) => <MaterialListItem key={item.pn} item={item} onEdit={handleEditMaterial} onDelete={deleteMaterial} />) : <div style={{ border: "1px dashed #cbd5e1", borderRadius: 14, background: "#f8fafc", padding: 40, textAlign: "center", color: "#64748b" }}>Nenhum material cadastrado ainda.</div>}
                    </div>
                  </Panel>
                </div>
              )}

              {activeTab === "movimentacao" && !canAccessMateriais && <LoginGate title="Entrada e Saída" subtitle="Login da área de materiais" onLogin={handleMateriaisLogin} loginForm={materiaisLoginForm} setLoginForm={setMateriaisLoginForm} errorMessage={materiaisLoginError} />}

              {activeTab === "movimentacao" && canAccessMateriais && (
                <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 20 }}>
                  <Panel
                    title="Registrar entrada ou saída"
                    right={<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><div style={{ background: "#EEF2F7", borderRadius: 10, padding: "10px 14px", fontWeight: 700 }}>👤 {authState.materiais?.nome}</div><ActionButton kind="secondary" onClick={() => logoutArea("materiais")}>Sair</ActionButton></div>}
                  >
                    <div style={{ display: "grid", gap: 14 }}>
                      <Field label="Tipo da movimentação"><select value={movementForm.tipo} onChange={(e) => setMovementForm((prev) => ({ ...prev, tipo: e.target.value }))} style={{ width: "100%", minHeight: 46, borderRadius: 10, border: "1px solid #d1d5db", padding: "12px 14px", fontSize: 16, outline: "none", background: "white" }}><option value="SAÍDA">SAÍDA</option><option value="ENTRADA">ENTRADA</option></select></Field>
                      <Field label="PN"><TextInput value={movementForm.pn} onChange={(e) => setMovementForm((prev) => ({ ...prev, pn: e.target.value }))} placeholder="Digite o PN" /></Field>
                      {matchedMovementMaterial ? <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, background: "#f8fafc" }}><div style={{ fontWeight: 800 }}>{matchedMovementMaterial.descricao}</div><div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>PN: {matchedMovementMaterial.pn}</div><div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Localização: {matchedMovementMaterial.localizacao || "Não informada"}</div><div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Quantidade atual cadastrada: {matchedMovementMaterial.quantidade ?? 0}</div></div> : null}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Quantidade"><TextInput type="number" value={movementForm.quantidade} onChange={(e) => setMovementForm((prev) => ({ ...prev, quantidade: e.target.value }))} placeholder="0" /></Field>
                        <Field label="Data e hora"><TextInput type="datetime-local" value={movementForm.data} onChange={(e) => setMovementForm((prev) => ({ ...prev, data: e.target.value }))} /></Field>
                      </div>
                      <Field label="Observação"><TextArea rows={3} value={movementForm.observacao} onChange={(e) => setMovementForm((prev) => ({ ...prev, observacao: e.target.value }))} placeholder="Ex.: faturado, reposição, devolução..." /></Field>
                      <InventoryPhotoInput label="Foto da movimentação" foto={movementForm.foto} onChange={(foto) => setMovementForm((prev) => ({ ...prev, foto }))} />
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <ActionButton onClick={registerMovement}>Salvar movimentação</ActionButton>
                        <ActionButton kind="secondary" onClick={() => setMovementForm({ tipo: "SAÍDA", pn: "", quantidade: "", observacao: "", foto: "", data: new Date().toISOString().slice(0, 16) })}>Limpar</ActionButton>
                      </div>
                    </div>
                  </Panel>

                  <Panel
                    title="Movimentações do mês"
                    right={<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><select value={movementMonthFilter} onChange={(e) => setMovementMonthFilter(e.target.value)} style={{ minHeight: 44, borderRadius: 14, border: "1px solid #d1d5db", padding: "10px 12px", background: "white" }}>{movementMonths.map((key) => <option key={key} value={key}>{formatMonthLabel(key)}</option>)}</select><ActionButton kind="secondary" onClick={exportMovementsCsv}>Exportar CSV</ActionButton></div>}
                  >
                    {filteredMovements.length ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {filteredMovements.sort((a, b) => new Date(b.data) - new Date(a.data)).map((item) => (
                          <div key={item.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "white" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 18 }}>{item.descricao}</div>
                                <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>PN: {item.pn}</div>
                              </div>
                              <span style={{ ...movementTypeStyle(item.tipo), padding: "6px 12px", borderRadius: 999, fontWeight: 800, fontSize: 12 }}>{item.tipo}</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
                              <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12 }}><div style={{ fontSize: 12, color: "#6b7280" }}>Quantidade</div><div style={{ fontWeight: 700, marginTop: 6 }}>{item.quantidade}</div></div>
                              <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12 }}><div style={{ fontSize: 12, color: "#6b7280" }}>Usuário</div><div style={{ fontWeight: 700, marginTop: 6 }}>{item.usuarioNome}</div></div>
                              <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12 }}><div style={{ fontSize: 12, color: "#6b7280" }}>Antes</div><div style={{ fontWeight: 700, marginTop: 6 }}>{item.quantidadeAntes}</div></div>
                              <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12 }}><div style={{ fontSize: 12, color: "#6b7280" }}>Depois</div><div style={{ fontWeight: 700, marginTop: 6 }}>{item.quantidadeDepois}</div></div>
                            </div>
                            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 12 }}>{formatDateTime(item.data)}</div>
                            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 6 }}>{item.observacao || "Sem observações"}</div>
                            {item.foto ? <div style={{ marginTop: 12, borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb" }}><img src={item.foto} alt="Movimentação" style={{ width: "100%", maxHeight: 240, objectFit: "cover" }} /></div> : null}
                          </div>
                        ))}
                      </div>
                    ) : <div style={{ border: "1px dashed #cbd5e1", borderRadius: 24, background: "#f8fafc", padding: 40, textAlign: "center", color: "#64748b" }}>Nenhuma movimentação registrada nesse mês.</div>}
                  </Panel>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
