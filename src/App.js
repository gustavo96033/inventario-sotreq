import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEYS = {
  materials: "inventario_materials_v9",
  inventories: "inventario_inventories_v9",
  currentInventory: "inventario_current_v9",
  auth: "inventario_auth_v9",
  movements: "inventario_movements_v9",
};

const CAT_YELLOW = "#f2c200";
const CAT_BLACK = "#111111";

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
      matricula: "401667,
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
      color: CAT_BLACK,
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
        borderRadius: 16,
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
        borderRadius: 24,
        padding: 20,
        boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
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
        borderRadius: 16,
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
        borderRadius: 16,
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
          borderRadius: 18,
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
        borderRadius: 20,
        padding: 12,
        alignItems: "center",
        background: "white",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 16,
          overflow: "hidden",
          background: "#f3f4f6",
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
        borderRadius: 20,
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
            borderRadius: 24,
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
              borderRadius: 16,
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
        background: "linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%)",
        color: "white",
        borderRadius: 22,
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
        borderRadius: 24,
        padding: 20,
        border: "1px solid #e5e7eb",
        boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
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
          "linear-gradient(135deg, #111111 0%, #1f2937 45%, #111111 100%)",
        borderRadius: 28,
        padding: 26,
        color: "white",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 16px 40px rgba(0,0,0,0.20)",
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
          background: "rgba(242,194,0,0.10)",
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
          background: "rgba(242,194,0,0.08)",
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
            color: CAT_BLACK,
            borderRadius: 999,
            padding: "10px 14px",
            fontWeight: 900,
            fontSize: 13,
            letterSpacing: 0.3,
          }}
        >
          SOTREQ CAT • CONTROLE INTERNO
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
              Sistema de Controle de Materiais
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
              Cadastro de materiais, inventário, histórico por usuário e controle
              mensal de entrada e saída com foto, quantidade e rastreabilidade.
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
                  borderRadius: 16,
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
                  borderRadius: 16,
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
                  borderRadius: 16,
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
              borderRadius: 24,
              background:
                "linear-gradient(180deg, rgba(242,194,0,0.14) 0%, rgba(255,255,255,0.02) 100%)",
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
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <div style={{ color: "#9ca3af", fontSize: 12 }}>Foco atual</div>
                <div style={{ marginTop: 6, fontWeight: 800, fontSize: 18 }}>
                  Entradas e saídas mensais
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <div style={{ color: "#9ca3af", fontSize: 12 }}>Controle</div>
                <div style={{ marginTop: 6, fontWeight: 800, fontSize: 18 }}>
                  Rastreio por usuário + foto
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <div style={{ color: "#9ca3af", fontSize: 12 }}>Sistema</div>
                <div style={{ marginTop: 6, fontWeight: 800, fontSize: 18 }}>
                  Gestão inteligente de estoque
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({ onEnter }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #111111 0%, #1f2937 50%, #111111 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1100,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 32,
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            minHeight: 620,
          }}
        >
          <div
            style={{
              padding: 42,
              color: "white",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              background:
                "linear-gradient(160deg, rgba(242,194,0,0.10) 0%, rgba(255,255,255,0.02) 45%, rgba(0,0,0,0.00) 100%)",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: CAT_YELLOW,
                  color: CAT_BLACK,
                  borderRadius: 999,
                  padding: "10px 16px",
                  fontWeight: 900,
                  fontSize: 14,
                }}
              >
                SOTREQ CAT
              </div>

              <h1
                style={{
                  margin: "22px 0 14px 0",
                  fontSize: 48,
                  lineHeight: 1.05,
                }}
              >
                Controle inteligente
                <br />
                de materiais
              </h1>

              <div
                style={{
                  color: "#d1d5db",
                  fontSize: 18,
                  lineHeight: 1.7,
                  maxWidth: 620,
                }}
              >
                Sistema para cadastro, pesquisa, inventário, histórico de ações e
                movimentação mensal de entrada e saída com identificação por usuário.
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  marginTop: 24,
                }}
              >
                <div
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    padding: "12px 16px",
                    fontWeight: 700,
                  }}
                >
                  📦 Cadastro e pesquisa
                </div>
                <div
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    padding: "12px 16px",
                    fontWeight: 700,
                  }}
                >
                  📝 Inventário salvo
                </div>
                <div
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    padding: "12px 16px",
                    fontWeight: 700,
                  }}
                >
                  🔁 Entrada e saída
                </div>
              </div>
            </div>

            <div style={{ marginTop: 26 }}>
              <button
                onClick={onEnter}
                style={{
                  background: CAT_YELLOW,
                  color: CAT_BLACK,
                  border: `1px solid ${CAT_YELLOW}`,
                  borderRadius: 18,
                  padding: "16px 24px",
                  fontWeight: 900,
                  fontSize: 17,
                  cursor: "pointer",
                }}
              >
                Entrar no sistema
              </button>
            </div>
          </div>

          <div
            style={{
              padding: 30,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.08) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 420,
                display: "grid",
                gap: 16,
              }}
            >
              <div
                style={{
                  background: "#0f0f0f",
                  color: "white",
                  borderRadius: 24,
                  padding: 22,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ color: "#9ca3af", fontSize: 13 }}>Módulo</div>
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>
                  Pesquisa de materiais
                </div>
                <div style={{ marginTop: 8, color: "#d1d5db" }}>
                  Busca rápida por PN, descrição, localização e histórico.
                </div>
              </div>

              <div
                style={{
                  background: "#0f0f0f",
                  color: "white",
                  borderRadius: 24,
                  padding: 22,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ color: "#9ca3af", fontSize: 13 }}>Módulo</div>
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>
                  Inventário e histórico
                </div>
                <div style={{ marginTop: 8, color: "#d1d5db" }}>
                  Criação de inventários salvos e rastreio por usuário.
                </div>
              </div>

              <div
                style={{
                  background: "#0f0f0f",
                  color: "white",
                  borderRadius: 24,
                  padding: 22,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ color: "#9ca3af", fontSize: 13 }}>Módulo</div>
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>
                  Entrada e saída mensal
                </div>
                <div style={{ marginTop: 8, color: "#d1d5db" }}>
                  Controle de quantidade, fotos e movimentações do mês.
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

export default function App() {
  const [materials, setMaterials] = useState(() =>
    readStorage(STORAGE_KEYS.materials, [])
  );
  const [inventories, setInventories] = useState(() =>
    readStorage(STORAGE_KEYS.inventories, [])
  );
  const [currentInventory, setCurrentInventory] = useState(() =>
    readStorage(STORAGE_KEYS.currentInventory, null)
  );
  const [authState, setAuthState] = useState(() =>
    readStorage(STORAGE_KEYS.auth, {
      inventario: null,
      materiais: null,
    })
  );
  const [movements, setMovements] = useState(() =>
    readStorage(STORAGE_KEYS.movements, [])
  );

  const [enteredApp, setEnteredApp] = useState(false);
  const [activeTab, setActiveTab] = useState("inicio");
  const [search, setSearch] = useState("");
  const [selectedMaterialPn, setSelectedMaterialPn] = useState("");

  const [newMaterial, setNewMaterial] = useState({
    pn: "",
    descricao: "",
    localizacao: "",
    quantidade: "",
    observacao: "",
    status: "IDENTIFICADO",
    foto: "",
  });

  const [editingPn, setEditingPn] = useState(null);

  const [newInventoryName, setNewInventoryName] = useState("");

  const [inventarioLoginForm, setInventarioLoginForm] = useState({
    matricula: "",
    senha: "",
  });
  const [materiaisLoginForm, setMateriaisLoginForm] = useState({
    matricula: "",
    senha: "",
  });
  const [inventarioLoginError, setInventarioLoginError] = useState("");
  const [materiaisLoginError, setMateriaisLoginError] = useState("");

  const [movementForm, setMovementForm] = useState({
    tipo: "SAÍDA",
    pn: "",
    quantidade: "",
    observacao: "",
    foto: "",
    data: new Date().toISOString().slice(0, 16),
  });

  const [movementMonthFilter, setMovementMonthFilter] = useState(
    getMonthKey(new Date())
  );

  const csvInputRef = useRef(null);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.materials, materials);
  }, [materials]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.inventories, inventories);
  }, [inventories]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.currentInventory, currentInventory);
  }, [currentInventory]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.auth, authState);
  }, [authState]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.movements, movements);
  }, [movements]);

  const canAccessInventario = !!authState.inventario;
  const canAccessMateriais = !!authState.materiais;

  const selectedMaterial = useMemo(() => {
    return materials.find((item) => item.pn === selectedMaterialPn) || null;
  }, [materials, selectedMaterialPn]);

  const matchedMovementMaterial = useMemo(() => {
    return (
      materials.find(
        (item) => normalizeText(item.pn) === normalizeText(movementForm.pn)
      ) || null
    );
  }, [materials, movementForm.pn]);

  const filteredMaterials = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return materials;

    return materials.filter((item) => {
      const combined = [
        item.pn,
        item.descricao,
        item.localizacao,
        item.observacao,
        item.status,
      ]
        .join(" ")
        .toLowerCase();

      return normalizeText(combined).includes(q);
    });
  }, [materials, search]);

  const movementMonths = useMemo(() => {
    const keys = Array.from(
      new Set(movements.map((item) => getMonthKey(item.data)))
    ).sort((a, b) => b.localeCompare(a));

    if (!keys.includes(movementMonthFilter)) {
      return [movementMonthFilter, ...keys].filter(Boolean);
    }

    return keys;
  }, [movements, movementMonthFilter]);

  const filteredMovements = useMemo(() => {
    return movements.filter(
      (item) => getMonthKey(item.data) === movementMonthFilter
    );
  }, [movements, movementMonthFilter]);

  const currentMonthLabel = formatMonthLabel(getMonthKey(new Date()));

  const currentMonthMovements = useMemo(() => {
    const currentMonth = getMonthKey(new Date());
    return movements.filter((item) => getMonthKey(item.data) === currentMonth);
  }, [movements]);

  const currentMonthEntries = useMemo(() => {
    return currentMonthMovements
      .filter((item) => String(item.tipo).toUpperCase() === "ENTRADA")
      .reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
  }, [currentMonthMovements]);

  const currentMonthOutputs = useMemo(() => {
    return currentMonthMovements
      .filter((item) => {
        const tipo = String(item.tipo).toUpperCase();
        return tipo === "SAÍDA" || tipo === "SAIDA";
      })
      .reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
  }, [currentMonthMovements]);

  function authenticate(area, matricula, senha) {
    const users = ACCESS_CONFIG[area] || [];
    return (
      users.find(
        (user) =>
          String(user.matricula) === String(matricula).trim() &&
          String(user.senha) === String(senha)
      ) || null
    );
  }

  function handleInventarioLogin() {
    const found = authenticate(
      "inventario",
      inventarioLoginForm.matricula,
      inventarioLoginForm.senha
    );

    if (!found) {
      setInventarioLoginError(
        "Matrícula ou senha inválida para a área de inventário."
      );
      return;
    }

    setInventarioLoginError("");
    setAuthState((prev) => ({
      ...prev,
      inventario: {
        matricula: found.matricula,
        nome: found.nome,
        loggedAt: new Date().toISOString(),
      },
    }));
    setInventarioLoginForm({ matricula: "", senha: "" });
  }

  function handleMateriaisLogin() {
    const found = authenticate(
      "materiais",
      materiaisLoginForm.matricula,
      materiaisLoginForm.senha
    );

    if (!found) {
      setMateriaisLoginError(
        "Matrícula ou senha inválida para a área de materiais."
      );
      return;
    }

    setMateriaisLoginError("");
    setAuthState((prev) => ({
      ...prev,
      materiais: {
        matricula: found.matricula,
        nome: found.nome,
        loggedAt: new Date().toISOString(),
      },
    }));
    setMateriaisLoginForm({ matricula: "", senha: "" });
  }

  function logoutArea(area) {
    setAuthState((prev) => ({
      ...prev,
      [area]: null,
    }));

    if (area === "inventario") {
      setInventarioLoginError("");
      setInventarioLoginForm({ matricula: "", senha: "" });
    }

    if (area === "materiais") {
      setMateriaisLoginError("");
      setMateriaisLoginForm({ matricula: "", senha: "" });
    }
  }

  function resetMaterialForm() {
    setNewMaterial({
      pn: "",
      descricao: "",
      localizacao: "",
      quantidade: "",
      observacao: "",
      status: "IDENTIFICADO",
      foto: "",
    });
    setEditingPn(null);
  }

  function saveMaterial() {
    const pn = String(newMaterial.pn || "").trim();
    const descricao = String(newMaterial.descricao || "").trim();

    if (!pn || !descricao) {
      alert("Preencha pelo menos o PN e a descrição.");
      return;
    }

    const quantity = Number(newMaterial.quantidade || 0);

    const baseRecord = {
      pn,
      descricao,
      localizacao: String(newMaterial.localizacao || "").trim(),
      quantidade: Number.isFinite(quantity) ? quantity : 0,
      observacao: String(newMaterial.observacao || "").trim(),
      status: String(newMaterial.status || "IDENTIFICADO").trim(),
      foto: newMaterial.foto || "",
      atualizadoEm: new Date().toISOString(),
    };

    if (editingPn) {
      setMaterials((prev) =>
        prev.map((item) => {
          if (item.pn !== editingPn) return item;

          const historyEntry = {
            id: createId(),
            acao: "EDIÇÃO DE CADASTRO",
            data: new Date().toISOString(),
            usuarioNome: authState.materiais?.nome || "Usuário",
            usuarioMatricula: authState.materiais?.matricula || "-",
            detalhe: `Material ${item.pn} editado`,
          };

          return {
            ...item,
            ...baseRecord,
            historico: [...(item.historico || []), historyEntry],
          };
        })
      );

      alert("Material atualizado com sucesso.");
    } else {
      const alreadyExists = materials.some(
        (item) => normalizeText(item.pn) === normalizeText(pn)
      );

      if (alreadyExists) {
        alert("Já existe um material com esse PN.");
        return;
      }

      const historyEntry = {
        id: createId(),
        acao: "CADASTRO",
        data: new Date().toISOString(),
        usuarioNome: authState.materiais?.nome || "Usuário",
        usuarioMatricula: authState.materiais?.matricula || "-",
        detalhe: `Material ${pn} cadastrado`,
      };

      setMaterials((prev) => [
        {
          id: createId(),
          criadoEm: new Date().toISOString(),
          historico: [historyEntry],
          ...baseRecord,
        },
        ...prev,
      ]);

      alert("Material salvo com sucesso.");
    }

    resetMaterialForm();
  }

  function handleEditMaterial(item) {
    setEditingPn(item.pn);
    setNewMaterial({
      pn: item.pn || "",
      descricao: item.descricao || "",
      localizacao: item.localizacao || "",
      quantidade: String(item.quantidade ?? ""),
      observacao: item.observacao || "",
      status: item.status || "IDENTIFICADO",
      foto: item.foto || "",
    });
    setActiveTab("cadastro");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteMaterial(pn) {
    const material = materials.find((item) => item.pn === pn);
    if (!material) return;

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o material ${pn}?`
    );
    if (!confirmed) return;

    setMaterials((prev) => prev.filter((item) => item.pn !== pn));

    if (selectedMaterialPn === pn) {
      setSelectedMaterialPn("");
    }

    alert("Material excluído.");
  }

  function startNewInventory() {
    const name =
      newInventoryName.trim() ||
      `Inventário ${new Date().toLocaleDateString("pt-BR")}`;

    setCurrentInventory({
      id: createId(),
      nome: name,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      criadoPor: authState.inventario?.nome || "Usuário",
      itens: [],
    });

    setNewInventoryName("");
  }

  function saveCurrentInventory() {
    if (!currentInventory) return;

    const sanitized = {
      ...currentInventory,
      atualizadoEm: new Date().toISOString(),
    };

    setCurrentInventory(sanitized);

    setInventories((prev) => {
      const exists = prev.some((inv) => inv.id === sanitized.id);
      if (exists) {
        return prev.map((inv) => (inv.id === sanitized.id ? sanitized : inv));
      }
      return [sanitized, ...prev];
    });

    alert("Inventário salvo com sucesso.");
  }

  function openInventory(inv) {
    setCurrentInventory(inv);
    setActiveTab("inventario");
  }

  function addManualItemToInventory() {
    if (!currentInventory) return;

    setCurrentInventory((prev) => ({
      ...prev,
      atualizadoEm: new Date().toISOString(),
      itens: [
        ...(prev?.itens || []),
        {
          id: createId(),
          pn: "",
          descricao: "",
          quantidadeContada: "",
          localizacao: "",
          observacao: "",
          foto: "",
        },
      ],
    }));
  }

  function addSearchedItemToInventory() {
    if (!currentInventory || !selectedMaterial) {
      alert("Selecione um material na pesquisa primeiro.");
      return;
    }

    setCurrentInventory((prev) => ({
      ...prev,
      atualizadoEm: new Date().toISOString(),
      itens: [
        ...(prev?.itens || []),
        {
          id: createId(),
          pn: selectedMaterial.pn,
          descricao: selectedMaterial.descricao,
          quantidadeContada: selectedMaterial.quantidade ?? "",
          localizacao: selectedMaterial.localizacao || "",
          observacao: selectedMaterial.observacao || "",
          foto: selectedMaterial.foto || "",
        },
      ],
    }));

    setActiveTab("inventario");
  }

  function updateInventoryItem(itemId, nextItem) {
    setCurrentInventory((prev) => ({
      ...prev,
      atualizadoEm: new Date().toISOString(),
      itens: prev.itens.map((item) => (item.id === itemId ? nextItem : item)),
    }));
  }

  function removeInventoryItem(itemId) {
    setCurrentInventory((prev) => ({
      ...prev,
      atualizadoEm: new Date().toISOString(),
      itens: prev.itens.filter((item) => item.id !== itemId),
    }));
  }

  function finishCurrentInventory() {
    if (!currentInventory) return;
    saveCurrentInventory();
    setCurrentInventory(null);
    alert("Inventário finalizado e salvo no histórico.");
  }

  function importCsvFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const imported = parseCsvText(text);

      if (!imported.length) {
        alert("Não foi possível importar a planilha.");
        return;
      }

      setMaterials((prev) => {
        const map = new Map(prev.map((item) => [normalizeText(item.pn), item]));

        imported.forEach((item) => {
          const key = normalizeText(item.pn);
          const existing = map.get(key);

          if (existing) {
            map.set(key, {
              ...existing,
              ...item,
              historico: [
                ...(existing.historico || []),
                {
                  id: createId(),
                  acao: "IMPORTAÇÃO CSV",
                  data: new Date().toISOString(),
                  usuarioNome: authState.materiais?.nome || "Sistema",
                  usuarioMatricula: authState.materiais?.matricula || "-",
                  detalhe: `Material ${item.pn} atualizado por importação`,
                },
              ],
            });
          } else {
            map.set(key, {
              ...item,
              historico: [
                {
                  id: createId(),
                  acao: "IMPORTAÇÃO CSV",
                  data: new Date().toISOString(),
                  usuarioNome: authState.materiais?.nome || "Sistema",
                  usuarioMatricula: authState.materiais?.matricula || "-",
                  detalhe: `Material ${item.pn} importado por CSV`,
                },
              ],
            });
          }
        });

        return Array.from(map.values()).sort((a, b) =>
          a.descricao.localeCompare(b.descricao, "pt-BR")
        );
      });

      alert(`Importação concluída. ${imported.length} item(ns) processado(s).`);
      if (csvInputRef.current) csvInputRef.current.value = "";
    };

    reader.readAsText(file, "utf-8");
  }

  function registerMovement() {
    const pn = String(movementForm.pn || "").trim();
    const quantidade = Number(movementForm.quantidade || 0);

    if (!pn) {
      alert("Digite o PN.");
      return;
    }

    if (!quantidade || quantidade <= 0) {
      alert("Digite uma quantidade válida.");
      return;
    }

    const material = materials.find(
      (item) => normalizeText(item.pn) === normalizeText(pn)
    );

    if (!material) {
      alert("PN não encontrado nos materiais cadastrados.");
      return;
    }

    const isEntrada = String(movementForm.tipo).toUpperCase() === "ENTRADA";
    const currentQty = Number(material.quantidade || 0);
    const nextQty = isEntrada ? currentQty + quantidade : currentQty - quantidade;

    if (!isEntrada && nextQty < 0) {
      alert("Não é possível fazer saída maior do que a quantidade atual.");
      return;
    }

    const record = {
      id: createId(),
      tipo: isEntrada ? "ENTRADA" : "SAÍDA",
      pn: material.pn,
      descricao: material.descricao,
      quantidade,
      observacao: String(movementForm.observacao || "").trim(),
      foto: movementForm.foto || "",
      data: movementForm.data
        ? new Date(movementForm.data).toISOString()
        : new Date().toISOString(),
      usuarioNome: authState.materiais?.nome || "Usuário",
      usuarioMatricula: authState.materiais?.matricula || "-",
      quantidadeAntes: currentQty,
      quantidadeDepois: nextQty,
    };

    setMovements((prev) => [record, ...prev]);

    setMaterials((prev) =>
      prev.map((item) => {
        if (item.pn !== material.pn) return item;

        return {
          ...item,
          quantidade: nextQty,
          atualizadoEm: new Date().toISOString(),
          historico: [
            ...(item.historico || []),
            {
              id: createId(),
              acao: record.tipo,
              data: record.data,
              usuarioNome: record.usuarioNome,
              usuarioMatricula: record.usuarioMatricula,
              detalhe: `${record.tipo} de ${quantidade} unidade(s). Antes: ${currentQty}. Depois: ${nextQty}.`,
              foto: record.foto || "",
              observacao: record.observacao || "",
            },
          ],
        };
      })
    );

    setMovementForm({
      tipo: "SAÍDA",
      pn: "",
      quantidade: "",
      observacao: "",
      foto: "",
      data: new Date().toISOString().slice(0, 16),
    });

    setMovementMonthFilter(getMonthKey(record.data));
    alert("Movimentação registrada com sucesso.");
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

    exportToCsv("materiais.csv", rows);
  }

  function exportMovementsCsv() {
    const rows = [
      [
        "TIPO",
        "PN",
        "DESCRIÇÃO",
        "QUANTIDADE",
        "USUÁRIO",
        "MATRÍCULA",
        "DATA",
        "OBSERVAÇÃO",
        "ANTES",
        "DEPOIS",
      ],
      ...filteredMovements.map((item) => [
        item.tipo,
        item.pn,
        item.descricao,
        item.quantidade,
        item.usuarioNome,
        item.usuarioMatricula,
        formatDateTime(item.data),
        item.observacao || "",
        item.quantidadeAntes,
        item.quantidadeDepois,
      ]),
    ];

    exportToCsv(`movimentacoes_${movementMonthFilter}.csv`, rows);
  }

  function tabButton(tab) {
    const isActive = activeTab === tab;
    return {
      border: isActive ? `1px solid ${CAT_YELLOW}` : "1px solid #d1d5db",
      background: isActive ? CAT_YELLOW : "white",
      color: CAT_BLACK,
      borderRadius: 18,
      padding: "12px 16px",
      fontWeight: 800,
      cursor: "pointer",
    };
  }

  if (!enteredApp) {
    return <WelcomeScreen onEnter={() => setEnteredApp(true)} />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: 20,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ maxWidth: 1450, margin: "0 auto" }}>
        <div
          style={{
            background: CAT_BLACK,
            borderRadius: 28,
            padding: 24,
            color: "white",
            boxShadow: "0 10px 35px rgba(0,0,0,0.18)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  background: CAT_YELLOW,
                  color: CAT_BLACK,
                  padding: "10px 14px",
                  borderRadius: 18,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  display: "inline-block",
                }}
              >
                SOTREQ CAT
              </div>
              <h1 style={{ margin: "14px 0 6px 0", fontSize: 30 }}>
                Controle de materiais
              </h1>
              <div style={{ color: "#d1d5db" }}>
                Cadastro, inventário, histórico e movimentação de entrada e saída
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 20,
                  padding: "12px 16px",
                }}
              >
                <div style={{ fontSize: 12, color: "#d1d5db" }}>Materiais</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  {materials.length}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 20,
                  padding: "12px 16px",
                }}
              >
                <div style={{ fontSize: 12, color: "#d1d5db" }}>Inventários</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  {inventories.length}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 20,
                  padding: "12px 16px",
                }}
              >
                <div style={{ fontSize: 12, color: "#d1d5db" }}>
                  Movimentações
                </div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  {movements.length}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 20,
            marginBottom: 20,
            background: "white",
            padding: 12,
            borderRadius: 24,
            border: "1px solid #e5e7eb",
            boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
          }}
        >
          <button style={tabButton("inicio")} onClick={() => setActiveTab("inicio")}>
            Início
          </button>

          <button style={tabButton("pesquisa")} onClick={() => setActiveTab("pesquisa")}>
            Pesquisa
          </button>

          <button style={tabButton("inventario")} onClick={() => setActiveTab("inventario")}>
            Inventário
          </button>

          <button style={tabButton("historico")} onClick={() => setActiveTab("historico")}>
            Histórico
          </button>

          <button style={tabButton("cadastro")} onClick={() => setActiveTab("cadastro")}>
            Materiais cadastrados
          </button>

          <button style={tabButton("movimentacao")} onClick={() => setActiveTab("movimentacao")}>
            Entrada e Saída
          </button>
        </div>

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
              <StatCard
                title="Materiais cadastrados"
                value={materials.length}
                subtitle="Base total cadastrada"
                icon="📦"
              />
              <StatCard
                title="Inventários salvos"
                value={inventories.length}
                subtitle="Histórico de contagens"
                icon="📝"
              />
              <StatCard
                title="Entradas no mês"
                value={currentMonthEntries}
                subtitle={currentMonthLabel}
                icon="⬇️"
              />
              <StatCard
                title="Saídas no mês"
                value={currentMonthOutputs}
                subtitle={currentMonthLabel}
                icon="⬆️"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 18,
              }}
            >
              <QuickAction
                title="Pesquisar material"
                text="Encontre rápido por PN, descrição, localização ou observação."
                buttonText="Abrir pesquisa"
                onClick={() => setActiveTab("pesquisa")}
              />

              <QuickAction
                title="Registrar entrada ou saída"
                text="Lance movimentações do mês com quantidade, foto, data e usuário responsável."
                buttonText="Abrir movimentação"
                onClick={() => setActiveTab("movimentacao")}
              />

              <QuickAction
                title="Criar ou abrir inventário"
                text="Monte um novo inventário, continue um salvo ou adicione item pesquisado."
                buttonText="Abrir inventário"
                onClick={() => setActiveTab("inventario")}
              />
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
                          borderRadius: 18,
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
                          <div style={{ color: "#6b7280", marginTop: 4 }}>
                            PN: {item.pn}
                          </div>
                          <div style={{ color: "#6b7280", marginTop: 4 }}>
                            Usuário: {item.usuarioNome} • {formatDateTime(item.data)}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span
                            style={{
                              ...movementTypeStyle(item.tipo),
                              padding: "6px 12px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            {item.tipo}
                          </span>
                          <div style={{ fontWeight: 900, fontSize: 20 }}>
                            {item.quantidade}
                          </div>
                        </div>
                      </div>
                    ))}

                  <div style={{ marginTop: 6 }}>
                    <ActionButton kind="secondary" onClick={() => setActiveTab("movimentacao")}>
                      Ver todas as movimentações do mês
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    border: "1px dashed #cbd5e1",
                    borderRadius: 22,
                    padding: 28,
                    textAlign: "center",
                    color: "#64748b",
                    background: "#f8fafc",
                  }}
                >
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
              right={
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <ActionButton kind="secondary" onClick={exportMaterialsCsv}>
                    Exportar CSV
                  </ActionButton>
                </div>
              }
            >
              <div style={{ display: "grid", gap: 14 }}>
                <TextInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquise por PN, descrição, localização..."
                />

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filteredMaterials.map((item) => (
                    <button
                      key={item.pn}
                      onClick={() => setSelectedMaterialPn(item.pn)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "64px 1fr",
                        gap: 12,
                        alignItems: "center",
                        borderRadius: 20,
                        border:
                          selectedMaterialPn === item.pn
                            ? `2px solid ${CAT_YELLOW}`
                            : "1px solid #e5e7eb",
                        background: "white",
                        padding: 12,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          borderRadius: 16,
                          overflow: "hidden",
                          background: "#f3f4f6",
                          width: 64,
                          height: 64,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {item.foto ? (
                          <img
                            src={item.foto}
                            alt={item.descricao}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <span style={{ color: "#6b7280" }}>📦</span>
                        )}
                      </div>

                      <div>
                        <div style={{ fontWeight: 700 }}>{item.descricao}</div>
                        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>
                          PN: {item.pn}
                        </div>
                        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>
                          Loc.: {item.localizacao || "-"}
                        </div>
                      </div>
                    </button>
                  ))}

                  {!filteredMaterials.length && (
                    <div
                      style={{
                        border: "1px dashed #cbd5e1",
                        borderRadius: 20,
                        padding: 30,
                        textAlign: "center",
                        color: "#64748b",
                      }}
                    >
                      Nenhum material encontrado.
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            <Panel
              title="Detalhes do material"
              right={
                selectedMaterial ? (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <ActionButton
                      kind="secondary"
                      onClick={() => {
                        handleEditMaterial(selectedMaterial);
                      }}
                    >
                      Editar material
                    </ActionButton>

                    {canAccessInventario && currentInventory ? (
                      <ActionButton kind="success" onClick={addSearchedItemToInventory}>
                        Adicionar ao inventário
                      </ActionButton>
                    ) : null}
                  </div>
                ) : null
              }
            >
              {selectedMaterial ? (
                <div style={{ display: "grid", gap: 14 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "280px 1fr",
                      gap: 18,
                      alignItems: "start",
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 22,
                        overflow: "hidden",
                        border: "1px solid #e5e7eb",
                        background: "#f3f4f6",
                        minHeight: 260,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selectedMaterial.foto ? (
                        <img
                          src={selectedMaterial.foto}
                          alt={selectedMaterial.descricao}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <span style={{ color: "#6b7280", fontSize: 48 }}>📦</span>
                      )}
                    </div>

                    <div style={{ display: "grid", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>Descrição</div>
                        <div style={{ fontWeight: 800, fontSize: 24, marginTop: 4 }}>
                          {selectedMaterial.descricao}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 16,
                            padding: 14,
                          }}
                        >
                          <div style={{ fontSize: 12, color: "#6b7280" }}>PN</div>
                          <div style={{ fontWeight: 700, marginTop: 6 }}>
                            {selectedMaterial.pn}
                          </div>
                        </div>

                        <div
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 16,
                            padding: 14,
                          }}
                        >
                          <div style={{ fontSize: 12, color: "#6b7280" }}>Quantidade</div>
                          <div style={{ fontWeight: 700, marginTop: 6 }}>
                            {selectedMaterial.quantidade ?? 0}
                          </div>
                        </div>

                        <div
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 16,
                            padding: 14,
                          }}
                        >
                          <div style={{ fontSize: 12, color: "#6b7280" }}>Localização</div>
                          <div style={{ fontWeight: 700, marginTop: 6 }}>
                            {selectedMaterial.localizacao || "-"}
                          </div>
                        </div>

                        <div
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 16,
                            padding: 14,
                          }}
                        >
                          <div style={{ fontSize: 12, color: "#6b7280" }}>Status</div>
                          <div style={{ marginTop: 6 }}>
                            <span
                              style={{
                                ...statusStyle(selectedMaterial.status),
                                padding: "6px 10px",
                                borderRadius: 999,
                                fontWeight: 700,
                                fontSize: 12,
                              }}
                            >
                              {selectedMaterial.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 18,
                          padding: 14,
                        }}
                      >
                        <div style={{ fontSize: 12, color: "#6b7280" }}>Observação</div>
                        <div style={{ marginTop: 6, fontWeight: 600 }}>
                          {selectedMaterial.observacao || "Sem observações"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Panel title="Histórico do material">
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {(selectedMaterial.historico || []).length ? (
                        [...selectedMaterial.historico]
                          .sort((a, b) => new Date(b.data) - new Date(a.data))
                          .map((item) => (
                            <div
                              key={item.id}
                              style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: 18,
                                padding: 14,
                                background: "#fafafa",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  gap: 10,
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                <span
                                  style={{
                                    ...movementTypeStyle(item.acao),
                                    padding: "4px 10px",
                                    borderRadius: 999,
                                    fontSize: 12,
                                    fontWeight: 800,
                                  }}
                                >
                                  {item.acao}
                                </span>

                                <div style={{ fontWeight: 700 }}>{item.usuarioNome}</div>
                                <div style={{ color: "#6b7280" }}>
                                  Matrícula: {item.usuarioMatricula || "-"}
                                </div>
                              </div>

                              <div style={{ marginTop: 8, color: "#6b7280" }}>
                                {formatDateTime(item.data)}
                              </div>

                              <div style={{ marginTop: 8, fontWeight: 600 }}>
                                {item.detalhe || "-"}
                              </div>

                              {item.observacao ? (
                                <div style={{ marginTop: 8, color: "#6b7280" }}>
                                  Obs.: {item.observacao}
                                </div>
                              ) : null}

                              {item.foto ? (
                                <div
                                  style={{
                                    marginTop: 12,
                                    borderRadius: 16,
                                    overflow: "hidden",
                                    border: "1px solid #e5e7eb",
                                  }}
                                >
                                  <img
                                    src={item.foto}
                                    alt="Histórico"
                                    style={{
                                      width: "100%",
                                      maxHeight: 220,
                                      objectFit: "cover",
                                    }}
                                  />
                                </div>
                              ) : null}
                            </div>
                          ))
                      ) : (
                        <div
                          style={{
                            border: "1px dashed #cbd5e1",
                            borderRadius: 20,
                            padding: 24,
                            textAlign: "center",
                            color: "#64748b",
                          }}
                        >
                          Nenhum histórico ainda.
                        </div>
                      )}
                    </div>
                  </Panel>
                </div>
              ) : (
                <div
                  style={{
                    border: "1px dashed #cbd5e1",
                    borderRadius: 24,
                    background: "#f8fafc",
                    padding: 40,
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  Selecione um material na lista para ver os detalhes.
                </div>
              )}
            </Panel>
          </div>
        )}

        {activeTab === "inventario" && !canAccessInventario && (
          <LoginGate
            title="Área de Inventário"
            subtitle="Acesso restrito"
            onLogin={handleInventarioLogin}
            loginForm={inventarioLoginForm}
            setLoginForm={setInventarioLoginForm}
            errorMessage={inventarioLoginError}
          />
        )}

        {activeTab === "inventario" && canAccessInventario && (
          <Panel
            title="Controle de inventário"
            right={
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div
                  style={{
                    background: "#f3f4f6",
                    borderRadius: 16,
                    padding: "10px 14px",
                    fontWeight: 700,
                  }}
                >
                  👤 {authState.inventario?.nome}
                </div>
                <ActionButton kind="secondary" onClick={() => logoutArea("inventario")}>
                  Sair
                </ActionButton>
              </div>
            }
          >
            {!currentInventory ? (
              <div style={{ display: "grid", gap: 18 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                  }}
                >
                  <TextInput
                    value={newInventoryName}
                    onChange={(e) => setNewInventoryName(e.target.value)}
                    placeholder="Ex.: Inventário Abril 2026"
                    style={{ minHeight: 52 }}
                  />
                  <ActionButton onClick={startNewInventory}>Criar inventário</ActionButton>
                </div>

                <Panel title="Inventários salvos">
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {inventories.length ? (
                      inventories.map((inv) => (
                        <div
                          key={inv.id}
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 18,
                            padding: 14,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800 }}>{inv.nome}</div>
                            <div style={{ color: "#6b7280", marginTop: 4 }}>
                              Criado por: {inv.criadoPor || "-"}
                            </div>
                            <div style={{ color: "#6b7280", marginTop: 4 }}>
                              Atualizado em: {formatDateTime(inv.atualizadoEm)}
                            </div>
                            <div style={{ color: "#6b7280", marginTop: 4 }}>
                              Itens: {(inv.itens || []).length}
                            </div>
                          </div>

                          <ActionButton kind="secondary" onClick={() => openInventory(inv)}>
                            Abrir inventário
                          </ActionButton>
                        </div>
                      ))
                    ) : (
                      <div
                        style={{
                          border: "1px dashed #cbd5e1",
                          borderRadius: 20,
                          padding: 24,
                          textAlign: "center",
                          color: "#64748b",
                        }}
                      >
                        Nenhum inventário salvo.
                      </div>
                    )}
                  </div>
                </Panel>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 18 }}>
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 22,
                    padding: 18,
                    background: "#f8fafc",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Inventário atual</div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                    {currentInventory.nome}
                  </div>
                  <div style={{ color: "#6b7280", marginTop: 6 }}>
                    Criado por {currentInventory.criadoPor} em{" "}
                    {formatDateTime(currentInventory.criadoEm)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <ActionButton onClick={addManualItemToInventory}>
                    Adicionar item manual
                  </ActionButton>
                  <ActionButton kind="secondary" onClick={saveCurrentInventory}>
                    Salvar inventário
                  </ActionButton>
                  <ActionButton kind="success" onClick={finishCurrentInventory}>
                    Finalizar inventário
                  </ActionButton>
                  <ActionButton
                    kind="danger"
                    onClick={() => {
                      const confirmed = window.confirm(
                        "Deseja fechar o inventário atual sem apagar os dados salvos?"
                      );
                      if (!confirmed) return;
                      setCurrentInventory(null);
                    }}
                  >
                    Fechar inventário
                  </ActionButton>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {(currentInventory.itens || []).length ? (
                    currentInventory.itens.map((item) => (
                      <InventoryItemRow
                        key={item.id}
                        item={item}
                        onChange={(nextItem) => updateInventoryItem(item.id, nextItem)}
                        onRemove={() => removeInventoryItem(item.id)}
                      />
                    ))
                  ) : (
                    <div
                      style={{
                        border: "1px dashed #cbd5e1",
                        borderRadius: 20,
                        padding: 30,
                        textAlign: "center",
                        color: "#64748b",
                      }}
                    >
                      Nenhum item no inventário atual.
                    </div>
                  )}
                </div>
              </div>
            )}
          </Panel>
        )}

        {activeTab === "historico" && (
          <Panel title="Histórico geral de movimentações e ações">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {materials.some((item) => (item.historico || []).length > 0) ? (
                materials
                  .flatMap((material) =>
                    (material.historico || []).map((hist) => ({
                      ...hist,
                      pn: material.pn,
                      descricao: material.descricao,
                    }))
                  )
                  .sort((a, b) => new Date(b.data) - new Date(a.data))
                  .map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 18,
                        padding: 14,
                        background: "white",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            ...movementTypeStyle(item.acao),
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {item.acao}
                        </span>

                        <strong>{item.descricao}</strong>
                        <span style={{ color: "#6b7280" }}>PN: {item.pn}</span>
                      </div>

                      <div style={{ marginTop: 8, color: "#6b7280" }}>
                        {formatDateTime(item.data)}
                      </div>

                      <div style={{ marginTop: 8, fontWeight: 600 }}>
                        Usuário: {item.usuarioNome} | Matrícula:{" "}
                        {item.usuarioMatricula || "-"}
                      </div>

                      <div style={{ marginTop: 8 }}>{item.detalhe || "-"}</div>

                      {item.observacao ? (
                        <div style={{ marginTop: 8, color: "#6b7280" }}>
                          Obs.: {item.observacao}
                        </div>
                      ) : null}
                    </div>
                  ))
              ) : (
                <div
                  style={{
                    border: "1px dashed #cbd5e1",
                    borderRadius: 24,
                    background: "#f8fafc",
                    padding: 40,
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  Nenhum histórico registrado ainda.
                </div>
              )}
            </div>
          </Panel>
        )}

        {activeTab === "cadastro" && !canAccessMateriais && (
          <LoginGate
            title="Cadastro de materiais"
            subtitle="Login da área de materiais"
            onLogin={handleMateriaisLogin}
            loginForm={materiaisLoginForm}
            setLoginForm={setMateriaisLoginForm}
            errorMessage={materiaisLoginError}
          />
        )}

        {activeTab === "cadastro" && canAccessMateriais && (
          <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 20 }}>
            <Panel
              title={editingPn ? "Editar material" : "Cadastrar material"}
              right={
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div
                    style={{
                      background: "#f3f4f6",
                      borderRadius: 16,
                      padding: "10px 14px",
                      fontWeight: 700,
                    }}
                  >
                    👤 {authState.materiais?.nome}
                  </div>
                  <ActionButton kind="secondary" onClick={() => logoutArea("materiais")}>
                    Sair
                  </ActionButton>
                </div>
              }
            >
              <div style={{ display: "grid", gap: 14 }}>
                <div
                  style={{
                    background: "#fff7cc",
                    border: "1px solid #fde68a",
                    borderRadius: 18,
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 800 }}>Modelo CSV para importar</div>
                  <div style={{ color: "#6b7280", marginTop: 6 }}>
                    Cabeçalho esperado:
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: "monospace",
                      background: "white",
                      borderRadius: 12,
                      padding: 10,
                      fontSize: 13,
                    }}
                  >
                    {CSV_HEADERS_EXAMPLE}
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={importCsvFile}
                    />
                  </div>
                </div>

                <Field label="PN">
                  <TextInput
                    value={newMaterial.pn}
                    onChange={(e) =>
                      setNewMaterial((prev) => ({ ...prev, pn: e.target.value }))
                    }
                    placeholder="Digite o PN"
                  />
                </Field>

                <Field label="Descrição">
                  <TextInput
                    value={newMaterial.descricao}
                    onChange={(e) =>
                      setNewMaterial((prev) => ({
                        ...prev,
                        descricao: e.target.value,
                      }))
                    }
                    placeholder="Descrição do material"
                  />
                </Field>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <Field label="Localização">
                    <TextInput
                      value={newMaterial.localizacao}
                      onChange={(e) =>
                        setNewMaterial((prev) => ({
                          ...prev,
                          localizacao: e.target.value,
                        }))
                      }
                      placeholder="01.02.03.04"
                    />
                  </Field>

                  <Field label="Quantidade">
                    <TextInput
                      type="number"
                      value={newMaterial.quantidade}
                      onChange={(e) =>
                        setNewMaterial((prev) => ({
                          ...prev,
                          quantidade: e.target.value,
                        }))
                      }
                      placeholder="0"
                    />
                  </Field>
                </div>

                <Field label="Status">
                  <select
                    value={newMaterial.status}
                    onChange={(e) =>
                      setNewMaterial((prev) => ({ ...prev, status: e.target.value }))
                    }
                    style={{
                      width: "100%",
                      minHeight: 46,
                      borderRadius: 16,
                      border: "1px solid #d1d5db",
                      padding: "12px 14px",
                      fontSize: 16,
                      outline: "none",
                      background: "white",
                    }}
                  >
                    <option value="IDENTIFICADO">IDENTIFICADO</option>
                    <option value="SEM FOTO">SEM FOTO</option>
                    <option value="SEM LOCALIZAÇÃO">SEM LOCALIZAÇÃO</option>
                    <option value="COMPLETO">COMPLETO</option>
                  </select>
                </Field>

                <Field label="Observação">
                  <TextArea
                    rows={3}
                    value={newMaterial.observacao}
                    onChange={(e) =>
                      setNewMaterial((prev) => ({
                        ...prev,
                        observacao: e.target.value,
                      }))
                    }
                    placeholder="Observações"
                  />
                </Field>

                <InventoryPhotoInput
                  label="Foto do material"
                  foto={newMaterial.foto}
                  onChange={(foto) =>
                    setNewMaterial((prev) => ({ ...prev, foto }))
                  }
                />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <ActionButton onClick={saveMaterial}>
                    {editingPn ? "Atualizar material" : "Salvar material"}
                  </ActionButton>

                  <ActionButton kind="secondary" onClick={resetMaterialForm}>
                    Limpar
                  </ActionButton>
                </div>
              </div>
            </Panel>

            <Panel title="Lista de materiais cadastrados">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {materials.length ? (
                  materials.map((item) => (
                    <MaterialListItem
                      key={item.pn}
                      item={item}
                      onEdit={handleEditMaterial}
                      onDelete={deleteMaterial}
                    />
                  ))
                ) : (
                  <div
                    style={{
                      border: "1px dashed #cbd5e1",
                      borderRadius: 24,
                      background: "#f8fafc",
                      padding: 40,
                      textAlign: "center",
                      color: "#64748b",
                    }}
                  >
                    Nenhum material cadastrado ainda.
                  </div>
                )}
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "movimentacao" && !canAccessMateriais && (
          <LoginGate
            title="Entrada e Saída"
            subtitle="Login da área de materiais"
            onLogin={handleMateriaisLogin}
            loginForm={materiaisLoginForm}
            setLoginForm={setMateriaisLoginForm}
            errorMessage={materiaisLoginError}
          />
        )}

        {activeTab === "movimentacao" && canAccessMateriais && (
          <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 20 }}>
            <Panel
              title="Registrar entrada ou saída"
              right={
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div
                    style={{
                      background: "#f3f4f6",
                      borderRadius: 16,
                      padding: "10px 14px",
                      fontWeight: 700,
                    }}
                  >
                    👤 {authState.materiais?.nome}
                  </div>
                  <ActionButton kind="secondary" onClick={() => logoutArea("materiais")}>
                    Sair
                  </ActionButton>
                </div>
              }
            >
              <div style={{ display: "grid", gap: 14 }}>
                <Field label="Tipo da movimentação">
                  <select
                    value={movementForm.tipo}
                    onChange={(e) =>
                      setMovementForm((prev) => ({
                        ...prev,
                        tipo: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      minHeight: 46,
                      borderRadius: 16,
                      border: "1px solid #d1d5db",
                      padding: "12px 14px",
                      fontSize: 16,
                      outline: "none",
                      background: "white",
                    }}
                  >
                    <option value="SAÍDA">SAÍDA</option>
                    <option value="ENTRADA">ENTRADA</option>
                  </select>
                </Field>

                <Field label="PN">
                  <TextInput
                    value={movementForm.pn}
                    onChange={(e) =>
                      setMovementForm((prev) => ({
                        ...prev,
                        pn: e.target.value,
                      }))
                    }
                    placeholder="Digite o PN"
                  />
                </Field>

                {matchedMovementMaterial ? (
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 18,
                      padding: 14,
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>
                      {matchedMovementMaterial.descricao}
                    </div>
                    <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                      PN: {matchedMovementMaterial.pn}
                    </div>
                    <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                      Localização: {matchedMovementMaterial.localizacao || "Não informada"}
                    </div>
                    <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                      Quantidade atual cadastrada: {matchedMovementMaterial.quantidade ?? 0}
                    </div>
                  </div>
                ) : null}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <Field label="Quantidade">
                    <TextInput
                      type="number"
                      value={movementForm.quantidade}
                      onChange={(e) =>
                        setMovementForm((prev) => ({
                          ...prev,
                          quantidade: e.target.value,
                        }))
                      }
                      placeholder="0"
                    />
                  </Field>

                  <Field label="Data e hora">
                    <TextInput
                      type="datetime-local"
                      value={movementForm.data}
                      onChange={(e) =>
                        setMovementForm((prev) => ({
                          ...prev,
                          data: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>

                <Field label="Observação">
                  <TextArea
                    rows={3}
                    value={movementForm.observacao}
                    onChange={(e) =>
                      setMovementForm((prev) => ({
                        ...prev,
                        observacao: e.target.value,
                      }))
                    }
                    placeholder="Ex.: faturado, reposição, devolução..."
                  />
                </Field>

                <InventoryPhotoInput
                  label="Foto da movimentação"
                  foto={movementForm.foto}
                  onChange={(foto) =>
                    setMovementForm((prev) => ({ ...prev, foto }))
                  }
                />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <ActionButton onClick={registerMovement}>
                    Salvar movimentação
                  </ActionButton>

                  <ActionButton
                    kind="secondary"
                    onClick={() =>
                      setMovementForm({
                        tipo: "SAÍDA",
                        pn: "",
                        quantidade: "",
                        observacao: "",
                        foto: "",
                        data: new Date().toISOString().slice(0, 16),
                      })
                    }
                  >
                    Limpar
                  </ActionButton>
                </div>
              </div>
            </Panel>

            <Panel
              title="Movimentações do mês"
              right={
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <select
                    value={movementMonthFilter}
                    onChange={(e) => setMovementMonthFilter(e.target.value)}
                    style={{
                      minHeight: 44,
                      borderRadius: 14,
                      border: "1px solid #d1d5db",
                      padding: "10px 12px",
                      background: "white",
                    }}
                  >
                    {movementMonths.map((key) => (
                      <option key={key} value={key}>
                        {formatMonthLabel(key)}
                      </option>
                    ))}
                  </select>

                  <ActionButton kind="secondary" onClick={exportMovementsCsv}>
                    Exportar CSV
                  </ActionButton>
                </div>
              }
            >
              {filteredMovements.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {filteredMovements
                    .sort((a, b) => new Date(b.data) - new Date(a.data))
                    .map((item) => (
                      <div
                        key={item.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 22,
                          padding: 16,
                          background: "white",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 18 }}>
                              {item.descricao}
                            </div>
                            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                              PN: {item.pn}
                            </div>
                          </div>

                          <span
                            style={{
                              ...movementTypeStyle(item.tipo),
                              padding: "6px 12px",
                              borderRadius: 999,
                              fontWeight: 800,
                              fontSize: 12,
                            }}
                          >
                            {item.tipo}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: 12,
                            marginTop: 12,
                          }}
                        >
                          <div
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: 14,
                              padding: 12,
                            }}
                          >
                            <div style={{ fontSize: 12, color: "#6b7280" }}>
                              Quantidade
                            </div>
                            <div style={{ fontWeight: 700, marginTop: 6 }}>
                              {item.quantidade}
                            </div>
                          </div>

                          <div
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: 14,
                              padding: 12,
                            }}
                          >
                            <div style={{ fontSize: 12, color: "#6b7280" }}>
                              Usuário
                            </div>
                            <div style={{ fontWeight: 700, marginTop: 6 }}>
                              {item.usuarioNome}
                            </div>
                          </div>

                          <div
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: 14,
                              padding: 12,
                            }}
                          >
                            <div style={{ fontSize: 12, color: "#6b7280" }}>
                              Antes
                            </div>
                            <div style={{ fontWeight: 700, marginTop: 6 }}>
                              {item.quantidadeAntes}
                            </div>
                          </div>

                          <div
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: 14,
                              padding: 12,
                            }}
                          >
                            <div style={{ fontSize: 12, color: "#6b7280" }}>
                              Depois
                            </div>
                            <div style={{ fontWeight: 700, marginTop: 6 }}>
                              {item.quantidadeDepois}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: 14,
                            color: "#6b7280",
                            marginTop: 12,
                          }}
                        >
                          {formatDateTime(item.data)}
                        </div>

                        <div
                          style={{
                            fontSize: 14,
                            color: "#6b7280",
                            marginTop: 6,
                          }}
                        >
                          {item.observacao || "Sem observações"}
                        </div>

                        {item.foto ? (
                          <div
                            style={{
                              marginTop: 12,
                              borderRadius: 18,
                              overflow: "hidden",
                              border: "1px solid #e5e7eb",
                            }}
                          >
                            <img
                              src={item.foto}
                              alt="Movimentação"
                              style={{
                                width: "100%",
                                maxHeight: 240,
                                objectFit: "cover",
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                </div>
              ) : (
                <div
                  style={{
                    border: "1px dashed #cbd5e1",
                    borderRadius: 24,
                    background: "#f8fafc",
                    padding: 40,
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  Nenhuma movimentação registrada nesse mês.
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
